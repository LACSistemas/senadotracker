import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Source } from '@senadotracker/domain';
import { OfficialHttp } from './http.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';

type Matter = { id: string; presentedAt: string | null; status: string | null };
type Event = { proposalId: string; date: string | null; label: string; kind: string };
type Json = Record<string, unknown>;

const sourceUrl = 'https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?tramitando=S';
const list = (value: unknown): Json[] => Array.isArray(value) ? value.filter((x): x is Json => Boolean(x) && typeof x === 'object') : value && typeof value === 'object' ? [value as Json] : [];
const day = (value: unknown) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? '')) ? String(value).slice(0, 10) : null;
const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const terminal = /(transformad[ao].*norma|transforma(?:ção|c[aã]o).*norma|convertid[ao].*norma|promulgad[ao]|sancionad[ao]|vetad[ao]|veto (?:total|parcial))/i;

function parseOfficial(data: unknown): Matter[] {
  const root = data as { PesquisaBasicaMateria?: { Materias?: { Materia?: unknown } } };
  return list(root.PesquisaBasicaMateria?.Materias?.Materia).flatMap(x => {
    const id = String(x.Codigo ?? '').trim();
    return id ? [{ id, presentedAt: day(x.Data), status: 'Em tramitação' }] : [];
  });
}

async function officialSenate(store: PostgresCollectorStore, runId: string, cacheFile: string) {
  try {
    const http = new OfficialHttp({ source: 'senado', save: raw => store.saveRaw(runId, raw), maxAttempts: 1, timeoutMs: 15_000 });
    const response = await http.json(sourceUrl);
    return { matters: parseOfficial(response.data), source: 'official-http', rawId: response.rawId, fetchedAt: response.fetchedAt, url: response.url };
  } catch (error) {
    const bytes = new Uint8Array(await readFile(cacheFile));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const rawId = await store.saveRaw(runId, { url: sourceUrl, fetchedAt: new Date().toISOString(), status: 200, contentType: 'application/json', bytes });
    return { matters: parseOfficial(data), source: 'official-cache', rawId, fetchedAt: new Date().toISOString(), url: sourceUrl, fallbackReason: error instanceof Error ? error.message : String(error) };
  }
}

function processingSummary(matters: Matter[], events: Event[], year: number) {
  const starts = new Map(matters.flatMap(m => { const value = day(m.presentedAt); return value ? [[m.id, Date.parse(`${value}T00:00:00Z`)] as const] : []; }));
  const ends = new Map<string, number>();
  for (const event of events) {
    const value = day(event.date); if (!value || value.slice(0, 4) !== String(year) || !terminal.test(event.label) && event.kind !== 'resulting_norm') continue;
    const timestamp = Date.parse(`${value}T00:00:00Z`); const previous = ends.get(event.proposalId); if (previous === undefined || timestamp < previous) ends.set(event.proposalId, timestamp);
  }
  const values = [...ends].flatMap(([id, end]) => { const start = starts.get(id); return start !== undefined && end >= start ? [(end - start) / 86_400_000] : []; }).sort((a, b) => a - b);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const median = values.length ? values.length % 2 ? values[Math.floor(values.length / 2)]! : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2 : null;
  return { meanDays: mean, medianDays: median, sampleSize: values.length, eligible: new Set(ends.keys()).size, coverage: new Set(ends.keys()).size ? values.length / new Set(ends.keys()).size : 0, terminalDefinition: 'Primeiro evento datado de sanção, promulgação, transformação/conversão em norma ou veto após a apresentação.' };
}

/** Builds the institutional operations publication from PostgreSQL relations and
 * the official Senate active-matter endpoint. It refuses activation when the
 * PostgreSQL event universe cannot be proven complete, rather than publishing
 * an approximate aggregate. */
export async function rebuildHouseOperationsPostgres(source: Source, year: number, options: { cacheFile?: string; publish?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const runId = await store.startRun(source, `pg-house-operations:${source}:${year}`);
  try {
    const official = source === 'senado' ? await officialSenate(store, runId, options.cacheFile ?? resolve('data', 'cache', 'senate-active-matters.json')) : null;
    const officialMatters = official?.matters ?? [];
    const officialIds = new Set(officialMatters.map(m => m.id));
    const proposals = (await store.query<any>(`SELECT external_id::text id,presented_at::text presented_at,status,label FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id WHERE p.source=$1`, [source])).rows as Array<{id:string;presented_at:string|null;status:string|null;label:string|null}>;
    const matters: Matter[] = source === 'senado' ? officialMatters : proposals.map(p => ({ id: p.id, presentedAt: day(p.presented_at), status: p.status }));
    const atomRows = (await store.query<any>(`SELECT proposal_id::text id,occurred_at::text date,kind,payload->>'label' label FROM civica_poc.proposal_detail_atoms WHERE source=$1 AND proposal_id IS NOT NULL AND kind IN ('movement','situation','resulting_norm')`, [source])).rows;
    const events: Event[] = atomRows.map((r: any) => ({ proposalId: String(r.id), date: r.date ? String(r.date) : null, kind: String(r.kind), label: String(r.label ?? '') }));
    const bridgeRows = source === 'senado'
      ? (await store.query<any>(`SELECT official_matter_id,pg_proposal_id,match_status,match_level FROM civica_poc.proposal_identity_bridge WHERE source=$1 AND pg_proposal_id IS NOT NULL`, [source])).rows
      : [];
    const bridgeByPg = new Map<string, any>(bridgeRows.map((row: any) => [String(row.pg_proposal_id), row]));
    const canonicalEvents = events.map(event => ({ ...event, proposalId: bridgeByPg.get(event.proposalId)?.official_matter_id ? String(bridgeByPg.get(event.proposalId).official_matter_id) : event.proposalId }));
    const received = source === 'senado' ? proposals.filter(p => p.presented_at?.slice(0, 4) === String(year)).length : matters.filter(m => m.presentedAt?.slice(0, 4) === String(year)).length;
    const terminalIds = new Set(events.filter(e => e.kind === 'resulting_norm' || terminal.test(e.label)).map(e => e.proposalId));
    const terminalReconciliation = [...terminalIds].map(terminalProposalId => {
      const bridge = bridgeByPg.get(terminalProposalId);
      const officialMatterId = bridge?.official_matter_id ? String(bridge.official_matter_id) : null;
      return { terminalProposalId, officialMatterId, bridgeStatus: bridge?.match_status ?? 'NO_BRIDGE_ROW', bridgeLevel: bridge?.match_level ?? null, inOfficialUniverse: Boolean(officialMatterId && officialIds.has(officialMatterId)) };
    });
    const intersection = terminalReconciliation.filter(row => row.inOfficialUniverse).map(row => row.officialMatterId as string);
    const processing = processingSummary(matters.filter(m => officialIds.size ? officialIds.has(m.id) : true), canonicalEvents.filter(e => officialIds.size ? officialIds.has(e.proposalId) : true), year);
    const agenda = (await store.query<any>(`SELECT count(*)::int events,count(DISTINCT i.proposal_id)::int matters,max(m.scheduled_date)::text max_date FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source=$1 AND i.active=true AND i.proposal_id IS NOT NULL AND m.scheduled_date >= $2 AND m.scheduled_date < $3`, [source, `${year}-01-01`, `${year + 1}-01-01`])).rows[0] ?? {};
    const norm = new Set(events.filter(e => e.kind === 'resulting_norm' && e.date?.slice(0, 4) === String(year)).map(e => e.proposalId)).size;
    const summary = { source, year, observedAt: official?.fetchedAt ?? new Date().toISOString(), backlog: officialIds.size || matters.length, backlogUniverse: source === 'senado' ? 'Matérias distintas retornadas pela pesquisa institucional oficial tramitando=S.' : 'Proposições distintas do catálogo ativo publicado.', processing, received, deliberated: 0, deliberatedReceived: 0, voteEvents: 0, decision: 0, norm, agenda: Number(agenda.matters ?? 0), agendaCoverage: { year, from: `${year}-01-01`, to: String(agenda.max_date ?? '').slice(0, 10) || null, items: Number(agenda.events ?? 0), matters: Number(agenda.matters ?? 0), published: false, source: source === 'senado' ? 'https://legis.senado.leg.br/dadosabertos/agendareuniao/mes/{AAAAMM}.json' : 'GET /eventos/{id}/pauta' } };
    // Câmara still lacks its canonical official agenda/operations publication
    // in the PostgreSQL schema.  The relational counts are useful diagnostics,
    // but are not sufficient evidence to activate a public read model.
    const complete = source === 'senado' ? officialIds.size > 0 && intersection.length > 0 && processing.sampleSize > 0 : false;
    const reconciliation = { source, year, officialMatterCount: officialIds.size, pgProposalCount: proposals.length, pgTerminalCount: terminalIds.size, terminalIntersection: intersection.length, terminalBridgeMatched: terminalReconciliation.filter(row => row.inOfficialUniverse).length, terminalBridgeUnmatched: terminalReconciliation.filter(row => !row.inOfficialUniverse).length, terminalReconciliation, bridgeRows: bridgeRows.length, missingCanonicalEventUniverse: source === 'senado' && intersection.length === 0, agenda, norm, summary, complete };
    if (options.publish && complete) {
      await store.transaction(async client => {
        await client.query(`INSERT INTO civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json) VALUES($1,$2,$3,$4,1,$5) ON CONFLICT(id) DO UPDATE SET record_count=excluded.record_count,reconciliation_json=excluded.reconciliation_json`, [runId, source, `house-operations-${year}`, new Date().toISOString(), JSON.stringify(reconciliation)]);
        await client.query(`INSERT INTO civica.legislative_complements(batch_id,source,external_key,kind,person_external_id,proposal_id,deliberation_id,body_id,occurred_at,raw_id,payload) VALUES($1,$2,$3,'reconciliation',NULL,NULL,NULL,NULL,$4,$5,$6::jsonb) ON CONFLICT(batch_id,external_key) DO UPDATE SET payload=excluded.payload`, [runId, source, `house-operations:${year}`, String(summary.observedAt).slice(0, 10), official?.rawId ?? 'pg:derived', JSON.stringify({ source, externalKey: `house-operations:${year}`, kind: 'reconciliation', value: JSON.stringify(summary), label: 'Indicadores institucionais da Casa', occurredAt: String(summary.observedAt).slice(0, 10), rawId: official?.rawId ?? 'pg:derived' })]);
        await client.query(`INSERT INTO civica.active_complement_publications(source,scope,batch_id) VALUES($1,$2,$3) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id`, [source, `house-operations-${year}`, runId]);
      });
    }
    await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status=$2,expected_count=$3,reconciliation_json=$4 WHERE id=$5`, [new Date().toISOString(), complete && options.publish ? 'published' : 'blocked', officialIds.size || matters.length, JSON.stringify(reconciliation), runId]);
    await store.pool.end();
    return { runId, ...reconciliation, publication: complete && options.publish ? 'active' : 'blocked-incomplete-source' };
  } catch (error) {
    await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='failed',error=$2 WHERE id=$3`, [new Date().toISOString(), error instanceof Error ? error.message : String(error), runId]).catch(() => {});
    await store.pool.end(); throw error;
  }
}
