import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';

/** Artefatos de cobertura, cadastro, crosswalk e reconciliação da P9.4 (somente leitura). Uso: node --import tsx scripts/exec/prisional-report.ts <pasta> <pasta-json-relatorios> <anuario-xlsx.json> */
const [out, repDir, anuJson] = process.argv.slice(2); if (!out || !repDir) throw new Error('uso: <pasta> <pasta-json-relatorios> [anuario.json]');
const pool = openPool(3);
const csv = (rows: Array<Record<string, unknown>>) => { const cols = Object.keys(rows[0] ?? {}); const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n'; };
const ref = (c: number) => `${Math.floor(c / 100)}/${c % 100 === 6 ? 1 : 2}`;
const fmt = (n: number | null | undefined, d = 0) => n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const UF_CODE: Record<string, number> = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
try {
  await mkdir(out, { recursive: true }); const q = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows as Array<Record<string, any>>; const summary: Record<string, unknown> = { at: new Date().toISOString() };
  const ufName = new Map((await q(`SELECT uf_code, uf FROM civica_exec.exec_entity WHERE kind = 3`)).map(r => [Number(r.uf_code), String(r.uf)]));
  // ---------------------------------------------------------------- cobertura
  const cov = await q(`SELECT * FROM civica_exec.exec_pri_cov ORDER BY competence, uf`);
  const indByUfCycle = new Map<string, number>(); for (const r of await q(`SELECT v.indicator_id, e.uf_code, e.kind, v.period_start, v.value FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id IN (6001, 6002, 6003, 6004, 6101, 6103, 6040, 6041, 6042, 6043) AND e.kind = 3`)) { const d = new Date(r.period_start); const c = d.getUTCFullYear() * 100 + (d.getUTCMonth() < 6 ? 6 : 12); indByUfCycle.set(`${c}|${r.uf_code}|${r.indicator_id}`, r.value == null ? NaN : Number(r.value)); }
  const covRows: Array<Record<string, unknown>> = [];
  for (const c of cov) { const k = (id: number) => indByUfCycle.get(`${c.competence}|${c.uf}|${id}`); const mk = (domain: string, units: number, cap: unknown, pop: unknown, extra: Record<string, unknown> = {}) => covRows.push({ ciclo: ref(Number(c.competence)), competencia_fim_semestre: c.competence, uf: ufName.get(Number(c.uf)), dominio: domain, estabelecimentos_no_arquivo: units, capacidade: cap ?? '', populacao: pop ?? '', universo_esperado: 'nao_consta_na_fonte', respondentes: units, cobertura_pct: '', ...extra, qualidade: Number(c.cap_incomplete) > 0 && domain === 'celas_fisicas_estaduais' ? 'capacidade_incompleta_em_algumas_unidades' : 'respostas_validadas' });
    mk('celas_fisicas_estaduais', Number(c.cela) - Number(c.federal), k(6002), k(6003), { novas_vs_serie: c.new_units, reconhecidas_de_ciclo_anterior: c.continuing, ausentes_vs_ciclo_anterior: c.absent_vs_prev, capacidade_incompleta: c.cap_incomplete, sem_municipio_conciliado: c.unassigned_mun });
    if (Number(c.federal) > 0) mk('celas_fisicas_federais_localizadas_na_uf', Number(c.federal), k(6102), k(6103));
    if (Number(c.dom_com) > 0) mk('domiciliar_com_monitoramento', Number(c.dom_com), '', k(6041)); if (Number(c.dom_sem) > 0) mk('domiciliar_sem_monitoramento', Number(c.dom_sem), '', k(6043)); }
  await writeFile(join(out, 'cobertura_sisdepen.csv'), csv(covRows)); summary.coverageRows = covRows.length;
  // ---------------------------------------------------------------- cadastro
  const units = await q(`SELECT u.unit_id, u.uf, u.ambito, u.canonical_name, u.first_competence, u.last_competence, u.key_kind, count(o.*)::int cycles, count(*) FILTER (WHERE x.review = 1)::int review, string_agg(DISTINCT o.tipo::text, '|' ORDER BY o.tipo::text) tipos,
      (array_agg(e.name ORDER BY o.competence DESC))[1] municipio, (array_agg(o.ibge7 ORDER BY o.competence DESC))[1] ibge7, count(DISTINCT o.source_name)::int names, count(DISTINCT o.entity_id)::int municipalities
    FROM civica_exec.exec_pri_unit u JOIN civica_exec.exec_pri_obs o USING (unit_id) LEFT JOIN civica_exec.exec_entity e ON e.entity_id = o.entity_id LEFT JOIN civica_exec.exec_pri_xwalk x ON x.competence = o.competence AND x.row_no = o.row_no AND x.uf = o.uf GROUP BY u.unit_id ORDER BY u.unit_id`);
  const cur = Math.max(...cov.map(c => Number(c.competence)));
  await writeFile(join(out, 'estabelecimentos_prisionais.csv'), csv(units.map(u => ({ unit_id_cívica: u.unit_id, chave: 'INTERNA do Cívica (o SISDEPEN não publica identificador estável)', uf: ufName.get(Number(u.uf)), nome_mais_recente: u.canonical_name, ambito: Number(u.ambito) === 2 ? 'federal' : 'estadual', primeiro_ciclo: ref(Number(u.first_competence)), ultimo_ciclo: ref(Number(u.last_competence)), ciclos_observados: u.cycles, no_ultimo_ciclo: Number(u.last_competence) === cur ? 'sim' : 'ausente_no_ultimo_ciclo', tipos_observados: String(u.tipos).replace(/1/g, 'cela_fisica').replace(/2/g, 'domiciliar_sem_mon').replace(/3/g, 'domiciliar_com_mon'), municipio_mais_recente: u.municipio ?? '', ibge7: u.ibge7 ?? '', nomes_distintos: u.names, municipios_distintos: u.municipalities, correspondencias_pendentes_de_revisao: u.review }))));
  const xw = await q(`SELECT x.competence, x.row_no, x.uf, x.unit_id, x.source_name, x.source_city, x.ibge7, x.method, x.confidence, x.review, x.evidence FROM civica_exec.exec_pri_xwalk x ORDER BY x.competence, x.uf, x.row_no`);
  const METHOD: Record<number, string> = { 0: 'unidade_nova', 1: 'nome_municipio_exatos', 2: 'mesmo_cep_nome_diferente', 3: 'mesmo_cep_municipio_diferente', 9: 'candidatos_ambiguos_separada' };
  await writeFile(join(out, 'crosswalk_estabelecimentos.csv'), csv(xw.map(x => ({ ciclo: ref(Number(x.competence)), linha_no_arquivo: x.row_no, uf: ufName.get(Number(x.uf)), unit_id_cívica: x.unit_id, nome_original: x.source_name, municipio_original: x.source_city, ibge7: x.ibge7 ?? '', metodo: METHOD[Number(x.method)], confianca: x.confidence, revisao_pendente: Number(x.review) === 1 ? 'sim' : 'nao', evidencia: x.evidence }))));
  const methodByCycle = await q(`SELECT competence, method, count(*)::int n FROM civica_exec.exec_pri_xwalk GROUP BY 1, 2 ORDER BY 1, 2`);
  summary.units = units.length; summary.xwalkRows = xw.length; summary.reviewPending = xw.filter(x => Number(x.review) === 1).length; summary.methodTotals = Object.fromEntries([0, 1, 2, 3, 9].map(m => [METHOD[m]!, xw.filter(x => Number(x.method) === m).length]));
  summary.unitsInLastCycle = units.filter(u => Number(u.last_competence) === cur).length; summary.unitsWithoutMunicipality = xw.filter(x => x.ibge7 == null && Number(x.competence) === cur).length;
  // ---------------------------------------------------------------- reconciliação
  const md: string[] = ['# Reconciliação prisional (P9.4)', '', `Gerado em ${new Date().toISOString()} a partir do banco de produção, do RAW preservado e dos relatórios oficiais da SENAPPEN. Nenhum valor foi ajustado para fechar: toda divergência está listada com hipótese e decisão.`, ''];
  const nat = new Map<string, number | null>(); for (const r of await q(`SELECT v.indicator_id, v.period_start, v.value FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 1 AND v.indicator_id BETWEEN 6000 AND 6199`)) { const d = new Date(r.period_start); nat.set(`${d.getUTCFullYear() * 100 + (d.getUTCMonth() < 6 ? 6 : 12)}|${r.indicator_id}`, r.value == null ? null : Number(r.value)); }
  const ufInd = new Map<string, number>(); for (const [k, v] of indByUfCycle) ufInd.set(k, v);
  // 1) relatórios oficiais
  const REPORTS: Array<[string, number]> = [['relatorio-1-semestre-de-2023', 202306], ['relotario-2o-semestre-de-2023', 202312], ['relatorio-do-1o-semestre-de-2024-16-ciclo-retificado', 202406], ['relatorio-do-2o-semestre-de-2024', 202412], ['relatorio-do-1o-semestre-de-2025-18-ciclo-retificado', 202506], ['relatorio-do-2o-semestre-de-2025', 202512]];
  md.push('## 1. Relatórios oficiais da SENAPPEN (ciclos 14 a 19; 6 semestres)', '', 'Os relatórios publicam o **sistema estadual** por UF e, em nota, o **Sistema Penitenciário Federal** à parte. O Cívica publica os dois separados (indicadores `…-E-…` e `…-F-…`): a comparação é feita por escopo.', '', '| Ciclo | Medida | Relatório (estadual) | Cívica (estadual) | Δ | Relatório (federal) | Cívica (federal) | Δ | UFs conferidas | UFs divergentes |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  const divergences: string[] = []; let ufChecks = 0, ufBad = 0;
  for (const [file, comp] of REPORTS) {
    const j = JSON.parse(await readFile(join(repDir, `${file}.json`), 'utf8')) as { kinds: Record<string, { uf: Record<string, number>; totals: number[]; federal: { total?: number } }> };
    for (const [kind, label, idE, idF] of [['pop', 'população em celas físicas', 6003, 6103], ['cap', 'capacidade (vagas)', 6002, 6102], ['estab', 'estabelecimentos (celas físicas)', 6001, 6101]] as const) {
      const k = j.kinds[kind]; if (!k) { divergences.push(`${ref(comp)} ${label}: quadro não localizado no relatório`); continue; }
      const repE = k.totals[0]!, repF = kind === 'estab' ? k.totals[1]! : (k.federal.total ?? k.totals[1]!); const dbE = nat.get(`${comp}|${idE}`) ?? null, dbF = nat.get(`${comp}|${idF}`) ?? null;
      let checked = 0, bad = 0;
      if (kind !== 'estab') for (const [uf, v] of Object.entries(k.uf)) { const mine = ufInd.get(`${comp}|${UF_CODE[uf]}|${idE}`); checked++; if (mine !== v) { bad++; divergences.push(`${ref(comp)} ${label} ${uf}: relatório ${v} × Cívica ${mine ?? 'sem linha'}`); } }
      ufChecks += checked; ufBad += bad;
      md.push(`| ${ref(comp)} | ${label} | ${fmt(repE)} | ${fmt(dbE)} | ${fmt((dbE ?? 0) - repE)} | ${fmt(repF)} | ${fmt(dbF)} | ${fmt((dbF ?? 0) - repF)} | ${kind === 'estab' ? '—' : checked} | ${kind === 'estab' ? '—' : bad} |`);
      if (dbE !== repE) divergences.push(`${ref(comp)} ${label} (estadual, Brasil): relatório ${repE} × Cívica ${dbE}`); if (dbF !== repF) divergences.push(`${ref(comp)} ${label} (federal): relatório ${repF} × Cívica ${dbF}`);
    }
    const def = j.kinds.deficit; if (def) { const mine = (nat.get(`${comp}|6003`) ?? 0) - (nat.get(`${comp}|6002`) ?? 0); md.push(`| ${ref(comp)} | déficit de vagas (pop − vagas) | ${fmt(def.totals[0])} | ${fmt(mine)} | ${fmt(mine - def.totals[0]!)} | — | — | — | — | — |`); if (mine !== def.totals[0]) divergences.push(`${ref(comp)} déficit estadual: relatório ${def.totals[0]} × Cívica ${mine}`); }
  }
  summary.reportUfChecks = ufChecks; summary.reportUfDivergent = ufBad; summary.reportDivergences = divergences.length;
  md.push('', `Conferência por UF (população e capacidade, 6 ciclos × 27 UFs): **${ufChecks} células, ${ufBad} divergentes**.`, '', '### Divergências', '', divergences.length ? divergences.map(d => `- ${d}`).join('\n') : 'Nenhuma: todos os totais e valores por UF do sistema estadual, os quantitativos federais e os números de estabelecimentos coincidem com os relatórios.', '');
  // 2) Anuário
  if (anuJson) {
    const a = JSON.parse(await readFile(anuJson, 'utf8')) as { years: Record<string, number> };
    md.push('## 2. Série nacional × Anuário Brasileiro de Segurança Pública 2026 (Tabela 75), ciclos de 31/12', '', 'O Anuário traz "presos no sistema penitenciário" (celas físicas **mais** prisão domiciliar, estaduais e federais). O Cívica soma celas + domiciliar apenas para esta conferência; os indicadores permanecem separados.', '', '| Ano (ciclo /2) | Anuário | Cívica: celas (E+F) | Cívica: domiciliar | Cívica: soma | Δ | Δ % |', '|---|---:|---:|---:|---:|---:|---:|');
    for (let y = 2016; y <= 2025; y++) { const comp = y * 100 + 12; const cel = (nat.get(`${comp}|6003`) ?? 0) + (nat.get(`${comp}|6103`) ?? 0); const dom = (nat.get(`${comp}|6041`) ?? 0) + (nat.get(`${comp}|6043`) ?? 0); const an = a.years[String(y)]; if (an == null) continue; md.push(`| ${y}/2 | ${fmt(an)} | ${fmt(cel)} | ${fmt(dom)} | ${fmt(cel + dom)} | ${fmt(cel + dom - an)} | ${fmt((cel + dom - an) / an * 100, 2)} |`); }
    md.push('', 'Diferenças pequenas e variáveis são esperadas (o Anuário usa a base consolidada do SISDEPEN, com retificações posteriores, e a data de corte pode diferir). Não foram forçadas a zero.', '');
  }
  // 3) matriz estadual/federal e cobertura
  md.push('## 3. Matriz estadual × federal × domiciliar por ciclo (Brasil)', '', '| Ciclo | Estab. estaduais | Estab. federais | Domiciliar c/ mon. | Domiciliar s/ mon. | Pop. celas estaduais | Pop. celas federais | Vagas estaduais | Vagas federais | Ocupação estadual % | Excedente líquido estadual |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const cycles = [...new Set(cov.map(c => Number(c.competence)))].sort();
  const totalsByCycle = new Map(cycles.map(c => [c, cov.filter(x => Number(x.competence) === c)])); const g = (c: number, id: number) => nat.get(`${c}|${id}`) ?? null;
  for (const c of cycles) md.push(`| ${ref(c)} | ${fmt(g(c, 6001))} | ${fmt(g(c, 6101))} | ${fmt(g(c, 6040))} | ${fmt(g(c, 6042))} | ${fmt(g(c, 6003))} | ${fmt(g(c, 6103))} | ${fmt(g(c, 6002))} | ${fmt(g(c, 6102))} | ${fmt(g(c, 6004), 1)} | ${fmt(g(c, 6005))} |`);
  md.push('', '## 4. Cobertura e continuidade (o arquivo só traz respostas validadas)', '', '| Ciclo | Registros no arquivo | Celas físicas | Domiciliar | Novas na série | Reconhecidas | Ausentes vs ciclo anterior | Capacidade incompleta | Sem município |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of cycles) { const l = totalsByCycle.get(c)!; const s = (f: string) => l.reduce((n, x) => n + Number(x[f]), 0); md.push(`| ${ref(c)} | ${fmt(s('rows_in_file'))} | ${fmt(s('cela'))} | ${fmt(s('dom_sem') + s('dom_com'))} | ${fmt(s('new_units'))} | ${fmt(s('continuing'))} | ${fmt(s('absent_vs_prev'))} | ${fmt(s('cap_incomplete'))} | ${fmt(s('unassigned_mun'))} |`); }
  md.push('', 'Queda do número de registros entre ciclos (ex.: 2018/2 → 2019/1) pode ser queda de cobertura da pesquisa, e não fechamento de unidades: o Cívica não declara encerramento.', '');
  summary.cycles = cycles.length; summary.national = Object.fromEntries(cycles.map(c => [ref(c), { unitsE: g(c, 6001), unitsF: g(c, 6101), popE: g(c, 6003), popF: g(c, 6103), capE: g(c, 6002), capF: g(c, 6102), occE: g(c, 6004), excNetE: g(c, 6005), excGrossE: g(c, 6006), domCom: g(c, 6041), domSem: g(c, 6043) }]));
  await writeFile(join(out, 'reconciliacao_prisional.md'), md.join('\n') + '\n'); await writeFile(join(out, 'summary_relatorio.json'), JSON.stringify(summary, null, 1)); console.log(JSON.stringify({ ...summary, national: undefined }, null, 1));
} finally { await pool.end(); }
void methodUnused;
function methodUnused() { /* reservado */ }
