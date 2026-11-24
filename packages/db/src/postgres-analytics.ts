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
  `CREATE INDEX IF NOT EXISTS events_session_idx ON ${ANALYTICS_SCHEMA}.events(session_id, occurred_at)`,
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
    `WITH session_counts AS (
       SELECT session_id, count(*)::int AS n FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')} GROUP BY session_id
     )
     SELECT count(*)::int AS sessions, coalesce(sum(n),0)::int AS pageviews, count(*) FILTER (WHERE n=1)::int AS bounced
       FROM session_counts`,
    params,
  )).rows[0];
  const sessions = row?.sessions ?? 0, pageviews = row?.pageviews ?? 0, bounced = row?.bounced ?? 0;
  return {
    pageviews, sessions, days,
    bounceRate: sessions > 0 ? bounced / sessions : null,
    pagesPerSession: sessions > 0 ? pageviews / sessions : null,
  };
}

/** Série diária de pageviews/sessões. Dias sem evento são preenchidos como zero (sem isso o gráfico
 * "pularia" datas em silêncio em vez de mostrar o vazio real) — por isso o corte usa data de calendário
 * (occurred_at::date), não um intervalo rolante, pra bater exatamente com os dias gerados. */
export async function getDailyTrend(pool: Pool, filters: AnalyticsFilters = {}) {
  const days = filters.days ?? 30;
  const params: unknown[] = [String(days), 'pageview'];
  const where = [`event_name=$2`, `occurred_at::date >= (current_date - ($1::text||' days')::interval + interval '1 day')::date`];
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series((current_date - ($1::text||' days')::interval + interval '1 day')::date, current_date, interval '1 day')::date AS day
     ), agg AS (
       SELECT occurred_at::date AS day, count(*)::int AS pageviews, count(DISTINCT session_id)::int AS sessions
         FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')} GROUP BY 1
     )
     SELECT to_char(days.day,'DD/MM') AS label, coalesce(agg.pageviews,0)::int AS pageviews, coalesce(agg.sessions,0)::int AS sessions
       FROM days LEFT JOIN agg ON agg.day = days.day ORDER BY days.day`,
    params,
  );
  return rows as Array<{ label: string; pageviews: number; sessions: number }>;
}

/** "Agora" = sessões com qualquer evento nos últimos 5 min; stream recente = últimos 30 min (até 25
 * eventos), pra enxergar o que está acontecendo sem depender só do próximo refresh do painel. */
export async function getRealtimeSnapshot(pool: Pool, filters: Pick<AnalyticsFilters, 'uf'> = {}) {
  const activeParams: unknown[] = [];
  const activeWhere = [`occurred_at >= now() - interval '5 minutes'`];
  if (filters.uf) { activeParams.push(filters.uf); activeWhere.push(`uf_visitor=$${activeParams.length}`); }
  const activeRow = (await pool.query(
    `SELECT count(DISTINCT session_id)::int AS active FROM ${ANALYTICS_SCHEMA}.events WHERE ${activeWhere.join(' AND ')}`,
    activeParams,
  )).rows[0];

  const recentParams: unknown[] = [];
  const recentWhere = [`occurred_at >= now() - interval '30 minutes'`];
  if (filters.uf) { recentParams.push(filters.uf); recentWhere.push(`uf_visitor=$${recentParams.length}`); }
  recentParams.push(25);
  const { rows: recent } = await pool.query(
    `SELECT occurred_at, event_name, path, uf_visitor AS uf, city_visitor AS city, device_type AS device
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${recentWhere.join(' AND ')}
     ORDER BY occurred_at DESC LIMIT $${recentParams.length}`,
    recentParams,
  );
  return {
    active: activeRow?.active ?? 0,
    recent: recent as Array<{ occurred_at: Date; event_name: string; path: string | null; uf: string | null; city: string | null; device: string | null }>,
  };
}

/** Primeira e última página vista em cada sessão (janela por `row_number`, não por MIN/MAX de texto). */
export async function getEntryExitPages(pool: Pool, filters: AnalyticsFilters = {}, limit = 10) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `path IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const limitIdx = params.length + 1;
  const sqlFor = (direction: 'ASC' | 'DESC') =>
    `SELECT path, count(*)::int AS sessions FROM (
       SELECT session_id, path, row_number() OVER (PARTITION BY session_id ORDER BY occurred_at ${direction}) AS rn
         FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     ) t WHERE rn=1 GROUP BY path ORDER BY sessions DESC LIMIT $${limitIdx}`;
  const [entry, exit] = await Promise.all([
    pool.query(sqlFor('ASC'), [...params, limit]),
    pool.query(sqlFor('DESC'), [...params, limit]),
  ]);
  return {
    entry: entry.rows as Array<{ path: string; sessions: number }>,
    exit: exit.rows as Array<{ path: string; sessions: number }>,
  };
}

/** Tempo médio na página = intervalo até o próximo pageview da MESMA sessão — a última página de cada
 * sessão não entra na média (não existe beacon de saída, mesma limitação de qualquer analytics sem
 * isso). Intervalos > 30 min são descartados: é aba esquecida aberta, não tempo de leitura real. */
export async function getAvgTimeOnPage(pool: Pool, filters: AnalyticsFilters = {}, limit = 15) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `path IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `WITH deltas AS (
       SELECT path, LEAD(occurred_at) OVER (PARTITION BY session_id ORDER BY occurred_at) - occurred_at AS dur
         FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     )
     SELECT path, avg(EXTRACT(EPOCH FROM dur))::int AS avg_seconds, count(*)::int AS n
       FROM deltas WHERE dur IS NOT NULL AND dur <= interval '30 minutes'
     GROUP BY path ORDER BY n DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(r => ({ path: r.path as string, avgSeconds: r.avg_seconds as number, samples: r.n as number }));
}

/** Transições mais comuns de uma página pra outra dentro da mesma sessão. Pula quando a "próxima" é a
 * mesma página (refresh/pageview duplicado não é navegação real). */
export async function getNavigationFlow(pool: Pool, filters: AnalyticsFilters = {}, limit = 15) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`, `path IS NOT NULL`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `WITH seq AS (
       SELECT path, LEAD(path) OVER (PARTITION BY session_id ORDER BY occurred_at) AS next_path
         FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     )
     SELECT path AS from_path, next_path AS to_path, count(*)::int AS n
       FROM seq WHERE next_path IS NOT NULL AND next_path <> path
     GROUP BY path, next_path ORDER BY n DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(r => ({ fromPath: r.from_path as string, toPath: r.to_path as string, n: r.n as number }));
}

export async function getDeviceBreakdown(pool: Pool, filters: AnalyticsFilters = {}) {
  const days = filters.days ?? 30;
  const params: unknown[] = ['pageview'];
  const where = [`event_name=$1`];
  const win = windowClause(days, 2); params.push(win.param); where.push(win.sql);
  if (filters.uf) { params.push(filters.uf); where.push(`uf_visitor=$${params.length}`); }
  const { rows } = await pool.query(
    `SELECT coalesce(device_type,'desconhecido') AS device, count(DISTINCT session_id)::int AS sessions
       FROM ${ANALYTICS_SCHEMA}.events WHERE ${where.join(' AND ')}
     GROUP BY 1 ORDER BY sessions DESC`,
    params,
  );
  return rows as Array<{ device: string; sessions: number }>;
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
  // Postgres devolve a coluna como `referrer_domain` (alias sem aspas nunca vira camelCase) —
  // mapeamento explícito aqui porque um `as Array<{referrerDomain}>` só mentiria sobre o formato.
  return rows.map(r => ({ referrerDomain: r.referrer_domain as string, sessions: r.sessions as number }));
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
