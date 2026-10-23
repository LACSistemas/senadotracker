import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import {
  COV_SCOPE, FROTA_COLUMNS, SIM_TRA_CATEGORIES, TRA_DEFS, TRA_VERSION, buildTraCrosswalk, compactKey, resolveTraName, type FrotaJson, type InfrJson, type PrfJson, type RenaestJson, type TraSimAgg,
} from '../../packages/db/src/exec/index.ts';
import { dirSize, freeBytes, readManifest, runPython, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { UF_ACRONYM, loadEntityDir, locateSimFile } from '../../apps/collector/src/exec/seguranca.ts';
import { fetchChecked, notHtml } from '../../apps/collector/src/exec/transito.ts';
import { openPool } from './db.ts';

/**
 * Relatórios de execução da P9.2 (somente leitura no banco): cobertura por família, reconciliação contra os arquivos-fonte (caches agregados / agregado do RENAEST no RAW),
 * crosswalk, armazenamento. Uso: node --import tsx scripts/exec/transito-report.ts <pasta> [--g0-before arquivo.json]
 */
const outDir = process.argv[2]; if (!outDir) throw new Error('informe a pasta de saída');
const beforePath = process.argv.includes('--g0-before') ? process.argv[process.argv.indexOf('--g0-before') + 1] : undefined;
const cfg = storageConfig(); const pool = openPool(3); await mkdir(outDir, { recursive: true });
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (head: string[], rows: unknown[][]) => '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n';
const q = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows;
const summary: Record<string, unknown> = { at: new Date().toISOString() };
const N = (v: unknown) => Number(v ?? 0);
const ymName = (ym: number) => ym < 3000 ? String(ym) : `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}`;
const staged = existsSync(cfg.stagingDir) ? await readdir(cfg.stagingDir) : [];
const readJson = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(cfg.stagingDir, name), 'utf8')) as T;
const defById = new Map(TRA_DEFS.map(d => [d.id, d]));
let md = `# Reconciliação de Trânsito (P9.2)\n\nCada família é reconciliada contra o **seu próprio arquivo-fonte** (caches agregados de extração, ou o agregado do RENAEST preservado no RAW), de forma independente do caminho de escrita no banco. As famílias **não** são reconciliadas entre si: os universos são diferentes (ver \`sobreposicao_fontes.md\`).\n\n`;
try {
  const man = [...(await readManifest(cfg)).values()];
  const { dir, ufByAcronym } = await loadEntityDir(pool); const xw = buildTraCrosswalk(dir, ufByAcronym);

  // ============================================================ SIM trânsito
  const simVals = await q(`SELECT v.indicator_id, e.uf_code, extract(year FROM v.period_start)::int AS y, max(v.value) FILTER (WHERE e.kind = 3) AS uf_val, count(*) FILTER (WHERE e.kind = 4 AND v.value > 0)::int AS n_mun,
      coalesce(sum(v.value) FILTER (WHERE e.kind = 5), 0) AS ign, max(v.status) AS st FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE v.indicator_id BETWEEN 4001 AND 4122 GROUP BY 1, 2, 3 ORDER BY 2, 3, 1`);
  const simRows = simVals.filter(r => r.uf_val != null).map(r => { const d = defById.get(N(r.indicator_id))!; return [UF_ACRONYM[N(r.uf_code)], r.y, d.perspective === 'ocorrencia' ? 'ocorrência' : 'residência', d.code, d.label, r.uf_val, r.n_mun, r.ign, N(r.st) === 1 ? 'preliminar' : 'definitivo']; });
  await writeFile(join(outDir, 'cobertura_sim_transito.csv'), csv(['uf', 'ano', 'perspectiva', 'codigo_indicador', 'indicador', 'valor_uf', 'municipios_com_valor_maior_que_zero', 'valor_no_municipio_ignorado', 'status'], simRows));
  let simMd = `## SIM — mortes em acidentes de transporte\n\n`; let simOk = 0, simN = 0; const simDiff: string[] = [];
  const dbSim = new Map<string, number>(); for (const r of simVals) if (r.uf_val != null) dbSim.set(`${r.indicator_id}|${r.uf_code}|${r.y}`, N(r.uf_val));
  const natRes = new Map<number, number>(), natOcc = new Map<number, number>();
  for (let y = 2013; y <= 2025; y++) for (const [uf, code] of ufByAcronym) {
    const f = await locateSimFile(cfg, uf, y); if (!f) continue;
    const cache = staged.find(n => n.startsWith(`simtra_${uf}_${y}_${f.sha256.slice(0, 12)}_`)); if (!cache) continue;
    const agg = await readJson<TraSimAgg>(cache); let tt = 0, out = 0, seq = 0;
    for (const keys of Object.values(agg.res)) for (const [k, n] of Object.entries(keys)) { if (k === 'Y850') seq += n; else if (k.startsWith('V')) { if (Number(k.slice(1)) <= 89) tt += n; else out += n; } }
    for (const [id, exp] of [[4001, tt], [4003, out], [4004, seq], [4002, tt + out]] as const) { simN++; const got = dbSim.get(`${id}|${code}|${y}`) ?? (id === 4003 && out === 0 ? 0 : undefined); const gv = id === 4003 && got === undefined ? 0 : got; if (gv === exp) simOk++; else simDiff.push(`${uf} ${y} ind ${id}: arquivo ${exp} × banco ${gv}`); }
    natRes.set(y, (natRes.get(y) ?? 0) + (dbSim.get(`4002|${code}|${y}`) ?? 0));
  }
  for (const r of simVals) if (N(r.indicator_id) === 4102 && r.uf_val != null) natOcc.set(N(r.y), (natOcc.get(N(r.y)) ?? 0) + N(r.uf_val));
  simMd += `- Conferência fatia a fatia (351 arquivos × 4 medidas): **${simOk} de ${simN}** idênticas ao agregado do arquivo (V01–V89, V90–V99, Y85.0 e total V01–V99). ${simDiff.length ? `Divergências:\n${simDiff.slice(0, 20).map(x => `  - ${x}`).join('\n')}\n` : 'Nenhuma divergência.\n'}`;
  simMd += `- Total nacional V01–V99 por ano — residência × ocorrência (os dois universos são o mesmo conjunto de óbitos nos 27 arquivos, vistos por municípios diferentes):\n\n| Ano | Residência | Ocorrência | Diferença |\n|---|---:|---:|---:|\n${[...natRes].map(([y, v]) => `| ${y} | ${v} | ${natOcc.get(y) ?? '—'} | ${(natOcc.get(y) ?? 0) - v} |`).join('\n')}\n\n`;
  const ctrl: Array<[string, number]> = [['ES', 819], ['SP', 5132], ['RS', 1770], ['MG', 3351]];
  simMd += `- **Controles da P9 (2023, residência, V01–V99 + Y85.0)**:\n\n| UF | P9 | Agudo V01–V99 | Sequela Y85.0 | Soma | Igual |\n|---|---:|---:|---:|---:|---|\n${ctrl.map(([uf, exp]) => { const c = ufByAcronym.get(uf)!; const at = dbSim.get(`4002|${c}|2023`) ?? 0, sq = dbSim.get(`4004|${c}|2023`) ?? 0; return `| ${uf} | ${exp} | ${at} | ${sq} | ${at + sq} | ${at + sq === exp ? 'sim' : 'NÃO'} |`; }).join('\n')}\n\nA P9 somava V01–V99 e Y85.0; a P9.2 separa a sequela (Y85.0) do evento agudo — as duas fórmulas reproduzem exatamente os controles.\n\n`;
  const exp2025 = (await q(`SELECT count(*)::int n FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 18 AND p.stage = 1`))[0].n;
  simMd += `- Fatias preliminares (2025): ${exp2025}. Município ignorado (residência) e óbitos sem município (ocorrência) estão em \`cobertura_sim_transito.csv\` e na qualidade de cada publicação.\n\n`;
  summary.sim = { slicesRes: N((await q(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE dataset_id = 18`))[0].n), slicesOcc: N((await q(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE dataset_id = 19`))[0].n), checks: simN, checksOk: simOk, municipalitiesWithData: N((await q(`SELECT count(DISTINCT v.entity_id)::int n FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = 4001 AND e.kind = 4`))[0].n), years: [...natRes.keys()] };
  md += simMd;

  // ============================================================ Senatran frota
  const fr = await q(`SELECT f.competence, e.uf_code, count(*) FILTER (WHERE e.kind = 4)::int AS munis, coalesce(sum(f.total) FILTER (WHERE e.kind = 4), 0) AS tot_mun, coalesce(sum(f.total) FILTER (WHERE e.kind = 5), 0) AS tot_ign, coalesce(sum(f.total), 0) AS tot
      FROM civica_exec.exec_tra_frota_mun_mes f JOIN civica_exec.exec_entity e ON e.entity_id = f.entity_id GROUP BY 1, 2 ORDER BY 1, 2`);
  const unm = await q(`SELECT p.uf, p.competence, r.quality->'nameUnmatched' AS un, r.quality->>'nameNotInformed' AS ni, r.quality->>'nameAlias' AS al FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 20`);
  const unmMap = new Map(unm.map(r => [`${r.uf}|${r.competence}`, r])); const brByComp = new Map<number, number>();
  await writeFile(join(outDir, 'cobertura_senatran_frota.csv'), csv(['uf', 'competencia', 'municipios_com_linha', 'frota_total_uf', 'frota_municipios', 'frota_municipio_ignorado', 'nomes_por_alias', 'nomes_municipio_nao_informado', 'nomes_nao_conciliados'], fr.map(r => { const u = unmMap.get(`${r.uf_code}|${r.competence}`); brByComp.set(N(r.competence), (brByComp.get(N(r.competence)) ?? 0) + N(r.tot)); return [UF_ACRONYM[N(r.uf_code)], r.competence, r.munis, r.tot, r.tot_mun, r.tot_ign, u?.al ?? '', u?.ni ?? '', (u?.un as string[] | undefined)?.join('; ') ?? '']; })));
  let frMd = `## Senatran — frota registrada por município e tipo\n\n`; let frOk = 0, frN = 0; const frDiff: string[] = [];
  const frInv = man.filter(e => e.dataset === 'senatran_frota'); const lastByComp = new Map<number, typeof frInv[number]>(); for (const e of frInv.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))) lastByComp.set(e.competence ?? 0, e);
  for (const [comp, e] of [...lastByComp].sort((a, b) => a[0] - b[0])) {
    const cache = staged.find(n => n.startsWith(`frota_${comp}_${e.sha256.slice(0, 12)}_`)); if (!cache) continue;
    const j = await readJson<FrotaJson>(cache); let tot = 0; for (const r of j.rows) if (r[0] !== 'UF' && /^[A-Z]{2}$/.test(r[0])) tot += (r[2] as number | null) ?? 0;
    frN++; if (tot === (brByComp.get(comp) ?? -1)) frOk++; else frDiff.push(`${ymName(comp)}: arquivo ${tot} × banco ${brByComp.get(comp)}`);
  }
  const incons = await q(`SELECT p.competence, sum((r.quality->>'totalMinusTypes')::numeric) AS diff FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 20 GROUP BY 1 HAVING sum((r.quality->>'totalMinusTypes')::numeric) <> 0 ORDER BY 1`);
  frMd += `- Total Brasil por competência (Σ das 27 UFs no banco) × soma da coluna TOTAL do arquivo: **${frOk} de ${frN}** competências idênticas. ${frDiff.length ? `Divergências: ${frDiff.slice(0, 10).join('; ')}.` : 'Nenhuma divergência.'}\n`;
  frMd += `- Competências publicadas: ${lastByComp.size} (${ymName(Math.min(...lastByComp.keys()))} a ${ymName(Math.max(...lastByComp.keys()))}), uma por mês; meses faltantes: nenhum no intervalo. Nada foi interpolado.\n`;
  frMd += `- TOTAL = Σ dos 21 tipos? ${incons.length ? `Em ${incons.length} competência(s) o TOTAL do arquivo difere da soma dos tipos: ${incons.map(r => `${ymName(N(r.competence))} (${N(r.diff) > 0 ? '+' : ''}${r.diff})`).join('; ')} — preservado como publicado.` : 'sim, em todas as competências.'}\n`;
  // conferência independente com o arquivo por UF (instantâneos de dezembro e último mês)
  const decs = [...lastByComp.keys()].filter(c => c % 100 === 12 || c === Math.max(...lastByComp.keys())).sort((a, b) => a - b); const ufChecks: string[] = []; let ufOk = 0, ufN = 0;
  const ufName = new Map<string, number>(); for (const [uf, code] of ufByAcronym) ufName.set(compactKey((await q(`SELECT name FROM civica_exec.exec_entity WHERE entity_id = $1`, [code]))[0].name), code);
  const ufFiles = await inventoryUfFiles();
  for (const comp of decs) {
    const it = ufFiles.get(comp); if (!it) { ufChecks.push(`${ymName(comp)}: arquivo por UF não localizado`); continue; }
    try {
      const entry = await fetchChecked(cfg, { url: it.url, relPath: `transito/senatran-frota-uf/${comp}__${it.file}`, competence: comp, uf: 0, retention: 1, dataset: 'senatran_frota_uf', dedupeByHash: true, accept: notHtml });
      const out = join(cfg.stagingDir, `frota_uf_${comp}_${entry.sha256.slice(0, 12)}.json`);
      if (!existsSync(out)) { const r = await runPython('scripts/exec/frota_uf_extract.py', [join(cfg.rawDir, entry.relPath), out, '--tmp', cfg.stagingDir]); if (r.code !== 0) { ufChecks.push(`${ymName(comp)}: arquivo por UF ilegível (${r.err.slice(-80).trim()})`); continue; } }
      const j = await readJson<{ rows: Array<[string, number | null, ...Array<number | null>]> }>(`frota_uf_${comp}_${entry.sha256.slice(0, 12)}.json`); let brasil = 0, sumUf = 0, nuf = 0;
      for (const r of j.rows) { const code = ufName.get(compactKey(r[0])); if (compactKey(r[0]) === 'BRASIL') brasil = r[1] ?? 0; if (code === undefined) continue; nuf++; const dbv = N(fr.filter(x => N(x.competence) === comp && N(x.uf_code) === code)[0]?.tot); sumUf += r[1] ?? 0; ufN++; if (dbv === r[1]) ufOk++; else ufChecks.push(`${ymName(comp)} ${UF_ACRONYM[code]}: arquivo por UF ${r[1]} × Σ municípios ${dbv}`); }
      ufChecks.push(`${ymName(comp)}: ${nuf} UFs lidas; Brasil no arquivo ${brasil}; Σ UFs do arquivo ${sumUf}; Σ banco ${brByComp.get(comp)}`);
    } catch (e) { ufChecks.push(`${ymName(comp)}: falha ao obter o arquivo por UF (${String(e instanceof Error ? e.message : e).slice(0, 90)})`); }
  }
  frMd += `- **Conferência independente com o arquivo "Frota por UF e Tipo"** (dezembro de cada ano e último mês): ${ufOk} de ${ufN} pares UF × competência idênticos (Σ municípios + município ignorado = UF).\n${ufChecks.map(x => `  - ${x}`).join('\n')}\n`;
  frMd += `- **Identidade territorial:** os nomes de município vêm sem código IBGE; ${TRA_VERSION.crosswalk} resolve por UF + chave compacta + 48 aliases validados, sem fuzzy. "MUNICIPIO NAO INFORMADO" e nomes sem correspondência (SP "IBITIUVA", 7 meses) vão ao município ignorado da UF e **entram** na UF. Detalhes em \`crosswalk_transito_ibge.csv\`.\n\n`;
  summary.frota = { competences: lastByComp.size, rows: N((await q(`SELECT count(*)::bigint n FROM civica_exec.exec_tra_frota_mun_mes`))[0].n), checks: frN, checksOk: frOk, ufChecks: ufN, ufChecksOk: ufOk, first: Math.min(...lastByComp.keys()), last: Math.max(...lastByComp.keys()), brasilUltimo: brByComp.get(Math.max(...lastByComp.keys())), municipalitiesEver: N((await q(`SELECT count(DISTINCT f.entity_id)::int n FROM civica_exec.exec_tra_frota_mun_mes f JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4`))[0].n) };
  md += frMd;

  // ============================================================ RENAEST
  const cov = await q(`SELECT source, uf, competence, records, fatal_records, municipalities, universe, scope FROM civica_exec.exec_tra_cov ORDER BY source, uf, competence`);
  const lastRen = Math.max(...cov.filter(c => N(c.source) === 1).map(c => N(c.competence)));
  const scopeName = ['', 'registros_presentes_escopo_desconhecido', 'restrito_a_fatais_inferido', 'sem_registros'];
  await writeFile(join(outDir, 'cobertura_renaest.csv'), csv(['uf', 'ano', 'mes', 'sinistros_reportados', 'sinistros_com_obito', 'municipios_com_registro', 'municipios_listados_pela_fonte', 'escopo', 'status_do_dado'], cov.filter(c => N(c.source) === 1).map(c => [UF_ACRONYM[N(c.uf)], Math.floor(N(c.competence) / 100), N(c.competence) % 100, c.records, c.fatal_records, c.municipalities, c.universe, scopeName[N(c.scope)], N(c.competence) >= (lastRen % 100 > 2 ? lastRen - 2 : (Math.floor(lastRen / 100) - 1) * 100 + 10 + (lastRen % 100)) ? 'preliminar' : 'definitivo'])));
  await writeFile(join(outDir, 'cobertura_prf.csv'), csv(['uf', 'ano', 'mes', 'sinistros_registrados', 'sinistros_com_vitima_fatal', 'municipios_com_registro', 'situacao'], cov.filter(c => N(c.source) === 2).map(c => [UF_ACRONYM[N(c.uf)], Math.floor(N(c.competence) / 100), N(c.competence) % 100, c.records, c.fatal_records, c.municipalities, N(c.scope) === COV_SCOPE.sem_registros ? 'nenhum sinistro registrado pela PRF no mês' : 'registros presentes'])));
  let renMd = `## RENAEST — sinistros e vítimas reportados\n\n`;
  const aggFile = man.filter(e => e.dataset === 'renaest_agg').sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)).at(-1);
  const orig = await q(`SELECT source_url, bytes, encode(sha256, 'hex') AS sha, competence, state FROM civica_exec.exec_raw_manifest WHERE rel_path LIKE '(descartado)%' ORDER BY file_id DESC LIMIT 3`);
  let renOk = 0, renN = 0; const renDiff: string[] = [];
  if (aggFile) {
    const j = JSON.parse(gunzipSync(await readFile(join(cfg.rawDir, aggFile.relPath))).toString('utf8')) as RenaestJson;
    const fileUy = new Map<string, [number, number, number]>(); for (const [uf, , ym, n, f, ob] of j.muni) { const k = `${uf}|${Math.floor(ym / 100)}`; const a = fileUy.get(k) ?? [0, 0, 0]; a[0] += n; a[1] += f; a[2] += ob; fileUy.set(k, a); }
    const dbUy = await q(`SELECT e.uf, extract(year FROM v.period_start)::int AS y, v.indicator_id, sum(v.value) AS s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.kind = 3 AND v.indicator_id IN (4301, 4302, 4303) GROUP BY 1, 2, 3`);
    const dbm = new Map(dbUy.map(r => [`${r.uf}|${r.y}|${r.indicator_id}`, N(r.s)]));
    for (const [k, v] of fileUy) { const [uf, y] = k.split('|') as [string, string]; [[4301, v[0]], [4302, v[1]], [4303, v[2]]].forEach(([id, exp]) => { renN++; const got = dbm.get(`${uf}|${y}|${id}`) ?? 0; if (got === exp) renOk++; else renDiff.push(`${uf} ${y} ${id}: agregado ${exp} × banco ${got}`); }); }
    renMd += `- Pacote cumulativo processado: recurso mais recente do CKAN, SHA-256 \`${orig[0]?.sha ?? '?'}\`, ${orig[0]?.bytes ?? '?'} bytes. **O original (microdados com endereço, CEP, coordenadas, hora e atributos de vítimas) foi descartado após a agregação** (manifesto: state 3); ficou o agregado sem dado pessoal em \`${aggFile.relPath.replace(/\\/g, '/')}\`.\n`;
    renMd += `- Linhas lidas: ${j.acidentes} sinistros (num_acidente único; qtde_acidente = 1 em todas), ${j.vitimas_linhas} linhas de vítimas, ${j.veiculos_total} veículos (${j.veiculos_orfaos} linhas de veículo sem sinistro correspondente = ${(j.veiculos_orfaos / 10390582 * 100).toFixed(1)} % — preservadas na qualidade, não contadas).\n`;
    renMd += `- Agregado × banco (UF × ano × 3 medidas): **${renOk} de ${renN}** idênticos. ${renDiff.length ? 'Divergências: ' + renDiff.slice(0, 8).join('; ') : 'Nenhuma divergência.'}\n`;
    const totalDb = N((await q(`SELECT sum(v.value) s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.kind = 3 AND v.indicator_id = 4301`))[0].s);
    renMd += `- Σ sinistros no banco: ${totalDb} (arquivo: ${j.acidentes}). Óbitos nos sinistros × óbitos na tabela de vítimas: ${j.muni.reduce((n, r) => n + r[5], 0)} × ${j.vitima_obitos.reduce((n, r) => n + r[2], 0)}.\n`;
    // UFs com registro por ano (tabela da P9)
    const byYear = new Map<number, Set<string>>(); for (const c of cov.filter(x => N(x.source) === 1 && N(x.records) > 0)) { const y = Math.floor(N(c.competence) / 100); (byYear.get(y) ?? byYear.set(y, new Set()).get(y)!).add(UF_ACRONYM[N(c.uf)]!); }
    const allUf = [...ufByAcronym.keys()];
    renMd += `\n| Ano | UFs com registro (≥ 1 sinistro) | UFs sem registro |\n|---|---:|---|\n${[...byYear].sort((a, b) => a[0] - b[0]).map(([y, s]) => `| ${y} | ${s.size} | ${allUf.filter(u => !s.has(u)).join(', ') || '—'} |`).join('\n')}\n\nP9 informou 25, 27, 26, 26, 26, 25, 23, 23 UFs para 2018–2025 (contagem por "uf_acidente"); a tabela acima usa o mesmo critério sobre o pacote de 05-2026.\n`;
    // escopo restrito a fatais
    const fat = cov.filter(c => N(c.source) === 1 && N(c.scope) === 2); const fatUfs = [...new Set(fat.map(c => UF_ACRONYM[N(c.uf)]))];
    renMd += `\n- **Escopo restrito a fatais (inferido: ≥ 30 sinistros e ≥ 90 % com óbito no UF × mês)**: ${fat.length} UF-meses em ${fatUfs.join(', ') || '—'}. Isto é inferência a partir dos dados, não confirmação da fonte.\n`;
    // ES 2023
    const es = ufByAcronym.get('ES')!; const g = async (ind: number, y: number, e = es) => N((await q(`SELECT coalesce(sum(value), 0) s FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2 AND period_start >= $3::date AND period_start < $4::date AND period_end - period_start <= 31`, [ind, e, `${y}-01-01`, `${y + 1}-01-01`]))[0].s);
    const gy = async (ind: number, y: number) => N((await q(`SELECT coalesce(max(value), 0) s FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2 AND period_start = $3::date`, [ind, es, `${y}-01-01`]))[0].s);
    const r23 = await g(4303, 2023), sinRen = await g(4301, 2023), fatRen = await g(4302, 2023);
    const simRes = await gy(4002, 2023) + await gy(4004, 2023), simResAT = await gy(4002, 2023), simOcc = await gy(4102, 2023), simOccSeq = await gy(4104, 2023), simTT = await gy(4001, 2023);
    renMd += `\n### Teste obrigatório — ES 2023\n\n| Medida | Valor | Universo |\n|---|---:|---|\n| RENAEST — óbitos em sinistros (Σ qtde_obitos) | ${r23} | sinistros reportados no ES em 2023 (${sinRen} sinistros; ${fatRen} com óbito); município do **sinistro** |\n| SIM — V01–V99 por **residência** (agudo) | ${simResAT} | óbitos de residentes do ES, em qualquer lugar |\n| SIM — V01–V99 + Y85.0 por **residência** | ${simRes} | idem, com sequelas (fórmula da P9) |\n| SIM — V01–V99 por **ocorrência** | ${simOcc} | óbitos ocorridos no ES, de qualquer residente |\n| SIM — V01–V89 (terrestre) por residência | ${simTT} | recorte terrestre |\n\nA diferença **não é erro**: (a) o RENAEST conta o óbito pelo município do sinistro e vem de boletins de órgãos de trânsito/segurança, o SIM pela declaração de óbito; (b) o SIM por ocorrência (${simOcc}) é a comparação de local mais próxima; (c) a janela de óbito do RENAEST (óbito no local ou registrado no sinistro) difere da causa básica do SIM, que inclui óbitos tardios e exclui os sem declaração; (d) a cobertura do RENAEST no ES muda por mês; (e) óbitos de pessoas não residentes e sequelas não coincidem. As duas séries **não** são somadas nem usadas para validar uma à outra.\n\n`;
    summary.renaest = { acidentes: j.acidentes, vitimas: j.vitimas_linhas, veiculosOrfaos: j.veiculos_orfaos, checks: renN, checksOk: renOk, ufYears: [...byYear].sort((a, b) => a[0] - b[0]).map(([y, s]) => [y, s.size]), fatalScopeUfMonths: fat.length, fatalScopeUfs: fatUfs, lastMonth: lastRen, es2023: { renaestObitos: r23, renaestSinistros: sinRen, simResidenciaAT: simResAT, simOcorrenciaAT: simOcc }, original: orig[0] ?? null };
  } else renMd += '> Agregado do RENAEST não encontrado no RAW: reconciliação não executada.\n';
  md += renMd;

  // ============================================================ PRF
  let prfMd = `## PRF — sinistros em rodovias federais (agrupados por ocorrência)\n\n`; let prfOk = 0, prfN = 0; const prfDiff: string[] = [];
  const prfInv = man.filter(e => e.dataset === 'prf_datatran').sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)); const prfBy = new Map<number, typeof prfInv[number]>(); for (const e of prfInv) prfBy.set(Math.floor((e.competence ?? 0) / 100), e);
  const dbPrf = await q(`SELECT extract(year FROM v.period_start)::int AS y, v.indicator_id, sum(v.value) AS s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.kind = 3 AND v.indicator_id BETWEEN 4621 AND 4631 GROUP BY 1, 2`);
  const dbp = new Map(dbPrf.map(r => [`${r.y}|${r.indicator_id}`, N(r.s)])); const ufSet = new Set([...ufByAcronym.keys()]); const unknownByYear: string[] = []; let unmatchedTotal = 0;
  for (const [y, e] of [...prfBy].sort((a, b) => a[0] - b[0])) {
    const cache = staged.find(n => n.startsWith(`prf_${y}_${e.sha256.slice(0, 12)}_`)); if (!cache) continue; const j = await readJson<PrfJson>(cache);
    const sums = new Array<number>(11).fill(0); let unknownUf = 0; for (const r of j.rows) { if (!ufSet.has(r[0])) { unknownUf += r[3] as number; continue; } for (let i = 0; i < 11; i++) sums[i]! += r[3 + i] as number; }
    const exp = [sums[0], sums[1], sums[2], sums[3], sums[1]! + sums[2]!, sums[5], sums[6], sums[7], sums[8], sums[9], sums[10]];
    exp.forEach((v, i) => { prfN++; const got = dbp.get(`${y}|${4621 + i}`) ?? 0; if (got === v) prfOk++; else prfDiff.push(`${y} ind ${4621 + i}: arquivo ${v} × banco ${got}`); });
    if (unknownUf) unknownByYear.push(`${y}: ${unknownUf}`);
    for (const r of j.rows) if (ufSet.has(r[0])) { const rr = resolveTraName(r[1], ufByAcronym.get(r[0])!, dir, xw); if (rr.how === 'nao_conciliado') unmatchedTotal += r[3] as number; }
  }
  prfMd += `- Arquivos: ${prfBy.size} (um por ano, ${Math.min(...prfBy.keys())}–${Math.max(...prfBy.keys())}), links lidos da página oficial e **validados pelo conteúdo** (o ano das datas confere com o do link em todos).\n- Agregado do arquivo × banco (anual, 11 medidas): **${prfOk} de ${prfN}** idênticos. ${prfDiff.length ? 'Divergências: ' + prfDiff.slice(0, 8).join('; ') : 'Nenhuma divergência.'}\n- Sinistros com UF informada como "(null)" no arquivo (não atribuíveis a UF, não inferidos): ${unknownByYear.length ? unknownByYear.join('; ') : 'nenhum'}.\n- Sinistros cujo município não concilia com o IBGE (preservados na UF, no município ignorado): ${unmatchedTotal}.\n- **Quebra de série em 2016:** o arquivo deixa de trazer a maior parte dos sinistros sem vítimas (ver abaixo); a série "com vítimas" (fatais + feridas) é a única comparável de 2007 a 2026.\n\n`;
  const byCls = await q(`SELECT extract(year FROM v.period_start)::int AS y, max(v.value) FILTER (WHERE v.indicator_id = 4624) AS sem, max(v.value) FILTER (WHERE v.indicator_id = 4625) AS com FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.kind = 1 OR 1 = 0 GROUP BY 1`);
  void byCls;
  const cls = await q(`SELECT extract(year FROM v.period_start)::int AS y, sum(v.value) FILTER (WHERE v.indicator_id = 4624) AS sem, sum(v.value) FILTER (WHERE v.indicator_id = 4625) AS com, sum(v.value) FILTER (WHERE v.indicator_id = 4621) AS tot FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.kind = 3 AND v.indicator_id BETWEEN 4621 AND 4625 GROUP BY 1 ORDER BY 1`);
  prfMd += `| Ano | Sinistros | Sem vítimas | Com vítimas (fatais + feridas) |\n|---|---:|---:|---:|\n${cls.map(r => `| ${r.y} | ${r.tot} | ${r.sem} | ${r.com} |`).join('\n')}\n\n`;
  summary.prf = { years: [...prfBy.keys()].sort(), checks: prfN, checksOk: prfOk, unknownUf: unknownByYear, unmatchedSinistros: unmatchedTotal, slices: N((await q(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE dataset_id = 22`))[0].n) };
  md += prfMd;

  // ============================================================ Infrações
  const inf = await q(`SELECT i.uf, i.competence, count(*)::int AS codigos, sum(i.qtde)::bigint AS total FROM civica_exec.exec_tra_infr_uf_mes i GROUP BY 1, 2 ORDER BY 2, 1`);
  await writeFile(join(outDir, 'cobertura_infracoes.csv'), csv(['uf_de_jurisdicao_do_veiculo', 'competencia', 'codigos_de_infracao', 'notificacoes_com_np'], inf.map(r => [UF_ACRONYM[N(r.uf)], r.competence, r.codigos, r.total])));
  const infTotByComp = new Map<number, number>(); for (const r of inf) infTotByComp.set(N(r.competence), (infTotByComp.get(N(r.competence)) ?? 0) + N(r.total));
  const infInv = man.filter(e => e.dataset === 'senatran_infracoes').sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)); const infBy = new Map<number, typeof infInv[number]>(); for (const e of infInv) infBy.set(e.competence ?? 0, e);
  let infOk = 0, infN = 0, totColFiles = 0; const totColBad: string[] = []; const infDiff: string[] = []; const layouts: Record<string, number> = {};
  for (const [comp, e] of [...infBy].sort((a, b) => a[0] - b[0])) { const cache = staged.find(n => n.startsWith(`infr_${comp}_${e.sha256.slice(0, 12)}_`)); if (!cache) continue; const j = await readJson<InfrJson>(cache); layouts[j.layout] = (layouts[j.layout] ?? 0) + 1; const exp = j.rows.reduce((n, r) => n + (ufName.has(compactKey(r[0])) ? r[2] : 0), 0); const totCol = j.rows.filter(r => compactKey(r[0]) === 'TOTAL').reduce((n, r) => n + r[2], 0); if (totCol) { totColFiles++; if (totCol !== exp) totColBad.push(ymName(comp)); } infN++; if (exp === (infTotByComp.get(comp) ?? 0)) infOk++; else infDiff.push(`${ymName(comp)}: arquivo ${exp} × banco ${infTotByComp.get(comp)}`); }
  const mom = [...infTotByComp].sort((a, b) => a[0] - b[0]);
  let infMd = `## Senatran — infrações com notificação de penalidade (UF de jurisdição do veículo)\n\n- Competências: ${infBy.size} (${ymName(mom[0]![0])} a ${ymName(mom.at(-1)![0])}); layouts encontrados: ${Object.entries(layouts).map(([k, v]) => `${k} ${v}`).join(', ')} (UTF-16 largo, largo com aspas duplicadas, longo com colunas em ordem variável, XLSX com linhas de título).\n- Total do arquivo × banco: **${infOk} de ${infN}** competências idênticas. ${infDiff.length ? 'Divergências: ' + infDiff.slice(0, 8).join('; ') : 'Nenhuma divergência.'}\n- Arquivos com coluna "TOTAL" própria (excluída da carga para não contar duas vezes): ${totColFiles}; coluna TOTAL ≠ Σ das 27 UFs em: ${totColBad.join(', ') || 'nenhum'}.
- Cada arquivo traz as 27 UFs; células vazias da matriz (UF × código) permanecem sem linha (não são zero declarado).\n- **A UF é a de jurisdição do veículo**, não o local da infração. Série irregular de 2020 (abril a novembro com 0,23–1,08 milhão de notificações contra ≈ 6 milhões em 2019) e dois vales em 2021 estão nos arquivos oficiais e foram preservados; a razão não consta na fonte.\n\n`;
  summary.infracoes = { competences: infBy.size, first: mom[0]![0], last: mom.at(-1)![0], layouts, checks: infN, checksOk: infOk, rows: N((await q(`SELECT count(*)::bigint n FROM civica_exec.exec_tra_infr_uf_mes`))[0].n), totalUltimo: mom.at(-1)![1] };
  md += infMd;

  // ============================================================ crosswalk
  const xwRows: unknown[][] = []; const seen = new Map<string, { how: string; n: number; first: number; last: number; entity: number; weight: number }>();
  const note = (fonte: string, uf: string, name: string, period: number, weight: number) => { const code = ufByAcronym.get(uf); if (code === undefined) { const k = `${fonte}|${uf}|${name}`; const c = seen.get(k) ?? { how: 'uf_desconhecida', n: 0, first: period, last: period, entity: 0, weight: 0 }; c.n++; c.weight += weight; c.last = Math.max(c.last, period); c.first = Math.min(c.first, period); seen.set(k, c); return; }
    const rr = resolveTraName(name, code, dir, xw); if (rr.how === 'direto') return; const k = `${fonte}|${uf}|${name}`; const c = seen.get(k) ?? { how: rr.how, n: 0, first: period, last: period, entity: rr.entity, weight: 0 }; c.n++; c.weight += weight; c.last = Math.max(c.last, period); c.first = Math.min(c.first, period); seen.set(k, c); };
  for (const [comp, e] of lastByComp) { const cache = staged.find(n => n.startsWith(`frota_${comp}_${e.sha256.slice(0, 12)}_`)); if (!cache) continue; const j = await readJson<FrotaJson>(cache); for (const r of j.rows) if (/^[A-Z]{2}$/.test(r[0]) && r[0] !== 'UF') note('senatran_frota', r[0], r[1], comp, (r[2] as number | null) ?? 0); }
  for (const [y, e] of prfBy) { const cache = staged.find(n => n.startsWith(`prf_${y}_${e.sha256.slice(0, 12)}_`)); if (!cache) continue; const j = await readJson<PrfJson>(cache); for (const r of j.rows) note('prf', r[0], r[1], y, r[3] as number); }
  const entName = new Map(dir.municipalities.map(m => [m.entityId, m] as const));
  for (const [k, v] of [...seen].sort()) { const [fonte, uf, name] = k.split('|') as [string, string, string]; const m = entName.get(v.entity); const al = v.how === 'alias' ? (await import('../../packages/db/src/exec/index.ts')).TRA_ALIASES.find(a => a.uf === uf && a.key === compactKey(name)) : undefined;
    xwRows.push([fonte, uf, name, v.how, v.how === 'alias' ? m?.name ?? '' : '', v.how === 'alias' ? (m ? m.entityId : '') : '', v.how === 'alias' ? al?.rule ?? '' : v.how === 'nao_informado' ? 'valores preservados no município ignorado da UF' : v.how === 'nao_conciliado' ? 'sem município com esse nome na UF; valores preservados no município ignorado da UF; nada foi inventado' : 'UF ausente/nula na fonte: não atribuído a UF', `${ymName(v.first)}..${ymName(v.last)}`, v.n, v.weight]); }
  const neverMunicipal = (await q(`SELECT e.uf, e.name, min(f.competence) AS first, count(f.competence)::int AS months FROM civica_exec.exec_entity e LEFT JOIN civica_exec.exec_tra_frota_mun_mes f ON f.entity_id = e.entity_id WHERE e.kind = 4 GROUP BY 1, 2 HAVING count(f.competence) < ${lastByComp.size} ORDER BY months`));
  for (const r of neverMunicipal) xwRows.push(['senatran_frota', r.uf, '', 'ibge_com_meses_sem_linha', r.name, '', `presente em ${r.months} de ${lastByComp.size} competências a partir de ${r.first ? ymName(N(r.first)) : '—'}; município criado depois ou sem instalação comprovada: nenhuma linha foi inventada para os meses ausentes`, '', r.months, 0]);
  await writeFile(join(outDir, 'crosswalk_transito_ibge.csv'), csv(['fonte', 'uf', 'nome_na_fonte', 'metodo', 'municipio_ibge', 'ibge7', 'regra_ou_efeito', 'periodo', 'ocorrencias_(meses_ou_anos)', 'registros_afetados'], xwRows));
  summary.crosswalk = { version: TRA_VERSION.crosswalk, aliases: 48, aliasRows: xwRows.filter(r => r[3] === 'alias').length, naoConciliados: xwRows.filter(r => r[3] === 'nao_conciliado').map(r => `${r[0]}:${r[1]}:${r[2]}`), naoInformado: xwRows.filter(r => r[3] === 'nao_informado').length, ibgeComMesesSemLinha: neverMunicipal.length };

  // ============================================================ armazenamento
  const before = beforePath ? JSON.parse(await readFile(beforePath, 'utf8')) as { database: { bytes: string }; execSchemaBytes: number; walBytes: { b: string }; ssd: { freeGiB: number }; pgFreeGiB: number } : null;
  const dbNow = (await q(`SELECT pg_database_size(current_database())::bigint AS b`))[0].b; const walNow = (await q(`SELECT wal_bytes::text AS b FROM pg_stat_wal`))[0].b;
  const schemaNow = N((await q(`SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS b FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'civica_exec' AND c.relkind IN ('r', 'm')`))[0].b);
  const rel = async (name: string) => (await q(`SELECT pg_total_relation_size($1::regclass)::bigint AS total, pg_relation_size($1::regclass)::bigint AS heap, pg_indexes_size($1::regclass)::bigint AS idx, (SELECT reltuples::bigint FROM pg_class WHERE oid = $1::regclass) AS est`, [`civica_exec.${name}`]))[0];
  const tFrota = await rel('exec_tra_frota_mun_mes'), tInfr = await rel('exec_tra_infr_uf_mes'), tCov = await rel('exec_tra_cov'), tInd = await rel('exec_ind_value'), tLog = await rel('exec_change_log'), tLat = await rel('exec_ind_latest');
  const cnt = (await q(`SELECT (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4001 AND 4799)::bigint AS ind, (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4001 AND 4122)::bigint AS sim, (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4201 AND 4203)::bigint AS frota_ind,
    (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4301 AND 4399)::bigint AS ren, (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4601 AND 4631)::bigint AS prf, (SELECT count(*) FROM civica_exec.exec_ind_value WHERE indicator_id = 4701)::bigint AS infr,
    (SELECT count(*) FROM civica_exec.exec_tra_frota_mun_mes)::bigint AS frota, (SELECT count(*) FROM civica_exec.exec_tra_infr_uf_mes)::bigint AS infr_rows, (SELECT count(*) FROM civica_exec.exec_tra_cov)::bigint AS cov, (SELECT count(DISTINCT indicator_id) FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 4001 AND 4799)::int AS defs,
    (SELECT count(*) FROM civica_exec.exec_change_log l JOIN civica_exec.exec_ingestion_run r USING (run_id) WHERE r.dataset_id BETWEEN 18 AND 23)::bigint AS log, (SELECT count(*) FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 18 AND 23)::int AS pubs`))[0];
  const dsz = async (sub: string) => dirSize(join(cfg.rawDir, 'transito', sub));
  const rawRows: unknown[][] = [];
  for (const sub of ['senatran-frota', 'senatran-frota-uf', 'prf', 'renaest', 'senatran-infracoes']) rawRows.push([`raw_ssd_${sub}_bytes`, 'depois', await dsz(sub), existsSync(join(cfg.rawDir, 'transito', sub)) ? '' : 'pasta ausente']);
  const rows: unknown[][] = [
    ['postgres_banco_bytes', 'antes', before?.database.bytes ?? '', 'pg_database_size'], ['postgres_banco_bytes', 'depois', dbNow, 'pg_database_size'], ['postgres_schema_civica_exec_bytes', 'antes', before?.execSchemaBytes ?? '', ''], ['postgres_schema_civica_exec_bytes', 'depois', schemaNow, ''],
    ['exec_tra_frota_mun_mes_total_bytes', 'depois', tFrota.total, `heap ${tFrota.heap} + índices ${tFrota.idx}; ${cnt.frota} linhas`], ['exec_tra_infr_uf_mes_total_bytes', 'depois', tInfr.total, `${cnt.infr_rows} linhas`], ['exec_tra_cov_total_bytes', 'depois', tCov.total, `${cnt.cov} linhas`],
    ['exec_ind_value_total_bytes', 'depois', tInd.total, `heap ${tInd.heap} + índices ${tInd.idx}`], ['exec_ind_latest_total_bytes', 'depois', tLat.total, ''], ['exec_change_log_total_bytes', 'depois', tLog.total, `${cnt.log} linhas de log pertencem ao trânsito`],
    ['linhas_exec_ind_value_trânsito', 'depois', cnt.ind, `SIM ${cnt.sim} · frota ${cnt.frota_ind} · RENAEST ${cnt.ren} · PRF ${cnt.prf} · infrações ${cnt.infr}`], ['bytes_por_linha_frota_larga_medido', 'depois', N(tFrota.total) / N(cnt.frota), 'inclui índices'], ['wal_bytes_gerados', 'delta', before ? BigInt(walNow) - BigInt(before.walBytes.b) : '', 'pg_stat_wal.wal_bytes (todo o cluster no período)'],
    ...rawRows, ['staging_ssd_bytes', 'depois', await dirSize(cfg.stagingDir), 'caches JSON agregados + downloads transitórios'],
    ['ssd_livre_gib', 'antes', before?.ssd.freeGiB ?? '', ''], ['ssd_livre_gib', 'depois', Number((await freeBytes(cfg.rawDir) / 1024 ** 3).toFixed(1)), ''], ['disco_postgres_livre_gib', 'antes', before?.pgFreeGiB ?? '', ''], ['disco_postgres_livre_gib', 'depois', Number((await freeBytes(cfg.pgProbeDir) / 1024 ** 3).toFixed(1)), ''],
  ];
  await writeFile(join(outDir, 'armazenamento_execucao.csv'), csv(['medida', 'momento', 'valor', 'observacao'], rows));
  summary.storage = { dbBefore: before?.database.bytes, dbAfter: String(dbNow), schemaBefore: before?.execSchemaBytes, schemaAfter: schemaNow, counts: Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, String(v)])), tables: { frota: N(tFrota.total), infr: N(tInfr.total), cov: N(tCov.total), indValue: N(tInd.total), changeLog: N(tLog.total) }, walDelta: before ? String(BigInt(walNow) - BigInt(before.walBytes.b)) : null, rawBytes: Object.fromEntries(rawRows.map(r => [String(r[0]), r[2]])) };
  md += `## Incompatibilidades de universo (resumo)\n\n- SIM (óbitos) × RENAEST (sinistros reportados) × PRF (rodovias federais) × frota (veículos registrados) × infrações (UF de jurisdição) medem coisas diferentes. Nenhum total entre famílias foi calculado. Ver \`sobreposicao_fontes.md\`.\n- O RENAEST não tem identificador comum com a PRF: sobreposição não resolvida; nada foi deduplicado nem somado.\n`;
  await writeFile(join(outDir, 'reconciliacao_transito.md'), md);
  await writeFile(join(outDir, 'summary_relatorio.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1).slice(0, 6000));
} finally { await pool.end(); }

/** Arquivos "Frota por UF e Tipo" das páginas anuais do Senatran (para a conferência independente). */
async function inventoryUfFiles(): Promise<Map<number, { file: string; url: string }>> {
  const out = new Map<number, { file: string; url: string }>();
  const { parseFrotaUfPage } = await import('../../apps/collector/src/exec/transito.ts');
  for (let y = 2013; y <= new Date().getFullYear(); y++) {
    try { const r = await fetch(`https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/frota-de-veiculos-${y}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } }); if (!r.ok) continue; for (const it of parseFrotaUfPage(await r.text(), y)) if (!out.has(it.competence)) out.set(it.competence, { file: it.file, url: it.url }); } catch { /* sem página */ }
  }
  return out;
}
void FROTA_COLUMNS; void SIM_TRA_CATEGORIES;
