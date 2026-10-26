import { EDU_OFFER_COLS } from './specs.ts';
import { sha256 } from './publication.ts';

/**
 * Matrículas, turmas e oferta por escola (P10.2): validação e montagem das fatias UF × edição. Puro (sem banco): testável com linhas sintéticas.
 * Contrato: docs/executivo-collector-plan/educacao-p102-execucao/MODELO_MATRICULAS_E_TURMAS.md. Regras de significado (não mudar sem versionar OFFER_VERSION):
 *  - Matrícula não é aluno: o mesmo aluno pode ter mais de uma matrícula. Turma é a unidade do Censo (QT_TUR_*), não "sala".
 *  - ADITIVAS (partição exata de QT_MAT_BAS, provada linha a linha em 2023–2025 e como resto não negativo em 2007–2022): infantil (creche+pré), fundamental (AI+AF), médio, EJA (fund+médio) e o RESTO
 *    = educação profissional não integrada ao médio (BAS − INF − FUND − MED − EJA, ≥ 0). Idem para turmas, com o EJA pelo total de turmas (em 2025, 4.696 turmas de EJA em 2.663 escolas não têm etapa fundamental/médio classificada).
 *  - TRANSVERSAIS (NUNCA somar às etapas): educação profissional total (inclui o técnico integrado, já contado em Médio), educação especial (classes comuns + exclusivas; recorte da matrícula básica), tempo integral, turno noturno e EAD.
 *  - NULL = a edição não tem a informação (turno antes de 2014, tempo integral de turmas antes de 2023); 0 = zero declarado. Nunca preencher zero onde a variável não existia.
 */
export const OFFER_VERSION = { parser: 'edu-oferta-2', publish: 'edu-oferta-pub-1' } as const;
export const offerCompetence = (year: number): number => year * 100 + 5;
export const offerLayoutOf = (year: number): 1 | 2 => year >= 2025 ? 2 : 1;
/** Primeira edição em que a variável é confiável: antes dela vira NULL (turno só partiu o total a partir de 2014; tempo integral de turmas só existe de 2023). */
export const OFFER_AVAILABLE_FROM: Record<string, number> = { mat_noturno: 2014, mat_ead: 2014, tur_int_inf: 2023, tur_int_fund: 2023, tur_int_med: 2023 };
/** Colunas só de validação, lidas do arquivo e nunca gravadas. */
export const OFFER_CHECK_COLS = ['v_mat_inf', 'v_mat_fund', 'v_mat_eja', 'v_mat_esp', 'v_mat_d', 'v_tur_inf', 'v_tur_fund', 'v_tur_esp'] as const;

export interface OfferRaw { row: number; inep: string; v: Record<string, string> }
export interface OfferSchool { uf: number; dep: number; loc: number | null }
export type OfferReject = 'INEP_INVALIDO' | 'INEP_DUPLICADO' | 'FORA_DO_CADASTRO' | 'VALOR_INVALIDO' | 'PARTICAO_INCONSISTENTE' | 'ESPECIAL_MAIOR_QUE_BASICA' | 'TURNO_INCONSISTENTE';
export type OfferRow = { inep: number; year: number } & Record<string, number | null>;
export interface OfferAggRow extends Record<string, number | null> { year: number; uf: number; dep: number; loc: number; schools: number }
export interface OfferCovRow { year: number; uf: number; layout: number; rows_in: number; valid: number; rejected: number; with_mat: number; with_tur: number; only_tur: number }
export interface OfferSlice { uf: number; rows: OfferRow[]; agg: OfferAggRow[]; cov: OfferCovRow; rejects: Array<{ row: number; reason: OfferReject }> }
export interface OfferYearBuilt { year: number; slices: Map<number, OfferSlice>; rejects: Array<{ row: number; reason: OfferReject }>; rowsIn: number; skippedNoOffer: number }

const INT = /^\d+$/;
const n0 = (x: number | null | undefined): number => x ?? 0;

export function buildOfferYear(year: number, rows: OfferRaw[], cadastro: Map<number, OfferSchool>): OfferYearBuilt {
  const seen = new Set<string>(); const slices = new Map<number, OfferSlice>(); const rejects: OfferYearBuilt['rejects'] = []; let skipped = 0;
  const sliceOf = (uf: number): OfferSlice => { let s = slices.get(uf); if (!s) { s = { uf, rows: [], agg: [], cov: { year, uf, layout: offerLayoutOf(year), rows_in: 0, valid: 0, rejected: 0, with_mat: 0, with_tur: 0, only_tur: 0 }, rejects: [] }; slices.set(uf, s); } return s; };
  for (const r of rows) {
    const ok = /^\d{8}$/.test(r.inep) && Number(r.inep) >= 10_000_000;
    const school = ok ? cadastro.get(Number(r.inep)) : undefined; const uf = school?.uf;
    const reject = (reason: OfferReject) => { rejects.push({ row: r.row, reason }); if (uf != null) { const s = sliceOf(uf); s.cov.rows_in++; s.cov.rejected++; s.rejects.push({ row: r.row, reason }); } };
    if (!ok) { reject('INEP_INVALIDO'); continue; }
    if (seen.has(r.inep)) { reject('INEP_DUPLICADO'); continue; }
    seen.add(r.inep);
    if (!school) { reject('FORA_DO_CADASTRO'); continue; }
    const m: Record<string, number | null> = {}; let bad = false;
    for (const c of [...EDU_OFFER_COLS, ...OFFER_CHECK_COLS]) {
      const raw = (r.v[c] ?? '').trim();
      if (raw === '') { m[c] = null; continue; }
      if (!INT.test(raw)) { bad = true; break; }
      m[c] = Number(raw);
    }
    if (bad) { reject('VALOR_INVALIDO'); continue; }
    for (const [c, from] of Object.entries(OFFER_AVAILABLE_FROM)) if (year < from) m[c] = null;
    const matBas = n0(m.mat_bas), turBas = n0(m.tur_bas);
    if (matBas <= 0 && turBas <= 0) { skipped++; continue; }
    // partições exatas (só quando a coluna-total de validação existe no arquivo)
    const eqc = (total: number | null | undefined, ...parts: Array<number | null | undefined>) => total == null || total === parts.reduce<number>((a, b) => a + n0(b), 0);
    if (!eqc(m.v_mat_inf, m.mat_inf_cre, m.mat_inf_pre) || !eqc(m.v_mat_fund, m.mat_fund_ai, m.mat_fund_af) || !eqc(m.v_mat_eja, m.mat_eja_fund, m.mat_eja_med) || !eqc(m.v_mat_esp, m.mat_esp_cc, m.mat_esp_ce)
      || !eqc(m.v_tur_inf, m.tur_inf_cre, m.tur_inf_pre) || !eqc(m.v_tur_fund, m.tur_fund_ai, m.tur_fund_af) || !eqc(m.v_tur_esp, m.tur_esp_cc, m.tur_esp_ce)) { reject('PARTICAO_INCONSISTENTE'); continue; }
    const stages = n0(m.mat_inf_cre) + n0(m.mat_inf_pre) + n0(m.mat_fund_ai) + n0(m.mat_fund_af) + n0(m.mat_med) + n0(m.mat_eja_fund) + n0(m.mat_eja_med);
    const tstages = n0(m.tur_inf_cre) + n0(m.tur_inf_pre) + n0(m.tur_fund_ai) + n0(m.tur_fund_af) + n0(m.tur_med) + n0(m.tur_eja);
    if (matBas < stages || turBas < tstages) { reject('PARTICAO_INCONSISTENTE'); continue; }
    if (n0(m.mat_esp_cc) + n0(m.mat_esp_ce) > matBas) { reject('ESPECIAL_MAIOR_QUE_BASICA'); continue; }
    if (year >= 2014 && m.v_mat_d != null && m.mat_noturno != null && matBas > 0 && n0(m.v_mat_d) + n0(m.mat_noturno) + n0(m.mat_ead) !== matBas) { reject('TURNO_INCONSISTENTE'); continue; }
    const row = { inep: Number(r.inep), year } as OfferRow; for (const c of EDU_OFFER_COLS) row[c] = m[c] ?? null;
    const s = sliceOf(school.uf); s.rows.push(row);
    s.cov.rows_in++; s.cov.valid++; if (matBas > 0) s.cov.with_mat++; if (turBas > 0) s.cov.with_tur++; if (turBas > 0 && matBas <= 0) s.cov.only_tur++;
    const key = `${school.dep}|${school.loc ?? 0}`; let a = (s as OfferSlice & { _agg?: Map<string, OfferAggRow> })._agg;
    if (!a) { a = new Map(); (s as OfferSlice & { _agg?: Map<string, OfferAggRow> })._agg = a; }
    let g = a.get(key); if (!g) { g = { year, uf: school.uf, dep: school.dep, loc: school.loc ?? 0, schools: 0 } as OfferAggRow; for (const c of EDU_OFFER_COLS) g[c] = null; g.mat_bas = 0; g.tur_bas = 0; a.set(key, g); }
    g.schools++; for (const c of EDU_OFFER_COLS) { const v = row[c]; if (v != null) g[c] = n0(g[c]) + v; }
  }
  for (const s of slices.values()) {
    const a = (s as OfferSlice & { _agg?: Map<string, OfferAggRow> })._agg; s.agg = a ? [...a.values()].sort((x, y) => x.dep - y.dep || x.loc - y.loc) : [];
    delete (s as OfferSlice & { _agg?: Map<string, OfferAggRow> })._agg; s.rows.sort((x, y) => x.inep - y.inep);
  }
  return { year, slices, rejects, rowsIn: rows.length, skippedNoOffer: skipped };
}

export const offerSliceFingerprint = (fileShas: string[], slice: OfferSlice): string =>
  sha256(`${fileShas.join(',')}:${OFFER_VERSION.parser}:${OFFER_VERSION.publish}:` + JSON.stringify(slice.rows.map(r => [r.inep, ...EDU_OFFER_COLS.map(c => r[c])])) + JSON.stringify(slice.cov));
