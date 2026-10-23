import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
import { ymDate } from './ym.ts';
import type { EntityDir } from './seguranca-build.ts';
import type { VdeCrosswalk } from './seguranca-build.ts';
import { normalizeName } from './seguranca-defs.ts';
import type { CrimeDef } from './crime-defs.ts';

/**
 * Construtor genérico de fatias (fonte × UF × ano) da criminalidade estadual municipalizada. Entrada = registros já normalizados pelo adaptador da fonte (um por município × mês × código
 * original); saída = linhas de exec_ind_value (município, município ignorado da UF e UF), cobertura (exec_seg_cov) e qualidade. Regras:
 *  - valor ausente (null) NUNCA vira zero; zero só existe quando a fonte declara (`explicitZeros`) — nas fontes de eventos o município sem linha é "sem ocorrência registrada", não zero declarado;
 *  - município sem correspondência vai ao município ignorado da UF (nunca distribuído); Σ municípios + não atribuídos = UF por construção;
 *  - indicador composto é publicado como a fonte o entrega e NUNCA é somado a seus componentes; a conferência composto = Σ componentes é relatada, jamais ajustada;
 *  - microdados agregados pelo Cívica: pequenas contagens (1–2) em categorias sensíveis são suprimidas (value NULL + flag), o total da UF não;
 *  - meses não publicados pela fonte ficam fora (`months`); ano corrente e fase preliminar da fonte são preliminares.
 */
export interface CrimeRecord { ym: number; ibge7?: number | undefined; name?: string | undefined; code: string; value: number | null; prelim?: boolean | undefined }
export interface CrimeCov { uf: number; indicator_id: number; competence: number; mun_pairs: number; src_lines: number; dup_lines: number; nz_rows: number; uf_total: number; unassigned: number; status: number }
export interface CrimeBuildArgs {
  defs: CrimeDef[]; year: number; ufCode: number; dir: EntityDir; xw: VdeCrosswalk; currentYear: number; months: Set<number>;
  explicitZeros: boolean; duplicates: 'error' | 'sum'; suppressBelow?: number;
  /** Totais da UF informados pela própria fonte (`${código}|${ym}` → valor) para reconciliar com Σ municípios. */
  ufTotals?: Map<string, number>;
}
export interface CrimeSlice { rows: IndicatorRow[]; cov: CrimeCov[]; quality: Record<string, unknown>; compositeViolations: Array<{ ym: number; entity: number; code: string; composite: number; parts: number }>; reconciliation: Array<{ code: string; ym: number; municipalPlusUnassigned: number; source: number }> }
const nextYm = (ym: number) => ym % 100 === 12 ? (Math.floor(ym / 100) + 1) * 100 + 1 : ym + 1;
export const SUPPRESS_BELOW_DEFAULT = 3;

export function buildCrimeSlice(records: CrimeRecord[], a: CrimeBuildArgs): CrimeSlice {
  const byCode = new Map(a.defs.map(d => [d.code, d])); const ignored = a.dir.ignoredByUf.get(a.ufCode);
  if (ignored === undefined) throw new Error(`UF ${a.ufCode} sem município ignorado`);
  const prelimYear = a.year >= a.currentYear; const unmatched = new Set<string>(); const lines = new Map<string, number>();   // `${code}|${ym}` → linhas
  const cell = new Map<string, { code: string; ym: number; entity: number; v: number; prelim: boolean }>(); const seenKey = new Set<string>();
  const ufSum = new Map<string, number>(); const unassigned = new Map<string, number>(); const nzMun = new Map<string, Set<number>>();
  let used = 0, nullSkipped = 0, outOfScope = 0;
  for (const r of records) {
    if (Math.floor(r.ym / 100) !== a.year || !a.months.has(r.ym)) { outOfScope++; continue; }
    const d = byCode.get(r.code); if (!d) throw new Error(`código desconhecido na fonte ${a.defs[0]?.source}: "${r.code}" — atualizar o contrato (crime-defs.ts)`);
    if (r.value == null) { nullSkipped++; continue; }
    if (!Number.isFinite(r.value) || r.value < 0) throw new Error(`valor inválido (${r.value}) em ${r.code} ${r.ym}`);
    let entity: number | undefined = undefined;
    if (r.ibge7 != null) entity = a.dir.byIbge6.get(String(Math.floor(r.ibge7 / 10)));
    if (entity === undefined && r.name) entity = a.xw.byUfName.get(`${a.ufCode}|${normalizeName(r.name)}`);
    if (entity === undefined) { entity = ignored; unmatched.add(`${r.ibge7 ?? ''}:${r.name ?? ''}`); }
    const ck = `${r.code}|${r.ym}|${entity}`;
    if (a.duplicates === 'error') { const k2 = `${ck}|${r.ibge7 ?? r.name}`; if (seenKey.has(k2)) throw new Error(`linha duplicada na fonte: ${r.code} ${r.ym} ${r.ibge7 ?? r.name}`); seenKey.add(k2); }
    const cur = cell.get(ck); if (cur) { cur.v += r.value; cur.prelim = cur.prelim || !!r.prelim; } else cell.set(ck, { code: r.code, ym: r.ym, entity, v: r.value, prelim: !!r.prelim });
    const uk = `${r.code}|${r.ym}`; lines.set(uk, (lines.get(uk) ?? 0) + 1); ufSum.set(uk, (ufSum.get(uk) ?? 0) + r.value); used++;
    if (entity === ignored) unassigned.set(uk, (unassigned.get(uk) ?? 0) + r.value);
    if (r.value > 0 && entity !== ignored) { const s = nzMun.get(uk) ?? new Set<number>(); s.add(entity); nzMun.set(uk, s); }
  }
  if (unmatched.size > 5) throw new Error(`${unmatched.size} municípios sem correspondência no IBGE em ${a.ufCode}: ${[...unmatched].slice(0, 6).join(', ')}`);
  const rows: IndicatorRow[] = []; const cov: CrimeCov[] = []; const th = a.suppressBelow ?? SUPPRESS_BELOW_DEFAULT; let suppressed = 0;
  for (const c of [...cell.values()].sort((x, y) => x.ym - y.ym || x.code.localeCompare(y.code) || x.entity - y.entity)) {
    const d = byCode.get(c.code)!; if (c.v === 0 && !a.explicitZeros) continue;
    const prelim = prelimYear || c.prelim; const base = prelim ? FLAG.preliminary : 0;
    const supp = d.derived && d.sensitive && c.v > 0 && c.v < th && c.entity !== a.ufCode;
    if (supp) suppressed++;
    rows.push({ indicator_id: d.id, entity_id: c.entity, period_start: ymDate(c.ym), period_end: ymDate(nextYm(c.ym)), status: prelim ? 1 : 2, numerator: supp ? null : c.v, denominator: null, value: supp ? null : c.v, flags: base | (supp ? FLAG.suppressed : 0) });
  }
  for (const [uk, total] of [...ufSum.entries()].sort()) {
    const [code, ymS] = uk.split('|') as [string, string]; const ym = Number(ymS); const d = byCode.get(code)!; const prelim = prelimYear || [...cell.values()].some(c => c.code === code && c.ym === ym && c.prelim);
    if (total === 0 && !a.explicitZeros) continue;
    rows.push({ indicator_id: d.id, entity_id: a.ufCode, period_start: ymDate(ym), period_end: ymDate(nextYm(ym)), status: prelim ? 1 : 2, numerator: total, denominator: null, value: total, flags: (prelim ? FLAG.preliminary : 0) | (total === 0 ? FLAG.zeroAmbiguous : 0) });
    cov.push({ uf: a.ufCode, indicator_id: d.id, competence: ym, mun_pairs: nzMun.get(uk)?.size ?? 0, src_lines: lines.get(uk) ?? 0, dup_lines: 0, nz_rows: nzMun.get(uk)?.size ?? 0, uf_total: total, unassigned: unassigned.get(uk) ?? 0, status: total === 0 ? 2 : 1 });
  }
  // composto = Σ componentes (só relata)
  const violations: CrimeSlice['compositeViolations'] = []; const v = new Map<string, number>();
  for (const c of cell.values()) v.set(`${c.code}|${c.ym}|${c.entity}`, c.v);
  for (const d of a.defs) if (d.composite) for (const c of cell.values()) if (c.code === d.code) {
    const parts = d.composite.map(k => v.get(`${k}|${c.ym}|${c.entity}`)); if (parts.some(p => p === undefined)) continue;
    const sum = (parts as number[]).reduce((s, x) => s + x, 0); if (sum !== c.v) violations.push({ ym: c.ym, entity: c.entity, code: d.code, composite: c.v, parts: sum });
  }
  const recon: CrimeSlice['reconciliation'] = [];
  if (a.ufTotals) for (const [uk, src] of a.ufTotals) { const [code, ymS] = uk.split('|') as [string, string]; if (!a.months.has(Number(ymS)) || Math.floor(Number(ymS) / 100) !== a.year) continue; const mine = ufSum.get(uk) ?? 0; if (mine !== src) recon.push({ code, ym: Number(ymS), municipalPlusUnassigned: mine, source: src }); }
  return { rows, cov, compositeViolations: violations, reconciliation: recon,
    quality: { contract: 'crime-state-v1', source: a.defs[0]?.source, year: a.year, months: [...a.months].filter(m => Math.floor(m / 100) === a.year).sort(), recordsUsed: used, nullSkipped, outOfScope, unmatchedMunicipalities: [...unmatched].slice(0, 20), unmatchedCount: unmatched.size, suppressedCells: suppressed, compositeViolations: violations.length, reconciliationDiffs: recon.length, preliminary: prelimYear } };
}
