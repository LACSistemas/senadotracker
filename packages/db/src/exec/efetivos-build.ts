import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
import type { EntityDir } from './seguranca-build.ts';
import {
  SIAPE_ORGS, ESTADIC_VARS, FBSP_CORPS, FBSP_GCM_IDS, FBSP_PLANS, FBSP_RATES, MUNIC_UF_AGG, MUNIC_VARS, type IbgeEdition, type RefWindow,
} from './efetivos-defs.ts';

/** Formato produzido por scripts/exec/fbsp_extract.py. */
export interface FbspCell { raw: string; state: 'NUM' | 'UNAVAILABLE' | 'NONE' | 'BLANK'; v: number | null }
export interface FbspTable { page: number; title: string; columns: string[]; rows: Record<string, { label: string; cells: Record<string, FbspCell> }> }
export interface FbspJson { version: string; pages: number; tables: Record<'T2' | 'T3' | 'T4' | 'T5' | 'T15', FbspTable> & { T6?: FbspTable }; checks: Record<string, unknown[]> }
/** Formato produzido por scripts/exec/ibge_perfil_extract.py. */
export type IbgeValue = number | string | null;
export interface IbgeJson { version: string; mode: 'munic' | 'estadic'; edition: number; sheet: string; columns: number; rows: Array<{ ufCode: number; cod?: number; v: Record<string, IbgeValue> }>; dictionary: Record<string, { label: string; context: string }>; missingOptional: string[] }

const row = (id: number, entity: number, w: RefWindow, value: number | null, flags: number, num: number | null = value, den: number | null = null): IndicatorRow =>
  ({ indicator_id: id, entity_id: entity, period_start: w.start, period_end: w.end, status: 2, numerator: num, denominator: den, value, flags: flags | (w.uncertain ? FLAG.refDateUncertain : 0) });
const win = (start: string, end: string, label: string, uncertain = false): RefWindow => ({ start, end, label, ...(uncertain ? { uncertain } : {}) });

export interface Recon { name: string; expected: number | null; got: number | null; ok: boolean }
const cmp = (name: string, expected: number | null, got: number | null): Recon => ({ name, expected, got, ok: expected === got });

// =================================================================== FBSP
export interface FbspArgs { ufEntityBySigla: Map<string, number>; brEntity: number; popByEntity: Map<number, number> }
export interface FbspBuilt { rows: IndicatorRow[]; recon: Recon[]; quality: Record<string, unknown> }
const UF_SIGLAS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
/** Células vazias admitidas: somente as explicadas por nota de rodapé do próprio documento. Qualquer outra é erro de layout (nunca é zero). */
const EXPECTED_BLANK = new Set(['T2:SP:CBM']);

function stateFlags(c: FbspCell): number {
  return c.state === 'UNAVAILABLE' ? FLAG.unavailable : c.state === 'NONE' ? FLAG.inexistent : c.state === 'BLANK' ? FLAG.composite : 0;
}
export function buildFbsp(j: FbspJson, a: FbspArgs): FbspBuilt {
  const out: IndicatorRow[] = []; const recon: Recon[] = []; const t2 = j.tables.T2;
  const entityOf = (k: string): number => { const e = k === 'BR' ? a.brEntity : a.ufEntityBySigla.get(k); if (e === undefined) throw new Error(`UF sem entidade: ${k}`); return e; };
  for (const k of ['BR', ...UF_SIGLAS]) if (!t2.rows[k]) throw new Error(`Tabela 2 sem a linha ${k}`);
  const existente = new Map<string, FbspRowRef>();   // `${corp}:${k}` → linha publicada (insumo das taxas)
  for (const corp of FBSP_CORPS) {
    for (const k of ['BR', ...UF_SIGLAS]) {
      if (k !== 'BR' && !corp.byUf) continue;
      const c = t2.rows[k]!.cells[corp.key]; if (!c) throw new Error(`Tabela 2 sem a coluna ${corp.key}`);
      if (c.state === 'BLANK' && !EXPECTED_BLANK.has(`T2:${k}:${corp.key}`)) throw new Error(`célula vazia inesperada na Tabela 2: ${k}/${corp.key}`);
      let flags = stateFlags(c);
      if (corp.key === 'PM' && k === 'SP') flags |= FLAG.composite;
      if (corp.key === 'PM' && k === 'RJ') flags |= FLAG.refDateUncertain;
      const value = c.state === 'NUM' ? c.v : c.state === 'NONE' ? 0 : null;
      const r = row(corp.id, entityOf(k), corp.ref, value, flags);
      out.push(r); existente.set(`${corp.key}:${k}`, { row: r, state: c.state });
    }
  }
  // soma das UFs = total nacional (somente colunas aditivas e por UF)
  for (const corp of FBSP_CORPS.filter(c => c.byUf)) {
    const br = t2.rows.BR!.cells[corp.key]!.v; const sum = UF_SIGLAS.reduce((n, k) => n + (t2.rows[k]!.cells[corp.key]!.v ?? 0), 0);
    recon.push(cmp(`T2 ${corp.key}: Σ UFs = Brasil`, br, sum));
  }
  // linha a linha: soma das corporações = total da linha (célula vazia/indisponível conta zero)
  for (const k of ['BR', ...UF_SIGLAS]) {
    const cells = t2.rows[k]!.cells; const s = FBSP_CORPS.reduce((n, c) => n + (cells[c.key]!.v ?? 0), 0);
    recon.push(cmp(`T2 linha ${k}: Σ corporações = Total`, cells.TOTAL!.v, s));
  }
  // previsto × existente (Tabelas 3, 4 e 5)
  for (const p of FBSP_PLANS) {
    const t = j.tables[p.table];
    for (const k of ['BR', ...UF_SIGLAS]) {
      const cells = t.rows[k]?.cells; if (!cells) throw new Error(`Tabela ${p.table} sem a linha ${k}`);
      const ent = entityOf(k); const prev = cells.PREVISTO!; const ex = cells.EXISTENTE!; const pct = cells.RELACAO_PCT!;
      const t2v = t2.rows[k]!.cells[p.corp]!.v;
      if (ex.state !== 'NUM' || ex.v !== t2v) throw new Error(`Tabela ${p.table} ${k}: existente ${ex.raw} difere da Tabela 2 (${t2v})`);
      const flags = (p.corp === 'PM' && k === 'RJ' ? FLAG.refDateUncertain : 0) | (p.corp === 'PM' && k === 'SP' ? FLAG.composite : 0);
      out.push(row(p.previsto, ent, MAR_25, prev.state === 'NUM' ? prev.v : null, flags | stateFlags(prev)));
      if (prev.state === 'NUM' && prev.v! > 0) {
        const occ = ex.v! / prev.v! * 100;
        if (pct.state === 'NUM' && Math.abs(occ - pct.v!) > 0.051) throw new Error(`Tabela ${p.table} ${k}: ocupação calculada ${occ.toFixed(2)} ≠ impressa ${pct.raw}`);
        out.push(row(p.ocupacao, ent, MAR_25, occ, flags, ex.v, prev.v));
        out.push(row(p.diferenca, ent, MAR_25, prev.v! - ex.v!, flags, prev.v, ex.v));
      }
    }
    recon.push(cmp(`${p.table} previsto: Σ UFs = Brasil`, t.rows.BR!.cells.PREVISTO!.v, UF_SIGLAS.reduce((n, k) => n + (t.rows[k]!.cells.PREVISTO!.v ?? 0), 0)));
  }
  // guardas municipais: Tabela 15
  const t15 = j.tables.T15; const RAIS = win('2024-01-01', '2025-01-01', 'RAIS 2024');
  for (const k of ['BR', ...UF_SIGLAS]) {
    const cells = t15.rows[k]?.cells; if (!cells) throw new Error(`Tabela 15 sem a linha ${k}`); const ent = entityOf(k);
    const put = (id: number, c: FbspCell, w: RefWindow) => { if (c.state === 'BLANK') throw new Error(`célula vazia inesperada na Tabela 15: ${k}`); out.push(row(id, ent, w, c.state === 'NUM' ? c.v : c.state === 'NONE' ? 0 : null, stateFlags(c))); };
    put(FBSP_GCM_IDS.munFinal, cells.MUN_FINAL!, GCM_FINAL); put(FBSP_GCM_IDS.efRais, cells.EF_RAIS2024!, RAIS); put(FBSP_GCM_IDS.munRais, cells.MUN_RAIS2024!, RAIS);
    const gcm = t2.rows[k]!.cells.GCM!; const fin = cells.EF_FINAL!;
    if (gcm.state !== fin.state || gcm.v !== fin.v) throw new Error(`GCM ${k}: Tabela 2 (${gcm.raw}) ≠ Tabela 15 final (${fin.raw})`);
  }
  for (const col of ['MUN_FINAL', 'EF_FINAL', 'EF_RAIS2024', 'MUN_RAIS2024'] as const) recon.push(cmp(`T15 ${col}: Σ UFs = Brasil`, t15.rows.BR!.cells[col]!.v, UF_SIGLAS.reduce((n, k) => n + (t15.rows[k]!.cells[col]!.v ?? 0), 0)));
  // taxas por 100 mil (UF): numerador publicado × população da UF em 2025; SP herda a marca "composite" na PM
  for (const r of FBSP_RATES) {
    const corp = FBSP_CORPS.find(c => c.key === r.corp)!;
    for (const k of UF_SIGLAS) {
      const src = existente.get(`${r.corp}:${k}`)!; const pop = a.popByEntity.get(entityOf(k));
      if (src.row.value == null || src.state !== 'NUM' || !pop || pop <= 0) continue;
      out.push(row(r.id, entityOf(k), corp.ref, src.row.value / pop * 100000, (src.row.flags ?? 0) & (FLAG.composite | FLAG.refDateUncertain), src.row.value, pop));
    }
  }
  const quality = { rows: out.length, perIndicator: countBy(out), recon: recon.filter(r => !r.ok).length, reconChecks: recon.length, blankCells: ['SP:CBM'], version: j.version };
  const bad = recon.filter(r => !r.ok); if (bad.length) throw new Error(`reconciliação do Raio-X falhou: ${bad.map(b => `${b.name} esperado ${b.expected} obtido ${b.got}`).join('; ')}`);
  return { rows: out, recon, quality };
}
interface FbspRowRef { row: IndicatorRow; state: FbspCell['state'] }
const MAR_25 = win('2025-03-01', '2025-04-01', 'março/2025');
const GCM_FINAL = win('2025-01-01', '2026-01-01', '2025', true);
const countBy = (rows: IndicatorRow[]): Record<number, number> => { const o: Record<number, number> = {}; for (const r of rows) o[r.indicator_id] = (o[r.indicator_id] ?? 0) + 1; return o; };

// =================================================================== dicionário (guarda de layout)
export function assertDictionary(j: IbgeJson, vars: Array<{ v: string; expectLabel: string; ctx?: string[] }>, refYear: number): void {
  const bad: string[] = [];
  for (const x of vars) {
    const d = j.dictionary[x.v];
    if (!d) { bad.push(`${x.v}: ausente do dicionário`); continue; }
    if (!d.label.includes(x.expectLabel)) bad.push(`${x.v}: rótulo "${d.label}" não contém "${x.expectLabel}"`);
    for (const c of x.ctx ?? []) { const need = c.replace('{Y}', String(refYear)); if (!d.context.includes(need)) bad.push(`${x.v}: contexto "${d.context}" não contém "${need}"`); }
  }
  if (bad.length) throw new Error(`layout do dicionário IBGE mudou: ${bad.join(' | ')}`);
}
/** Respostas das pesquisas. "-" = pergunta não aplicável (não gera linha). 2019 usa "Recusa"/"Não soube informar"; 2023 usa "Não informou". */
type Answer = { kind: 'yes' } | { kind: 'no' } | { kind: 'notInformed' } | { kind: 'refused' } | { kind: 'na' } | { kind: 'num'; v: number } | { kind: 'unknown'; raw: string };
export function parseAnswer(raw: IbgeValue | undefined): Answer {
  if (typeof raw === 'number') return { kind: 'num', v: raw };
  const t = String(raw ?? '').replace(/^\(\*\)\s*/, '').trim();
  if (t === 'Sim') return { kind: 'yes' }; if (t === 'Não') return { kind: 'no' }; if (t === '-') return { kind: 'na' };
  if (t === 'Não informou' || t === 'Não soube informar') return { kind: 'notInformed' }; if (t === 'Recusa') return { kind: 'refused' };
  return { kind: 'unknown', raw: String(raw) };
}
const STATE_FLAG = { notInformed: FLAG.notInformed, refused: FLAG.refused } as const;

// =================================================================== ESTADIC
export interface EstadicBuilt { rows: IndicatorRow[]; respondents: Record<string, string[]>; sums: Record<number, number>; quality: Record<string, unknown> }
export function buildEstadic(j: IbgeJson, a: { ufEntityByCode: Map<number, number>; edition: IbgeEdition }): EstadicBuilt {
  const ed = a.edition; if (ed.mode !== 'estadic' || j.mode !== 'estadic' || j.edition !== ed.year) throw new Error(`ESTADIC: edição do arquivo (${j.mode} ${j.edition}) ≠ esperada (${ed.key})`);
  assertDictionary(j, ESTADIC_VARS.map(v => ({ v: v.v, expectLabel: v.expectLabel, ctx: v.ctx })), ed.refYear);
  if (j.rows.length !== 27) throw new Error(`ESTADIC: ${j.rows.length} linhas (esperado 27)`);
  const out: IndicatorRow[] = []; const respondents: Record<string, string[]> = {}; const hm: string[] = []; const sums: Record<number, number> = {};
  const seen = new Set<number>();
  for (const r of j.rows) {
    const ufCode = Number(r.ufCode); const ent = a.ufEntityByCode.get(ufCode); if (ent === undefined) throw new Error(`ESTADIC: UF desconhecida ${ufCode}`);
    if (seen.has(ufCode)) throw new Error(`ESTADIC: UF repetida ${ufCode}`); seen.add(ufCode);
    for (const v of ESTADIC_VARS) {
      const ans = parseAnswer(r.v[v.v]); let value: number | null; let flags = 0;
      if (ans.kind === 'num') value = ans.v;
      else if (v.measure === 'existencia' && ans.kind === 'yes') value = 1;
      else if (v.measure === 'existencia' && ans.kind === 'no') value = 0;
      else if (ans.kind === 'notInformed' || ans.kind === 'refused') { value = null; flags = STATE_FLAG[ans.kind]; }
      else if (ans.kind === 'na') continue;   // pergunta não aplicável: sem linha
      else throw new Error(`ESTADIC ${ufCode}/${v.v}: valor inesperado ${JSON.stringify(r.v[v.v])}`);
      if (value != null) { (respondents[v.v] ??= []).push(String(ufCode)); sums[v.id] = (sums[v.id] ?? 0) + value; }
      out.push(row(v.id, ent, ed.ref, value, flags));
    }
    for (const [h, m, t] of [['ESEG271', 'ESEG272', 'ESEG273'], ['ESEG491', 'ESEG492', 'ESEG493']] as const) {
      const x = [r.v[h], r.v[m], r.v[t]]; if (x.every(n => typeof n === 'number') && (x[0] as number) + (x[1] as number) !== (x[2] as number)) hm.push(`${ufCode}:${t}`);
    }
  }
  if (hm.length) throw new Error(`ESTADIC: homens + mulheres ≠ total em ${hm.join(', ')}`);
  return { rows: out, respondents, sums, quality: { edition: ed.key, rows: out.length, perIndicator: countBy(out), sums, respondents: Object.fromEntries(Object.entries(respondents).map(([k, v]) => [k, v.length])), version: j.version } };
}

// =================================================================== MUNIC
export interface MunicUfStats { ufCode: number; municipios: number; comGuarda: number; semGuarda: number; naoInformou: number; recusa: number; efetivo: number; comDelegaciaPc: number; zeroDeclarado: number; semEfetivoNumerico: number }
export interface MunicBuilt { rows: IndicatorRow[]; stats: MunicUfStats; unmatched: number[]; quality: Record<string, unknown> }
/** expectRows existe só para testes com amostras pequenas; produção usa as 5.570 linhas da pesquisa. */
export function buildMunic(j: IbgeJson, a: { ufCode: number; ufEntity: number; dir: EntityDir; edition: IbgeEdition; expectRows?: number }): MunicBuilt {
  const ed = a.edition; if (ed.mode !== 'munic' || j.mode !== 'munic' || j.edition !== ed.year) throw new Error(`MUNIC: edição do arquivo (${j.mode} ${j.edition}) ≠ esperada (${ed.key})`);
  const vars = MUNIC_VARS.filter(v => j.dictionary[v.v] !== undefined || (ed.key === 'munic2023'));
  const missingCore = MUNIC_VARS.filter(v => v.core && !j.dictionary[v.v]); if (missingCore.length) throw new Error(`MUNIC: variáveis obrigatórias ausentes ${missingCore.map(v => v.v).join(',')}`);
  if (ed.key === 'munic2023' && j.missingOptional.length) throw new Error(`MUNIC 2023: variáveis ausentes ${j.missingOptional.join(',')}`);
  assertDictionary(j, vars.map(v => ({ v: v.v, expectLabel: v.expectLabel, ctx: ed.datedContext && v.datedCtx ? [v.datedCtx] : [] })), ed.refYear);
  const expectRows = a.expectRows ?? 5570; if (j.rows.length !== expectRows) throw new Error(`MUNIC: ${j.rows.length} linhas (esperado ${expectRows})`);
  const out: IndicatorRow[] = []; const unmatched: number[] = [];
  const st: MunicUfStats = { ufCode: a.ufCode, municipios: 0, comGuarda: 0, semGuarda: 0, naoInformou: 0, recusa: 0, efetivo: 0, comDelegaciaPc: 0, zeroDeclarado: 0, semEfetivoNumerico: 0 };
  const codes = new Set<number>();
  for (const r of j.rows) {
    const cod = Number(r.cod); if (!Number.isInteger(cod)) throw new Error(`MUNIC: código municipal inválido ${String(r.cod)}`);
    if (codes.has(cod)) throw new Error(`MUNIC: município repetido ${cod}`); codes.add(cod);
    if (Number(r.ufCode) !== a.ufCode) continue;
    const ent = a.dir.byIbge6.get(String(Math.floor(cod / 10))); if (ent === undefined) { unmatched.push(cod); continue; }
    st.municipios++;
    const guarda = parseAnswer(r.v.MSEG27);
    if (guarda.kind === 'yes') st.comGuarda++; else if (guarda.kind === 'no') st.semGuarda++; else if (guarda.kind === 'notInformed') st.naoInformou++; else if (guarda.kind === 'refused') st.recusa++; else throw new Error(`MUNIC ${cod}: MSEG27 inesperado ${JSON.stringify(r.v.MSEG27)}`);
    for (const v of vars) {
      if (!(v.v in r.v)) continue;   // variável opcional ausente nesta edição
      const ans = parseAnswer(r.v[v.v]); let value: number | null; let flags = 0; const w = v.kind === 'count' ? ed.ref : ed.survey;
      if (ans.kind === 'na') continue;   // pergunta não aplicável (ex.: efetivo de quem não tem guarda): sem linha
      if (v.kind === 'bool') {
        if (ans.kind === 'yes') value = 1; else if (ans.kind === 'no') value = 0; else if (ans.kind === 'notInformed' || ans.kind === 'refused') { value = null; flags = STATE_FLAG[ans.kind]; } else throw new Error(`MUNIC ${cod}/${v.v}: valor inesperado ${JSON.stringify(r.v[v.v])}`);
      } else {
        if (ans.kind === 'num') { value = ans.v; if (ans.v === 0) { flags = FLAG.zeroAmbiguous; if (v.v === 'MSEG283') st.zeroDeclarado++; } }
        else if (ans.kind === 'notInformed' || ans.kind === 'refused') { value = null; flags = STATE_FLAG[ans.kind]; }
        else throw new Error(`MUNIC ${cod}/${v.v}: valor inesperado ${JSON.stringify(r.v[v.v])}`);
        if (v.v === 'MSEG283') { if (guarda.kind !== 'yes' && value != null) throw new Error(`MUNIC ${cod}: efetivo informado sem guarda`); if (value != null) st.efetivo += value; else st.semEfetivoNumerico++; }
      }
      out.push(row(v.id, ent, w, value, flags));
    }
    if (parseAnswer(r.v.MSEG161).kind === 'yes') st.comDelegaciaPc++;
  }
  // agregados da UF (entidade UF) = soma dos municípios da própria carga
  const semResp = st.naoInformou + st.recusa; const partial = semResp > 0 ? FLAG.partialCoverage : 0;
  out.push(row(MUNIC_UF_AGG.guardas, a.ufEntity, ed.survey, st.comGuarda, partial));
  out.push(row(MUNIC_UF_AGG.efetivo, a.ufEntity, ed.ref, st.efetivo, partial));
  out.push(row(MUNIC_UF_AGG.semResposta, a.ufEntity, ed.survey, semResp, 0));
  out.push(row(MUNIC_UF_AGG.delegacia, a.ufEntity, ed.survey, st.comDelegaciaPc, partial));
  return { rows: out, stats: st, unmatched, quality: { edition: ed.key, ...st, rows: out.length, unmatched: unmatched.length, version: j.version } };
}

// =================================================================== SIAPE
/** Formato produzido por scripts/exec/siape_extract.py (somente contagens por órgão). */
export interface SiapeJson { version: string; competence: number; file_rows: number; orgs: Record<string, { name: string | null; rows: number; distinct: number; by_tipo: Record<string, number>; situacao: Record<string, number>; uf_sigiloso: number; cargo_sigiloso: number }> }
export interface SiapeBuilt { rows: IndicatorRow[]; quality: Record<string, unknown> }
const ymWindow = (ym: number): RefWindow => {
  const y = Math.floor(ym / 100), m = ym % 100; const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; const p = (n: number) => String(n).padStart(2, '0');
  return { start: `${y}-${p(m)}-01`, end: `${ny}-${p(nm)}-01`, label: `${y}-${p(m)}` };
};
export function buildSiape(j: SiapeJson, a: { brEntity: number }): SiapeBuilt {
  if (!Number.isInteger(j.competence) || j.competence < 201301) throw new Error(`SIAPE: competência inválida ${j.competence}`);
  const w = ymWindow(j.competence); const out: IndicatorRow[] = []; const q: Record<string, unknown> = { competence: j.competence, fileRows: j.file_rows, version: j.version };
  for (const o of SIAPE_ORGS) {
    const x = j.orgs[o.cod]; if (!x || x.rows <= 0) throw new Error(`SIAPE ${j.competence}: órgão ${o.cod} sem registros`);
    if (!x.name || !x.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().includes(o.cod === '20115' ? 'POLICIA FEDERAL' : 'POLICIA RODOVIARIA FEDERAL')) throw new Error(`SIAPE ${j.competence}: nome do órgão ${o.cod} inesperado (${x.name})`);
    const tipoSum = Object.values(x.by_tipo).reduce((n, v) => n + v, 0); if (tipoSum !== x.rows) throw new Error(`SIAPE ${j.competence} ${o.cod}: Σ por tipo ${tipoSum} ≠ linhas ${x.rows}`);
    out.push(row(o.total, a.brEntity, w, x.rows, 0)); out.push(row(o.cargo, a.brEntity, w, x.by_tipo['Cargo'] ?? 0, 0));
    q[o.key] = { rows: x.rows, cargo: x.by_tipo['Cargo'] ?? 0, byTipo: x.by_tipo, distinctIds: x.distinct, ufSigiloso: x.uf_sigiloso, cargoSigiloso: x.cargo_sigiloso, situacao: x.situacao };
  }
  return { rows: out, quality: q };
}
