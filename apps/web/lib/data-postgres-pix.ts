import type { Pool, PoolClient } from 'pg';
import { parliamentarianPixSummary } from '../../../packages/db/src/postgres-budget-read.ts';
import { webPostgresPool } from './postgres-pool.ts';
import { PIX_PERIOD, type PixProfileData } from './pix-profile-model.ts';

type Queryable = Pick<Pool | PoolClient, 'query'>;

/**
 * Emendas Pix de um parlamentar para o perfil. UMA chamada ao read model `parliamentarianPixSummary` (que só enxerga autoria revisada);
 * o diagnóstico de estado vazio só roda quando o resumo vem sem emendas. Qualquer falha vira `unavailable`: o perfil nunca quebra por causa do Pix.
 */
export async function parliamentarianPixWith(db: Queryable, source: 'camara' | 'senado', externalId: string): Promise<PixProfileData> {
  try {
    const identity = (await db.query(`SELECT person_id FROM civica.external_identifiers WHERE source=$1 AND external_id=$2`, [source, externalId])).rows[0];
    if (!identity) return { status: 'empty', reason: 'none' };
    const personId = identity.person_id as string;
    const summary = await parliamentarianPixSummary(db, personId);
    if (summary.counts.amendments > 0) return { status: 'available', summary };
    if (!summary.run) return { status: 'unavailable' };
    // vazio: distinguir "autoria em revisão" (linha do crosswalk desta pessoa ainda não revisada) de "mandato fora do período"
    const pending = Number((await db.query(`SELECT count(*) n FROM civica_budget.author_code_crosswalk WHERE person_id=$1 AND NOT reviewed`, [personId])).rows[0].n);
    if (pending > 0) return { status: 'empty', reason: 'pending_authorship' };
    const mandates = (await db.query(`SELECT payload->>'start' start, payload->>'end' "end" FROM civica.mandates WHERE person_id=$1`, [personId])).rows;
    const from = `${PIX_PERIOD.from - 1}-08-01`, to = `${PIX_PERIOD.to}-12-31`;
    const overlaps = mandates.some(m => (m.start ?? '0000') <= to && (m.end ?? '9999') >= from);
    return { status: 'empty', reason: mandates.length && !overlaps ? 'no_mandate_in_period' : 'none' };
  } catch {
    return { status: 'unavailable' };
  }
}

export const parliamentarianPix = (source: 'camara' | 'senado', externalId: string): Promise<PixProfileData> => parliamentarianPixWith(webPostgresPool(), source, externalId);
