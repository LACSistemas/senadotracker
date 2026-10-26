import { EDU_INFRA_AGG_COLS, EDU_INFRA_COLS } from './specs.ts';
import { INFRA_VARS, infraAvailable } from './educacao-infra-catalog.ts';
import { sha256 } from './publication.ts';

/**
 * Infraestrutura escolar (P10.3): validação e montagem das fatias UF × edição. Puro (sem banco): testável com linhas sintéticas.
 * Contrato: docs/executivo-collector-plan/educacao-p103-execucao/TAXONOMIA_INFRAESTRUTURA_ESCOLAR.md. Regras de significado (versionar INFRA_VERSION ao mudar):
 *  - Respostas AUTODECLARADAS de existência/uso. Não medem condição, funcionamento, manutenção nem qualidade; "tem internet" não é "internet para aprender".
 *  - O ZIP do Censo traz as colunas de TODAS as edições e preenche com 0 (ou deixa em branco) as que ainda não existiam: por isso o valor fora do intervalo de vigência da variável (catálogo)
 *    é descartado e vira NULL ("fora da edição"), nunca "não".
 *  - Universo: escola em atividade (TP_SITUACAO_FUNCIONAMENTO = 1) com identidade no cadastro da P10.1. Célula em branco = NÃO INFORMADO (NULL), nunca "não".
 *  - Percentual = sim ÷ (sim + não) dentro do mesmo grupo e edição; os "não informados" aparecem à parte.
 */
export const INFRA_VERSION = { parser: 'edu-infra-1', publish: 'edu-infra-pub-1' } as const;
export const infraCompetence = (year: number): number => year * 100 + 5;
export const infraLayoutOf = (year: number): 1 | 2 => year >= 2025 ? 2 : 1;
const SMALLINT_MAX = 32767;

export interface InfraRaw { row: number; inep: string; sit: string; v: Record<string, string> }
export interface InfraSchool { uf: number; dep: number; loc: number | null; withMat: boolean }
export type InfraReject = 'INEP_INVALIDO' | 'INEP_DUPLICADO' | 'FORA_DO_CADASTRO' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA';
export type InfraRow = { inep: number; year: number } & Record<string, number | boolean | null>;
export interface InfraAggRow extends Record<string, number | null> { year: number; uf: number; dep: number; loc: number; schools: number }
export interface InfraCovRow { year: number; uf: number; layout: number; rows_in: number; active: number; valid: number; rejected: number; answered: number; unanswered: number; with_mat: number; extreme: number; coded_unknown: number }
export interface InfraSlice { uf: number; rows: InfraRow[]; agg: InfraAggRow[]; cov: InfraCovRow; rejects: Array<{ row: number; reason: InfraReject }> }
export interface InfraYearBuilt { year: number; slices: Map<number, InfraSlice>; rejects: Array<{ row: number; reason: InfraReject }>; rowsIn: number; notActive: number }

const INT = /^\d+$/;

export function buildInfraYear(year: number, rows: InfraRaw[], cadastro: Map<number, InfraSchool>): InfraYearBuilt {
  const seen = new Set<string>(); const slices = new Map<number, InfraSlice>(); const rejects: InfraYearBuilt['rejects'] = []; let notActive = 0;
  const sliceOf = (uf: number): InfraSlice => { let s = slices.get(uf); if (!s) { s = { uf, rows: [], agg: [], cov: { year, uf, layout: infraLayoutOf(year), rows_in: 0, active: 0, valid: 0, rejected: 0, answered: 0, unanswered: 0, with_mat: 0, extreme: 0, coded_unknown: 0 }, rejects: [] }; slices.set(uf, s); } return s; };
  const aggs = new Map<number, Map<string, InfraAggRow>>();
  for (const r of rows) {
    const ok = /^\d{8}$/.test(r.inep) && Number(r.inep) >= 10_000_000;
    const school = ok ? cadastro.get(Number(r.inep)) : undefined; const uf = school?.uf;
    const reject = (reason: InfraReject) => { rejects.push({ row: r.row, reason }); if (uf != null) { const s = sliceOf(uf); s.cov.rows_in++; s.cov.rejected++; if (r.sit === '1') s.cov.active++; s.rejects.push({ row: r.row, reason }); } };
    if (!ok) { if (r.sit === '1') rejects.push({ row: r.row, reason: 'INEP_INVALIDO' }); continue; }
    if (seen.has(r.inep)) { reject('INEP_DUPLICADO'); continue; }
    seen.add(r.inep);
    if (!school) { if (r.sit === '1') rejects.push({ row: r.row, reason: 'FORA_DO_CADASTRO' }); continue; }
    const s = sliceOf(school.uf); s.cov.rows_in++;
    if (r.sit !== '1') { notActive++; continue; }
    s.cov.active++;
    const row = { inep: Number(r.inep), year } as InfraRow; let bad: InfraReject | null = null; let answered = false;
    for (const x of INFRA_VARS) {
      const raw = (r.v[x.code] ?? '').trim();
      if (!infraAvailable(x.code, year) || raw === '') { row[x.code] = null; continue; }   // fora da edição OU não informado
      if (x.kind === 'flag') {
        if (x.unknownCode && raw === x.unknownCode) { row[x.code] = null; s.cov.coded_unknown++; continue; }   // "9 - Não informado" do dicionário oficial: NULL, contado à parte
        if (raw !== '0' && raw !== '1') { bad = 'VALOR_INVALIDO'; break; }
        row[x.code] = raw === '1'; answered = true;
      } else {
        if (!INT.test(raw)) { bad = 'VALOR_INVALIDO'; break; }
        const n = Number(raw);
        if (x.extremeCode != null && n === x.extremeCode) { row[x.code] = null; s.cov.extreme++; continue; }   // "88888 - valor extremo" marcado pelo INEP: NULL, contado à parte, nunca somado
        if (n > SMALLINT_MAX) { bad = 'VALOR_FORA_DE_FAIXA'; break; }
        row[x.code] = n; answered = true;
      }
    }
    if (bad) { s.cov.rejected++; rejects.push({ row: r.row, reason: bad }); s.rejects.push({ row: r.row, reason: bad }); continue; }
    s.rows.push(row); s.cov.valid++; if (answered) s.cov.answered++; else s.cov.unanswered++; if (school.withMat) s.cov.with_mat++;
    let am = aggs.get(school.uf); if (!am) { am = new Map(); aggs.set(school.uf, am); }
    const key = `${school.dep}|${school.loc ?? 0}`; let g = am.get(key);
    if (!g) { g = { year, uf: school.uf, dep: school.dep, loc: school.loc ?? 0, schools: 0 } as InfraAggRow; for (const c of EDU_INFRA_AGG_COLS) g[c] = null; am.set(key, g); }
    g.schools++;
    for (const x of INFRA_VARS) {
      const val = row[x.code]; if (val == null) continue;
      if (x.kind === 'flag') { const k = val ? `${x.code}_t` : `${x.code}_f`; g[k] = (g[k] ?? 0) + 1; }
      else { g[`${x.code}_s`] = (g[`${x.code}_s`] ?? 0) + (val as number); g[`${x.code}_n`] = (g[`${x.code}_n`] ?? 0) + 1; }
    }
  }
  for (const s of slices.values()) {
    s.agg = [...(aggs.get(s.uf)?.values() ?? [])].sort((a, b) => a.dep - b.dep || a.loc - b.loc);
    // flags com algum "sim" e nenhum "não" (ou vice-versa) no grupo continuam com o outro lado = null; o read model trata null como 0 ao somar
    s.rows.sort((a, b) => a.inep - b.inep);
  }
  return { year, slices, rejects, rowsIn: rows.length, notActive };
}

export const infraSliceFingerprint = (fileShas: string[], slice: InfraSlice): string =>
  sha256(`${fileShas.join(',')}:${INFRA_VERSION.parser}:${INFRA_VERSION.publish}:` + JSON.stringify(slice.rows.map(r => [r.inep, ...EDU_INFRA_COLS.map(c => r[c])])) + JSON.stringify(slice.cov));
