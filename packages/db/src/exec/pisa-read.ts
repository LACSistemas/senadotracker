import type { Pool } from 'pg';

/** P14.13 — PISA (OCDE, via OWID): Brasil, média OCDE e média dos participantes do PISA, por disciplina
 * e edição. Internacional, só nível-país — nunca comparar na mesma escala do Ideb/Saeb (INEP). */
type Q = Pick<Pool, 'query'>;
export type PisaSubject = 'MATEMATICA' | 'LEITURA' | 'CIENCIAS';
export interface PisaPointRow { edition: number; score: number }
export interface PisaSubjectComparison { brasil: PisaPointRow[]; mediaOcde: PisaPointRow[]; mediaParticipantes: PisaPointRow[] }
export type PisaComparison = Record<PisaSubject, PisaSubjectComparison>;

export async function getPisaComparison(q: Q): Promise<PisaComparison> {
  const rows = (await q.query<{ entity: string; subject: PisaSubject; edition: number; score: string }>(
    `SELECT entity, subject, edition, score FROM civica_exec.exec_pisa_score ORDER BY subject, entity, edition`,
  )).rows;
  const of = (subject: PisaSubject, entity: string): PisaPointRow[] => rows.filter(r => r.subject === subject && r.entity === entity).map(r => ({ edition: Number(r.edition), score: Number(r.score) }));
  const subjects: PisaSubject[] = ['MATEMATICA', 'LEITURA', 'CIENCIAS'];
  return Object.fromEntries(subjects.map(s => [s, { brasil: of(s, 'BRASIL'), mediaOcde: of(s, 'MEDIA_OCDE'), mediaParticipantes: of(s, 'MEDIA_PARTICIPANTES_PISA') }])) as PisaComparison;
}
