import type { Pool } from 'pg';

export const ANALYTICS_SCHEMA = 'civica_analytics';

/** Painel /admin: autenticação básica (admin_users) e eventos de uso do site (events, 1 linha por
 * pageview/interação). session_id é um UUID aleatório em cookie, sem nenhum dado pessoal; uf_visitor/
 * country vêm de GeoIP resolvido no servidor a partir do IP, nunca armazenamos o IP em si. */
export const ANALYTICS_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS ${ANALYTICS_SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${ANALYTICS_SCHEMA}.schema_migrations (version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${ANALYTICS_SCHEMA}.admin_users (
    email text PRIMARY KEY, password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ${ANALYTICS_SCHEMA}.events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
    event_name text NOT NULL, path text, referrer text,
    uf_visitor char(2), country text, device_type text,
    props jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `ALTER TABLE ${ANALYTICS_SCHEMA}.events ADD COLUMN IF NOT EXISTS city_visitor text`,
  `CREATE INDEX IF NOT EXISTS events_occurred_idx ON ${ANALYTICS_SCHEMA}.events(occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS events_name_idx ON ${ANALYTICS_SCHEMA}.events(event_name, occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS events_uf_idx ON ${ANALYTICS_SCHEMA}.events(uf_visitor, occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS events_path_idx ON ${ANALYTICS_SCHEMA}.events(path, occurred_at DESC)`,
];

export async function ensureAnalyticsSchema(pool: Pool): Promise<void> {
  for (const sql of ANALYTICS_SCHEMA_SQL) await pool.query(sql);
}

export interface TrackedEvent {
  sessionId: string; eventName: string; path: string | null; referrer: string | null;
  ufVisitor: string | null; country: string | null; cityVisitor: string | null; deviceType: string | null; props: Record<string, unknown>;
}

export async function recordEvent(pool: Pool, e: TrackedEvent): Promise<void> {
  await pool.query(
    `INSERT INTO ${ANALYTICS_SCHEMA}.events (session_id, event_name, path, referrer, uf_visitor, country, city_visitor, device_type, props)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [e.sessionId, e.eventName, e.path, e.referrer, e.ufVisitor, e.country, e.cityVisitor, e.deviceType, JSON.stringify(e.props ?? {})],
  );
}

export async function getAdminUser(pool: Pool, email: string): Promise<{ email: string; passwordHash: string } | null> {
  const row = (await pool.query(`SELECT email, password_hash FROM ${ANALYTICS_SCHEMA}.admin_users WHERE email=$1`, [email.toLowerCase()])).rows[0];
  return row ? { email: row.email, passwordHash: row.password_hash } : null;
}

export async function upsertAdminUser(pool: Pool, email: string, passwordHash: string): Promise<void> {
  await pool.query(
    `INSERT INTO ${ANALYTICS_SCHEMA}.admin_users (email, password_hash) VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, updated_at=now()`,
    [email.toLowerCase(), passwordHash],
  );
}

export interface AnalyticsFilters { uf?: string | null; days?: number }

function windowClause(days: number, startParamIndex: number) {
  return { sql: `occurred_at >= now() - ($${startParamIndex}::text || ' days')::interval`, param: String(days) };
}

export async function getAnalyticsKpis(pool: Pool, filters: AnalyticsFilters = {}) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const row = (await pool.query(
    `SELECT count(*)::int AS pageviews, count(DISTINCT session_id)::int AS sessions
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}`,
    params,
  )).rows[0];
  return { pageviews: row?.pageviews ?? 0, sessions: row?.sessions ?? 0, days };
}

export async function getTopPaths(pool: Pool, filters: AnalyticsFilters = {}, limit = 15) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `path IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT path, count(*)::int AS views FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY path ORDER BY views DESC LIMIT $${params.length}`,
    params,
  );
  return rows as Array<{ path: string; views: number }>;
}

export async function getTopUfs(pool: Pool, filters: AnalyticsFilters = {}, limit = 30) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `uf_visitor IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT uf_visitor AS uf, count(*)::int AS views, count(DISTINCT session_id)::int AS sessions
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY uf_visitor ORDER BY views DESC LIMIT $${params.length}`,
    params,
  );
  return rows as Array<{ uf: string; views: number; sessions: number }>;
}

export async function getTopCities(pool: Pool, filters: AnalyticsFilters = {}, limit = 20) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `city_visitor IS NOT NULL`, `uf_visitor IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT city_visitor AS city, uf_visitor AS uf, count(*)::int AS views, count(DISTINCT session_id)::int AS sessions
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY city_visitor, uf_visitor ORDER BY views DESC LIMIT $${params.length}`,
    params,
  );
  return rows as Array<{ city: string; uf: string; views: number; sessions: number }>;
}

/** Domínio de origem do tráfego. Conta por SESSÃO (não por pageview): como `document.referrer` só é
 * preenchido pelo navegador na entrada da sessão (navegação dentro do site via Link não muda ele),
 * contar por evento infla artificialmente quem tem muitas páginas vistas numa mesma visita. */
export async function getTopReferrers(pool: Pool, filters: AnalyticsFilters = {}, limit = 15) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT
       CASE WHEN referrer IS NULL OR referrer = '' THEN 'Direto / não informado'
            ELSE COALESCE(substring(referrer from '^https?://(?:www\\.)?([^/]+)'), referrer)
       END AS referrer_domain,
       count(DISTINCT session_id)::int AS sessions
     FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY 1 ORDER BY sessions DESC LIMIT $${params.length}`,
    params,
  );
  return rows as Array<{ referrerDomain: string; sessions: number }>;
}

/** Funil do widget "Qual parlamentar vota como você?" (eventos próprios, disparados pelo componente
 * client — não é pageview). started/completed por Casa, pra enxergar taxa de conclusão. */
export async function getVoteMatchFunnel(pool: Pool, filters: AnalyticsFilters = {}) {
  const days = filters.days ?? 30;
  const params: unknown[] = [];
  const where = [`event_name IN ('vote_match_started','vote_match_completed')`];
  const win = windowClause(days, 1); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const { rows } = await pool.query(
    `SELECT event_name, props->>'house' AS house, count(*)::int AS n
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')} GROUP BY 1,2`,
    params,
  );
  const funnel = { senado: { started: 0, completed: 0 }, camara: { started: 0, completed: 0 } };
  for (const r of rows as Array<{ event_name: string; house: string | null; n: number }>) {
    if (r.house !== 'senado' && r.house !== 'camara') continue;
    if (r.event_name === 'vote_match_started') funnel[r.house].started = r.n;
    else if (r.event_name === 'vote_match_completed') funnel[r.house].completed = r.n;
  }
  return funnel;
}

/** Perfis de parlamentar visitados (rotas `/legislativo/senadores/[id]`, `/legislativo/deputados/[id]`
 * e `/parlamentares/[source]/[id]`), já com nome/partido/UF resolvidos em `civica_people_poc.profiles`. */
export async function getTopParliamentarians(pool: Pool, filters: AnalyticsFilters = {}, limit = 20) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [
    `event_name=$1`,
    `(path ~ '^/legislativo/senadores/[^/]+$' OR path ~ '^/legislativo/deputados/[^/]+$' OR path ~ '^/parlamentares/(senado|camara)/[^/]+$')`,
  ];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const { rows } = await pool.query(
    `SELECT
       CASE WHEN path LIKE '/legislativo/senadores/%' THEN 'senado'
            WHEN path LIKE '/legislativo/deputados/%' THEN 'camara'
            ELSE split_part(path,'/',3) END AS source,
       CASE WHEN path LIKE '/parlamentares/%' THEN split_part(path,'/',4) ELSE split_part(path,'/',4) END AS external_id,
       count(*)::int AS views
     FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY 1,2 ORDER BY views DESC LIMIT ${Math.max(1, limit) * 3}`,
    params,
  );
  if (!rows.length) return [] as Array<{ source: string; externalId: string; name: string; party: string; uf: string; views: number }>;
  const bySource = new Map<string, string[]>();
  for (const r of rows) { const list = bySource.get(r.source) ?? []; list.push(String(r.external_id)); bySource.set(r.source, list); }
  const profiles = new Map<string, { name: string; party: string; uf: string }>();
  for (const [source, ids] of bySource) {
    const { rows: pRows } = await pool.query(
      `SELECT external_id::text id, name, party, uf FROM civica_people_poc.profiles WHERE source=$1 AND external_id=ANY($2::text[])`,
      [source, ids],
    );
    for (const p of pRows) profiles.set(`${source}:${p.id}`, { name: p.name, party: p.party ?? 'S/Partido', uf: p.uf ?? '' });
  }
  return rows
    .map(r => {
      const profile = profiles.get(`${r.source}:${r.external_id}`);
      if (!profile) return null;
      return { source: r.source as string, externalId: String(r.external_id), name: profile.name, party: profile.party, uf: profile.uf, views: r.views as number };
    })
    .filter((x): x is { source: string; externalId: string; name: string; party: string; uf: string; views: number } => x != null)
    .slice(0, limit);
}
