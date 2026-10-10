/**
 * Contrato temporal das proposições.
 *
 * - `identifierYear`: ano oficial do NÚMERO/identificador ("PL 123/2026"). Tipos numerados por órgão (pareceres, destaques,
 *   substitutivos…) chegam da Câmara com `ano = 0`; isso significa "sem ano", e vira `null`. O raw oficial continua guardando 0.
 * - `presentedAt`: data oficial de apresentação da entidade naquela Casa.
 * - `presentedYear`: ano civil de `presentedAt` em America/Sao_Paulo.
 * - `activity`: reservado; ainda não há cobertura de eventos para uma métrica anual de atividade.
 */
export type TemporalBasis = 'identifier_year' | 'presented_at' | 'activity';
export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const MIN_YEAR = 1800, MAX_YEAR = 2200;

/** `0`, vazio, nulo e valores fora de um intervalo plausível são "sem ano". Nunca devolve 0. */
export function normalizeIdentifierYear(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
}

/** Número oficial; nulo/vazio/NaN viram `null` (e não 0, que era o erro de `Number(null)`). */
export function normalizeProposalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Ano civil de uma data de apresentação em America/Sao_Paulo (a meia-noite BRT do Senado é 03:00Z). */
export function presentedYearOf(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value);
  if (Number.isNaN(date.getTime())) return null;
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: BRAZIL_TIME_ZONE, year: 'numeric' }).format(date));
}

/** Câmara devolve data/hora local sem fuso ("2026-02-03T00:00"): interpretada em Brasília. */
export function brasiliaTimestamp(local: string | null | undefined): string | null {
  const text = String(local ?? '').trim();
  if (!text) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) return text;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00-03:00` : `${text.length === 16 ? `${text}:00` : text}-03:00`;
}

/**
 * Texto de uma métrica anual a partir da sua base temporal. Uma métrica `identifier_year` nunca produz "apresentadas":
 * o texto fala em número/ano do número.
 */
export function describeTemporalBasis(basis: TemporalBasis, year: number | string, subject = 'proposições'): string {
  switch (basis) {
    case 'identifier_year': return `${subject} com ano do número ${year}`;
    case 'presented_at': return `${subject} apresentadas em ${year}`;
    case 'activity': return `${subject} com atividade em ${year}`;
  }
}

/** Frase curta de uma métrica anual. `identifier_year` nunca produz "apresentadas": evita o rótulo errado por construção. */
export function temporalPhrase(basis: TemporalBasis, year: number | string): string {
  switch (basis) {
    case 'identifier_year': return `com ano ${year}`;
    case 'presented_at': return `apresentadas em ${year}`;
    case 'activity': return `com atividade em ${year}`;
  }
}
