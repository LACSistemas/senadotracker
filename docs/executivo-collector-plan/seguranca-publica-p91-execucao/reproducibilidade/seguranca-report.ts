import { createReadStream, existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SEG_DEFS, VDE_ALIASES, VDE_BY_NATIVE, VDE_DEFS, VDE_EVENTS, normalizeName } from '../../packages/db/src/exec/index.ts';
import { dirSize, freeBytes, readManifest, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { UF_ACRONYM } from '../../apps/collector/src/exec/seguranca.ts';
import { openPool } from './db.ts';

/**
 * Relatórios de execução da P9.1 (somente leitura sobre o banco): cobertura SIM/VDE, reconciliação com Atlas e com o arquivo-fonte, crosswalk, armazenamento.
 * Uso: node --import tsx scripts/exec/seguranca-report.ts <pastaDeSaida> [--g0-before arquivo.json]
 */
const outDir = process.argv[2]; if (!outDir) throw new Error('informe a pasta de saída');
const beforePath = process.argv.includes('--g0-before') ? process.argv[process.argv.indexOf('--g0-before') + 1] : undefined;
const cfg = storageConfig(); const pool = openPool(3); await mkdir(outDir, { recursive: true });
const heavyDir = join(cfg.rootDir ?? '.', 'reports', 'seguranca-p91'); await mkdir(heavyDir, { recursive: true });
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (head: string[], rows: unknown[][]) => '\uFEFF' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n';
const q = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows;
const sha = (p: string) => new Promise<string>((ok, bad) => { const h = createHash('sha256'); createReadStream(p).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', bad); });
const summary: Record<string, unknown> = { at: new Date().toISOString() };
const GIB = 1024 ** 3;
try {
  const man = [...(await readManifest(cfg)).values()];
  // ------------------------------------------------------------------ cobertura_sim.csv
  const pubs = await q(`SELECT p.uf, p.competence, p.stage, p.run_id, p.activated_at, p.row_count, r.quality, r.inputs, r.status
    FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 15 ORDER BY p.uf, p.competence`);
  const simVals = await q(`SELECT v.indicator_id, e.uf_code, e.kind, extract(year FROM v.period_start)::int AS y, count(*) FILTER (WHERE v.value > 0)::int AS pos, count(*)::int AS n, sum(v.value) AS s
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE v.indicator_id IN (3001, 3011) GROUP BY 1, 2, 3, 4`);
  const munUniverse = new Map((await q(`SELECT uf_code, count(*)::int n FROM civica_exec.exec_entity WHERE kind = 4 GROUP BY 1`)).map(r => [Number(r.uf_code), Number(r.n)]));
  const get = (ind: number, uf: number, kind: number, y: number) => simVals.find(r => Number(r.indicator_id) === ind && Number(r.uf_code) === uf && Number(r.kind) === kind && Number(r.y) === y);
  const occPub = await q(`SELECT p.competence, p.stage, p.run_id, r.quality FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 16`);
  const simRows = pubs.map(p => {
    const ufc = Number(p.uf), y = Math.floor(Number(p.competence) / 100), ql = p.quality as Record<string, number & Record<string, number>>;
    const t = (ql.totals ?? {}) as unknown as Record<string, number>;
    const resMun = get(3001, ufc, 4, y), occMun = get(3011, ufc, 4, y);
    return [UF_ACRONYM[ufc], y, Number(p.stage) === 1 ? 'preliminar' : 'definitivo', (p.inputs as { file?: string })?.file ?? '', (p.inputs as { sim?: string })?.sim ?? '', ql.rowsRead, t.AGR, t.INT, t.GUE, t.IND, resMun?.pos ?? '', occMun?.pos ?? '', `${resMun?.n ?? 0}/${munUniverse.get(ufc) ?? ''}`, p.run_id, new Date(p.activated_at as string).toISOString()];
  });
  await writeFile(join(outDir, 'cobertura_sim.csv'), csv(['uf', 'ano', 'status', 'arquivo', 'sha256', 'registros_lidos', 'obitos_agressao', 'intervencao_legal', 'operacoes_guerra', 'intencao_indeterminada', 'municipios_residencia_com_obito_agressao', 'municipios_ocorrencia_com_obito_agressao', 'municipios_no_universo_publicado/universo_uf', 'run_id', 'publicado_em'], simRows));
  const simUfs = new Set(pubs.map(p => Number(p.uf))), simYears = new Set(pubs.map(p => Math.floor(Number(p.competence) / 100)));
  summary.sim = {
    ufs: simUfs.size, years: [...simYears].sort(), slicesResidence: pubs.length, slicesOccurrence: occPub.length, occurrenceYears: occPub.map(r => Math.floor(Number(r.competence) / 100)).sort(),
    municipalitiesWithResidenceRows: Number((await q(`SELECT count(DISTINCT v.entity_id)::int AS n FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 3001 AND e.kind = 4`))[0].n),
    municipalitiesWithResidenceDeaths: Number((await q(`SELECT count(DISTINCT v.entity_id)::int AS n FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 3001 AND e.kind = 4 AND v.value > 0`))[0].n),
    ignoredMunicipalityDeathsAgr: Number((await q(`SELECT coalesce(sum(v.value), 0) AS s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 3001 AND e.kind = 5`))[0].s),
    occurrenceUnplaced: occPub.map(r => ({ year: Math.floor(Number(r.competence) / 100), invalid: (r.quality as Record<string, number>).unplacedInvalidCode, unresolved: (r.quality as Record<string, number>).unplacedUnresolvedCode })),
  };

  // ------------------------------------------------------------------ reconciliação SIM × Atlas (arquivo preservado no RAW)
  const atlasRel = man.find(e => e.dataset === 'atlas_ipea')?.relPath ?? 'referencias/ipea/atlas-AVIOL12_HOMIC_2026-10-21.json';
  const atlasAbs = join(cfg.rawDir, atlasRel);
  let md = `# Reconciliação SIM × Atlas da Violência (P9.1)\n\nReferência: Ipeadata \`AVIOL12_HOMIC\` (arquivo preservado em \`${atlasRel.replace(/\\/g, '/')}\`, SHA-256 \`${existsSync(atlasAbs) ? await sha(atlasAbs) : 'n/d'}\`). O Atlas é derivado do SIM: serve como **conferência**, não como fonte independente. Comparação: **IND-SEG-SIM-ATL-RES** (X85–Y09 + Y35, município de residência; Y36 fica em indicador próprio) × valor do Atlas.\n\n`;
  const atlasRows: unknown[][] = [];
  if (existsSync(atlasAbs)) {
    const atlas = (JSON.parse(await readFile(atlasAbs, 'utf8')) as { value: Array<{ VALDATA: string; VALVALOR: number | null; NIVNOME: string; TERCODIGO: string }> }).value;
    const estados = new Map<string, number>(); const munis = new Map<string, number>();
    for (const a of atlas) { const y = a.VALDATA.slice(0, 4); if (a.NIVNOME === 'Estados') estados.set(`${a.TERCODIGO}|${y}`, Number(a.VALVALOR)); else if (/^Munic/.test(a.NIVNOME)) munis.set(`${a.TERCODIGO}|${y}`, Number(a.VALVALOR)); }
    const ours = await q(`SELECT e.kind, e.uf_code, e.ibge7, extract(year FROM v.period_start)::int AS y, v.value, v.status FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 3005 AND e.kind IN (3, 4)`);
    let ufOk = 0, ufN = 0; const ufDiff: string[] = [];
    for (const r of ours.filter(x => Number(x.kind) === 3)) {
      const y = Number(r.y), ref = estados.get(`${r.uf_code}|${y}`); if (ref == null) continue; ufN++;
      const ok = Number(r.value) === ref; if (ok) ufOk++; else ufDiff.push(`${UF_ACRONYM[Number(r.uf_code)]} ${y}: SIM ${r.value} × Atlas ${ref} (${Number(r.value) - ref >= 0 ? '+' : ''}${Number(r.value) - ref})`);
      atlasRows.push(['UF', UF_ACRONYM[Number(r.uf_code)], y, r.value, ref, Number(r.value) - ref, Number(r.status) === 1 ? 'preliminar' : 'definitivo']);
    }
    let mOk = 0, mN = 0; const mDiff = new Map<number, number>(); let mAbs = 0;
    for (const r of ours.filter(x => Number(x.kind) === 4)) {
      const y = Number(r.y), ref = munis.get(`${r.ibge7}|${y}`); if (ref == null) continue; mN++;
      if (Number(r.value) === ref) mOk++; else { mDiff.set(y, (mDiff.get(y) ?? 0) + 1); mAbs += Math.abs(Number(r.value) - ref); if (mDiff.size < 400) atlasRows.push(['município', r.ibge7, y, r.value, ref, Number(r.value) - ref, '']); }
    }
    md += `## Estados\n\n- Pares UF × ano comparáveis (Atlas disponível): **${ufN}**; idênticos: **${ufOk}** (${ufN ? (ufOk / ufN * 100).toFixed(1) : '0'} %).\n`;
    md += ufDiff.length ? `- Diferenças:\n${ufDiff.slice(0, 80).map(d => `  - ${d}`).join('\n')}\n` : '- Nenhuma diferença.\n';
    md += `\n## Municípios (residência)\n\n- Pares município × ano com Atlas: **${mN}**; idênticos: **${mOk}** (${mN ? (mOk / mN * 100).toFixed(2) : '0'} %); divergentes: ${mN - mOk} (soma absoluta das diferenças: ${mAbs} óbitos). Por ano: ${[...mDiff].sort().map(([y, n]) => `${y}: ${n}`).join('; ') || 'nenhuma'}.\n`;
    // consistência interna do próprio Atlas: a soma dos municípios de uma UF nunca pode superar o valor da UF (sobra = município ignorado)
    const incons: string[] = []; const sumMunAtlas = new Map<string, number>();
    for (const [k, v] of munis) { const [code, y] = k.split('|') as [string, string]; const kk = `${code!.slice(0, 2)}|${y}`; sumMunAtlas.set(kk, (sumMunAtlas.get(kk) ?? 0) + v); }
    const byYear = new Map<string, { over: number; ufs: number; sumMun: number; sumUf: number }>();
    for (const [kk, sm] of sumMunAtlas) { const y = kk.split('|')[1]!; const uf = estados.get(kk); if (uf == null) continue; const a = byYear.get(y) ?? { over: 0, ufs: 0, sumMun: 0, sumUf: 0 }; a.ufs++; a.sumMun += sm; a.sumUf += uf; if (sm > uf) a.over++; byYear.set(y, a); }
    for (const [y, a] of [...byYear].sort()) if (a.over > 0 && Number(y) >= 2013) incons.push(`${y}: Σ municípios do Atlas = ${a.sumMun} > Σ UFs do Atlas = ${a.sumUf} (${a.over} UFs com municípios somando mais que a UF)`);
    md += `- **Consistência interna do Atlas** (Σ municípios ≤ UF): ${incons.length ? `inconsistente em ${incons.length} ano(s): ${incons.join('; ')}. ${ufOk === ufN ? 'Nessas séries municipais a divergência não indica erro do SIM do Cívica, cujo total por UF coincide com o Atlas em todos os pares.' : 'Ver diferenças por UF acima.'}` : 'sem inconsistências.'}
`;
    // diferenças municipais fora dos anos em que o próprio Atlas é inconsistente: explicar pela única causa conhecida (Y36)
    const anomalyYears = new Set(incons.map(t => t.slice(0, 4)));
    const other = atlasRows.filter(r => r[0] === 'município' && !anomalyYears.has(String(r[2])));
    if (other.length) {
      const g = await q(`SELECT e.ibge7, extract(year FROM v.period_start)::int AS y, v.value FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 3003 AND e.kind = 4 AND v.value > 0`);
      md += `- Diferenças municipais fora dos anos inconsistentes do Atlas: ${other.map(r => { const y = g.find(x => String(x.ibge7) === String(r[1]) && Number(x.y) === Number(r[2])); return `${r[1]}/${r[2]} (SIM ${r[3]} × Atlas ${r[4]}${y ? `; o município tem ${y.value} óbito(s) Y36 — operações de guerra —, que o recorte do Cívica mantém fora da soma e o Atlas municipal parece incluir` : ''})`; }).join('; ')}.
`;
    }
    md += `- O Atlas redistribui por ano de referência do arquivo e pode usar versão diferente do SIM; as diferenças são listadas em \`reconciliacao_sim_atlas_detalhe.csv\` (limitado a 400 linhas municipais) sem ajustar nossos valores.\n`;
    summary.atlas = { ufPairs: ufN, ufIdentical: ufOk, munPairs: mN, munIdentical: mOk, munAbsDiff: mAbs };
    const es = ours.filter(x => Number(x.kind) === 3 && Number(x.uf_code) === 32 && [2023, 2024].includes(Number(x.y)));
    md += `\n## Controle documentado na P9 (Espírito Santo)\n\n| Ano | SIM (X85–Y09 + Y35) | Atlas | Igual |\n|---|---:|---:|---|\n${es.map(r => `| ${r.y} | ${r.value} | ${estados.get(`32|${r.y}`)} | ${Number(r.value) === estados.get(`32|${r.y}`) ? 'sim' : 'NÃO'} |`).join('\n')}\n`;
  } else md += '> Arquivo do Atlas ausente: reconciliação não executada.\n';
  md += `\n## Resíduo de causa indeterminada (Y10–Y34), residência, último ano publicado por UF\n\n| UF | Ano | Agressões (X85–Y09) | Indeterminadas | Proporção de indeterminadas |\n|---|---:|---:|---:|---:|\n`;
  const resid = await q(`SELECT e.uf, extract(year FROM a.period_start)::int AS y, a.value AS agr, i.value AS ind, p.value AS prop FROM civica_exec.exec_ind_value a JOIN civica_exec.exec_entity e USING (entity_id)
    JOIN civica_exec.exec_ind_value i ON i.entity_id = a.entity_id AND i.period_start = a.period_start AND i.indicator_id = 3004 LEFT JOIN civica_exec.exec_ind_value p ON p.entity_id = a.entity_id AND p.period_start = a.period_start AND p.indicator_id = 3008
    WHERE a.indicator_id = 3001 AND e.kind = 3 AND a.period_start = (SELECT max(period_start) FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = a.entity_id) ORDER BY e.uf`);
  md += resid.map(r => `| ${r.uf} | ${r.y} | ${r.agr} | ${r.ind} | ${r.prop == null ? '—' : Number(r.prop).toFixed(1) + ' %'} |`).join('\n') + '\n\nNenhuma indeterminada foi reclassificada como homicídio. 2025 é preliminar.\n';
  await writeFile(join(outDir, 'reconciliacao_sim_atlas.md'), md);
  await writeFile(join(outDir, 'reconciliacao_sim_atlas_detalhe.csv'), csv(['nivel', 'territorio', 'ano', 'sim_atl', 'atlas', 'diferenca', 'status'], atlasRows));

  // ------------------------------------------------------------------ VDE: cobertura (UF × ano × evento) e mensal (SSD)
  const covs = await q(`SELECT c.uf, c.indicator_id, c.competence, c.mun_pairs, c.src_lines, c.dup_lines, c.nz_rows, c.uf_total, c.unassigned, c.status FROM civica_exec.exec_seg_cov c ORDER BY c.uf, c.indicator_id, c.competence`);
  const defById = new Map(SEG_DEFS.map(d => [d.id, d]));
  const monthly = [['uf', 'competencia', 'indicador', 'codigo', 'granularidade', 'unidade', 'total_uf', 'municipios_no_arquivo', 'chaves_com_valor', 'valor_municipio_ignorado', 'linhas_fonte', 'linhas_repetidas_somadas', 'status_cobertura']];
  type Agg = { n: number; ok: number; amb: number; total: number; unassigned: number; maxPairs: number; dup: number; nz: number };
  const yearly = new Map<string, Agg>();
  for (const c of covs) {
    const d = defById.get(Number(c.indicator_id))!, y = Math.floor(Number(c.competence) / 100), uf = UF_ACRONYM[Number(c.uf)]!;
    monthly.push([uf, c.competence, d.label, d.code, d.granularity, d.unit, c.uf_total, c.mun_pairs, c.nz_rows, c.unassigned, c.src_lines, c.dup_lines, Number(c.status) === 1 ? 'com_registros' : 'zero_ou_sem_relato']);
    const k = `${uf}|${y}|${c.indicator_id}`; const a = yearly.get(k) ?? { n: 0, ok: 0, amb: 0, total: 0, unassigned: 0, maxPairs: 0, dup: 0, nz: 0 };
    a.n++; if (Number(c.status) === 1) a.ok++; else a.amb++; a.total += Number(c.uf_total); a.unassigned += Number(c.unassigned); a.maxPairs = Math.max(a.maxPairs, Number(c.mun_pairs)); a.dup += Number(c.dup_lines); a.nz += Number(c.nz_rows); yearly.set(k, a);
  }
  await writeFile(join(heavyDir, 'cobertura_vde_mensal.csv'), monthly.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  const yRows = [...yearly].map(([k, a]) => { const [uf, y, id] = k.split('|'); const d = defById.get(Number(id))!; return [uf, Number(y), d.label, d.code, d.granularity, d.unit, a.n, a.ok, a.amb, a.total, a.maxPairs, a.nz, a.unassigned, a.dup, d.source, 'dnsp-base-de-dados/bancovde-' + y + '.xlsx']; });
  await writeFile(join(outDir, 'cobertura_vde.csv'), csv(['uf', 'ano', 'evento', 'codigo_indicador', 'granularidade', 'tipo_de_medida', 'competencias_publicadas', 'competencias_com_registros', 'competencias_zeradas_ou_sem_relato', 'quantidade_no_periodo', 'municipios_no_arquivo_max', 'chaves_municipais_com_valor_total', 'valor_no_municipio_ignorado', 'linhas_repetidas_somadas', 'fonte', 'arquivo'], yRows));
  const vdeMonths = [...new Set(covs.map(c => Number(c.competence)))].sort();
  summary.vde = {
    ufs: new Set(covs.map(c => Number(c.uf))).size, years: [...new Set(vdeMonths.map(m => Math.floor(m / 100)))], competencesPublished: vdeMonths.length, firstMonth: vdeMonths[0], lastMonth: vdeMonths.at(-1),
    eventsMunicipal: VDE_EVENTS.filter(e => e.level === 'M').length, eventsUfOnly: VDE_EVENTS.filter(e => e.level === 'U').length, indicatorsPublished: new Set(covs.map(c => Number(c.indicator_id))).size,
    covRows: covs.length, ambiguousUfMonths: covs.filter(c => Number(c.status) === 2).length, dupLines: covs.reduce((n, c) => n + Number(c.dup_lines), 0), rowsInIgnoredMunicipality: covs.filter(c => Number(c.unassigned) > 0).length,
  };

  // ------------------------------------------------------------------ reconciliação VDE: banco × arquivo-fonte (cache de extração em fluxo, independente do caminho de leitura do banco)
  const vdeEntries = man.filter(e => e.dataset === 'sinesp_vde').sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
  const latestByYear = new Map<number, typeof vdeEntries[number]>(); for (const e of vdeEntries) latestByYear.set(Math.floor((e.competence ?? 0) / 100), e);
  const dbTot = await q(`SELECT v.indicator_id, extract(year FROM v.period_start)::int AS y, sum(v.value) FILTER (WHERE e.kind = 3) AS uf_sum, sum(v.value) FILTER (WHERE e.kind = 4) AS mun_sum, sum(v.value) FILTER (WHERE e.kind = 5) AS ign_sum
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id BETWEEN 3101 AND 3141 AND v.period_end - v.period_start BETWEEN 28 AND 31 GROUP BY 1, 2`);
  let rmd = `# Reconciliação Sinesp VDE (P9.1)\n\nCada arquivo anual foi lido em fluxo, **independentemente** do banco, e seus totais por evento foram comparados com o publicado em \`exec_ind_value\` (linha da UF) e com a soma de municípios + município ignorado.\n\n`;
  const vrows: unknown[][] = []; let allMatch = true; const stage = cfg.stagingDir; const stagedFiles = existsSync(stage) ? await readdir(stage) : [];
  const natByEvent = new Map<string, number>();
  for (const [y, e] of [...latestByYear].sort((a, b) => a[0] - b[0])) {
    const cacheName = stagedFiles.find(f => f.startsWith(`vde_${y}_${e.sha256.slice(0, 12)}_`)); if (!cacheName) { rmd += `- ${y}: cache de extração ausente.\n`; continue; }
    const j = JSON.parse(await readFile(join(stage, cacheName), 'utf8')) as { cov: Array<{ uf: string; evento: string; comp: number; abr: string; vit: number; tot: number; peso: number; dup: number; lin: number }>; rows_read: number; competences: number[] };
    const empty = new Set<number>(); const sumByComp = new Map<number, number>(); for (const c of j.cov) sumByComp.set(c.comp, (sumByComp.get(c.comp) ?? 0) + Math.abs(c.vit) + Math.abs(c.tot) + Math.abs(c.peso));
    for (const [m, v] of sumByComp) if (v === 0) empty.add(m);
    const fileTot = new Map<number, number>();
    for (const c of j.cov) { if (empty.has(c.comp)) continue; const ev = VDE_BY_NATIVE.get(c.evento); if (!ev) continue; const abr = c.abr === 'Estadual' ? 'E' : c.abr === 'Polícia Federal' ? 'F' : 'R'; const id = ev.abr[abr]; if (!id) continue; fileTot.set(id, (fileTot.get(id) ?? 0) + (ev.measure === 'vit' ? c.vit : ev.measure === 'tot' ? c.tot : c.peso)); }
    for (const id of [...fileTot.keys()].sort()) {
      const d = defById.get(id)!; const db = dbTot.find(r => Number(r.indicator_id) === id && Number(r.y) === y);
      const ufSum = db ? Number(db.uf_sum) : 0, mun = db ? Number(db.mun_sum ?? 0) + Number(db.ign_sum ?? 0) : 0; const ft = fileTot.get(id)!;
      const okUf = Math.abs(ufSum - ft) <= 1e-6 * Math.max(1, Math.abs(ft)); const okMun = d.granularity === 'uf' || Math.abs(mun - ft) <= 1e-6 * Math.max(1, Math.abs(ft));
      if (!okUf || !okMun) allMatch = false;
      vrows.push([y, d.code, d.label, d.granularity, d.unit, ft, ufSum, d.granularity === 'municipio' ? mun : '', db ? Number(db.ign_sum ?? 0) : 0, okUf && okMun ? 'igual' : 'DIVERGE']);
      if (y === 2025 && d.code.endsWith('-E')) natByEvent.set(d.label, ft);
    }
    rmd += `- **${y}**: arquivo \`${e.relPath}\` (SHA-256 \`${e.sha256.slice(0, 16)}…\`), ${j.rows_read} linhas, competências ${j.competences.filter(m => !empty.has(m)).length} publicadas${empty.size ? ` (meses vazios descartados: ${[...empty].join(', ')})` : ''}.\n`;
  }
  rmd += `\n**Resultado:** ${allMatch ? 'todos os totais por ano e evento coincidem (arquivo = linha da UF = Σ municípios + município ignorado).' : 'HÁ DIVERGÊNCIAS — ver tabela.'}\n\n`;
  rmd += `## Total nacional 2025 (Σ das 27 UFs, abrangência Estadual) — eventos com município\n\n| Evento | Total 2025 |\n|---|---:|\n${[...natByEvent].filter(([l]) => /Homic|Feminic|Latroc|Lesão|Suic|Tentativa/.test(l)).map(([l, v]) => `| ${l} | ${v} |`).join('\n')}\n\nCompare: P9 registrou, no arquivo de 2025, homicídio doloso 31.518, feminicídio 1.578 e latrocínio 805 vítimas.\n`;
  // comparação com a publicação oficial: Mapa da Segurança Pública 2026 (MJSP), dados do Sinesp extraídos em 25/02/2026 (valores nacionais de 2025)
  const MAPA: Array<[string, number, number[]]> = [
    ['Homicídio doloso (vítimas)', 31448, [3101]], ['Tentativa de homicídio (vítimas)', 34199, [3102]], ['Feminicídio (vítimas)', 1548, [3105]], ['Lesão corporal seguida de morte (vítimas)', 644, [3104]],
    ['Morte por intervenção de agente do Estado (vítimas; Estadual + PF + PRF)', 6583, [3132, 3133, 3134]], ['Morte no trânsito ou em decorrência dele, exceto homicídio doloso (vítimas)', 25030, [3109]],
    ['Suicídio de agente do Estado (vítimas; Estadual + PF)', 132, [3130, 3131]], ['Morte de agente do Estado (vítimas; Estadual + PF)', 187, [3128, 3129]],
  ];
  const nat = await q(`SELECT v.indicator_id, sum(v.value) AS s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 3 AND v.period_start >= '2025-01-01' AND v.period_start < '2026-01-01' AND v.period_end - v.period_start BETWEEN 28 AND 31 AND v.indicator_id BETWEEN 3101 AND 3141 GROUP BY 1`);
  rmd += `## Comparação com a publicação oficial (Mapa da Segurança Pública 2026, ano 2025)\n\nO Mapa (MJSP) usa o Sinesp com **data de extração 25/02/2026**; o arquivo do VDE lido pelo Cívica é o publicado em 21/10/2026, depois de revisões das UFs. Diferenças pequenas são esperadas e **não foram ajustadas**.\n\n| Indicador (Brasil, 2025) | Mapa 2026 | VDE em 21/10/2026 | Diferença |\n|---|---:|---:|---:|\n`;
  for (const [label, ref, ids] of MAPA) { const ours = ids.reduce((n, id) => n + Number(nat.find(r => Number(r.indicator_id) === id)?.s ?? 0), 0); rmd += `| ${label} | ${ref} | ${ours} | ${ours - ref >= 0 ? '+' : ''}${ours - ref} (${((ours - ref) / ref * 100).toFixed(2)} %) |\n`; }
  rmd += `\n`;
  rmd += `\n## Zero estrutural e zero ambíguo\n\n- Combinações evento × abrangência sem nenhum valor ≠ 0 em 2015–2026 (zero estrutural, não publicadas): ${['Furto de veículo / PF', 'Roubo de veículo / PF', 'Roubo de carga / PF', 'Roubo a instituição financeira / PF', 'Morte de agente do Estado / PRF', 'Suicídio de agente do Estado / PRF'].join('; ')}.\n- Meses de UF × evento com total zero (zero reportado ou ausência de relato; a fonte não distingue): **${(summary.vde as { ambiguousUfMonths: number }).ambiguousUfMonths}** de ${covs.length} registros de cobertura.\n- Apreensão de cocaína e de maconha usam \`total_peso\`; \`total\` vem zerado no arquivo (correção à leitura da P9, que classificou o evento como 100 % zero).\n- Linhas repetidas na mesma chave somadas: ${(summary.vde as { dupLines: number }).dupLines} (DF informa por região administrativa sob o nome BRASÍLIA).\n`;
  await writeFile(join(outDir, 'reconciliacao_vde.md'), rmd);
  await writeFile(join(outDir, 'reconciliacao_vde_totais.csv'), csv(['ano', 'codigo', 'evento', 'granularidade', 'unidade', 'total_arquivo', 'total_uf_banco', 'soma_municipios_mais_ignorado', 'valor_no_municipio_ignorado', 'resultado'], vrows));
  summary.vdeReconciliation = { rows: vrows.length, allMatch };

  // ------------------------------------------------------------------ crosswalk (auditoria completa)
  const ents = await q(`SELECT e.entity_id, e.uf, e.name, e.ibge7, coalesce(v.evidence_ref LIKE '%NÃO comprovada%', false) AS unproven FROM civica_exec.exec_entity e LEFT JOIN civica_exec.exec_entity_version v ON v.entity_id = e.entity_id AND v.valid_to IS NULL WHERE e.kind = 4`);
  const key = new Map<string, typeof ents[number]>(); for (const e of ents) key.set(`${e.uf}|${normalizeName(String(e.name))}`, e);
  const alias = new Map(VDE_ALIASES.map(a => [`${a.uf}|${normalizeName(a.source)}`, a]));
  const pairsByYear = new Map<number, Record<string, [number, number]>>();
  for (const [y, e] of latestByYear) { const f = stagedFiles.find(n => n.startsWith(`vde_${y}_${e.sha256.slice(0, 12)}_`)); if (!f) continue; const j = JSON.parse(await readFile(join(stage, f), 'utf8')) as { pairs?: Record<string, [number, number]> }; if (j.pairs) pairsByYear.set(y, j.pairs); }
  const crow: unknown[][] = []; const seen = new Set<string>(); let direct = 0, viaAlias = 0, unassigned = 0, unmatched = 0, validPairs = 0, totalPairs = 0;
  const anyYear = [...pairsByYear.keys()].sort()[0]; const universe = new Map<string, number>();
  for (const [y, p] of pairsByYear) for (const [k, v] of Object.entries(p)) { universe.set(k, (universe.get(k) ?? 0) + v[0]); void y; }
  for (const [k, lines] of [...universe].sort()) {
    const [uf, name] = k.split('|') as [string, string]; totalPairs++;
    if (name === 'NÃO INFORMADO') { unassigned++; crow.push([uf, name, '', '', '', 'nao_informado', 'valores vão ao município ignorado da UF; nunca viram município', lines]); continue; }
    validPairs++; const nk = `${uf}|${normalizeName(name)}`; const al = alias.get(nk); const e = key.get(nk);
    if (al) { viaAlias++; const t = key.get(`${uf}|${normalizeName(al.canonical)}`); seen.add(`${uf}|${normalizeName(al.canonical)}`); crow.push([uf, name, t?.name ?? '', t?.ibge7 ?? '', t?.entity_id ?? '', 'alias_validado', `${al.rule}; ${al.evidence}; validado em ${al.validated}; versão vde-xw-v1`, lines]); }
    else if (e) { direct++; seen.add(nk); crow.push([uf, name, e.name, e.ibge7, e.entity_id, 'direto', 'nome normalizado igual (UF + nome)', lines]); }
    else { unmatched++; crow.push([uf, name, '', '', '', 'NAO_CONCILIADO', 'valores vão ao município ignorado da UF', lines]); }
  }
  let ibgeWithoutPair = 0;
  for (const e of ents) if (!seen.has(`${e.uf}|${normalizeName(String(e.name))}`)) { ibgeWithoutPair++; crow.push([e.uf, '', e.name, e.ibge7, e.entity_id, 'ibge_sem_par_no_vde', e.unproven ? 'data de instalação não comprovada; não aparece no universo do VDE; nenhuma série foi inventada' : 'sem par no VDE', 0]); }
  await writeFile(join(outDir, 'crosswalk_vde_ibge.csv'), csv(['uf', 'nome_na_fonte', 'municipio_ibge', 'ibge7', 'entity_id', 'metodo', 'regra_evidencia', 'chaves_no_arquivo(soma_dos_anos)'], crow));
  summary.crosswalk = { yearsInspected: [...pairsByYear.keys()].sort(), firstYear: anyYear, totalPairs, validNamePairs: validPairs, matchedDirect: direct, matchedAlias: viaAlias, unmatched, unassignedPairs: unassigned, ibgeEntitiesWithoutVdePair: ibgeWithoutPair, entities: ents.length };

  // ------------------------------------------------------------------ armazenamento_execucao.csv
  const before = beforePath ? JSON.parse(await readFile(beforePath, 'utf8')) as { database: { bytes: string }; execSchemaBytes: number; walBytes: { b: string }; ssd: { freeGiB: number }; pgFreeGiB: number; at: string } : null;
  const dbNow = (await q(`SELECT pg_database_size(current_database())::bigint AS b`))[0].b; const schemaNow = Number((await q(`SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS b FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'civica_exec' AND c.relkind IN ('r', 'm')`))[0].b);
  const walNow = (await q(`SELECT wal_bytes::text AS b FROM pg_stat_wal`))[0].b;
  const rel = async (name: string) => (await q(`SELECT pg_total_relation_size($1::regclass)::bigint AS total, pg_relation_size($1::regclass)::bigint AS heap, pg_indexes_size($1::regclass)::bigint AS idx`, [`civica_exec.${name}`]))[0];
  const counts = (await q(`SELECT (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 3001 AND 3015)::bigint AS sim, (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 3101 AND 3208)::bigint AS vde,
    (SELECT count(*) FROM civica_exec.exec_seg_cov)::bigint AS cov, (SELECT count(*) FROM civica_exec.exec_ind_latest WHERE indicator_id BETWEEN 3001 AND 3208)::bigint AS latest,
    (SELECT count(*) FROM civica_exec.exec_change_log l JOIN civica_exec.exec_ingestion_run r USING (run_id) WHERE r.dataset_id IN (15, 16, 17))::bigint AS log,
    (SELECT count(*) FROM civica_exec.exec_ind_value)::bigint AS ind_all`))[0];
  const runs = await q(`SELECT dataset_id, count(*)::int AS runs, coalesce(sum(extract(epoch FROM finished_at - started_at)), 0)::numeric(12,1) AS secs, coalesce(sum(rows_out), 0)::bigint AS rows FROM civica_exec.exec_ingestion_run WHERE dataset_id IN (15, 16, 17) AND status = 9 GROUP BY 1 ORDER BY 1`);
  const ind = await rel('exec_ind_value'), lat = await rel('exec_ind_latest'), cov = await rel('exec_seg_cov'), lg = await rel('exec_change_log');
  const rawSeg = await dirSize(join(cfg.rawDir, 'seguranca')); const rawRef = await dirSize(join(cfg.rawDir, 'referencias', 'ipea')); const stagingNow = await dirSize(cfg.stagingDir);
  const rows: unknown[][] = [
    ['postgres_banco_bytes', 'antes', before?.database.bytes ?? '', 'pg_database_size'], ['postgres_banco_bytes', 'depois', dbNow, 'pg_database_size'], ['postgres_schema_civica_exec_bytes', 'antes', before?.execSchemaBytes ?? '', 'soma pg_total_relation_size'], ['postgres_schema_civica_exec_bytes', 'depois', schemaNow, 'soma pg_total_relation_size'],
    ['exec_ind_value_total_bytes', 'depois', ind.total, `heap ${ind.heap} + índices ${ind.idx}; ${counts.ind_all} linhas no total`], ['exec_ind_latest_total_bytes', 'depois', lat.total, ''], ['exec_seg_cov_total_bytes', 'depois', cov.total, `${counts.cov} linhas`], ['exec_change_log_total_bytes', 'depois', lg.total, `${counts.log} linhas de log pertencem à Segurança`],
    ['linhas_exec_ind_value_sim', 'depois', counts.sim, 'indicadores 3001–3015'], ['linhas_exec_ind_value_vde', 'depois', counts.vde, 'indicadores 3101–3208'], ['linhas_exec_seg_cov', 'depois', counts.cov, ''], ['linhas_exec_ind_latest_seguranca', 'depois', counts.latest, ''],
    ['bytes_por_linha_ind_value_medido', 'depois', Number(ind.total) / Number(counts.ind_all), 'total da tabela ÷ linhas (inclui índices)'],
    ['wal_bytes_gerados', 'delta', before ? BigInt(walNow) - BigInt(before.walBytes.b) : '', 'pg_stat_wal.wal_bytes (inclui qualquer outra atividade do cluster no período)'],
    ['raw_ssd_seguranca_bytes', 'depois', rawSeg, 'D:\\Civica\\raw\\seguranca (XLSX do VDE)'], ['raw_ssd_referencias_ipea_bytes', 'depois', rawRef, 'Atlas/Ipeadata para reconciliação'], ['raw_sim_novo_bytes', 'depois', 0, 'RAW do SIM reutilizado; nenhuma cópia nova'], ['staging_ssd_bytes', 'depois', stagingNow, 'caches JSON agregados de extração'],
    ['ssd_livre_gib', 'antes', before?.ssd.freeGiB ?? '', ''], ['ssd_livre_gib', 'depois', Number((await freeBytes(cfg.rawDir) / GIB).toFixed(1)), ''], ['disco_postgres_livre_gib', 'antes', before?.pgFreeGiB ?? '', ''], ['disco_postgres_livre_gib', 'depois', Number((await freeBytes(cfg.pgProbeDir) / GIB).toFixed(1)), ''],
    ...runs.map(r => [`runs_dataset_${r.dataset_id}`, 'depois', r.rows, `${r.runs} publicações (execuções publicadas, incluindo ensaios no banco real quando houver)`]),
  ];
  await writeFile(join(outDir, 'armazenamento_execucao.csv'), csv(['medida', 'momento', 'valor', 'observacao'], rows));
  summary.storage = { dbBytesBefore: before?.database.bytes, dbBytesAfter: String(dbNow), schemaBytesBefore: before?.execSchemaBytes, schemaBytesAfter: schemaNow, indValueBytes: Number(ind.total), covBytes: Number(cov.total), changeLogBytes: Number(lg.total), simRows: String(counts.sim), vdeRows: String(counts.vde), covRows: String(counts.cov), rawSegBytes: rawSeg, stagingBytes: stagingNow, walDelta: before ? String(BigInt(walNow) - BigInt(before.walBytes.b)) : null, runs };
  await writeFile(join(outDir, 'summary_relatorio.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  void stat; void appendFile;
} finally { await pool.end(); }
void VDE_DEFS;
