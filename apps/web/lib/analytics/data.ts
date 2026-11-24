/** `@senadotracker/db` só exporta `./src/index.ts`, e `postgres-analytics.ts` não entra nesse barrel
 * (um `AnalyticsFilters` já existe lá vindo de outro módulo — reexportar daria ambiguidade). Este
 * shim concentra o caminho relativo fundo num único lugar, em vez de repeti-lo com profundidade
 * diferente em cada rota de /admin/analytics. */
export * from '../../../../packages/db/src/postgres-analytics.ts';
