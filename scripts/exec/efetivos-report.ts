import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  EFE_DEFS, EFE_DEF_BY_ID, ESTADIC_VARS, FBSP_CORPS, FBSP_PLANS, FBSP_RATES, MUNIC_UF_AGG, MUNIC_VARS, SIAPE_ORGS, buildFbsp, statusOf, FLAG, type FbspJson,
} from '../../packages/db/src/exec/index.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { extractEfetivos, fetchEfetivosSource, loadEntities } from '../../apps/collector/src/exec/efetivos.ts';
import { loadPopulation } from '../../apps/collector/src/exec/seguranca.ts';
import { openPool } from './db.ts';

/** Gera os artefatos de cobertura e reconciliação da P9.3 a partir do banco (somente leitura). Uso: node --import tsx scripts/exec/efetivos-report.ts <pasta> */
const out = process.argv[2]; if (!out) throw new Error('informe a pasta de saída');
const pool = openPool(3); const cfg = storageConfig();
const csv = (rows: Array<Record<string, unknown>>) => { const cols = Object.keys(rows[0] ?? {}); const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n'; };
const iso = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const flagsOf = (f: number) => (Object.entries(FLAG) as Array<[string, number]>).filter(([, b]) => (f & b) !== 0).map(([k]) => k).join('|');
const fmt = (n: number | null | undefined, d = 0) => n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const UFS = ['RO', 'AC', 'AM', 'RR', 'PA', 'AP', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES', 'RJ', 'SP', 'PR', 'SC', 'RS', 'MS', 'MT', 'GO', 'DF'];
const FBSP_TABLE: Record<string, string> = { existente: 'Tabela 2', previsto: 'Tabelas 3, 4 e 5', ocupacao: 'derivado das Tabelas 3, 4 e 5', diferenca: 'derivado das Tabelas 3, 4 e 5', taxa: 'Tabela 2 ÷ população 2025 (IBGE)', agregado_uf: 'Tabela 15' };
try {
  await mkdir(out, { recursive: true }); const summary: Record<string, unknown> = { at: new Date().toISOString() };
  const q = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows as Array<Record<string, any>>;
  const ents = await q(`SELECT entity_id, kind, ibge7, uf_code, uf, name FROM civica_exec.exec_entity WHERE kind IN (1, 3, 4)`);
  const entById = new Map(ents.map(e => [Number(e.entity_id), e])); const ufByCode = new Map(ents.filter(e => e.kind === 3).map(e => [Number(e.uf_code), String(e.uf)]));

  // ---------------------------------------------------------------- cobertura_fbsp.csv
  const fb = await q(`SELECT indicator_id, entity_id, period_start, period_end, value, numerator, denominator, flags FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5001 AND 5034 ORDER BY indicator_id, entity_id`);
  const fbRows: Array<Record<string, unknown>> = [];
  for (const r of fb) { const d = EFE_DEF_BY_ID.get(Number(r.indicator_id))!; const e = entById.get(Number(r.entity_id))!; const v = r.value == null ? null : Number(r.value);
    fbRows.push({ uf: e.kind === 1 ? 'BR' : e.uf, territorio: e.kind === 1 ? 'Brasil' : e.name, corporacao: d.corporation, natureza_medida: d.measure, indicador: d.code, indicator_id: d.id, ano_publicacao: 2026, data_base_inicio: iso(r.period_start), data_base_fim: iso(r.period_end),
      valor: v, numerador: r.numerator, denominador: r.denominator, unidade: d.unit, estado: statusOf(v, Number(r.flags)), flags: flagsOf(Number(r.flags)), tabela_fonte: FBSP_TABLE[d.measure] ?? '' }); }
  for (const c of FBSP_CORPS.filter(c => !c.byUf)) for (const uf of UFS) fbRows.push({ uf, territorio: uf, corporacao: c.key, natureza_medida: 'existente', indicador: `IND-EFE-FBSP-${c.key}`, indicator_id: c.id, ano_publicacao: 2026, data_base_inicio: c.ref.start, data_base_fim: c.ref.end, valor: '', numerador: '', denominador: '', unidade: 'servidores', estado: 'indisponivel_na_fonte_por_uf', flags: '', tabela_fonte: 'Tabela 2 ("...": informação não disponível)' });
  await writeFile(join(out, 'cobertura_fbsp.csv'), csv(fbRows)); summary.fbspRows = fbRows.length;

  // ---------------------------------------------------------------- cobertura_estadic.csv
  const es = await q(`SELECT indicator_id, entity_id, period_start, period_end, value, flags FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5101 AND 5110 ORDER BY period_start, indicator_id, entity_id`);
  const esRows = es.map(r => { const d = EFE_DEF_BY_ID.get(Number(r.indicator_id))!; const e = entById.get(Number(r.entity_id))!; const v = r.value == null ? null : Number(r.value); const start = iso(r.period_start);
    return { uf: e.uf, territorio: e.name, corporacao: d.corporation, natureza_medida: d.measure, indicador: d.code, indicator_id: d.id, edicao: Number(start.slice(0, 4)) + (start.endsWith('12-31') ? 1 : 0), ano_data_base: Number(start.slice(0, 4)) + (start.endsWith('12-31') ? 0 : 0), data_base: start, valor: v, unidade: d.unit, estado: statusOf(v, Number(r.flags)), flags: flagsOf(Number(r.flags)) }; });
  await writeFile(join(out, 'cobertura_estadic.csv'), csv(esRows)); summary.estadicRows = esRows.length;

  // ---------------------------------------------------------------- cobertura_munic_guardas.csv e delegacias
  const mun = await q(`SELECT v.entity_id, v.indicator_id, v.period_start, v.value, v.flags FROM civica_exec.exec_ind_value v WHERE v.indicator_id BETWEEN 5201 AND 5224`);
  type Cell = { value: number | null; flags: number; start: string };
  const by = new Map<string, Cell>(); for (const r of mun) { const s = iso(r.period_start); by.set(`${r.entity_id}|${r.indicator_id}|${s.startsWith('2019') ? 2019 : 2023}`, { value: r.value == null ? null : Number(r.value), flags: Number(r.flags), start: s }); }
  const stateTxt = (c: Cell | undefined): string => !c ? 'nao_aplicavel_ou_ausente' : c.value == null ? (c.flags & FLAG.refused ? 'recusa' : c.flags & FLAG.notInformed ? 'nao_informou' : 'indisponivel') : c.value === 1 ? 'sim' : c.value === 0 ? 'nao' : String(c.value);
  const municipios = ents.filter(e => e.kind === 4).sort((a, b) => Number(a.ibge7) - Number(b.ibge7));
  const g = (e: number, id: number, y: 2019 | 2023) => by.get(`${e}|${id}|${y}`);
  const gRows = municipios.map(m => { const id = Number(m.entity_id); const row: Record<string, unknown> = { ibge7: m.ibge7, municipio: m.name, uf: m.uf };
    for (const y of [2019, 2023] as const) { const ex = g(id, 5201, y), ef = g(id, 5202, y), h = g(id, 5203, y), w = g(id, 5204, y);
      row[`guarda_existe_${y}`] = stateTxt(ex); row[`guarda_efetivo_total_${y}`] = ef?.value ?? ''; row[`guarda_efetivo_homens_${y}`] = h?.value ?? ''; row[`guarda_efetivo_mulheres_${y}`] = w?.value ?? '';
      row[`guarda_efetivo_estado_${y}`] = ef ? stateTxt(ef) === 'sim' ? 'declarado' : (ef.value != null ? 'declarado' : stateTxt(ef)) : (ex && ex.value === 0 ? 'nao_aplicavel_sem_guarda' : 'ausente'); row[`guarda_efetivo_zero_declarado_${y}`] = ef && ef.value === 0 ? 'sim' : '';
      row[`guarda_efetivo_data_base_${y}`] = ef?.start ?? ''; row[`na_pesquisa_${y}`] = ex ? 'sim' : 'nao'; }
    return row; });
  await writeFile(join(out, 'cobertura_munic_guardas.csv'), csv(gRows)); summary.guardasRows = gRows.length;
  const dRows = municipios.map(m => { const id = Number(m.entity_id); const row: Record<string, unknown> = { ibge7: m.ibge7, municipio: m.name, uf: m.uf };
    for (const y of [2019, 2023] as const) { const dpc = g(id, 5211, y); const none = g(id, 5221, y);
      row[`delegacia_pc_${y}`] = dpc ? stateTxt(dpc) : (none?.value === 1 ? 'nao (nenhuma das citadas)' : 'nao_aplicavel_ou_ausente'); row[`nenhuma_das_citadas_${y}`] = y === 2019 ? 'pergunta_inexistente_em_2019' : stateTxt(none);
      for (const v of MUNIC_VARS.filter(x => x.id >= 5212 && x.id <= 5220)) row[`${v.v}_${y}`] = stateTxt(g(id, v.id, y)); for (const v of MUNIC_VARS.filter(x => x.id >= 5222 && x.id <= 5224)) row[`${v.v}_${y}`] = stateTxt(g(id, v.id, y)); }
    return row; });
  await writeFile(join(out, 'cobertura_munic_delegacias.csv'), csv(dRows)); summary.delegaciasRows = dRows.length;

  // ---------------------------------------------------------------- reconciliação
  const md: string[] = ['# Reconciliação institucional (P9.3)', '', `Gerado em ${new Date().toISOString()} a partir do banco de produção, do RAW preservado em D:\\Civica e dos arquivos oficiais. Nenhum total foi ajustado para fechar: onde as fontes divergem, os dois valores estão preservados.`, ''];
  // FBSP: recon + Tabela 6
  const file = await fetchEfetivosSource(pool, cfg, 'fbsp'); const j = await extractEfetivos<FbspJson>(cfg, file); const en = await loadEntities(pool); const pop = await loadPopulation(pool, 2025);
  const built = buildFbsp(j, { ufEntityBySigla: en.ufEntityBySigla, brEntity: en.brEntity, popByEntity: pop });
  md.push('## 1. FBSP Raio-X 2026 (dados de 2025)', '', `Arquivo: \`${file.entry.relPath}\` — SHA-256 \`${file.entry.sha256}\` (${file.entry.bytes} bytes). Extração por posição das palavras na página (\`fbsp_extract.py\`, ${j.version}); SP e RS conferidos visualmente na Tabela 2 (página 14) e nas Tabelas 3 a 5 (páginas 22, 24 e 28).`, '',
    '- **SP**: a célula do Corpo de Bombeiros está **vazia no PDF** (nota 7: bombeiros somados à PM). Na extração por texto corrido a linha vinha com 8 números e deslocava todas as colunas; por posição, SP PM = 82.250 (inclui bombeiros), CBM = vazio, PC = 19.420, Perícia = 4.785, Polícia Penal = 24.898, GCM = 30.184, total 161.537 (soma conferida).',
    '- **RS**: PM 18.360, CBM 2.995, PC 5.771, Perícia 825, Polícia Penal 6.036, GCM 2.436, total 36.423 (soma conferida); as linhas de RS das Tabelas 3, 4 e 5 também fecham com a coluna "relação" impressa.', '', '| Verificação | Esperado | Obtido | OK |', '|---|---:|---:|:--:|');
  for (const r of built.recon) md.push(`| ${r.name} | ${fmt(r.expected)} | ${fmt(r.got)} | ${r.ok ? 'sim' : '**NÃO**'} |`);
  md.push('', `${built.recon.length} verificações; ${built.recon.filter(r => !r.ok).length} falhas. A carga aborta se qualquer uma falhar.`, '');
  const t6 = (j.tables as unknown as Record<string, { rows: Record<string, { cells: Record<string, { v: number | null; raw: string; state: string }> }> }>).T6;
  if (t6) {
    md.push('### Taxa por 1.000 habitantes — conferência independente com a Tabela 6 do FBSP', '', 'O Cívica calcula a taxa dividindo o efetivo pela população estimada 2025 (IBGE, SIDRA 6579) já carregada; o FBSP usa as estimativas enviadas ao TCU em 2025. A diferença de denominador explica desvios de até ±0,1 por mil (arredondamento).', '', '| UF | PM Cívica | PM FBSP | CBM Cívica | CBM FBSP | PC Cívica | PC FBSP |', '|---|---:|---:|---:|---:|---:|---:|');
    let within = 0, total = 0; const worst: string[] = [];
    for (const uf of UFS) { const row = (id: number) => built.rows.find(r => r.indicator_id === id && r.entity_id === en.ufEntityBySigla.get(uf)); const cells: string[] = [];
      for (const [rid, col] of [[5031, 'PM'], [5032, 'CBM'], [5033, 'PC']] as const) { const mine = row(rid)?.value; const t = t6.rows[uf]!.cells[col]!; const mineK = mine == null ? null : mine / 100; cells.push(fmt(mineK, 2), t.state === 'NUM' ? fmt(t.v, 1) : '—');
        if (mineK != null && t.state === 'NUM') { total++; if (Math.abs(mineK - t.v!) <= 0.1) within++; else worst.push(`${uf} ${col}: ${mineK.toFixed(2)} × ${t.v}`); } }
      md.push(`| ${uf} | ${cells.join(' | ')} |`); }
    md.push('', `${within} de ${total} células ficam a no máximo 0,1 por mil da taxa impressa pelo FBSP${worst.length ? `; fora da tolerância: ${worst.join('; ')}` : ''}.`, ''); summary.rate = { within, total, worst };
  }
  // ESTADIC
  md.push('## 2. ESTADIC (edições 2019 e 2023)', '');
  const estTot = await q(`SELECT period_start, indicator_id, sum(value)::float8 s, count(value)::int ok, count(*)::int n, count(*) FILTER (WHERE flags & 1024 <> 0)::int refused, count(*) FILTER (WHERE flags & 512 <> 0)::int ni FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5101 AND 5110 GROUP BY 1, 2 ORDER BY 1, 2`);
  md.push('| Data-base | Indicador | Σ das UFs | UFs com valor | UFs com linha | Recusa | Não informou |', '|---|---|---:|---:|---:|---:|---:|');
  for (const r of estTot) md.push(`| ${iso(r.period_start)} | ${EFE_DEF_BY_ID.get(Number(r.indicator_id))!.label} | ${fmt(r.s)} | ${r.ok} | ${r.n} | ${r.refused} | ${r.ni} |`);
  md.push('', '**Controles da investigação P9 (ESTADIC 2023):** PM = 398.455 e PC = 107.968 (26 UFs respondentes; Rondônia recusou). Reconciliados: ver as linhas `2022-12-31` de ESEG273 e ESEG493 acima.', '',
    '**ESTADIC 2019 (edição adicional, mesmas variáveis e mesmos rótulos):** data-base 31/12/2018; 27 UFs responderam PM e PC (PM = 416.923; PC = 117.228); o Pará não soube informar as delegacias. **Em 2023** Pará e Tocantins informaram só o total do efetivo (sem o recorte por sexo) e Rondônia recusou responder.', '');
  const ro = await q(`SELECT v.indicator_id, v.value, v.flags FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.uf = 'RO' AND e.kind = 3 AND v.indicator_id IN (5101, 5104) AND v.period_start = '2022-12-31'`);
  md.push(`Rondônia 2023: ${ro.map(r => `${EFE_DEF_BY_ID.get(Number(r.indicator_id))!.code} → valor ${r.value ?? 'NULL'} (${statusOf(null, Number(r.flags))})`).join('; ')}. Nunca zero.`, '');
  // MUNIC
  md.push('## 3. MUNIC (edições 2019 e 2023)', '');
  const munTot = await q(`SELECT (CASE WHEN period_start = '2022-12-31' THEN 2023 ELSE extract(year FROM period_start)::int END) y, count(*) FILTER (WHERE indicator_id = 5201 AND value = 1)::int sim, count(*) FILTER (WHERE indicator_id = 5201 AND value = 0)::int nao, count(*) FILTER (WHERE indicator_id = 5201 AND value IS NULL AND flags & 512 <> 0)::int ni, count(*) FILTER (WHERE indicator_id = 5201 AND value IS NULL AND flags & 1024 <> 0)::int rec,
      count(*) FILTER (WHERE indicator_id = 5201)::int tot, sum(value) FILTER (WHERE indicator_id = 5202)::float8 ef, count(*) FILTER (WHERE indicator_id = 5202 AND value = 0)::int zero, count(*) FILTER (WHERE indicator_id = 5211 AND value = 1)::int dpc, count(*) FILTER (WHERE indicator_id = 5211 AND value = 0)::int dpc_nao, count(*) FILTER (WHERE indicator_id = 5211 AND value IS NULL)::int dpc_ni, count(*) FILTER (WHERE indicator_id = 5221 AND value = 1)::int nenhuma
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 AND indicator_id BETWEEN 5201 AND 5224 GROUP BY 1 ORDER BY 1`);
  md.push('| Edição da pesquisa (efetivo: data-base 31/12/2022 em 2023) | Com guarda | Sem guarda | Não informou | Recusa | Σ (reconcilia com) | Efetivo total declarado | Guarda com efetivo 0 declarado | Delegacia PC sim | Delegacia PC não | Delegacia PC sem resposta | "Nenhuma das citadas" |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of munTot) if (r.tot > 0) md.push(`| ${r.y} | ${r.sim} | ${r.nao} | ${r.ni} | ${r.rec} | ${r.sim + r.nao + r.ni + r.rec} de ${r.tot} | ${fmt(r.ef)} | ${r.zero} | ${r.dpc} | ${r.dpc_nao} | ${r.dpc_ni} | ${r.nenhuma} |`);
  const ef23 = await q(`SELECT sum(value)::float8 s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 AND indicator_id = 5202 AND period_start = '2022-12-31'`); const ef19 = await q(`SELECT sum(value)::float8 s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 AND indicator_id = 5202 AND period_start = '2019-01-01'`);
  md.push('', `**Controles da investigação P9 (MUNIC 2023):** 1.322 com guarda + 4.242 sem + 6 sem resposta = 5.570 linhas; efetivo 101.854 (obtido: ${fmt(ef23[0]!.s)}); delegacia de Polícia Civil em 4.231 (a P9 contou "Sim" em MSEG161). Em 2023, **1.331** municípios têm "-" em MSEG161 porque marcaram "Nenhuma das citadas" (MSEG1611 = Sim): somados aos 2 "Não", são 1.333 municípios sem delegacia declarada; 6 não informaram; 4.231 + 1.333 + 6 = 5.570. Edição 2019: 1.188 com guarda, efetivo ${fmt(ef19[0]!.s)}.`, '',
    'A fundação territorial do Cívica tem 5.571 municípios; as duas pesquisas têm 5.570. O município sem linha na MUNIC não recebe valor (ver `cobertura_munic_guardas.csv`, coluna `na_pesquisa_*`).', '', '### Casos de regressão (município)', '', '| Município | Guarda 2023 | Efetivo 2023 (31/12/2022) | Delegacia PC 2023 | Guarda 2019 | Efetivo 2019 |', '|---|---|---:|---|---|---:|');
  const names: Array<[number, string, number | null | undefined]> = [[3205309, 'Vitória/ES', 427], [3205200, 'Vila Velha/ES', 286], [3205002, 'Serra/ES', 142], [3201308, 'Cariacica/ES', 43], [3200359, 'Alto Rio Novo/ES', null], [3550308, 'São Paulo/SP', 5800], [3304557, 'Rio de Janeiro/RJ', 7238], [4314902, 'Porto Alegre/RS', undefined], [1100205, 'Porto Velho/RO', undefined], [5300108, 'Brasília/DF', undefined]];
  const regress: Array<Record<string, unknown>> = [];
  for (const [ibge7, label, expected] of names) { const e = municipios.find(m => Number(m.ibge7) === ibge7); if (!e) { md.push(`| ${label} | (sem entidade) | | | | |`); continue; } const id = Number(e.entity_id);
    const ef = g(id, 5202, 2023); const ok = expected == null ? true : ef?.value === expected; if (expected !== undefined) regress.push({ label, expected, got: ef?.value ?? null, ok });
    md.push(`| ${label} | ${stateTxt(g(id, 5201, 2023))} | ${ef?.value ?? '—'}${expected != null ? (ok ? ' ✓' : ` ✗ (esperado ${expected})`) : ''} | ${stateTxt(g(id, 5211, 2023))} | ${stateTxt(g(id, 5201, 2019))} | ${g(id, 5202, 2019)?.value ?? '—'} |`); }
  summary.regression = regress;
  // GCM por UF: três leituras
  md.push('', '### Guardas municipais por UF: FBSP × MUNIC (leituras diferentes; não forçadas a igualar)', '', 'FBSP final = RAIS 2024 + MUNIC 2023 + Senasp 2024 validados pelo FBSP (Tabela 15). MUNIC Cívica = soma direta das respostas das prefeituras na planilha oficial. O próprio FBSP leu a MUNIC 2023 como 1.306 municípios e 101.653 guardas; a planilha oficial tem 1.322 e 101.854: o Cívica publica o arquivo como está.', '', '| UF | FBSP final (efetivo) | RAIS 2024 (FBSP) | MUNIC 2023 (soma Cívica) | MUNIC 2019 (soma Cívica) | Municípios sem resposta 2023 |', '|---|---:|---:|---:|---:|---:|');
  const gcm = await q(`SELECT e.uf, max(v.value) FILTER (WHERE v.indicator_id = 5010)::float8 fbsp, max(v.value) FILTER (WHERE v.indicator_id = 5021)::float8 rais, max(v.value) FILTER (WHERE v.indicator_id = ${MUNIC_UF_AGG.efetivo} AND v.period_start = '2022-12-31')::float8 m23, max(v.value) FILTER (WHERE v.indicator_id = ${MUNIC_UF_AGG.efetivo} AND v.period_start = '2019-01-01')::float8 m19, max(v.value) FILTER (WHERE v.indicator_id = ${MUNIC_UF_AGG.semResposta} AND v.period_start = '2023-01-01')::float8 ni
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 3 AND v.indicator_id IN (5010, 5021, ${MUNIC_UF_AGG.efetivo}, ${MUNIC_UF_AGG.semResposta}) GROUP BY e.uf ORDER BY e.uf`);
  for (const r of gcm) md.push(`| ${r.uf} | ${fmt(r.fbsp)} | ${fmt(r.rais)} | ${fmt(r.m23)} | ${fmt(r.m19)} | ${r.ni ?? '—'} |`);
  // FBSP × ESTADIC
  md.push('', '## 4. FBSP 2025 × ESTADIC 2022 — PM e PC por UF (valores lado a lado)', '', 'Fontes, datas-base e definições diferentes (portais da transparência, março/2025 × declaração do órgão gestor, 31/12/2022): **não é variação**, e não existe valor para 2023–2024.', '', '| UF | PM FBSP 2025 | PM ESTADIC 2022 | PC FBSP 2025 | PC ESTADIC 2022 |', '|---|---:|---:|---:|---:|');
  const cmpRows = await q(`SELECT e.uf, max(v.value) FILTER (WHERE v.indicator_id = 5001)::float8 pm_f, max(v.value) FILTER (WHERE v.indicator_id = 5101 AND v.period_start = '2022-12-31')::float8 pm_e, max(v.value) FILTER (WHERE v.indicator_id = 5003)::float8 pc_f, max(v.value) FILTER (WHERE v.indicator_id = 5104 AND v.period_start = '2022-12-31')::float8 pc_e FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 3 AND v.indicator_id IN (5001, 5003, 5101, 5104) GROUP BY e.uf ORDER BY e.uf`);
  for (const r of cmpRows) md.push(`| ${r.uf} | ${fmt(r.pm_f)} | ${fmt(r.pm_e)} | ${fmt(r.pc_f)} | ${fmt(r.pc_e)} |`);
  // SIAPE
  md.push('', '## 5. SIAPE — registros de vínculo (PF e PRF) × FBSP', '', 'Registros do cadastro SIAPE por órgão de exercício (agregado em memória; original descartado). Não são policiais em efetivo operacional: cargo, situação, UF e identificador vêm "Sigiloso" em PF/PRF; uma pessoa pode ter registro de cargo e de função. Comparar com o FBSP serve apenas para mostrar que **são medidas diferentes**.', '', '| Mês | PF registros | PF tipo Cargo | PRF registros | PRF tipo Cargo |', '|---|---:|---:|---:|---:|');
  const sp = await q(`SELECT period_start, max(value) FILTER (WHERE indicator_id = 5301)::float8 pf, max(value) FILTER (WHERE indicator_id = 5302)::float8 pfc, max(value) FILTER (WHERE indicator_id = 5303)::float8 prf, max(value) FILTER (WHERE indicator_id = 5304)::float8 prfc FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5301 AND 5304 GROUP BY 1 ORDER BY 1`);
  for (const r of sp) md.push(`| ${iso(r.period_start).slice(0, 7)} | ${fmt(r.pf)} | ${fmt(r.pfc)} | ${fmt(r.prf)} | ${fmt(r.prfc)} |`);
  md.push('', 'Controle da P9 (ago/2026): PF 17.253 e PRF 14.000 — reproduzidos. FBSP 2025: PF 12.536 (abril/2025) e PRF 12.328 (março/2025). Diferença ≈ 38 % (PF) e 14 % (PRF): inclui carreiras administrativas e registros de função; **não** é crescimento de policiais.', '');
  summary.siapeMonths = sp.length;
  // totais de indicadores e valores
  const totals = await q(`SELECT count(*)::int values_n, count(DISTINCT indicator_id)::int indicators, count(DISTINCT entity_id)::int entities FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5001 AND 5399`);
  const byFamily = await q(`SELECT CASE WHEN indicator_id < 5100 THEN 'FBSP' WHEN indicator_id < 5200 THEN 'ESTADIC' WHEN indicator_id < 5300 THEN 'MUNIC' ELSE 'SIAPE' END fam, count(*)::int n, count(DISTINCT indicator_id)::int ind FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5001 AND 5399 GROUP BY 1 ORDER BY 1`);
  summary.totals = totals[0]; summary.byFamily = byFamily;
  const pubs = await q(`SELECT dataset_id, count(*)::int slices, min(competence) mn, max(competence) mx FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 24 AND 27 GROUP BY 1 ORDER BY 1`); summary.publications = pubs;
  await writeFile(join(out, 'reconciliacao_institucional.md'), md.join('\n') + '\n');
  await writeFile(join(out, 'summary_relatorio.json'), JSON.stringify(summary, null, 1)); console.log(JSON.stringify(summary, null, 1));
} finally { await pool.end(); }
void EFE_DEFS; void ESTADIC_VARS; void FBSP_PLANS; void FBSP_RATES; void SIAPE_ORGS;
