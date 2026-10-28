/**
 * ENEM (P11.6): regras puras de supressão e reconciliação nacional, sem I/O. O extrator Python e a orquestração em
 * Node (`scripts/exec/enem_extract.py`, `scripts/exec/educacao-enem-p116-run.ts`) usam este módulo para decidir o que
 * é seguro publicar; nenhuma linha individual, nenhum `CO_ESCOLA`, nenhum município de residência passa por aqui.
 */
export const ENEM_SUBJECTS = ['CN', 'CH', 'LC', 'MT', 'ESSAY'] as const;
export type EnemSubject = (typeof ENEM_SUBJECTS)[number];
export const ENEM_SUBJECT_LABEL: Record<EnemSubject, string> = { CN: 'Ciências da Natureza', CH: 'Ciências Humanas', LC: 'Linguagens e Códigos', MT: 'Matemática', ESSAY: 'Redação' };

/** Códigos nativos de `TP_DEPENDENCIA_ADM_ESC`; 0 é o agregado "todas as redes" que este projeto adiciona. */
export const ENEM_NETWORKS = [0, 1, 2, 3, 4] as const;
export type EnemNetwork = (typeof ENEM_NETWORKS)[number];
export const ENEM_NETWORK_LABEL: Record<EnemNetwork, string> = { 0: 'Todas as redes', 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 4: 'Privada' };

/**
 * Corte de célula pequena: mesmo limiar que o próprio Inep usa para mascarar `CO_ESCOLA` em 2024/2025 (menos de 10
 * participantes). `READY_FOR_ENEM_PUBLICATION` do P11.1 ficou `NO` por falta de revisão jurídica; este corte é a
 * salvaguarda técnica enquanto essa revisão não existe — recorte por município só é servido ao público quando passa aqui.
 */
export const ENEM_MIN_CELL = 10;
export const suppressCell = (n: number): boolean => n < ENEM_MIN_CELL;

export interface EnemReconciliationInput {
  edition: number;
  registrants: number; allFourPresent: number; mathValid: number; essayValid: number;
  sinopseRegistrants: number; sinopseAllFourPresent: number; sinopseMathValid: number; sinopseEssayValid: number;
}
export interface EnemReconciliationResult { reconciled: boolean; note: string }
/** Reconciliação nacional contra as Sinopses Estatísticas do Inep (tabelas 1.1, 1.2, 7.4.1, 7.5.1): exige igualdade exata nos quatro totais. */
export function reconcileEnemNational(i: EnemReconciliationInput): EnemReconciliationResult {
  const deltas: Array<[string, number]> = [
    ['inscritos', i.registrants - i.sinopseRegistrants], ['presentes nos dois dias', i.allFourPresent - i.sinopseAllFourPresent],
    ['Matemática válida', i.mathValid - i.sinopseMathValid], ['redação válida', i.essayValid - i.sinopseEssayValid],
  ];
  const off = deltas.filter(([, d]) => d !== 0);
  if (off.length === 0) return { reconciled: true, note: `edição ${i.edition}: reconcilia exatamente com a Sinopse (inscritos, presença, Matemática, redação).` };
  return { reconciled: false, note: `edição ${i.edition}: NÃO reconcilia (${off.map(([k, d]) => `${k} diff ${d}`).join('; ')}).` };
}

/** Nota objetiva válida (CN/CH/LC/MT): presença = 1 e nota numérica não negativa. */
export const isValidSubjectScore = (presence: number | null, score: number | null): boolean => presence === 1 && score != null && Number.isFinite(score) && score >= 0;
/** Redação válida: `TP_STATUS_REDACAO = 1` ("sem problemas"), regra que reconcilia com a Sinopse 7.5.1 — não é "nota numérica presente". */
export const isValidEssay = (status: number | null): boolean => status === 1;
