/** Competência yyyy-mm → "mês/ano" legível. Extraído de `exec-territory.ts` (P3) para ser importável por
 * componentes client-side sem arrastar o pool de Postgres junto — `exec-territory.ts` reexporta esta
 * função, então quem já importava `competenceLabel` de lá continua funcionando sem mudar nada. */
export const competenceLabel = (periodStart: string): string => {
  const [y, m] = periodStart.split('-');
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[Number(m) - 1]}/${y}`;
};
