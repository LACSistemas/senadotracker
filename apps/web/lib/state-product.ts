import type { Pool, PoolClient } from 'pg';
import { webPostgresPool } from './postgres-pool';
import { loadStateActivity, type StateActivityResult } from './state-activity';
import { getStateBudgetAmendmentsByLegislator, getStateBudgetAmendmentDetail, getStateBudgetAmendmentHouseSummary } from '@senadotracker/db';

type Queryable = Pick<Pool | PoolClient, 'query'>;

export const STATE_HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as const;
export type StateHouse = typeof STATE_HOUSES[number];
export type CoverageState = 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'EXTERNAL_BLOCKER' | 'EXECUTION_ENV_BLOCKED' | 'UPSTREAM_BLOCKER' | 'NOT_APPLICABLE' | 'UNKNOWN';
export type ProductCoverage = { state: CoverageState; coverageComplete: boolean; reason: string | null; dataThrough: string | null; lastSuccessfulCollection: string | null; sourceUrl: string | null; revisionId: string | null };

export type StateProductProfile = {
  identity: { id: string; name: string; house: StateHouse; provider: string; source: string | null; profileUrl: string | null; photoUrl: string | null; party: string | null };
  mandate: { kind: 'current_roster'; note: string };
  domains: Record<'identity' | 'finance' | 'personnel' | 'legislative' | 'timeline' | 'budgetAmendments', ProductCoverage>;
};

export type StateFinanceProduct = {
  house: StateHouse; personId: string; year: number; totalCents: number | null; recordCount: number | null;
  categories: Array<{ category: string; amountCents: number }>;
  recent: Array<{ competence: string | null; occurredAt: string | null; category: string | null; amountCents: number | null; supplierName: string | null; sourceUrl: string | null }>;
  coverage: ProductCoverage;
};

export type StatePersonnelProduct = {
  house: StateHouse; personId: string; staff: Array<{ key: string; name: string | null; role: string | null; office: string | null; active: boolean | null; competence: string | null }>;
  payroll: { recordCount: number | null; grossCents: number | null; netCents: number | null; competence: string | null };
  coverage: ProductCoverage;
};

export type StateBudgetProduct = {
  house: StateHouse; fiscalYear: number; amendments: Array<Record<string, unknown>>; summary: Record<string, unknown> | null; coverage: ProductCoverage;
};

const VALID = new Set<string>(STATE_HOUSES);
const BLOCKED_ACTIVITY = new Set(['PB', 'AM']);
const iso = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString() : String(v);
const numberOrNull = (v: unknown): number | null => v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const sourceUrl = (v: unknown): string | null => {
  if (!v) return null;
  const obj = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
  if (!obj || typeof obj !== 'object') return null;
  for (const k of ['sourceUrl', 'officialUrl', 'source_url', 'endpoint']) if (typeof (obj as Record<string, unknown>)[k] === 'string') return (obj as Record<string, unknown>)[k] as string;
  return null;
};

async function guard(pool: Queryable): Promise<void> {
  const row = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0];
  const expected = process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
  if (row?.current_database !== expected) throw new Error(`state product database mismatch: expected ${expected}`);
}

function house(value: string): StateHouse {
  const normalized = value.toUpperCase();
  if (!VALID.has(normalized)) throw new Error(`invalid state house: ${value}`);
  return normalized as StateHouse;
}

function coverage(state: CoverageState, opts: Partial<Omit<ProductCoverage, 'state' | 'coverageComplete'>> = {}): ProductCoverage {
  return { state, coverageComplete: state === 'AVAILABLE', reason: null, dataThrough: null, lastSuccessfulCollection: null, sourceUrl: null, revisionId: null, ...opts };
}

function stateFromRevision(revision: string | null, reason = 'Fonte oficial publicada para esta Casa.'): ProductCoverage {
  return revision ? coverage('AVAILABLE', { revisionId: revision, reason }) : coverage('UPSTREAM_BLOCKER', { reason: 'Nenhuma revisão ativa publicada para este domínio.' });
}

async function revisions(pool: Queryable, normalizedHouse: StateHouse): Promise<Map<string, { revision: string; activatedAt: string | null }>> {
  const rows = await pool.query<{ domain: string; revision_id: string; activated_at: unknown }>('SELECT domain,revision_id,activated_at FROM civica_state.active_publications WHERE house=$1', [normalizedHouse]);
  return new Map(rows.rows.map(row => [row.domain, { revision: row.revision_id, activatedAt: iso(row.activated_at) }]));
}

async function budgetRevision(pool: Queryable, normalizedHouse: StateHouse, year: number): Promise<{ revision: string; activatedAt: string | null } | null> {
  const row = (await pool.query<{ revision_id: string; activated_at: unknown }>(`SELECT revision_id,activated_at FROM civica_state_budget.active_publications WHERE house=$1 AND fiscal_year=$2 AND domain='state_budget_amendments'`, [normalizedHouse, year])).rows[0];
  return row ? { revision: row.revision_id, activatedAt: iso(row.activated_at) } : null;
}

async function profileRow(pool: Queryable, normalizedHouse: StateHouse, personId: string) {
  return (await pool.query(`SELECT c.external_id::text AS id,c.name,c.house,c.provider,c.source,c.published_at,m.profile_url,m.photo_url,m.observed_at,m.provenance,pm.canonical_party,pm.raw_party_label FROM civica_state.current_state_parliamentarians c LEFT JOIN LATERAL (SELECT profile_url,photo_url,observed_at,provenance FROM civica_state.state_profile_metadata WHERE house=c.house AND external_id=c.external_id ORDER BY observed_at DESC NULLS LAST LIMIT 1) m ON true LEFT JOIN LATERAL (SELECT canonical_party,raw_party_label FROM civica_state.party_memberships WHERE house=c.house AND person_external_id=c.external_id ORDER BY end_at DESC NULLS LAST,start_at DESC NULLS LAST LIMIT 1) pm ON true WHERE c.house=$1 AND c.external_id::text=$2 LIMIT 1`, [normalizedHouse, personId])).rows[0] ?? null;
}

async function domainCoverage(pool: Queryable, normalizedHouse: StateHouse, year: number, active: Map<string, { revision: string; activatedAt: string | null }>, budget: { revision: string; activatedAt: string | null } | null): Promise<StateProductProfile['domains']> {
  const finance = active.get('finance');
  const legislative = active.get('legislative');
  const timeline = active.get('timeline');
  const personnel = (await pool.query<{ revision_id: string; activated_at: unknown }>('SELECT revision_id,activated_at FROM civica_state.state_office_active_publications WHERE house=$1 AND domain=\'staff\'', [normalizedHouse])).rows[0];
  const personnelCoverage = personnel ? coverage('AVAILABLE', { revisionId: personnel.revision_id, lastSuccessfulCollection: iso(personnel.activated_at), reason: 'Snapshot oficial de gabinete publicado; vínculos sem correspondência continuam visíveis como ausência de observação.' }) : coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica a lista de pessoal do gabinete em formato utilizável.' });
  const legislativeCoverage = BLOCKED_ACTIVITY.has(normalizedHouse) ? coverage('EXTERNAL_BLOCKER', { reason: 'A fonte oficial de atividade legislativa permanece bloqueada externamente para esta Casa.' }) : stateFromRevision(legislative?.revision ?? null, 'Autoria e produção são lidas da revisão legislativa ativa.');
  const timelineCoverage = timeline ? stateFromRevision(timeline.revision, 'Eventos de tramitação publicados pela Casa.') : coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica a tramitação das proposições em formato utilizável.' });
  const budgetCoverage = budget ? stateFromRevision(budget.revision, 'Emendas estaduais publicadas para o exercício.') : coverage('UPSTREAM_BLOCKER', { reason: `A Casa não publica emendas estaduais utilizáveis para ${normalizedHouse}/${year}.` });
  return {
    identity: coverage('AVAILABLE', { reason: 'Cadastro corrente publicado pela Casa.', lastSuccessfulCollection: null }),
    finance: finance ? stateFromRevision(finance.revision, 'Despesas parlamentares publicadas; os períodos variam conforme a Casa.') : coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica despesas parlamentares em formato utilizável.' }),
    personnel: personnelCoverage,
    legislative: legislativeCoverage,
    timeline: timelineCoverage,
    budgetAmendments: budgetCoverage,
  };
}

export async function getStateLegislatorProfile(houseValue: string, personId: string, year = 2026, queryable?: Queryable): Promise<StateProductProfile | null> {
  const normalizedHouse = house(houseValue); if (!personId || personId.length > 160) throw new Error('invalid canonical state person id');
  const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const row: any = await profileRow(pool, normalizedHouse, personId); if (!row) return null;
  const active = await revisions(pool, normalizedHouse); const budget = await budgetRevision(pool, normalizedHouse, year);
  const domains = await domainCoverage(pool, normalizedHouse, year, active, budget);
  return { identity: { id: row.id, name: row.name, house: normalizedHouse, provider: row.provider, source: row.source, profileUrl: row.profile_url ?? sourceUrl(row.provenance), photoUrl: row.photo_url ?? null, party: row.canonical_party ?? row.raw_party_label ?? null }, mandate: { kind: 'current_roster', note: 'Cadastro corrente da Casa; não se infere histórico de mandato nesta rota.' }, domains };
}

export async function getStateLegislatorFinance(houseValue: string, personId: string, year = 2026, queryable?: Queryable): Promise<StateFinanceProduct> {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const active = await revisions(pool, normalizedHouse); const revision = active.get('finance');
  if (!revision) return { house: normalizedHouse, personId, year, totalCents: null, recordCount: null, categories: [], recent: [], coverage: coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica despesas parlamentares em formato utilizável.' }) };
  const rows = await pool.query(`SELECT competence,occurred_at,category,amount_cents,supplier_name,source_url FROM civica_state.expenses WHERE house=$1 AND revision_id=$2 AND person_external_id::text=$3 AND ($4::int IS NULL OR competence LIKE $4::text || '%' OR competence LIKE '%/' || $4::text) ORDER BY occurred_at DESC NULLS LAST,external_id DESC`, [normalizedHouse, revision.revision, personId, year]);
  const categories = new Map<string, number>(); for (const row of rows.rows as any[]) { const key = String(row.category ?? 'Sem categoria'); categories.set(key, (categories.get(key) ?? 0) + (numberOrNull(row.amount_cents) ?? 0)); }
  const total = rows.rows.length ? (rows.rows as any[]).reduce((sum, row) => sum + (numberOrNull(row.amount_cents) ?? 0), 0) : 0;
  const maxDate = rows.rows.reduce<string | null>((max, row: any) => { const value = iso(row.occurred_at) ?? row.competence ?? null; return value && (!max || value > max) ? value : max; }, null);
  return { house: normalizedHouse, personId, year, totalCents: total, recordCount: rows.rowCount ?? 0, categories: [...categories.entries()].map(([category, amountCents]) => ({ category, amountCents })).sort((a,b) => b.amountCents - a.amountCents), recent: (rows.rows as any[]).slice(0, 30).map(row => ({ competence: row.competence ?? null, occurredAt: iso(row.occurred_at), category: row.category ?? null, amountCents: numberOrNull(row.amount_cents), supplierName: row.supplier_name ?? null, sourceUrl: row.source_url ?? null })), coverage: coverage('AVAILABLE', { revisionId: revision.revision, dataThrough: maxDate, lastSuccessfulCollection: revision.activatedAt }) };
}

export async function getStateLegislatorPersonnel(houseValue: string, personId: string, queryable?: Queryable): Promise<StatePersonnelProduct> {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const pub = (await pool.query<{ revision_id: string; activated_at: unknown }>('SELECT revision_id,activated_at FROM civica_state.state_office_active_publications WHERE house=$1 AND domain=\'staff\'', [normalizedHouse])).rows[0];
  if (!pub) return { house: normalizedHouse, personId, staff: [], payroll: { recordCount: null, grossCents: null, netCents: null, competence: null }, coverage: coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica a lista de pessoal do gabinete em formato utilizável.' }) };
  const rows = await pool.query(`SELECT staff_key,name,role,office_label,is_active,competence FROM civica_state.state_office_staff_snapshots WHERE house=$1 AND revision_id=$2 AND person_external_id::text=$3 AND coalesce(is_parliamentary_office_staff::text,'true') IN ('true','t','1') ORDER BY is_active DESC NULLS LAST,name`, [normalizedHouse, pub.revision_id, personId]);
  const staffKeys = (rows.rows as any[]).map(row => String(row.staff_key));
  let payroll = { recordCount: 0, grossCents: 0, netCents: 0, competence: null as string | null };
  const payrollPub = (await pool.query<{ revision_id: string }>('SELECT revision_id FROM civica_state.state_office_active_publications WHERE house=$1 AND domain=\'payroll\'', [normalizedHouse])).rows[0];
  if (payrollPub && staffKeys.length) { const p = await pool.query(`SELECT count(*)::int AS n,sum(gross_cents)::bigint AS gross,sum(net_cents)::bigint AS net,max(competence) AS competence FROM civica_state.state_office_payroll_snapshots WHERE house=$1 AND revision_id=$2 AND staff_key=ANY($3::text[])`, [normalizedHouse, payrollPub.revision_id, staffKeys]); payroll = { recordCount: Number(p.rows[0]?.n ?? 0), grossCents: numberOrNull(p.rows[0]?.gross) ?? 0, netCents: numberOrNull(p.rows[0]?.net) ?? 0, competence: p.rows[0]?.competence ?? null }; }
  return { house: normalizedHouse, personId, staff: (rows.rows as any[]).map(row => ({ key: String(row.staff_key), name: row.name ?? null, role: row.role ?? null, office: row.office_label ?? null, active: row.is_active == null ? null : Boolean(row.is_active), competence: row.competence ?? null })), payroll, coverage: coverage('AVAILABLE', { revisionId: pub.revision_id, lastSuccessfulCollection: iso(pub.activated_at), dataThrough: (rows.rows as any[]).reduce((max, row) => row.competence && (!max || row.competence > max) ? row.competence : max, null) }) };
}

export async function getStateBudgetProduct(houseValue: string, personId: string, fiscalYear = 2026, queryable?: Queryable): Promise<StateBudgetProduct> {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const budget = await budgetRevision(pool, normalizedHouse, fiscalYear);
  if (!budget) return { house: normalizedHouse, fiscalYear, amendments: [], summary: null, coverage: coverage('UPSTREAM_BLOCKER', { reason: `A Casa não publica emendas estaduais utilizáveis para ${normalizedHouse}/${fiscalYear}.` }) };
  const [amendments, summary] = await Promise.all([getStateBudgetAmendmentsByLegislator(pool as Pool, normalizedHouse, fiscalYear, personId), getStateBudgetAmendmentHouseSummary(pool as Pool, normalizedHouse, fiscalYear)]);
  const latest = await pool.query(`SELECT data_through,source_updated_at,created_at FROM civica_state_budget.revisions WHERE revision_id=$1 LIMIT 1`, [budget.revision]);
  return { house: normalizedHouse, fiscalYear, amendments: amendments.map((row: any) => ({ ...row, amountIndicatedCents: numberOrNull(row.amount_indicated_cents), amountCurrentCents: numberOrNull(row.amount_current_cents), amountCommittedCents: numberOrNull(row.amount_committed_cents), amountLiquidatedCents: numberOrNull(row.amount_liquidated_cents), amountPaidCents: numberOrNull(row.amount_paid_cents) })), summary: summary ?? null, coverage: coverage('AVAILABLE', { revisionId: budget.revision, lastSuccessfulCollection: budget.activatedAt, dataThrough: iso(latest.rows[0]?.data_through ?? latest.rows[0]?.source_updated_at ?? latest.rows[0]?.created_at) }) };
}

export async function getStateLegislatorActivity(houseValue: string, personId: string, year = 2026, queryable?: Queryable): Promise<(StateActivityResult & { budget: StateBudgetProduct; timeline: { proposalCount: number; eventCount: number; coverage: ProductCoverage } }) | null> {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const activity = await loadStateActivity(normalizedHouse, personId, year, pool); if (!activity) return null;
  const budget = await getStateBudgetProduct(normalizedHouse, personId, year, pool);
  const timelineRevision = (await revisions(pool, normalizedHouse)).get('timeline');
  let eventCount = 0; const ids = activity.proposals.items.map(item => String(item.id));
  if (timelineRevision && ids.length) { const result = await pool.query(`SELECT count(*)::int AS n FROM civica_state.state_proposal_events WHERE house=$1 AND revision_id=$2 AND proposal_external_id::text=ANY($3::text[])`, [normalizedHouse, timelineRevision.revision, ids]); eventCount = Number(result.rows[0]?.n ?? 0); }
  return { ...activity, budget, timeline: { proposalCount: ids.length, eventCount, coverage: timelineRevision ? coverage('AVAILABLE', { revisionId: timelineRevision.revision, lastSuccessfulCollection: timelineRevision.activatedAt }) : coverage('UPSTREAM_BLOCKER', { reason: 'A Casa não publica a tramitação das proposições em formato utilizável.' }) } };
}

export async function listStateLegislators(houseValue: string, queryable?: Queryable) {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  const rows = await pool.query(`SELECT c.external_id::text AS id,c.name,c.provider,m.profile_url,m.photo_url,pm.canonical_party,pm.raw_party_label FROM civica_state.current_state_parliamentarians c LEFT JOIN LATERAL (SELECT profile_url,photo_url FROM civica_state.state_profile_metadata WHERE house=c.house AND external_id=c.external_id ORDER BY observed_at DESC NULLS LAST LIMIT 1) m ON true LEFT JOIN LATERAL (SELECT canonical_party,raw_party_label FROM civica_state.party_memberships WHERE house=c.house AND person_external_id=c.external_id ORDER BY end_at DESC NULLS LAST,start_at DESC NULLS LAST LIMIT 1) pm ON true WHERE c.house=$1 ORDER BY c.name,c.external_id`, [normalizedHouse]);
  return rows.rows.map((row: any) => ({ id: row.id, name: row.name, provider: row.provider, profileUrl: row.profile_url ?? null, photoUrl: row.photo_url ?? null, party: row.canonical_party ?? row.raw_party_label ?? null }));
}

export async function getStateBudgetDetail(houseValue: string, fiscalYear: number, amendmentKey: string, queryable?: Queryable) {
  const normalizedHouse = house(houseValue); const pool = queryable ?? webPostgresPool(); if (!queryable) await guard(pool);
  return getStateBudgetAmendmentDetail(pool as Pool, normalizedHouse, fiscalYear, amendmentKey);
}

