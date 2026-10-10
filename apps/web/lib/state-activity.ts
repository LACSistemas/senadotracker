import type { Pool, PoolClient } from 'pg';
import { webPostgresPool } from './postgres-pool';

export type StateActivityStatus = 'OPERATIONAL' | 'PARTIAL' | 'SOURCE_GAP' | 'EXTERNAL_BLOCKER' | 'DEFERRED' | 'NOT_APPLICABLE';

export type StateActivityCapability = {
  status: StateActivityStatus;
  coverageComplete: boolean;
  dataThrough: string | null;
  reason?: string;
};

export type StateActivityResult = {
  parliamentarian: { id: string; name: string; house: string; provider: string; source: string | null };
  mandate: { kind: 'current_roster'; house: string; note: string };
  proposals: {
    total: number | null;
    items: Array<Record<string, unknown>>;
    byType: Array<{ type: string; count: number }>;
    byMonth: Array<{ month: string; count: number }>;
    recent: Array<Record<string, unknown>>;
    authoredRelations: number | null;
    coauthoredRelations: number | null;
    coverage: StateActivityCapability;
  };
  participation: {
    sessions: { count: number | null; coverage: StateActivityCapability };
    attendance: { count: number | null; coverage: StateActivityCapability };
    rollCall: { count: number | null; coverage: StateActivityCapability };
    individualVotes: { count: number | null; coverage: StateActivityCapability };
  };
  rapporteurships: { items: Array<Record<string, unknown>>; coverage: StateActivityCapability };
  themes: { items: Array<Record<string, unknown>>; coverage: StateActivityCapability };
  coverage: Record<string, StateActivityCapability>;
};

const BLOCKED = new Set(['PB', 'AM']);
const VALID_HOUSES = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);

function capability(status: StateActivityStatus, dataThrough: string | null, reason?: string): StateActivityCapability {
  return { status, coverageComplete: status === 'OPERATIONAL', dataThrough, ...(reason ? { reason } : {}) };
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sourceUrl(provenance: unknown): string | null {
  if (!provenance) return null;
  if (typeof provenance === 'string') {
    try { return sourceUrl(JSON.parse(provenance)); } catch { return /^https?:\/\//.test(provenance) ? provenance : null; }
  }
  if (typeof provenance === 'object') {
    const x = provenance as Record<string, unknown>;
    for (const key of ['url', 'sourceUrl', 'officialUrl', 'source_url']) if (typeof x[key] === 'string') return x[key] as string;
  }
  return null;
}

async function databaseGuard(pool: Pool): Promise<void> {
  const result = await pool.query<{ current_database: string }>('SELECT current_database()');
  const expected = process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
  if (result.rows[0]?.current_database !== expected) {
    throw new Error(`state activity product database mismatch: expected ${expected}`);
  }
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

export async function loadStateActivity(house: string, personId: string, year = 2026, queryable?: Queryable): Promise<StateActivityResult | null> {
  const normalizedHouse = house.toUpperCase();
  if (!VALID_HOUSES.has(normalizedHouse)) throw new Error(`invalid state house: ${house}`);
  if (!personId || personId.length > 160) throw new Error('invalid canonical state person id');
  const pool = queryable ?? webPostgresPool();
  if (!queryable) await databaseGuard(pool as Pool);
  const roster = await pool.query(`
    SELECT external_id::text AS person_id, name, house, provider, source, published_at
    FROM civica_state.current_state_parliamentarians
    WHERE house=$1 AND external_id::text=$2
    LIMIT 1`, [normalizedHouse, personId]);
  if (!roster.rowCount) return null;
  const person = roster.rows[0] as { person_id: string; name: string; house: string; provider: string; source: string | null; published_at: unknown };
  const publicationRows = await pool.query(`
    SELECT domain, revision_id
    FROM civica_state.active_publications
    WHERE house=$1 AND domain IN ('legislative','participation','rapporteurship')`, [normalizedHouse]);
  const active = new Map<string, string>(publicationRows.rows.map((row: any) => [row.domain, row.revision_id]));
  const legislativeRevision = active.get('legislative');
  const blocked = BLOCKED.has(normalizedHouse);
  const proposalCapability = blocked
    ? capability('EXTERNAL_BLOCKER', null, 'P20 source exception: official proposal corpus is externally unavailable')
    : normalizedHouse === 'RS'
      ? capability('PARTIAL', iso(person.published_at), 'official corpus is bounded partial; visible rows are retained')
      : legislativeRevision
        ? capability('OPERATIONAL', iso(person.published_at))
        : capability('SOURCE_GAP', null, 'no active legislative revision');

  let items: Array<Record<string, unknown>> = [];
  let byType: Array<{ type: string; count: number }> = [];
  let byMonth: Array<{ month: string; count: number }> = [];
  let relationCount = 0;
  let coauthored = 0;
  if (legislativeRevision && !blocked) {
    const rows = await pool.query(`
      WITH authored AS MATERIALIZED (
        SELECT * FROM civica_state.proposal_authors
        WHERE house=$1 AND revision_id=$2 AND person_external_id::text=$3
      )
      SELECT p.external_id::text AS proposal_id, p.title, p.type, p.number, p.year,
             p.presented_at, p.status, p.raw_id::text AS raw_id, p.provenance,
             a.role, a.author_order, a.actor_type_canonical, a.actor_type_raw,
             a.author_raw, a.person_external_id::text AS person_external_id
      FROM authored a
      JOIN civica_state.proposals p
        ON a.house=p.house AND a.revision_id=p.revision_id AND a.proposal_external_id=p.external_id
      WHERE ($4::int IS NULL OR p.year=$4)
      ORDER BY p.presented_at DESC NULLS LAST, p.external_id`, [normalizedHouse, legislativeRevision, personId, year]);
    relationCount = rows.rowCount ?? 0;
    const unique = new Map<string, Record<string, unknown>>();
    const typeCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();
    for (const row of rows.rows as any[]) {
      const id = String(row.proposal_id);
      if (!unique.has(id)) unique.set(id, {
        id, sourceProposalId: id, title: row.title ?? null, type: row.type ?? null,
        number: row.number ?? null, year: row.year ?? null, presentedAt: iso(row.presented_at),
        status: row.status ?? null, authorRole: row.role ?? 'SOURCE_UNSPECIFIED',
        authorOrder: row.author_order ?? null, actorType: row.actor_type_canonical ?? row.actor_type_raw ?? null,
        sourceUrl: sourceUrl(row.provenance), rawId: row.raw_id ?? null,
      });
      const type = String(row.type ?? 'UNKNOWN'); typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      const date = row.presented_at ? new Date(row.presented_at) : null;
      if (date && !Number.isNaN(date.getTime())) { const month = date.toISOString().slice(0, 7); monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1); }
      if (/CO.?AUTOR|CO.?AUTHOR/.test(String(row.role ?? '').toUpperCase())) coauthored++;
    }
    items = [...unique.values()];
    byType = [...typeCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    byMonth = [...monthCounts.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
  }
  const recent = items.slice(0, 10);
  const participation = await loadParticipation(pool, normalizedHouse, personId, active.get('participation'));
  const rapporteurships = await loadRapporteurships(pool, normalizedHouse, personId, active.get('rapporteurship'));
  const themes = await loadThemes(pool, normalizedHouse, items, legislativeRevision);
  const coverage = {
    proposals: proposalCapability,
    authorship: blocked ? capability('EXTERNAL_BLOCKER', null, 'proposal source is externally unavailable') : legislativeRevision ? proposalCapability : capability('SOURCE_GAP', null, 'no active authorship revision'),
    sessions: participation.sessions.coverage,
    attendance: participation.attendance.coverage,
    rollCall: participation.rollCall.coverage,
    individualVote: participation.individualVotes.coverage,
    rapporteurship: rapporteurships.coverage,
    themes: themes.coverage,
  };
  return {
    parliamentarian: { id: person.person_id, name: person.name, house: normalizedHouse, provider: person.provider, source: person.source },
    mandate: { kind: 'current_roster', house: normalizedHouse, note: 'current roster scope; no historical mandate inference is performed in this product query' },
    proposals: { total: blocked ? null : items.length, items, byType, byMonth, recent, authoredRelations: blocked ? null : relationCount, coauthoredRelations: blocked ? null : (coauthored || null), coverage: proposalCapability },
    participation, rapporteurships, themes, coverage,
  };
}

async function loadParticipation(pool: Queryable, house: string, personId: string, revision: string | undefined) {
  const missing = (reason: string) => ({ count: null, coverage: capability('SOURCE_GAP', null, reason) });
  if (!revision) return { sessions: missing('no active participation revision'), attendance: missing('no active participation revision'), rollCall: missing('no active participation revision'), individualVotes: missing('no active participation revision') };
  const [sessions, attendance, rollCalls, votes] = await Promise.all([
    pool.query('SELECT count(*)::int AS count, max(occurred_at) AS data_through FROM civica_state.state_meetings WHERE house=$1 AND revision_id=$2', [house, revision]),
    pool.query('SELECT count(*)::int AS count, max(occurred_at) AS data_through FROM civica_state.state_attendance WHERE house=$1 AND revision_id=$2 AND person_external_id::text=$3', [house, revision, personId]),
    pool.query('SELECT count(*)::int AS count, max(occurred_at) AS data_through FROM civica_state.state_deliberations WHERE house=$1 AND revision_id=$2', [house, revision]),
    pool.query('SELECT count(*)::int AS count, max((SELECT occurred_at FROM civica_state.state_deliberations d WHERE d.house=v.house AND d.revision_id=v.revision_id AND d.external_id=v.deliberation_external_id)) AS data_through FROM civica_state.state_individual_votes v WHERE v.house=$1 AND v.revision_id=$2 AND v.person_external_id::text=$3', [house, revision, personId]),
  ]);
  const make = (row: any) => ({ count: Number(row.rows[0]?.count ?? 0), coverage: capability('OPERATIONAL', iso(row.rows[0]?.data_through)) });
  return { sessions: make(sessions), attendance: make(attendance), rollCall: make(rollCalls), individualVotes: make(votes) };
}

async function loadRapporteurships(pool: Queryable, house: string, personId: string, revision: string | undefined) {
  if (!revision) return { items: [], coverage: capability('SOURCE_GAP', null, 'no active rapporteurship revision') };
  const rows = await pool.query(`SELECT proposal_external_id::text AS proposal_id, role_raw, body_source_id, body_name_raw, assigned_at, ended_at, source_key, provenance FROM civica_state.state_rapporteurships WHERE house=$1 AND revision_id=$2 AND person_external_id::text=$3 ORDER BY assigned_at DESC NULLS LAST`, [house, revision, personId]);
  return { items: rows.rows.map((r: any) => ({ ...r, assignedAt: iso(r.assigned_at), endedAt: iso(r.ended_at), sourceUrl: sourceUrl(r.provenance) })), coverage: capability('OPERATIONAL', rows.rows.length ? iso(rows.rows[0].assigned_at) : null) };
}

async function loadThemes(pool: Queryable, house: string, items: Array<Record<string, unknown>>, revision: string | undefined) {
  if (!revision || !items.length) return { items: [], coverage: capability('SOURCE_GAP', null, 'no source-native themes for this active proposal revision') };
  const ids = items.map((x) => String(x.id));
  const rows = await pool.query(`SELECT proposal_external_id::text AS proposal_id, theme_key, label, taxonomy, source_key, provenance FROM civica_state.state_proposal_themes WHERE house=$1 AND revision_id=$2 AND proposal_external_id = ANY($3::text[]) ORDER BY label`, [house, revision, ids]);
  return { items: rows.rows.map((r: any) => ({ proposalId: r.proposal_id, key: r.theme_key, label: r.label, taxonomy: r.taxonomy, sourceUrl: sourceUrl(r.provenance) })), coverage: rows.rowCount ? capability('OPERATIONAL', null) : capability('SOURCE_GAP', null, 'source-native themes are not available') };
}

export async function explainStateProposalQuery(pool: Pool): Promise<unknown> {
  await databaseGuard(pool);
  const result = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) WITH authored AS MATERIALIZED (SELECT * FROM civica_state.proposal_authors WHERE house='ES' AND revision_id=(SELECT revision_id FROM civica_state.active_publications WHERE house='ES' AND domain='legislative') AND person_external_id::text='45') SELECT p.external_id FROM authored a JOIN civica_state.proposals p ON p.house=a.house AND p.revision_id=a.revision_id AND p.external_id=a.proposal_external_id WHERE p.year=2026`);
  return result.rows[0]?.['QUERY PLAN'] ?? null;
}

