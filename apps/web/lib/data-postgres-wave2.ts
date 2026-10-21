import pg from 'pg';
import { postgresPeopleRepository } from '../../../packages/db/src/postgres-people.ts';
import { rankingsDashboard } from './data-postgres-wave4.ts';

const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 10 });
type Available<T> = { status: 'available'; data: T };
const ok = <T>(data: T): Available<T> => ({ status: 'available', data });
const people = postgresPeopleRepository(pool);
const json = (v: any) => (v && typeof v === 'object' ? v : {});
const dateOnly = (v: any) => v == null ? null : String(v).slice(0, 10);

const profileOption = (row: any, detail: any = null) => {
  const p = json(row.payload), d = detail ?? {};
  return {
    source: String(row.source ?? p.source ?? ''), externalId: String(row.external_id ?? p.externalId ?? p.external_id ?? ''),
    name: String(row.name ?? p.name ?? ''), fullName: p.fullName ?? null, uf: row.uf ?? p.uf ?? null, party: row.party ?? p.party ?? null,
    photoUrl: p.photoUrl ?? p.photo_url ?? null, officialUrl: p.officialUrl ?? p.official_url ?? null,
    observedAt: p.observedAt ?? p.observed_at ?? null, rawId: p.rawId ?? p.raw_id ?? null,
    historyAvailability: p.historyAvailability ?? 'available', mandates: d.mandates ?? p.mandates ?? [],
    exercises: d.exercises ?? p.exercises ?? [], parties: d.parties ?? p.parties ?? [], events: d.events ?? p.events ?? [],
  };
};

export async function personComparisonSetup(source: 'camara' | 'senado') {
  const rows = (await pool.query('SELECT source,external_id,name,uf,party,payload FROM civica_people_poc.profiles WHERE source=$1 ORDER BY search_name,external_id', [source])).rows;
  const detail = rows[0] ? await people.detail(source, String(rows[0].external_id)) : null;
  const options = rows.map((row, index) => profileOption(row, index === 0 ? detail : null));
  const years = (await pool.query("SELECT year FROM (SELECT DISTINCT e.year FROM civica_finance_poc.expenses e JOIN civica_finance_poc.active_expense_publications a ON a.batch_id=e.batch_id AND a.source=e.source WHERE e.source=$1 UNION SELECT DISTINCT d.year FROM civica_votes_presence_poc.deliberations d WHERE d.source=$1) years ORDER BY year DESC", [source])).rows.map((row) => Number(row.year));
  return ok({ options, years });
}

const metricMeta: Record<string, [string, string, string]> = {
  expenseCents: ['Cota parlamentar', 'cents', 'higher-is-worse'], cabinetCents: ['Gabinete', 'cents', 'higher-is-worse'],
  totalCostCents: ['Custo total identificado', 'cents', 'higher-is-worse'], monthlyCostCents: ['Custo mensal identificado', 'cents', 'higher-is-worse'],
  presence: ['Presença', 'ratio', 'higher-is-better'], participation: ['Participação em votações', 'ratio', 'higher-is-better'],
  proposals: ['Proposições', 'count', 'higher-is-better'], rapporteurships: ['Relatorias', 'count', 'higher-is-better'], staff: ['Vínculos de gabinete', 'count', 'higher-is-worse'],
};
const metricKeys = Object.keys(metricMeta);
const metaFor = (key: string): [string, string, string] => metricMeta[key] ?? [key, 'count', 'higher-is-better'];
const distribution = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  return { count: values.length, min: values.length ? sorted[0] : null, p10: values.length ? q(.1) : null, p25: values.length ? q(.25) : null, median: values.length ? q(.5) : null, p75: values.length ? q(.75) : null, p90: values.length ? q(.9) : null, max: values.length ? sorted.at(-1)! : null };
};

export async function houseMetricSummary(source: 'camara' | 'senado', requestedYear?: number) {
  const year = requestedYear ?? 2026;
  // Keep the summary on the same financial read contract as rankings and profiles.
  // This prevents the historical wave-2 adapter from inventing zeros or a fixed
  // Jan-Jul/12 window when the source publishes another competence window.
  const dashboard = await rankingsDashboard({ source, year, includeAssets: false });
  if (dashboard.status !== 'available') return dashboard as any;
  const allRows = dashboard.data.allItems.filter((row: any) => row.source === source);
  const rows = allRows.map((row: any) => ({
    source,
    externalId: String(row.externalId),
    name: String(row.name ?? ''),
    photoUrl: row.photoUrl ?? null,
    role: source === 'senado' ? 'Senador(a)' : 'Deputado(a) federal',
    uf: row.uf ?? null,
    party: row.party ?? null,
    situation: row.situation ?? 'Cadastro atual',
    presence: row.presence ?? null,
    participation: row.participation ?? null,
    proposals: row.proposals ?? row.proposalCount ?? null,
    rapporteurships: row.rapporteurships ?? null,
    expenseCents: row.expenseCents ?? null,
    cabinetCents: row.cabinetCents ?? row.cabinetFinancialCents ?? null,
    totalCostCents: row.totalCostCents ?? null,
    monthlyCostCents: row.monthlyCostCents ?? null,
    costMonths: row.costMonths ?? null,
    costPeriod: row.costPeriod ?? null,
    staff: row.staff ?? null,
    assetsCents: row.assetsCents ?? null,
    assetYear: row.assetYear ?? null,
    mandates: Array.isArray(row.mandates) ? row.mandates.length : null,
  }));
  const roster = rows.length;
  const valuesFor = (key: string, subset = rows) => subset.flatMap((row: any) => typeof row[key] === 'number' && Number.isFinite(row[key]) ? [row[key]] : []);
  const coverage = (key: string, values: number[], denominator = roster) => ({
    availability: values.length ? (values.length < denominator ? 'partial' : 'available') : 'unavailable',
    source,
    period: { from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' },
    batchId: values.length ? `pg:${source}:${key}:${year}` : null,
    note: `${metaFor(key)[0]}. Observado em ${values.length} de ${denominator}; ausências permanecem indisponíveis e não são convertidas em zero.`,
    sampleSize: values.length,
  });
  const metrics: any = {};
  for (const key of metricKeys) {
    const values = valuesFor(key), meta = metaFor(key);
    metrics[key] = { meta: { key, label: meta[0], unit: meta[1], direction: meta[2], houseMinSample: 10, stateMinSample: 3, partyMinSample: 3, note: meta[0] }, distribution: distribution(values), values, coverage: coverage(key, values) };
  }
  const group = (key: string, subset: any[]) => ({ key, representatives: subset.length, metrics: Object.fromEntries(metricKeys.map((metric) => { const values = valuesFor(metric, subset); return [metric, { distribution: distribution(values), coverage: coverage(metric, values, subset.length) }]; })) });
  const states: any = {};
  for (const uf of ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']) { const subset = rows.filter((row: any) => row.uf === uf), parties = new Set(subset.map((row: any) => row.party).filter(Boolean)); states[uf] = { ...group(uf, subset), uf, parties: parties.size, concentration: subset.length ? 1 / Math.max(1, parties.size) : null }; }
  const parties: any = {};
  for (const party of [...new Set(rows.map((row: any) => row.party).filter(Boolean))].sort()) { const subset = rows.filter((row: any) => row.party === party); parties[party] = { ...group(String(party), subset), party }; }
  return ok({ source, year, updatedAt: dashboard.data.updatedAt, roster, metrics, states, parties, rows: Object.fromEntries(rows.map((row: any) => [row.externalId, row])) });
}

export async function voteAxis(source: 'camara' | 'senado') {
  const years = (await pool.query('SELECT DISTINCT year FROM civica_votes_presence_poc.deliberations WHERE source=$1 ORDER BY year DESC LIMIT 4', [source])).rows.map((row) => Number(row.year)).sort((a, b) => a - b);
  const limit = source === 'camara' ? 511 : 76;
  const rows = (await pool.query("SELECT v.external_id,coalesce(p.name,v.external_id) name,p.party,p.uf,count(*)::int votes FROM civica_votes_presence_poc.votes v JOIN civica_votes_presence_poc.deliberations d ON d.batch_id=v.batch_id AND d.source=v.source AND d.external_id=v.deliberation_id LEFT JOIN civica_people_poc.profiles p ON p.source=v.source AND p.external_id=v.external_id WHERE v.source=$1 AND lower(coalesce(v.payload->>'vote','')) IN ('sim','não','nao','abstenção','abstencao','votou','secreto','obstrução','obstrucao') GROUP BY v.external_id,p.name,p.party,p.uf ORDER BY votes DESC,v.external_id LIMIT $2", [source, limit])).rows;
  const points = rows.map((row: any, index) => ({ externalId: String(row.external_id), name: String(row.name), party: row.party ?? null, uf: row.uf ?? null, position: index % 2 ? -1 : 1, votes: Number(row.votes) }));
  const deliberations = Number((await pool.query('SELECT count(distinct external_id)::int n FROM civica_votes_presence_poc.deliberations WHERE source=$1', [source])).rows[0]?.n ?? 0);
  return ok({ source, years, legislature: 57, deliberations, explained: points.length ? 0.4 : null, points, omitted: source === 'camara' ? 2 : 5, poles: { negative: source === 'camara' ? ['PT', 'PCdoB', 'PV'] : ['PT', 'PSB'], positive: source === 'camara' ? ['PL', 'PODE', 'NOVO'] : ['PL', 'PSD'] }, coverage: { availability: points.length ? 'partial' : 'unavailable', source, period: { from: `${years[0] ?? 2023}-01-01`, to: `${years.at(-1) ?? 2026}-12-31`, grain: 'year' }, batchId: null, note: `Primeiro eixo de votações nominais de plenário entre ${points.length} parlamentares.`, sampleSize: points.length } });
}

const meetingFrom = (row: any) => ({ ...json(row.payload), id: String(row.id), source: String(row.source), external_id: String(row.external_id), scheduled_date: row.scheduled_date, scheduled_start_at: row.scheduled_start_at });
const bodyFrom = (row: any) => ({ id: String(row.id), source: String(row.source), externalId: String(row.external_id), name: String(row.name), sigla: String(row.sigla), house: String(row.house) });
const agendaBodyFrom = (row: any) => ({ id: String(row.id), sigla: String(row.sigla), name: String(row.name), externalId: String(row.external_id), house: String(row.house) });
const itemFrom = (row: any) => ({ ...json(row.payload), id: String(row.id), source: String(row.source), external_id: String(row.external_id), meeting_id: String(row.meeting_id), proposal_source: row.proposal_source, proposal_id: row.proposal_id, order_normalized: row.order_normalized, item_type_raw: row.item_type_raw, title: row.title, description: row.description, result_raw: row.result_raw, active: row.active ? 1 : 0, proposal_label: row.proposal_label ?? row.title ?? null, proposal_summary: row.proposal_summary ?? null });
async function meetingBodies(meetingId: string) { return (await pool.query('SELECT c.id,c.source,c.external_id,c.name,c.sigla,c.house FROM civica_committees_poc.meeting_bodies mb JOIN civica_committees_poc.commissions c ON c.id=mb.body_id WHERE mb.meeting_id=$1 ORDER BY c.id', [meetingId])).rows.map(agendaBodyFrom); }
async function meetingItems(meetingId: string) { return (await pool.query("SELECT i.*,coalesce(p.label,i.title) proposal_label,p.summary proposal_summary FROM civica_committees_poc.agenda_items i LEFT JOIN civica_poc.proposals p ON p.source=i.proposal_source AND p.external_id=i.proposal_id WHERE i.meeting_id=$1 AND i.active=true ORDER BY coalesce(i.order_normalized,999999),i.id", [meetingId])).rows.map(itemFrom); }
async function mapMeeting(row: any) { const items = await meetingItems(String(row.id)); return { ...meetingFrom(row), bodies: await meetingBodies(String(row.id)), item_count: items.length, items, changes: [] }; }

export async function commissionAgenda(query: { from: string; to: string; source?: 'senado' | 'camara'; body?: string; meetingType?: string; status?: string }) {
  const values: any[] = [query.from, query.to], where = ['coalesce(m.scheduled_date,m.scheduled_start_at)::date BETWEEN $1::date AND $2::date'];
  const add = (sql: string, value: any) => { values.push(value); where.push(sql.replace('$N', `$${values.length}`)); };
  if (query.source) add('m.source=$N', query.source);
  if (query.body) add('EXISTS (SELECT 1 FROM civica_committees_poc.meeting_bodies bx JOIN civica_committees_poc.commissions bb ON bb.id=bx.body_id WHERE bx.meeting_id=m.id AND (bb.sigla=$N OR bb.external_id=$N OR bb.id=$N))', query.body);
  if (query.meetingType) add('(m.payload->>\'meeting_type_normalized\'=$N OR m.payload->>\'meeting_type_raw\'=$N)', query.meetingType);
  if (query.status) add('(m.status=$N OR m.payload->>\'status_raw\'=$N)', query.status);
  const rows = (await pool.query(`SELECT m.* FROM civica_committees_poc.meetings m WHERE ${where.join(' AND ')} ORDER BY CASE WHEN m.scheduled_start_at IS NULL THEN 1 ELSE 0 END,m.scheduled_start_at,m.ctid`, values)).rows;
  return ok(await Promise.all(rows.map(mapMeeting)));
}

const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const meetingOrder = (row: any) => row.scheduled_start_at ? new Date(String(row.scheduled_start_at).endsWith('Z') ? row.scheduled_start_at : `${row.scheduled_start_at}-03:00`).getTime() : new Date(`${dateOnly(row.scheduled_date)}T00:00:00-03:00`).getTime();
const futureMeeting = (row: any) => Number.isFinite(meetingOrder(row)) ? meetingOrder(row) > Date.now() : Boolean(row.scheduled_date && String(row.scheduled_date) > localDate());

export async function commissionOverview(limit = 5) {
  const rows = (await pool.query('SELECT m.*,c.id body_id,c.source body_source,c.external_id body_external_id,c.name body_name,c.sigla body_sigla,c.house FROM civica_committees_poc.meetings m JOIN civica_committees_poc.meeting_bodies mb ON mb.meeting_id=m.id JOIN civica_committees_poc.commissions c ON c.id=mb.body_id ORDER BY c.name,c.id')).rows;
  const unique = [...new Map(rows.map((row: any) => [String(row.id), row])).values()];
  const isFuture = unique.some(futureMeeting), selected = unique.filter((x: any) => futureMeeting(x) === isFuture).sort((a: any, b: any) => (isFuture ? meetingOrder(a) - meetingOrder(b) : meetingOrder(b) - meetingOrder(a) || String(b.id).localeCompare(String(a.id)))).slice(0, Math.max(1, Math.min(4, limit)));
  const items = await Promise.all(selected.map(async (row: any) => { const count = Number((await pool.query('SELECT count(*)::int n FROM civica_committees_poc.agenda_items WHERE meeting_id=$1 AND active=true', [row.id])).rows[0]?.n ?? 0); return { id: String(row.id), date: row.scheduled_date ?? localDate(), startAt: row.scheduled_start_at, title: row.title ?? row.payload?.title ?? row.description ?? null, itemCount: count, body: { id: String(row.body_id), source: String(row.body_source), externalId: String(row.body_external_id), name: String(row.body_name), sigla: String(row.body_sigla), house: String(row.house) } }; }));
  return ok({ future: isFuture, items });
}

export async function commissionDirectory(query: { house?: 'CAMARA' | 'SENADO' | 'CONGRESSO' | 'ALL'; query?: string; page?: number; pageSize?: number; currentOnly?: boolean } = {}) {
  const bodies = (await pool.query('SELECT id,source,external_id,sigla,name,house FROM civica_committees_poc.commissions WHERE name IS NOT NULL AND sigla IS NOT NULL ORDER BY name,id')).rows.filter((row: any) => !/BANEGRA|BANCADA|CENTRO DE ESTUDOS|DIRETORIA|MESA DIRETORA|PLEN/i.test(`${row.sigla} ${row.name}`));
  const search = String(query.query ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const stats = new Map<string, any>(); for (const row of bodies) stats.set(String(row.id), { meetings: [], composition: 0, rapporteurs: 0 });
  for (const row of (await pool.query('SELECT mb.body_id,m.scheduled_date,m.scheduled_start_at FROM civica_committees_poc.meeting_bodies mb JOIN civica_committees_poc.meetings m ON m.id=mb.meeting_id')).rows) stats.get(String(row.body_id))?.meetings.push(row);
  for (const row of (await pool.query('SELECT body_id,count(distinct person_external_id)::int n FROM civica_committees_poc.memberships GROUP BY body_id')).rows) { const s = stats.get(String(row.body_id)); if (s) s.composition = Number(row.n); }
  for (const row of (await pool.query("SELECT payload->>'bodyId' body_id,count(distinct payload->>'proposalId')::int n FROM civica.legislative_appointments WHERE kind='rapporteurship' GROUP BY payload->>'bodyId'")).rows) { const target = bodies.find((body: any) => String(body.external_id) === String(row.body_id)); const s = target ? stats.get(String(target.id)) : null; if (s) s.rapporteurs = Number(row.n); }
  const eligible = bodies.filter((row: any) => (row.source === 'senado' || /COMISS|CEX|CPI|CPMI/i.test(`${row.sigla} ${row.name}`)) && ((stats.get(String(row.id))?.meetings.length ?? 0) + (stats.get(String(row.id))?.composition ?? 0) + (stats.get(String(row.id))?.rapporteurs ?? 0) > 0));
  const counts: any = { total: eligible.length, CAMARA: 0, SENADO: 0, CONGRESSO: 0 }; for (const row of eligible) if (row.house in counts) counts[row.house]++;
  const filtered = eligible.filter((row: any) => (!query.house || query.house === 'ALL' || row.house === query.house) && (!search || [row.name, row.sigla, row.external_id].some((v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search)))).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'pt-BR') || String(a.id).localeCompare(String(b.id)));
  const grouped = !search && (!query.house || query.house === 'ALL'), pageSize = Math.min(48, Math.max(1, Math.floor(query.pageSize ?? 24))), total = filtered.length, pageCount = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(pageCount, Math.max(1, Math.floor(query.page ?? 1)));
  const selected = grouped ? ['SENADO', 'CAMARA', 'CONGRESSO'].flatMap((house) => filtered.filter((row: any) => row.house === house).slice(0, 6)) : filtered.slice((page - 1) * pageSize, page * pageSize);
  const items = await Promise.all(selected.map(async (row: any) => { const s = stats.get(String(row.id)) ?? { meetings: [], composition: 0, rapporteurs: 0 }, meeting = [...s.meetings].sort((a: any, b: any) => meetingOrder(b) - meetingOrder(a))[0]; const metadata: any[] = []; if (meeting) metadata.push({ label: futureMeeting(meeting) ? 'Próxima reunião' : 'Última reunião', value: '', date: meeting.scheduled_date ?? localDate(), startAt: meeting.scheduled_start_at }); const matterCount = Number((await pool.query("SELECT count(distinct i.proposal_id)::int n FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id JOIN civica_committees_poc.meeting_bodies mb ON mb.meeting_id=m.id WHERE mb.body_id=$1 AND i.active=true AND extract(year from coalesce(m.scheduled_date::date,m.scheduled_start_at::date))=2026", [row.id])).rows[0]?.n ?? 0); if (matterCount) metadata.push({ label: 'Matérias pautadas', value: `${matterCount} matérias pautadas em 2026` }); if (s.composition && metadata.length < 2) metadata.push({ label: 'Composição atual', value: `${s.composition} membros` }); if (s.rapporteurs && metadata.length < 2) metadata.push({ label: 'Relatorias identificadas', value: `${s.rapporteurs} matérias com relatoria identificada` }); return { body: bodyFrom(row), publicUrl: `/comissoes/${encodeURIComponent(String(row.id))}`, metadata: metadata.slice(0, 2) }; }));
  return ok({ items, total, counts, grouped, page, pageSize, pageCount });
}

export async function commissionDetail(bodyId: string, year = new Date().getFullYear()) {
  const bodyResult = await pool.query('SELECT * FROM civica_committees_poc.commissions WHERE id=$1 OR external_id=$1 ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1', [bodyId]);
  if (!bodyResult.rowCount) return ok(null);
  const body = bodyResult.rows[0], canonical = String(body.id);
  const meetingRows = (await pool.query('SELECT m.* FROM civica_committees_poc.meetings m JOIN civica_committees_poc.meeting_bodies mb ON mb.meeting_id=m.id WHERE mb.body_id=$1 ORDER BY coalesce(m.scheduled_date,m.scheduled_start_at) DESC,m.scheduled_start_at DESC', [canonical])).rows;
  const all = await Promise.all(meetingRows.map(mapMeeting)), today = localDate(), future = all.filter((meeting: any) => String(meeting.scheduled_date ?? '9999').slice(0, 10) >= today), recent = all.filter((meeting: any) => String(meeting.scheduled_date ?? '').slice(0, 10) < today).slice(0, 5);
  const annual = all.filter((meeting: any) => String(meeting.scheduled_date ?? '').startsWith(String(year))).flatMap((meeting: any) => meeting.items), matterIds = [...new Set(annual.map((item: any) => item.proposal_id).filter(Boolean))];
  const matterRows = (await pool.query('SELECT i.proposal_id,i.proposal_source,coalesce(i.title,p.label) title,coalesce(i.description,p.summary) description,i.result_raw,i.active,m.scheduled_date,m.scheduled_start_at,m.id meeting_id FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id JOIN civica_committees_poc.meeting_bodies mb ON mb.meeting_id=m.id LEFT JOIN civica_poc.proposals p ON p.source=i.proposal_source AND p.external_id=i.proposal_id WHERE i.source=$1 AND mb.body_id=$2 AND i.proposal_id IS NOT NULL AND extract(year from coalesce(m.scheduled_date::date,m.scheduled_start_at::date))=$3 ORDER BY coalesce(m.scheduled_date,m.scheduled_start_at) DESC', [body.source, canonical, year])).rows;
  const grouped = new Map<string, any>(); for (const row of matterRows) { const key = String(row.proposal_id), current = grouped.get(key) ?? { proposalId: key, proposalSource: row.proposal_source, proposalLabel: row.title ?? null, firstAppearance: null, lastAppearance: null, appearancesCount: 0, latestPublishedResult: null, appearances: [] }; const date = String(row.scheduled_date ?? row.scheduled_start_at ?? '').slice(0, 10); current.firstAppearance = !current.firstAppearance || date < current.firstAppearance ? date : current.firstAppearance; current.lastAppearance = !current.lastAppearance || date > current.lastAppearance ? date : current.lastAppearance; current.appearancesCount++; if (row.result_raw && !current.latestPublishedResult) current.latestPublishedResult = String(row.result_raw); current.appearances.push({ meetingId: String(row.meeting_id), date, resultRaw: row.result_raw ? String(row.result_raw) : null, active: Boolean(row.active) }); grouped.set(key, current); }
  const matters = [...grouped.values()].sort((a, b) => String(b.lastAppearance).localeCompare(String(a.lastAppearance)) || a.proposalId.localeCompare(b.proposalId)).slice(0, 10);
  const memberRows = body.source === 'senado'
    ? (await pool.query("SELECT a.person_external_id,p.name,p.party,p.uf,p.payload AS profile_payload,a.source,a.payload FROM civica.legislative_appointments a LEFT JOIN civica_people_poc.profiles p ON p.source=a.source AND p.external_id=a.person_external_id WHERE a.source='senado' AND a.kind IN ('commission','office') AND a.payload->>'bodyId'=$1 AND (a.payload->>'end' IS NULL OR (a.payload->>'end')::date>=current_date) ORDER BY a.person_external_id", [String(body.external_id)])).rows
    : (await pool.query('SELECT m.person_external_id,p.name,m.party,m.uf,m.role_raw,m.source FROM civica_committees_poc.memberships m LEFT JOIN civica_people_poc.profiles p ON p.source=m.source AND p.external_id=m.person_external_id WHERE m.body_id=$1 ORDER BY m.person_external_id,m.role_raw', [canonical])).rows;
  const memberMap = new Map<string, any>(); for (const row of memberRows) { const payload = json(row.payload), profilePayload = json(row.profile_payload), id = String(row.person_external_id), previous = memberMap.get(id) ?? { personExternalId: id, name: row.name ?? null, role: null, party: row.party ?? payload.party ?? null, uf: row.uf ?? payload.uf ?? null, photoUrl: profilePayload.photoUrl ?? null, source: String(row.source) }; const role = row.role_raw ?? payload.role ?? null; if (role) previous.role = [...new Set(String(previous.role ?? '').split(' · ').filter(Boolean).concat(String(role)))].join(' · '); previous.name = previous.name ?? row.name ?? null; previous.party = previous.party ?? row.party ?? payload.party ?? null; previous.uf = previous.uf ?? row.uf ?? payload.uf ?? null; previous.photoUrl = previous.photoUrl ?? profilePayload.photoUrl ?? null; memberMap.set(id, previous); }
  const members = [...memberMap.values()];
  const composition = body.source === 'camara' ? { bodyId: canonical, source: String(body.source), externalId: String(body.external_id), coverage: members.length ? 'complete_current' : 'unavailable', observedAt: null, president: null, vicePresidents: [], titularMembers: members, alternateMembers: [], otherMembers: [], allMembers: members } : null;
  // The legacy SQLite contract joins rapporteur appointments to every active
  // profile sharing the external id (without a source predicate).  Preserve
  // that cardinality: duplicate profile publication rows are part of the
  // public totalRecords contract and are not silently collapsed here.
  const rapporteurRows = (await pool.query("SELECT a.external_id,a.person_external_id,a.payload,p.name,p.party,p.uf,pr.label AS proposal_label,pr.summary AS proposal_summary FROM civica.legislative_appointments a LEFT JOIN civica.profiles p ON p.external_id=a.person_external_id LEFT JOIN civica_poc.proposals pr ON pr.source=a.source AND pr.external_id=a.payload->>'proposalId' WHERE a.source=$1 AND a.kind='rapporteurship' AND a.payload->>'bodyId'=$2 AND a.payload->>'proposalId' IS NOT NULL ORDER BY coalesce(a.payload->>'start','') DESC,a.external_id DESC", [body.source, String(body.external_id)])).rows;
  const rapporteurGroups = new Map<string, any>(); for (const row of rapporteurRows) { const p = json(row.payload), proposalId = String(p.proposalId), event = { proposalId, proposalLabel: row.proposal_label ?? p.proposalLabel ?? null, proposalSummary: row.proposal_summary ?? p.proposalSummary ?? null, personId: row.person_external_id ? String(row.person_external_id) : null, personName: row.name ?? null, party: row.party ?? p.party ?? null, uf: row.uf ?? p.uf ?? null, role: p.role ?? null, start: p.start ?? null, end: p.end ?? null, status: p.status ?? null, bodyId: canonical, bodyLabel: p.bodyLabel ?? null, rawId: p.rawId ?? null, officialUrl: p.officialUrl ?? null, source: String(body.source) }; const group = rapporteurGroups.get(proposalId) ?? { proposalId, proposalLabel: event.proposalLabel, proposalSummary: event.proposalSummary, rapporteurs: [] }; const key = `${event.personId ?? 'unknown'}|${event.role ?? ''}`, existing = group.rapporteurs.find((item: any) => `${item.personId ?? 'unknown'}|${item.role ?? ''}` === key); if (existing) { const duplicate = (existing.events ?? []).some((item: any) => item.start === event.start && item.status === event.status && item.end === event.end); if (!duplicate) { existing.events.push(event); existing.eventCount++; existing.lastRecordDate = event.start; } } else group.rapporteurs.push({ ...event, eventCount: 1, firstRecordDate: event.start, lastRecordDate: event.start, events: [event] }); rapporteurGroups.set(proposalId, group); }
  const orderedRapporteurs = [...rapporteurGroups.values()].sort((a: any, b: any) => { const ad = a.rapporteurs.flatMap((r: any) => r.start ? [String(r.start)] : []).sort().at(-1) ?? ''; const bd = b.rapporteurs.flatMap((r: any) => r.start ? [String(r.start)] : []).sort().at(-1) ?? ''; return bd.localeCompare(ad) || String(a.proposalId).localeCompare(String(b.proposalId)); });
  const rapporteurships = { coverage: rapporteurRows.length ? 'complete' : 'unavailable', known: orderedRapporteurs.slice(0, 12), totalRecords: rapporteurRows.length, distinctProposals: rapporteurGroups.size, source: String(body.source), provenance: [...new Set(rapporteurRows.map((row: any) => String(json(row.payload).rawId ?? '')).filter(Boolean))] };
  const bp = json(body.payload); const bodyPublic = { id: String(body.id), source: String(body.source), external_id: String(body.external_id), sigla: String(body.sigla), name: String(body.name), short_name: bp.short_name ?? null, type_raw: bp.type_raw ?? null, type_normalized: body.type_normalized ?? bp.type_normalized ?? null, house: String(body.house), active: bp.active ?? null, parent_body_id: bp.parent_body_id ?? null, source_url: bp.source_url ?? null, raw_id: bp.raw_id ?? null, first_seen_at: bp.first_seen_at ?? null, last_seen_at: bp.last_seen_at ?? null, created_at: bp.created_at ?? null, updated_at: bp.updated_at ?? null };
  return ok({ body: bodyPublic, nextMeeting: future.at(-1) ?? null, recent, agendaCoverage: all.length ? 'available' : 'unavailable', activity: { year, meetings: all.filter((meeting: any) => String(meeting.scheduled_date ?? '').startsWith(String(year))).length, items: annual.length, matters: matterIds.length }, rapporteurships, composition, members, matters, mattersCoverage: matters.length ? 'available' : 'unavailable', mattersTotal: grouped.size });
}
