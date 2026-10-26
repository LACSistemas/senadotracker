import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow, Row } from './publication.ts';
import { COV, COV_CAVEAT, DCA_IE_COLUMNS, DCA_IG_COLUMNS, dcaIgColumn, FIN_SOURCE, FUNCTIONS, FUNCTION_BY_NAME, RREO_COLUMNS, SEC, SEC_SUB_BY_NAME, dcaIeColumn, normLabel, rreoColumn } from './financas-defs.ts';

/** Item de resposta do Siconfi (campos usados). Os rótulos de texto NÃO são persistidos: só os códigos de função/subfunção e a coluna normalizada. */
export interface SiconfiItem { exercicio: number; cod_ibge: number; anexo: string; coluna: string; cod_conta: string; conta: string; valor: number | null; populacao?: number | null }
export interface ParsedFin {
  /** `${conta}|${coluna}` → centavos. conta: 'TOT' | 'INTRA' | 'NN' (função) | '06.xxx' | 'FU06'. */
  facts: Map<string, number>;
  labels: Map<string, string>;
  caveats: number; ignored: number; unknown06: string[]; functionsSeen: Set<string>;
}
export const cents = (v: number): number => Math.round(v * 100);
const DCA_FN = /^(\d{2}) - (.+)$/, DCA_SUB = /^(\d{2})\.(\d{3}) - (.+)$/, DCA_DEMAIS = /^FU(\d{2}) - Demais/;
const fresh = (): ParsedFin => ({ facts: new Map(), labels: new Map(), caveats: 0, ignored: 0, unknown06: [], functionsSeen: new Set() });
function put(p: ParsedFin, conta: string, col: string, v: number | null, label?: string): void {
  if (v == null || !Number.isFinite(v)) { p.ignored++; return; }
  const k = `${conta}|${col}`; const c = cents(v); const had = p.facts.get(k);
  if (had !== undefined) { if (had !== c) p.caveats |= COV_CAVEAT.divergentDuplicates; return; }
  p.facts.set(k, c); if (label && !p.labels.has(conta)) p.labels.set(conta, label);
}
/** Mantém TODAS as funções (denominadores e comparações) e, da função 06, as subfunções. Serve ao Anexo I-E (estágios do exercício) e ao I-G (restos a pagar), que têm a mesma estrutura de contas. */
function parseDcaAnexo(items: SiconfiItem[], anexo: string, colFn: (c: string) => string | null, target = SEC): ParsedFin {
  const p = fresh();
  for (const it of items) {
    if (it.anexo !== anexo || it.cod_conta !== 'TotalDespesas') { p.ignored++; continue; }
    const col = colFn(it.coluna); if (!col) { p.ignored++; continue; }
    const n = it.conta; let m: RegExpExecArray | null;
    if ((m = DCA_SUB.exec(n))) { if (m[1] === target) put(p, `${m[1]}.${m[2]}`, col, it.valor, m[3]); else p.ignored++; }
    else if ((m = DCA_FN.exec(n))) { put(p, m[1]!, col, it.valor, m[2]); p.functionsSeen.add(m[1]!); }
    else if ((m = DCA_DEMAIS.exec(n))) { if (m[1] === target) put(p, `FU${target}`, col, it.valor, 'Demais Subfunções'); else p.ignored++; }
    else if (/^DESPESAS EXCETO INTRA/.test(normLabel(n))) put(p, 'TOT', col, it.valor);
    else if (/^DESPESAS INTRA/.test(normLabel(n))) put(p, 'INTRA', col, it.valor);
    else { p.ignored++; }
  }
  return p;
}
export const parseDcaIE = (items: SiconfiItem[]): ParsedFin => parseDcaAnexo(items, 'DCA-Anexo I-E', dcaIeColumn);
export const parseDcaIEEducation = (items: SiconfiItem[]): ParsedFin => parseDcaAnexo(items, 'DCA-Anexo I-E', dcaIeColumn, '12');
export const parseDcaIG = (items: SiconfiItem[]): ParsedFin => parseDcaAnexo(items, 'DCA-Anexo I-G', dcaIgColumn);
const FN_BY_NORM = new Map(FUNCTIONS.map(([c, n]) => [normLabel(n), c]));
/** RREO Anexo 02: as linhas não trazem código; função = nome oficial, subfunção = linhas seguintes (ordem estável dentro de cada coluna). Só o bloco "exceto intra-orçamentárias". */
export function parseRreo02(items: SiconfiItem[]): ParsedFin {
  const p = fresh(); const byCol = new Map<string, SiconfiItem[]>();
  for (const it of items) { if (it.anexo !== 'RREO-Anexo 02') { p.ignored++; continue; } const col = rreoColumn(it.coluna); if (!col) { p.ignored++; continue; } (byCol.get(col) ?? byCol.set(col, []).get(col)!).push(it); }
  for (const [col, list] of byCol) {
    let fn = '';
    for (const it of list) {
      const nm = normLabel(it.conta);
      if (/^DESPESAS \(EXCETO INTRA/.test(nm)) { put(p, 'TOT', col, it.valor); fn = ''; continue; }
      if (/^DESPESAS \(INTRA/.test(nm)) { put(p, 'INTRA', col, it.valor); fn = ''; continue; }
      if (/^TOTAL \(III\)/.test(nm)) continue;
      if (it.cod_conta !== 'RREO2TotalDespesas') { p.ignored++; continue; }
      const f = FN_BY_NORM.get(nm); const fu = /^FU(\d{2}) - /.exec(it.conta);
      if (f && !fu) { fn = f; put(p, f, col, it.valor, FUNCTIONS.find(x => x[0] === f)![1]); p.functionsSeen.add(f); continue; }
      const cur = fu ? fu[1]! : fn;
      if (cur === SEC) {
        const sub = SEC_SUB_BY_NAME.get(it.conta) ?? SEC_SUB_BY_NAME.get(it.conta.replace(/^FU06 - /, 'FU06 - '));
        if (sub) put(p, sub, col, it.valor, it.conta.replace(/^FU06 - /, '')); else { p.caveats |= COV_CAVEAT.unknownLabelInFn06; if (!p.unknown06.includes(it.conta)) p.unknown06.push(it.conta); }
      } else p.ignored++;
    }
  }
  return p;
}

const TOL = 100;   // R$ 1,00: soma de ~30 parcelas com centavos
/** Invariantes contábeis para partições mutuamente exclusivas (só quando todas as partes estão presentes): Σ funções = total; Σ subfunções (com "Demais") = função 06. */
export function checkFin(p: ParsedFin, cols: string[]): { caveats: number; detail: Array<{ col: string; check: string; a: number; b: number }> } {
  let caveats = p.caveats; const detail: Array<{ col: string; check: string; a: number; b: number }> = [];
  for (const col of cols) {
    const tot = p.facts.get(`TOT|${col}`);
    if (tot !== undefined) {
      let s = 0, any = false; for (const [f] of FUNCTIONS) { const v = p.facts.get(`${f}|${col}`); if (v !== undefined) { s += v; any = true; } }
      if (any && Math.abs(s - tot) > TOL) { caveats |= COV_CAVEAT.sumFunctionsNeTotal; detail.push({ col, check: 'Σ funções ≠ total', a: s, b: tot }); }
    }
    const f6 = p.facts.get(`${SEC}|${col}`);
    if (f6 !== undefined) {
      let s = 0; for (const [k, v] of p.facts) if (k.endsWith(`|${col}`) && (/^06\.\d{3}\|/.test(k) || k.startsWith('FU06|'))) s += v;
      if (Math.abs(s - f6) > TOL) { caveats |= COV_CAVEAT.sumSubfunctionsNeFunction; detail.push({ col, check: 'Σ subfunções ≠ função 06', a: s, b: f6 }); }
    }
  }
  return { caveats, detail };
}

export interface FinEnteInput { entityId: number; status: number; items: SiconfiItem[] }
export interface FinSliceArgs { source: typeof FIN_SOURCE.dcaIE | typeof FIN_SOURCE.rreo02 | typeof FIN_SOURCE.dcaIG; year: number; periodo: number; pop: Map<number, number>; entities: FinEnteInput[]; ids: { conta: (code: string) => number; col: (code: string) => number } }
export interface FinSlice { facts: Row[]; cov: Row[]; indicators: IndicatorRow[]; quality: Record<string, unknown>; codes: Map<string, string>; failures: Array<{ entityId: number; col: string; check: string; a: number; b: number }> }
const OTHER_SUB = (k: string) => /^06\.\d{3}\|/.test(k) && !/^06\.(122|181|182|183)\|/.test(k) || k.startsWith('FU06|');
const stageBits = (cols: typeof DCA_IE_COLUMNS, p: ParsedFin) => cols.reduce((m, c) => m | (p.facts.has(`${SEC}|${c.code}`) ? c.bit : 0), 0);

/** Coleta de codes (conta → rótulo) que precisam existir no dicionário antes do build. */
export function collectCodes(parsed: ParsedFin[]): Map<string, string> {
  const m = new Map<string, string>(); for (const [c] of FUNCTIONS) m.set(c, FUNCTIONS.find(x => x[0] === c)![1]); m.set('TOT', 'Despesas exceto intra-orçamentárias (total)'); m.set('INTRA', 'Despesas intra-orçamentárias (total)');
  for (const p of parsed) for (const k of p.facts.keys()) { const c = k.split('|')[0]!; if (!m.has(c)) m.set(c, p.labels.get(c) ?? c); }
  return m;
}

export function buildFinSlice(a: FinSliceArgs): FinSlice {
  const isDca = a.source === FIN_SOURCE.dcaIE; const isRp = a.source === FIN_SOURCE.dcaIG; const cols = isRp ? DCA_IG_COLUMNS : isDca ? DCA_IE_COLUMNS : RREO_COLUMNS; const colCodes = cols.map(c => c.code);
  const facts: Row[] = [], cov: Row[] = [], indicators: IndicatorRow[] = [], failures: FinSlice['failures'] = []; const parsedAll: ParsedFin[] = [];
  const ps = `${a.year}-01-01`, pe = `${a.year + 1}-01-01`;
  const prelim = !isDca && !isRp && a.periodo < 6; const stat: 1 | 2 = prelim ? 1 : 2; const base = prelim ? FLAG.preliminary : 0;
  const counts: Record<string, number> = { entes: 0, notReported: 0, withFn06: 0, noFn06: 0, caveats: 0, facts: 0, indicators: 0 };
  const parsedBy = new Map<number, ParsedFin>();
  for (const e of a.entities) {
    counts.entes!++;
    if (e.status !== 200) { cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status: COV.SOURCE_UNAVAILABLE, items: 0, fn06: 0, stages: 0, caveats: 0 }); continue; }
    if (!e.items.length) { counts.notReported!++; cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status: COV.NOT_REPORTED, items: 0, fn06: 0, stages: 0, caveats: 0 }); continue; }
    const p = isRp ? parseDcaIG(e.items) : isDca ? parseDcaIE(e.items) : parseRreo02(e.items); parsedAll.push(p); parsedBy.set(e.entityId, p);
    const chk = checkFin(p, colCodes); for (const d of chk.detail) failures.push({ entityId: e.entityId, ...d });
    const fn06 = [...p.facts.keys()].some(k => k.startsWith(`${SEC}|`));
    const status = !fn06 ? COV.DECLARED_WITHOUT_FUNCTION : chk.caveats ? COV.PUBLISHED_WITH_CAVEATS : COV.PUBLISHED;
    if (fn06) counts.withFn06!++; else counts.noFn06!++; if (chk.caveats) counts.caveats!++;
    cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status, items: e.items.length, fn06: fn06 ? 1 : 0, stages: stageBits(cols, p), caveats: chk.caveats });
    for (const [k, v] of p.facts) { const [conta, col] = k.split('|') as [string, string]; facts.push({ entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, conta_id: a.ids.conta(conta), coluna_id: a.ids.col(col), valor: v }); }
    // ---- indicadores (R$ = centavos / 100; linha só quando a fonte trouxe a célula)
    const mk = (id: number, num: number | null, den: number | null, val: number | null, flags = 0) => { indicators.push({ indicator_id: id, entity_id: e.entityId, period_start: ps, period_end: pe, status: stat, numerator: num, denominator: den, value: val, flags: base | flags }); };
    const money = (id: number, key: string) => { const v = p.facts.get(key); if (v !== undefined) mk(id, v / 100, null, v / 100); return v; };
    const pop = a.pop.get(e.entityId); const popFlag = pop != null && pop < 20000 ? FLAG.smallN : 0;
    if (isRp) {
      const sum = (...ks: string[]) => { let t = 0, any = false; for (const k of ks) { const v = p.facts.get(`06|${k}`); if (v !== undefined) { t += v; any = true; } } return any ? t : undefined; };
      const pg = sum('RPNP_PAG', 'RPP_PAG'), cn = sum('RPNP_CANC', 'RPP_CANC'); if (pg !== undefined) mk(7021, pg / 100, null, pg / 100); if (cn !== undefined) mk(7022, cn / 100, null, cn / 100);
    } else if (isDca) {
      const emp = money(7001, '06|EMP'), liq = money(7002, '06|LIQ'), pag = money(7003, '06|PAG'); void liq; money(7004, '06|RPNP_INSC'); money(7005, '06|RPP_INSC');
      const tEmp = money(7006, 'TOT|EMP'); money(7007, 'TOT|PAG');
      ([['122', '06.122'], ['181', '06.181'], ['182', '06.182'], ['183', '06.183']] as const).forEach(([, c], i) => { money(7011 + i * 2, `${c}|EMP`); money(7012 + i * 2, `${c}|PAG`); });
      for (const [col, id] of [['EMP', 7019], ['PAG', 7020]] as const) { let s = 0, any = false; for (const [k, v] of p.facts) if (k.endsWith(`|${col}`) && OTHER_SUB(k)) { s += v; any = true; } if (any) mk(id, s / 100, null, s / 100); }
      if (emp !== undefined && tEmp !== undefined && tEmp > 0) mk(7031, emp / 100, tEmp / 100, emp / tEmp * 100);
      if (pag !== undefined && pop != null && pop > 0) mk(7032, pag / 100, pop, pag / 100 / pop, popFlag);
      if (emp !== undefined && pop != null && pop > 0) mk(7033, emp / 100, pop, emp / 100 / pop, popFlag);
      if (emp !== undefined && pag !== undefined && emp > 0) mk(7034, pag / 100, emp / 100, pag / emp * 100);
    } else {
      money(7041, '06|DOT_INI'); const dot = money(7042, '06|DOT_ATU'); const emp = money(7043, '06|EMP_ATE'); const liq = money(7044, '06|LIQ_ATE');
      if (emp !== undefined && dot !== undefined && dot > 0) mk(7045, emp / 100, dot / 100, emp / dot * 100);
      if (liq !== undefined && dot !== undefined && dot > 0) mk(7046, liq / 100, dot / 100, liq / dot * 100);
    }
  }
  counts.facts = facts.length; counts.indicators = indicators.length;
  return { facts, cov, indicators, codes: collectCodes(parsedAll), failures, quality: { source: a.source, year: a.year, periodo: a.periodo, ...counts, invariantFailures: failures.length } };
}

/** Versão aditiva da DCA para a função 12. Mantém os fatos no contrato compartilhado,
 * mas publica em dataset/tabela separados e nunca altera a fatia histórica da função 06. */
export function buildEducationFinSlice(a: FinSliceArgs): FinSlice {
  if (a.source !== FIN_SOURCE.dcaIE) throw new Error('Educação usa somente DCA I-E nesta fase');
  const cols = DCA_IE_COLUMNS; const facts: Row[] = []; const cov: Row[] = []; const indicators: IndicatorRow[] = []; const failures: FinSlice['failures'] = [];
  const parsedAll: ParsedFin[] = []; const ps = `${a.year}-01-01`; const pe = `${a.year + 1}-01-01`;
  const counts: Record<string, number> = { entes: 0, notReported: 0, withFn12: 0, noFn12: 0, caveats: 0, facts: 0, indicators: 0 };
  for (const e of a.entities) {
    counts.entes!++;
    if (e.status !== 200) { cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status: COV.SOURCE_UNAVAILABLE, items: 0, fn06: 0, fn12: 0, stages: 0, caveats: 0 }); continue; }
    if (!e.items.length) { counts.notReported!++; cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status: COV.NOT_REPORTED, items: 0, fn06: 0, fn12: 0, stages: 0, caveats: 0 }); continue; }
    const p = parseDcaIEEducation(e.items); parsedAll.push(p);
    const fn12 = [...p.facts.keys()].some(k => k.startsWith('12|')); const detail: Array<{ col: string; check: string; a: number; b: number }> = [];
    for (const col of cols.map(x => x.code)) { const f = p.facts.get(`12|${col}`); if (f === undefined) continue; let s = 0; for (const [k, v] of p.facts) if (k.endsWith(`|${col}`) && (/^12\.\d{3}\|/.test(k) || k.startsWith('FU12|'))) s += v; if (s && Math.abs(s - f) > 100) detail.push({ col, check: 'sumSubfunctionsNeFunction12', a: s, b: f }); }
    const caveats = p.caveats | (detail.length ? COV_CAVEAT.sumSubfunctionsNeFunction : 0); failures.push(...detail.map(d => ({ entityId: e.entityId, ...d })));
    const status = !fn12 ? COV.DECLARED_WITHOUT_FUNCTION : caveats ? COV.PUBLISHED_WITH_CAVEATS : COV.PUBLISHED; if (fn12) counts.withFn12!++; else counts.noFn12!++; if (caveats) counts.caveats!++;
    cov.push({ source: a.source, entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, status, items: e.items.length, fn06: 0, fn12: fn12 ? 1 : 0, stages: cols.reduce((m, c) => m | (p.facts.has(`12|${c.code}`) ? c.bit : 0), 0), caveats });
    for (const [k, v] of p.facts) { const [conta, col] = k.split('|') as [string, string]; if (!(conta === '12' || conta.startsWith('12.') || conta === 'FU12')) continue; facts.push({ entity_id: e.entityId, exercicio: a.year, periodo: a.periodo, conta_id: a.ids.conta(conta), coluna_id: a.ids.col(col), valor: v }); }
    const mk = (id: number, num: number | null, den: number | null, value: number | null, flags = 0) => indicators.push({ indicator_id: id, entity_id: e.entityId, period_start: ps, period_end: pe, status: 2, numerator: num, denominator: den, value, flags });
    const money = (id: number, key: string) => { const v = p.facts.get(key); if (v !== undefined) mk(id, v / 100, null, v / 100); return v; };
    const emp = money(7101, '12|EMP'); money(7102, '12|LIQ'); const pag = money(7103, '12|PAG'); money(7104, '12|RPNP_INSC'); money(7105, '12|RPP_INSC'); const totalEmp = money(7106, 'TOT|EMP'); money(7107, 'TOT|PAG');
    const subs = ['122','361','362','363','364','365','366','367','368']; subs.forEach((c, i) => { money(7120 + i * 2, `12.${c}|EMP`); money(7121 + i * 2, `12.${c}|PAG`); });
    const pop = a.pop.get(e.entityId); if (emp !== undefined && totalEmp !== undefined && totalEmp > 0) mk(7108, emp / 100, totalEmp / 100, emp / totalEmp * 100); if (emp !== undefined && pop != null && pop > 0) mk(7110, emp / 100, pop, emp / 100 / pop); if (pag !== undefined && pop != null && pop > 0) mk(7111, pag / 100, pop, pag / 100 / pop); if (emp !== undefined && pag !== undefined && emp > 0) mk(7109, pag / 100, emp / 100, pag / emp * 100);
  }
  counts.facts = facts.length; counts.indicators = indicators.length; return { facts, cov, indicators, codes: collectCodes(parsedAll), failures, quality: { source: a.source, functionCode: '12', year: a.year, periodo: a.periodo, ...counts, invariantFailures: failures.length } };
}
void FUNCTION_BY_NAME;
