import { sha256 } from './publication.ts';

/**
 * Cadastro de escolas do Censo Escolar (P10.1): validação e montagem das fatias UF × edição. Puro (sem banco): testável com linhas sintéticas.
 * Contrato: docs/executivo-collector-plan/educacao-p10/contrato_censo_escolar.md e contrato_identidade_escolas.md.
 * Regras de significado (não mudar sem versionar EDU_VERSION):
 *  - Ausência de uma escola numa edição NÃO é fechamento. A situação só vem do campo oficial TP_SITUACAO_FUNCIONAMENTO (1 em atividade, 2 paralisada, 3 extinta no ano, 4 extinta em anos anteriores).
 *  - "Com matrícula" (bit0) = QT_MAT_BAS > 0 (matrícula da educação básica; escola só com atividade complementar/AEE não tem). "Universo" (bit1) = em atividade E com matrícula,
 *    o recorte da Sinopse Estatística (reconciliado em RECONCILIACAO_CENSO_2025.md).
 *  - Cadastro (todas as linhas do arquivo) ≠ escola ativa ≠ escola com matrícula ≠ escola pública ≠ rede municipal ≠ escola localizada no município.
 */
export const EDU_VERSION = { parser: 'edu-censo-1', publish: 'edu-pub-1' } as const;
export const EDU_FLAG = { withEnrollment: 1, universe: 2, nameMissing: 4 } as const;
export const EDU_DEP: Record<number, string> = { 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 4: 'Privada' };
export const EDU_LOC: Record<number, string> = { 1: 'Urbana', 2: 'Rural' };
export const EDU_SIT: Record<number, string> = { 0: 'Situação não disponível na edição', 1: 'Em atividade', 2: 'Paralisada', 3: 'Extinta (no ano da edição)', 4: 'Extinta (em anos anteriores)' };
export const eduCompetence = (year: number): number => year * 100 + 5;   // referência do Censo: última quarta-feira de maio

/** Linha lida do TSV de staging (scripts/exec/censo_escola_extract.py); tudo texto, sem interpretação. */
export interface CensoRow { row: number; inep: string; ibge7: string; uf: string; name: string; dep: string; loc: string; sit: string; mat: string }
export interface EduMunicipality { entityId: number; ufCode: number }
export type EduReject = 'INEP_INVALIDO' | 'INEP_DUPLICADO' | 'MUNICIPIO_INEXISTENTE' | 'UF_INCOMPATIVEL' | 'DEPENDENCIA_INVALIDA' | 'LOCALIZACAO_INVALIDA' | 'SITUACAO_INVALIDA';

export interface EduSchoolYearRow { inep: number; year: number; entity_id: number; name: string; dep: number; loc: number | null; sit: number; flags: number }
export interface EduCovRow { year: number; uf: number; layout: number; rows_in: number; valid: number; rejected: number; active: number; with_mat: number; univ: number; muns: number }
export interface EduSlice { uf: number; rows: EduSchoolYearRow[]; cov: EduCovRow; rejects: Array<{ row: number; reason: EduReject }> }
export interface EduYearBuilt { year: number; slices: Map<number, EduSlice>; rejects: Array<{ row: number; ufFile: string; reason: EduReject }>; rowsIn: number }

/** Famílias de layout do arquivo. 1 = CSV único por ano (2007–2024, nomenclatura harmonizada pelo INEP); 2 = tabelas separadas (2025+). */
export const eduLayoutOf = (year: number): 1 | 2 => year >= 2025 ? 2 : 1;

const INT = /^\d+$/;
export function buildEduYear(year: number, rows: CensoRow[], municipalities: Map<string, EduMunicipality>): EduYearBuilt {
  const seen = new Set<string>(); const slices = new Map<number, EduSlice>(); const rejects: EduYearBuilt['rejects'] = [];
  const sliceOf = (uf: number): EduSlice => { let s = slices.get(uf); if (!s) { s = { uf, rows: [], cov: { year, uf, layout: eduLayoutOf(year), rows_in: 0, valid: 0, rejected: 0, active: 0, with_mat: 0, univ: 0, muns: 0 }, rejects: [] }; slices.set(uf, s); } return s; };
  for (const r of rows) {
    const reject = (reason: EduReject, uf?: number) => { rejects.push({ row: r.row, ufFile: r.uf, reason }); if (uf != null) { const s = sliceOf(uf); s.cov.rows_in++; s.cov.rejected++; s.rejects.push({ row: r.row, reason }); } };
    const mun = municipalities.get(r.ibge7);
    const ufHint = mun?.ufCode;   // a UF da fatia é a do município cadastrado; sem município, a linha só aparece na lista global de rejeições
    if (!/^\d{8}$/.test(r.inep) || Number(r.inep) < 10_000_000) { reject('INEP_INVALIDO', ufHint); continue; }
    if (seen.has(r.inep)) { reject('INEP_DUPLICADO', ufHint); continue; }
    seen.add(r.inep);
    if (!mun) { reject('MUNICIPIO_INEXISTENTE'); continue; }
    if (String(mun.ufCode) !== r.uf || !r.ibge7.startsWith(r.uf)) { reject('UF_INCOMPATIVEL', mun.ufCode); continue; }
    const dep = INT.test(r.dep) ? Number(r.dep) : NaN; if (!(dep >= 1 && dep <= 4)) { reject('DEPENDENCIA_INVALIDA', mun.ufCode); continue; }
    const loc = r.loc === '' ? null : INT.test(r.loc) ? Number(r.loc) : NaN; if (loc !== null && !(loc === 1 || loc === 2)) { reject('LOCALIZACAO_INVALIDA', mun.ufCode); continue; }
    const sit = INT.test(r.sit) ? Number(r.sit) : NaN; if (!(sit >= 1 && sit <= 4)) { reject('SITUACAO_INVALIDA', mun.ufCode); continue; }
    const mat = INT.test(r.mat) ? Number(r.mat) : null;
    const name = r.name.trim();
    let flags = 0; if (mat !== null && mat > 0) flags |= EDU_FLAG.withEnrollment; if (sit === 1 && (flags & EDU_FLAG.withEnrollment)) flags |= EDU_FLAG.universe; if (!name) flags |= EDU_FLAG.nameMissing;
    const s = sliceOf(mun.ufCode);
    s.rows.push({ inep: Number(r.inep), year, entity_id: mun.entityId, name: name || `Escola ${r.inep}`, dep, loc, sit, flags });
    s.cov.rows_in++; s.cov.valid++; if (sit === 1) s.cov.active++; if (flags & EDU_FLAG.withEnrollment) s.cov.with_mat++; if (flags & EDU_FLAG.universe) s.cov.univ++;
  }
  for (const s of slices.values()) s.cov.muns = new Set(s.rows.map(x => x.entity_id)).size;
  return { year, slices, rejects, rowsIn: rows.length };
}

/** Impressão da fatia: arquivo de origem + versões + conteúdo. Mesma entrada → mesmo hash → NO_CHANGE. */
export const eduSliceFingerprint = (fileShas: string[], slice: EduSlice): string =>
  sha256(`${fileShas.join(',')}:${EDU_VERSION.parser}:${EDU_VERSION.publish}:` + JSON.stringify(slice.rows.map(r => [r.inep, r.entity_id, r.name, r.dep, r.loc, r.sit, r.flags]).sort((a, b) => (a[0] as number) - (b[0] as number))) + JSON.stringify(slice.cov));
