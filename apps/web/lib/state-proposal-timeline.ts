import type { Pool, PoolClient } from 'pg';
import { webPostgresPool } from './postgres-pool';

type Queryable = Pick<Pool | PoolClient, 'query'>;

export type StateProposalTimeline = {
  proposal: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
  relatedProposals: Array<Record<string, unknown>>;
  rapporteurships: Array<Record<string, unknown>>;
  opinions: Array<Record<string, unknown>>;
  votes: Array<Record<string, unknown>>;
  legalNorm: Record<string, unknown> | null;
  coverage: { status: 'OPERATIONAL' | 'PARTIAL' | 'EXTERNAL_BLOCKER' | 'SOURCE_GAP'; revision: string | null; dataThrough: string | null; reason?: string };
};

const VALID_HOUSES = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);

async function databaseGuard(pool: Pool): Promise<void> {
  const row = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0];
  const expected = process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
  if (row?.current_database !== expected) throw new Error(`state proposal timeline database mismatch: expected ${expected}`);
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function sourceUrl(value: unknown): string | null {
  if (!value) return null;
  const object = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  if (!object || typeof object !== 'object') return null;
  const row = object as Record<string, unknown>;
  for (const key of ['sourceUrl', 'officialUrl', 'source_url', 'endpoint']) if (typeof row[key] === 'string') return row[key] as string;
  return null;
}

/** Reads the active canonical proposal plus its published timeline. It never resolves names at runtime. */
export async function getStateProposalTimeline(house: string, proposalId: string, queryable?: Queryable): Promise<StateProposalTimeline | null> {
  const normalizedHouse = house.toUpperCase();
  if (!VALID_HOUSES.has(normalizedHouse)) throw new Error(`invalid state house: ${house}`);
  if (!proposalId || proposalId.length > 200) throw new Error('invalid state proposal id');
  const pool = queryable ?? webPostgresPool();
  if (!queryable) await databaseGuard(pool as Pool);
  const revisions = await pool.query<{ domain: string; revision_id: string }>(`SELECT domain,revision_id FROM civica_state.active_publications WHERE house=$1 AND domain IN ('legislative','timeline','participation','rapporteurship')`, [normalizedHouse]);
  const active = new Map(revisions.rows.map((row) => [row.domain, row.revision_id]));
  const legislativeRevision = active.get('legislative');
  if (!legislativeRevision) return null;
  const proposalQuery = await pool.query(`SELECT external_id::text AS id,title,type,number,year,presented_at,status,raw_id::text AS raw_id,provenance FROM civica_state.proposals WHERE house=$1 AND revision_id=$2 AND external_id::text=$3 LIMIT 1`, [normalizedHouse, legislativeRevision, proposalId]);
  if (!proposalQuery.rowCount) return null;
  const proposalRow = proposalQuery.rows[0] as any;
  const timelineRevision = active.get('timeline');
  if (!timelineRevision) return {
    proposal: { ...proposalRow, presentedAt: iso(proposalRow.presented_at), sourceUrl: sourceUrl(proposalRow.provenance) },
    events: [], relatedProposals: [], rapporteurships: [], opinions: [], votes: [], legalNorm: null,
    coverage: { status: normalizedHouse === 'MG' ? 'EXTERNAL_BLOCKER' : 'SOURCE_GAP', revision: null, dataThrough: null, reason: normalizedHouse === 'MG' ? 'ALMG public 2026 proposal data is available, but no public event/timeline endpoint was available for the bounded P22.1 sample.' : 'No active timeline revision for this house.' },
  };
  const eventsQuery = await pool.query(`SELECT proposal_external_id::text AS proposal_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,status_raw,source_url,raw_id::text AS raw_id,provenance FROM civica_state.state_proposal_events WHERE house=$1 AND revision_id=$2 AND proposal_external_id::text=$3 ORDER BY event_order,source_event_key`, [normalizedHouse, timelineRevision, proposalId]);
  const relatedQuery = await pool.query(`SELECT from_proposal_external_id::text AS from_proposal_id,to_external_id::text AS to_proposal_id,relation_key,kind,source_key,provenance FROM civica_state.state_proposal_relations WHERE house=$1 AND revision_id=$2 AND from_proposal_external_id::text=$3 ORDER BY relation_key`, [normalizedHouse, legislativeRevision, proposalId]);
  const rapporteurQuery = await pool.query(`SELECT proposal_external_id::text AS proposal_id,rapporteur_key,person_external_id::text AS person_external_id,source_person_id,role_raw,body_source_id,body_name_raw,assigned_at,ended_at,source_key,provenance FROM civica_state.state_rapporteurships WHERE house=$1 AND revision_id=$2 AND proposal_external_id::text=$3 ORDER BY assigned_at NULLS LAST`, [normalizedHouse, legislativeRevision, proposalId]);
  const opinions = eventsQuery.rows.filter((row: any) => row.event_type === 'opinion').map((row: any) => ({ ...row, occurredAt: iso(row.occurred_at), sourceUrl: row.source_url }));
  const votes: Array<Record<string, unknown>> = [];
  const legalNormQuery = await pool.query(`SELECT external_id::text AS id,proposal_external_id::text AS proposal_id,document_type,title,description,official_date,source_locator,provenance FROM civica_state.state_documents WHERE house=$1 AND revision_id=$2 AND proposal_external_id::text=$3 AND lower(coalesce(document_type,'')) IN ('norm','law','sanction','veto') ORDER BY official_date DESC NULLS LAST LIMIT 1`, [normalizedHouse, legislativeRevision, proposalId]);
  const dataThrough = eventsQuery.rows.reduce<string | null>((max, row: any) => { const value = iso(row.occurred_at); return !value || (max && max >= value) ? max : value; }, null);
  return {
    proposal: { ...proposalRow, presentedAt: iso(proposalRow.presented_at), sourceUrl: sourceUrl(proposalRow.provenance) },
    events: eventsQuery.rows.map((row: any) => ({ ...row, occurredAt: iso(row.occurred_at), sourceUrl: row.source_url })),
    relatedProposals: relatedQuery.rows,
    rapporteurships: rapporteurQuery.rows.map((row: any) => ({ ...row, assignedAt: iso(row.assigned_at), endedAt: iso(row.ended_at), sourceUrl: sourceUrl(row.provenance) })),
    opinions,
    votes,
    legalNorm: legalNormQuery.rows[0] ? { ...legalNormQuery.rows[0], officialDate: iso(legalNormQuery.rows[0].official_date), sourceUrl: sourceUrl(legalNormQuery.rows[0].provenance) } : null,
    coverage: { status: eventsQuery.rowCount ? 'OPERATIONAL' : 'PARTIAL', revision: timelineRevision, dataThrough },
  };
}
