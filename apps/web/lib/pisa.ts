import { getPisaComparison, type PisaComparison } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** PISA (OCDE, via OWID): Brasil, média OCDE e média dos participantes, por disciplina e edição —
 * cacheado 1h. Internacional, só nível-país — nunca comparado na mesma escala do Ideb/Saeb. P14.13. */
export async function loadPisaComparison(): Promise<PisaComparison> {
  return memo('pisa-comparison', () => getPisaComparison(webPostgresPool()), 60 * 60_000);
}
