import type { Pool } from 'pg';
import { createFinanceResolver, officialBridgeFromRosterPayload } from './state-finance-identity.ts';

/**
 * Agregados de leitura da página de cada Assembleia (`/legislativo/estaduais/[UF]/deputados`).
 * Somente derivam de tabelas já publicadas em `civica_state`; não alteram collectors nem revisões.
 * Cada linha guarda `source_key` (revisões ativas de identidade+legislativo+finanças usadas no cálculo): a página só confia
 * no agregado quando a chave bate com as revisões ativas atuais, caso contrário mostra "atualização pendente".
 * Motivo: a junção autoria×proposições de SP leva 5–7 s ao vivo; a leitura do agregado leva 1 consulta.
 */
export const STATE_STORY_SCHEMA = 'civica_state_story';
/** Sobe quando o FORMATO ou a REGRA do cálculo muda: entra na chave, então todas as Casas são recalculadas sozinhas após o deploy. */
export const STATE_STORY_VERSION = 3;
export const STATE_STORY_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS ${STATE_STORY_SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${STATE_STORY_SCHEMA}.house_story (house text NOT NULL, section text NOT NULL, source_key text NOT NULL, built_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL, PRIMARY KEY (house, section))`,
];

export type StoryPartyRow = { party: string; seats: number };
export interface StorySeats { total: number; parties: StoryPartyRow[]; unresolved: number }
export interface StoryProposals {
  year: number; total: number; authored: number; authorsLinkedPct: number | null;
  byType: Array<{ type: string; n: number }>; byMonth: Array<{ month: string; n: number }>;
  byParty: Array<{ party: string; proposals: number; seats: number }>;
  topAuthors: Array<{ id: string; name: string; party: string | null; n: number }>;
  perMember: Record<string, number>; statuses: Array<{ status: string; n: number }>;
  /** por parlamentar: proposições por mês, alinhado a `byMonth` (mesmo índice). */
  memberMonthly: Record<string, number[]>;
}
export type FinanceLabelSemantics = 'category' | 'supplier' | 'unusable';
export interface StoryFinance {
  totalCents: number; people: number; linkedValuePct: number | null; semantics: FinanceLabelSemantics; from: string | null; to: string | null; ignoredFutureRows: number;
  monthly: Array<{ month: string; cents: number; n: number }>;
  labels: Array<{ label: string; cents: number; n: number }>;
  byParty: Array<{ party: string; cents: number; members: number }>;
  topMembers: Array<{ id: string; name: string; party: string | null; cents: number }>;
  perMember: Record<string, number>;
  /** por parlamentar: centavos por mês, alinhado a `monthly` (mesmo índice). */
  memberMonthly: Record<string, number[]>;
  /** como as despesas foram ligadas ao cadastro: atores ligados por método e o que ficou sem vínculo. */
  links: { byMethod: Record<string, number>; unlinkedActors: number; unlinkedCents: number };
}
export interface StateHouseStory { house: string; fresh: boolean; builtAt: string | null; seats: StorySeats | null; proposals: StoryProposals | null; finance: StoryFinance | null }

const ROSTER = `roster AS (SELECT c.external_id AS id, c.name, COALESCE(pm.canonical_party, pm.raw_party_label) AS party FROM civica_state.current_state_parliamentarians c LEFT JOIN LATERAL (SELECT canonical_party, raw_party_label FROM civica_state.party_memberships WHERE house=c.house AND person_external_id=c.external_id ORDER BY end_at DESC NULLS LAST, start_at DESC NULLS LAST LIMIT 1) pm ON true WHERE c.house=$1)`;
const UNRESOLVED = /^(?:\d+|UNI|BRASIL|UNRESOLVED)$/i;
const cleanParty = (party: string | null | undefined) => { const value = party?.trim(); return value && !UNRESOLVED.test(value) ? value : null; };

export async function ensureStateStorySchema(pool: Pool): Promise<void> { for (const sql of STATE_STORY_SCHEMA_SQL) await pool.query(sql); }

async function sourceKey(pool: Pool, house: string): Promise<string> {
  const rows = (await pool.query<{ domain: string; revision_id: string }>(`SELECT domain, revision_id FROM civica_state.active_publications WHERE house=$1 AND domain IN ('identity','legislative','finance') ORDER BY domain`, [house])).rows;
  return [`v${STATE_STORY_VERSION}`, ...rows.map(r => `${r.domain}=${r.revision_id}`)].join('|');
}

/** Classifica o que a coluna `category` significa em cada Casa (verificado na base em 2026-10-09). */
export function financeLabelSemantics(house: string, labels: string[], distinct: number): FinanceLabelSemantics {
  if (!labels.length) return 'unusable';
  if (house === 'MG') return 'supplier'; // MG publica o favorecido (locadoras, companhias aéreas…) nesse campo
  const numeric = labels.filter(label => /^\d+$/.test(label.trim())).length;
  if (distinct > 120 || numeric / labels.length > 0.5 || labels.some(label => /R\$|Saldo|Disponibilidade/i.test(label))) return 'unusable';
  return 'category';
}

export async function refreshStateHouseStory(pool: Pool, house: string, options: { year?: number; today?: Date } = {}): Promise<{ house: string; sections: string[]; ms: number }> {
  const started = Date.now(); await ensureStateStorySchema(pool);
  const year = options.year ?? (options.today ?? new Date()).getFullYear(), now = options.today ?? new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = await sourceKey(pool, house); const sections: string[] = [];
  const save = async (section: string, payload: unknown) => { await pool.query(`INSERT INTO ${STATE_STORY_SCHEMA}.house_story(house,section,source_key,built_at,payload) VALUES($1,$2,$3,now(),$4::jsonb) ON CONFLICT(house,section) DO UPDATE SET source_key=excluded.source_key, built_at=excluded.built_at, payload=excluded.payload`, [house, section, key, JSON.stringify(payload)]); sections.push(section); };
  const drop = (section: string) => pool.query(`DELETE FROM ${STATE_STORY_SCHEMA}.house_story WHERE house=$1 AND section=$2`, [house, section]);

  // Bancada
  const seatRows = (await pool.query<{ id: string; name: string; party: string | null }>(`WITH ${ROSTER} SELECT * FROM roster`, [house])).rows;
  const seatCount = new Map<string, number>(); let unresolved = 0;
  for (const row of seatRows) { const party = cleanParty(row.party); if (!party) { unresolved++; } seatCount.set(party ?? 'Sem partido', (seatCount.get(party ?? 'Sem partido') ?? 0) + 1); }
  const parties = [...seatCount].map(([party, seats]) => ({ party, seats })).sort((a, b) => (a.party === 'Sem partido' ? 1 : 0) - (b.party === 'Sem partido' ? 1 : 0) || b.seats - a.seats || a.party.localeCompare(b.party, 'pt-BR'));
  const seats: StorySeats = { total: seatRows.length, parties, unresolved };
  await save('seats', seats);
  const rosterById = new Map(seatRows.map(r => [r.id, { name: r.name, party: cleanParty(r.party) }]));

  // Produção legislativa
  const hasLegislative = (await pool.query(`SELECT 1 FROM civica_state.active_publications WHERE house=$1 AND domain='legislative'`, [house])).rowCount;
  if (hasLegislative) {
    const L = `FROM civica_state.proposals p JOIN civica_state.active_publications a ON a.house=p.house AND a.domain='legislative' AND a.revision_id=p.revision_id WHERE p.house=$1 AND p.year=$2`;
    const [totalRow, byType, byMonth, statuses, authors] = await Promise.all([
      pool.query<{ n: number }>(`SELECT count(*)::int n ${L}`, [house, year]),
      pool.query<{ type: string | null; n: number }>(`SELECT COALESCE(NULLIF(p.type_label,''), NULLIF(p.type,''), '—') AS type, count(*)::int n ${L} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [house, year]),
      pool.query<{ month: string | null; n: number }>(`SELECT CASE WHEN p.presented_at ~ '^\\d{4}-\\d{2}' THEN substr(p.presented_at,1,7) WHEN p.presented_at ~ '^\\d{2}/\\d{2}/\\d{4}' THEN substr(p.presented_at,7,4)||'-'||substr(p.presented_at,4,2) END AS month, count(*)::int n ${L} GROUP BY 1 ORDER BY 1`, [house, year]),
      pool.query<{ status: string | null; n: number }>(`SELECT COALESCE(NULLIF(p.status,''),'—') AS status, count(*)::int n ${L} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [house, year]),
      pool.query<{ id: string; month: string | null; n: number }>(`SELECT pa.person_external_id AS id, CASE WHEN p.presented_at ~ '^\\d{4}-\\d{2}' THEN substr(p.presented_at,1,7) WHEN p.presented_at ~ '^\\d{2}/\\d{2}/\\d{4}' THEN substr(p.presented_at,7,4)||'-'||substr(p.presented_at,4,2) END AS month, count(DISTINCT pa.proposal_external_id)::int n FROM civica_state.proposals p JOIN civica_state.active_publications a ON a.house=p.house AND a.domain='legislative' AND a.revision_id=p.revision_id JOIN civica_state.proposal_authors pa ON pa.house=p.house AND pa.revision_id=p.revision_id AND pa.proposal_external_id=p.external_id WHERE p.house=$1 AND p.year=$2 AND pa.person_external_id IS NOT NULL GROUP BY 1, 2`, [house, year]),
    ]);
    const perMember: Record<string, number> = {}, memberMonthly: Record<string, number[]> = {}; const partyProps = new Map<string, number>(); let linkedAuthors = 0, authored = 0;
    const monthIndex = new Map(byMonth.rows.filter(r => r.month).map((r, index) => [r.month!, index]));
    const authorIds = new Set<string>();
    for (const row of authors.rows) { authored += row.n; authorIds.add(row.id); const member = rosterById.get(row.id); if (!member) continue; perMember[row.id] = (perMember[row.id] ?? 0) + row.n; const series = memberMonthly[row.id] ??= new Array(monthIndex.size).fill(0); const at = row.month ? monthIndex.get(row.month) : undefined; if (at !== undefined) series[at]! += row.n; const party = member.party ?? 'Sem partido'; partyProps.set(party, (partyProps.get(party) ?? 0) + row.n); }
    linkedAuthors = Object.keys(perMember).length;
    const seatsOf = new Map(parties.map(p => [p.party, p.seats]));
    const proposals: StoryProposals = {
      year, total: totalRow.rows[0]?.n ?? 0, authored, authorsLinkedPct: authorIds.size ? Math.round(1000 * linkedAuthors / authorIds.size) / 10 : null,
      byType: byType.rows.map(r => ({ type: r.type ?? '—', n: r.n })), byMonth: byMonth.rows.filter(r => r.month).map(r => ({ month: r.month!, n: r.n })),
      byParty: [...partyProps].map(([party, count]) => ({ party, proposals: count, seats: seatsOf.get(party) ?? 0 })).sort((a, b) => b.proposals - a.proposals),
      topAuthors: Object.entries(perMember).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ id, name: rosterById.get(id)!.name, party: rosterById.get(id)!.party, n })),
      perMember, memberMonthly, statuses: statuses.rows.map(r => ({ status: r.status ?? '—', n: r.n })),
    };
    await save('proposals', proposals);
  } else await drop('proposals');

  // Finanças parlamentares
  const hasFinance = (await pool.query(`SELECT 1 FROM civica_state.active_publications WHERE house=$1 AND domain='finance'`, [house])).rowCount;
  if (hasFinance) {
    const F = `FROM civica_state.expenses e JOIN civica_state.active_publications a ON a.house=e.house AND a.domain='finance' AND a.revision_id=e.revision_id WHERE e.house=$1`;
    const [monthly, labels, labelDistinct, actorMonthly, parliamentaryNames] = await Promise.all([
      pool.query<{ month: string | null; cents: string; n: number }>(`SELECT e.competence AS month, sum(e.amount_cents)::bigint cents, count(*)::int n ${F} GROUP BY 1 ORDER BY 1`, [house]),
      pool.query<{ label: string | null; cents: string; n: number }>(`SELECT e.category AS label, sum(e.amount_cents)::bigint cents, count(*)::int n ${F} AND e.competence <= $2 GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [house, currentMonth]),
      pool.query<{ n: number }>(`SELECT count(DISTINCT e.category)::int n ${F}`, [house]),
      pool.query<{ id: string | null; l1: string | null; l2: string | null; month: string | null; cents: string }>(`SELECT e.person_external_id AS id, e.provenance->>'providerPersonLabel' AS l1, e.provenance->>'providerDeputyLabel' AS l2, e.competence AS month, sum(e.amount_cents)::bigint cents ${F} AND e.competence <= $2 GROUP BY 1, 2, 3, 4`, [house, currentMonth]),
      pool.query<{ id: string; name: string | null }>(`SELECT DISTINCT ON (external_id) external_id AS id, parliamentary_name AS name FROM civica_state.state_profile_metadata WHERE house=$1 ORDER BY external_id, observed_at DESC NULLS LAST`, [house]),
    ]);
    // Ligação despesa → parlamentar: id do cadastro, chave oficial da Casa ou nome exato e único (ver state-finance-identity.ts).
    const pnames = new Map(parliamentaryNames.rows.map(r => [r.id, r.name]));
    const bridge = new Map<string, string>();
    if (house === 'SP') {
      const raws = (await pool.query<{ rid: string }>(`SELECT DISTINCT provenance->>'rawId' AS rid FROM civica_state.state_profile_metadata WHERE house=$1 AND provenance->>'rawId' IS NOT NULL`, [house])).rows;
      for (const { rid } of raws) { const body = (await pool.query<{ body: string }>(`SELECT body FROM civica_state.raw_objects WHERE raw_id=$1`, [rid])).rows[0]?.body; if (body) for (const [k, v] of officialBridgeFromRosterPayload(house, body)) bridge.set(k, v); }
    }
    const resolve = createFinanceResolver(seatRows.map(r => ({ id: r.id, name: r.name, parliamentaryName: pnames.get(r.id) ?? null })), bridge);
    const valid = monthly.rows.filter(r => r.month && r.month <= currentMonth), ignored = monthly.rows.filter(r => !r.month || r.month > currentMonth).reduce((s, r) => s + r.n, 0);
    const monthPos = new Map(valid.map((r, index) => [r.month!, index]));
    const perMember: Record<string, number> = {}, memberMonthly: Record<string, number[]> = {}; const partyMap = new Map<string, { cents: number; members: Set<string> }>();
    const linkOf = new Map<string, ReturnType<typeof resolve>>(), actorCents = new Map<string, number>(); let total = 0, linkedCents = 0;
    for (const row of actorMonthly.rows) {
      const cents = Number(row.cents), actorKey = `${row.id ?? ''}|${row.l1 ?? ''}|${row.l2 ?? ''}`; total += cents; actorCents.set(actorKey, (actorCents.get(actorKey) ?? 0) + cents);
      if (!linkOf.has(actorKey)) linkOf.set(actorKey, resolve({ id: row.id, labels: [row.l1, row.l2].filter((v): v is string => Boolean(v)) }));
      const link = linkOf.get(actorKey); if (!link) continue; linkedCents += cents; perMember[link.rosterId] = (perMember[link.rosterId] ?? 0) + cents;
      const party = rosterById.get(link.rosterId)?.party ?? 'Sem partido'; const cur = partyMap.get(party) ?? { cents: 0, members: new Set<string>() }; cur.cents += cents; cur.members.add(link.rosterId); partyMap.set(party, cur);
      const at = row.month ? monthPos.get(row.month) : undefined; if (at !== undefined) (memberMonthly[link.rosterId] ??= new Array(valid.length).fill(0))[at]! += cents;
    }
    const byMethod: Record<string, number> = {}; let unlinkedActors = 0, unlinkedCents = 0;
    for (const [key, link] of linkOf) { if (link) byMethod[link.method] = (byMethod[link.method] ?? 0) + 1; else { unlinkedActors++; unlinkedCents += actorCents.get(key) ?? 0; } }
    const semantics = financeLabelSemantics(house, labels.rows.map(r => r.label ?? ''), labelDistinct.rows[0]?.n ?? 0);
    const finance: StoryFinance = {
      totalCents: total, people: linkOf.size, linkedValuePct: total ? Math.round(1000 * linkedCents / total) / 10 : null, semantics,
      from: valid[0]?.month ?? null, to: valid.at(-1)?.month ?? null, ignoredFutureRows: ignored,
      monthly: valid.map(r => ({ month: r.month!, cents: Number(r.cents), n: r.n })),
      labels: semantics === 'unusable' ? [] : labels.rows.filter(r => r.label).map(r => ({ label: r.label!, cents: Number(r.cents), n: r.n })),
      byParty: [...partyMap].map(([party, v]) => ({ party, cents: v.cents, members: v.members.size })).sort((a, b) => b.cents - a.cents),
      topMembers: Object.entries(perMember).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, cents]) => ({ id, name: rosterById.get(id)!.name, party: rosterById.get(id)!.party, cents })),
      perMember, memberMonthly, links: { byMethod, unlinkedActors, unlinkedCents },
    };
    await save('finance', finance);
  } else await drop('finance');
  return { house, sections, ms: Date.now() - started };
}

/** Uma consulta de leitura + uma de revisões ativas. `fresh=false` quando as revisões mudaram depois do cálculo. */
export async function readStateHouseStory(pool: Pool, house: string): Promise<StateHouseStory> {
  const empty: StateHouseStory = { house, fresh: false, builtAt: null, seats: null, proposals: null, finance: null };
  let rows: Array<{ section: string; source_key: string; built_at: Date; payload: any }>;
  try { rows = (await pool.query(`SELECT section, source_key, built_at, payload FROM ${STATE_STORY_SCHEMA}.house_story WHERE house=$1`, [house])).rows; }
  catch (error) { if ((error as { code?: string }).code === '42P01') return empty; throw error; }
  if (!rows.length) return empty;
  const key = await sourceKey(pool, house); const by = new Map(rows.map(r => [r.section, r]));
  const fresh = rows.every(r => r.source_key === key);
  return { house, fresh, builtAt: rows.map(r => r.built_at).sort((a, b) => +b - +a)[0]!.toISOString(), seats: by.get('seats')?.payload ?? null, proposals: by.get('proposals')?.payload ?? null, finance: by.get('finance')?.payload ?? null };
}

export interface StateHouseGlance { house: string; seats: StorySeats | null; proposalsTotal: number | null; proposalsYear: number | null; hasFinance: boolean }

/** Uma consulta para a landing nacional: composição e presença de domínios das 27 Casas, sem varrer tabelas de origem. */
export async function readStateHouseGlances(pool: Pool): Promise<StateHouseGlance[]> {
  let rows: Array<{ house: string; section: string; payload: any }>;
  try { rows = (await pool.query(`SELECT house, section, payload FROM ${STATE_STORY_SCHEMA}.house_story`)).rows; }
  catch (error) { if ((error as { code?: string }).code === '42P01') return []; throw error; }
  const by = new Map<string, StateHouseGlance>();
  for (const row of rows) {
    const item = by.get(row.house) ?? { house: row.house, seats: null, proposalsTotal: null, proposalsYear: null, hasFinance: false };
    if (row.section === 'seats') item.seats = row.payload; else if (row.section === 'proposals') { item.proposalsTotal = row.payload.total; item.proposalsYear = row.payload.year; } else if (row.section === 'finance') item.hasFinance = true;
    by.set(row.house, item);
  }
  return [...by.values()].sort((a, b) => a.house.localeCompare(b.house));
}

const KEYED_DOMAINS = `('identity','legislative','finance')`;
export interface StoryReconcileResult { checked: number; refreshed: string[]; skippedLocked: string[]; failed: Array<{ house: string; error: string }> }

/**
 * Fronteira única de consistência dos agregados: compara, para cada Casa, a chave das revisões ativas com a chave usada no último
 * cálculo e recalcula só o que divergiu. Não depende de QUEM publicou a revisão (orquestrador, persistence.ts, scripts, promoção
 * manual): basta a revisão ativa mudar. Segura para chamar com frequência (2 consultas quando nada mudou) e de vários processos
 * ao mesmo tempo (trava consultiva por Casa: quem não conseguir a trava segue em frente, pois outro processo já está recalculando).
 */
export async function reconcileStateHouseStories(pool: Pool, options: { houses?: readonly string[]; year?: number; today?: Date } = {}): Promise<StoryReconcileResult> {
  await ensureStateStorySchema(pool);
  const filter = options.houses?.length ? [...options.houses] : null;
  const [current, stored] = await Promise.all([
    pool.query<{ house: string; key: string }>(`SELECT house, 'v${STATE_STORY_VERSION}|' || string_agg(domain||'='||revision_id, '|' ORDER BY domain) AS key FROM civica_state.active_publications WHERE domain IN ${KEYED_DOMAINS} ${filter ? 'AND house = ANY($1::text[])' : ''} GROUP BY house`, filter ? [filter] : []),
    pool.query<{ house: string; keys: string[] }>(`SELECT house, array_agg(DISTINCT source_key) AS keys FROM ${STATE_STORY_SCHEMA}.house_story ${filter ? 'WHERE house = ANY($1::text[])' : ''} GROUP BY house`, filter ? [filter] : []),
  ]);
  const storedBy = new Map(stored.rows.map(row => [row.house, row.keys]));
  const stale = current.rows.filter(row => { const keys = storedBy.get(row.house); return !keys || keys.length !== 1 || keys[0] !== row.key; }).map(row => row.house);
  const result: StoryReconcileResult = { checked: current.rows.length, refreshed: [], skippedLocked: [], failed: [] };
  for (const house of stale) {
    const client = await pool.connect();
    try {
      const locked = (await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [`state_story:${house}`])).rows[0]?.ok;
      if (!locked) { result.skippedLocked.push(house); continue; }
      try { await refreshStateHouseStory(pool, house, { ...(options.year !== undefined ? { year: options.year } : {}), ...(options.today ? { today: options.today } : {}) }); result.refreshed.push(house); }
      catch (error) { result.failed.push({ house, error: error instanceof Error ? error.message : String(error) }); }
      finally { await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [`state_story:${house}`]); }
    } finally { client.release(); }
  }
  return result;
}
