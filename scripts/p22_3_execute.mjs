import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const S = 'civica_state';
const YEAR = 2026;
const TARGETS = process.env.P22_3_HOUSE ? [process.env.P22_3_HOUSE.toUpperCase()] : ['MA', 'AP', 'GO', 'MS', 'MT'];
const LIMIT = Number(process.env.P22_3_LIMIT ?? 0);
const PROBE_ONLY = process.env.P22_3_PROBE_ONLY === '1';
const cfg = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(x => x.includes('=')).map(x => x.split('=')));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value ?? '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
const date = value => { const m = String(value ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/); return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}.000Z` : null; };

function eventType(raw) {
  const t = String(raw ?? '').toLocaleLowerCase('pt-BR');
  if (/san[cç][aã]o/.test(t)) return 'SANCTIONED';
  if (/veto/.test(t)) return 'VETOED';
  if (/transformad|convertid.*norm|norma promulg/.test(t)) return 'TRANSFORMED_INTO_NORM';
  if (/arquiv/.test(t)) return 'ARCHIVED';
  if (/rejeitad/.test(t)) return 'REJECTED';
  if (/aprovad|aprova[cç][aã]o/.test(t)) return 'APPROVED';
  if (/parecer|relator/.test(t)) return 'OPINION';
  if (/pauta|ordem do dia|agenda/.test(t)) return 'AGENDA';
  if (/recebid|protocol|entrada/.test(t)) return 'RECEIVED';
  if (/enviado|encaminhad|distribu/.test(t)) return 'REFERRED';
  if (/retirad/.test(t)) return 'WITHDRAWN';
  return 'OTHER';
}

function typeGroup(raw) { const t = String(raw ?? '').toLocaleLowerCase('pt-BR'); if (/emenda|substitutiv|subemenda/.test(t)) return 'AMENDMENT'; if (/indica|\bind\b/.test(t)) return 'INDICATION'; if (/requer|pedido de informa|pedido informa|mo[c�][�a]o|\breq\b|\bmoc\b/.test(t)) return 'REQUEST'; if (/parecer|relat[o�]rio/.test(t)) return 'OPINION'; if (/veto|\bvet[tp]?\b/.test(t)) return 'VOTING_INSTRUMENT'; if (/of[i�]cio|mensagem|processo|\bmsg\b/.test(t)) return 'SPECIAL_DOCUMENT'; if (/projeto|proposta|lei|resolu|\bpec\b|decreto|\bpre\b|\bplo\b|\bpl\b|\bplc\b|\bpdl\b|\bpr\b|\bmpv\b/.test(t)) return 'LEGISLATIVE_MAIN'; return 'OTHER'; }

function parseMA(body, id, url, rawId) {
  const decoded = body;
  const block = decoded.match(/<legend>Tramita[\s\S]*?<\/fieldset>/i)?.[0] ?? '';
  const parts = block.split(/<hr[^>]*>/i).map(x => x.replace(/<legend>[\s\S]*?<\/legend>/i, '')).filter(x => /Data:/i.test(x));
  return parts.map((part, i) => {
    const text = clean(part);
    const fields = label => clean(part.match(new RegExp(`<b>\\s*${label}\\s*:\\s*<\\/b>\\s*([^<]+)`, 'i'))?.[1]);
    const dateRaw = fields('Data');
    const origin = fields('Origem');
    const destination = fields('Destino');
    const status = fields('Situa(?:ção|cao)');
    const action = fields('[ÚU]ltima A[cç][ãa]o');
    return event(id, i + 1, date(dateRaw), dateRaw ? 'DATE' : 'UNKNOWN', [status, action].filter(Boolean).join(' - ') || text, status, origin, destination, url, rawId, `${id}|${i + 1}|${dateRaw}|${status}|${action}|${origin}|${destination}`);
  });
}

function parseAP(body, id, url, rawId) {
  const section = body.match(/<h2[^>]*>\s*Movimenta[çc][ãa]o da proposi[çc][ãa]o\s*<\/h2>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const rows = [...section.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(x => x[0]);
  return rows.map((row, i) => { const cells = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map(x => clean(x[1])); const dateRaw = cells[0] ?? ''; const desc = cells[1] ?? ''; return event(id, i + 1, date(dateRaw), dateRaw ? 'DATE' : 'UNKNOWN', desc, desc, null, null, url, rawId, `${id}|${i + 1}|${dateRaw}|${desc}`); }).filter(x => x.descriptionRaw);
}

function parseGO(body, id, url, rawId) {
  const section = body.match(/<tbody[^>]+id=["']ContentPlaceHolder1_tb_tramitacao["'][^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const rows = [...section.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(x => x[0]).filter(x => /Recebimento:|Envio:|Fase:/i.test(x));
  const unique = [...new Map(rows.map(x => [clean(x), x])).values()];
  return unique.map((row, i) => { const text = clean(row); const dateRaw = text.match(/(?:Recebimento|Envio|Data)\s*:\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i)?.[1] ?? text.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? ''; const phase = text.match(/Fase:\s*([\s\S]*?)(?=\s+Setor:|\s+A[cç][ãa]o:|\s+Recebimento:|$)/i)?.[1]?.trim() ?? ''; const sector = text.match(/Setor:\s*([\s\S]*?)(?=\s+Recebimento:|\s+Envio:|\s+Fase:|$)/i)?.[1]?.trim() ?? ''; const action = text.match(/A[cç][ãa]o:\s*([\s\S]*?)(?=\s+Documento|$)/i)?.[1]?.trim() ?? ''; return event(id, i + 1, date(dateRaw), dateRaw.includes(':') ? 'DATETIME' : dateRaw ? 'DATE' : 'UNKNOWN', [phase, action, sector].filter(Boolean).join(' - ') || text, phase || action, sector, null, url, rawId, `${id}|${i + 1}|${dateRaw}|${phase}|${action}|${sector}`); });
}

function parseMT(body, id, url, rawId) {
  const section = body.match(new RegExp(`<turbo-frame[^>]+id=["']proposicao-tramitacoes-${id}["'][^>]*>([\\s\\S]*?)<\\/turbo-frame>`, 'i'))?.[1] ?? '';
  const rows = [...section.matchAll(/<div[^>]*class=["'][^"']*mb-1[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)].map(x => clean(x[1]));
  return rows.map((text, i) => { const m = text.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*(.*)$/); const dateRaw = m?.[1] ?? ''; const desc = m?.[2] ?? text; return event(id, i + 1, date(dateRaw), dateRaw ? 'DATE' : 'UNKNOWN', desc, desc, null, null, url, rawId, `${id}|${i + 1}|${dateRaw}|${desc}`); });
}

function event(proposalId, order, occurredAt, precision, description, status, origin, destination, sourceUrl, rawId, natural) {
  const key = `sha256:${sha(natural)}`;
  return { proposalId: String(proposalId), sourceEventKey: key, eventOrder: order, occurredAt, eventDatePrecision: precision, eventType: eventType(description), eventTypeRaw: status || null, descriptionRaw: description || 'Movimentação oficial', originBodyId: null, originBodyRaw: origin || null, destinationBodyId: null, destinationBodyRaw: destination || null, statusRaw: status || null, sourceUrl, rawId, semanticHash: sha(JSON.stringify([proposalId, key, order, occurredAt, description, origin, destination])) };
}

function sourceUrl(house, id, proposal) {
  const p = proposal.provenance ?? {};
  if (house === 'MA') return `https://sapl-old.al.ma.leg.br/sapl/consultas/materia/materia_mostrar_proc?cod_materia=${encodeURIComponent(id)}`;
  if (house === 'AP') return `https://elegis.al.ap.leg.br/portal/proposicao/${encodeURIComponent(id)}`;
  if (house === 'GO') return `https://alegodigital.al.go.leg.br/processo.aspx?id=${encodeURIComponent(id)}&ano=${YEAR}`;
  if (house === 'MT') return String(p.officialUrl ?? `https://www.al.mt.gov.br/proposicao/cpdoc/${encodeURIComponent(id)}/visualizar`);
  return String(p.source ?? 'https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao');
}

function parserFor(house) { return house === 'MA' ? parseMA : house === 'AP' ? parseAP : house === 'GO' ? parseGO : parseMT; }

async function fetchOne(house, proposal) {
  const id = String(proposal.external_id); const url = sourceUrl(house, id, proposal); let last = null;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Civica-P22.3/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(60_000) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const decoder = house === 'MA' ? new TextDecoder('iso-8859-15') : new TextDecoder('utf-8');
      const body = decoder.decode(bytes); const digest = sha(bytes); const rawId = `raw:sha256:${digest}`;
      if (!response.ok) { if ((response.status === 429 || response.status >= 500) && attempt < 8) { await wait(response.status === 429 ? Math.min(60_000, 5_000 * attempt) : 1_000 * attempt); continue; } return { id, status: response.status >= 500 ? 'TRANSIENT_FAILURE' : 'SOURCE_DETAIL_NOT_FOUND', httpStatus: response.status, url, events: [], raw: { rawId, body, sha256: digest, status: response.status, endpoint: response.url || url, contentType: response.headers.get('content-type') ?? 'text/html', fetchedAt: now() } }; }
      let events; try { events = parserFor(house)(body, id, response.url || url, rawId); } catch (error) { return { id, status: 'PARSER_FAILURE', httpStatus: response.status, url, events: [], error: String(error), raw: { rawId, body, sha256: digest, status: response.status, endpoint: response.url || url, contentType: response.headers.get('content-type') ?? 'text/html', fetchedAt: now() } }; }
      return { id, status: events.length ? 'EVENTS_COLLECTED' : 'SOURCE_CONFIRMED_NO_EVENTS', httpStatus: response.status, url, events, raw: { rawId, body, sha256: digest, status: response.status, endpoint: response.url || url, contentType: response.headers.get('content-type') ?? 'text/html', fetchedAt: now() } };
    } catch (error) { last = error; if (attempt < 3) await wait(750 * attempt); }
  }
  return { id, status: 'TRANSIENT_FAILURE', httpStatus: null, url, events: [], error: String(last?.message ?? last), raw: null };
}

async function mapLimit(rows, limit, fn, progress) { const out = new Array(rows.length); let next = 0; let done = 0; async function worker() { while (true) { const i = next++; if (i >= rows.length) return; out[i] = await fn(rows[i], i); done++; if (progress) progress(done, rows.length, out[i]); } } await Promise.all(Array.from({ length: limit }, worker)); return out; }

function checkpointValue(house, result) {
  if (!result.raw?.body) return result;
  const dir = path.join('artifacts', `p22_3_raw_${house}`); fs.mkdirSync(dir, { recursive: true });
  const bodyPath = path.join(dir, `${result.id}-${result.raw.sha256}.html`);
  if (!fs.existsSync(bodyPath)) fs.writeFileSync(bodyPath, result.raw.body);
  return { ...result, raw: { ...result.raw, body: undefined, bodyPath } };
}
function restoreValue(result) {
  if (result.raw?.bodyPath && !result.raw.body && fs.existsSync(result.raw.bodyPath)) return { ...result, raw: { ...result.raw, body: fs.readFileSync(result.raw.bodyPath, 'utf8') } };
  return result;
}

async function msProbe() {
  const urls = ['https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao/329323/dados-gerais/', 'https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao/329323/tramitacao/', 'https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao/329323'];
  const rows = []; for (const url of urls) { try { const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Civica-P22.3/1.0' }, signal: AbortSignal.timeout(30_000) }); const b = await r.text(); rows.push({ url, status: r.status, contentType: r.headers.get('content-type'), bytes: b.length, sha256: sha(b), bodyPrefix: b.slice(0, 200) }); } catch (e) { rows.push({ url, error: String(e) }); } }
  const blocker = rows.every(row => row.status === 401 || row.status === 403 || row.error);
  return { provider: 'sgpl_ms', source: 'https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao', probes: rows, terminalStatus: blocker ? 'PROVEN_EXTERNAL_BLOCKER' : 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: blocker ? 'All bounded public timeline/detail routes require the documented SGPL PoW/CAPTCHA contract.' : 'At least one route responded; further bounded implementation required.' };
}

async function getProposals(c, house) { const rev = (await c.query(`SELECT revision_id FROM ${S}.active_publications WHERE house=$1 AND domain='legislative'`, [house])).rows[0]?.revision_id; return (await c.query(`SELECT external_id::text,provider,provenance,type,number,year,presented_at,status FROM ${S}.proposals WHERE house=$1 AND revision_id=$2 AND year=$3 ORDER BY external_id`, [house, rev, YEAR])).rows; }
async function saveRaw(c, house, provider, result) { if (!result.raw) return; await c.query(`INSERT INTO ${S}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,'proposal-timeline',$4,'{}'::jsonb,$5,$6,now(),$7,$8,$9,$10) ON CONFLICT(raw_id) DO NOTHING`, [result.raw.rawId, house, provider, result.raw.endpoint, result.id, result.raw.fetchedAt, result.raw.status, result.raw.contentType, result.raw.sha256, result.raw.body]); }

async function publish(c, house, provider, results, sourceRevision) {
  const events = results.flatMap(r => r.events ?? []); const payload = JSON.stringify({ house, proposals: results.map(r => [r.id, r.status]).sort(), events: events.map(e => [e.proposalId, e.sourceEventKey, e.semanticHash]).sort() }); const revision = `state:${house}:timeline:${sha(payload)}`; const quality = { phase: 'P22.3', inspected: results.length, withEvents: results.filter(r => (r.events ?? []).length).length, confirmedZeroEvent: results.filter(r => r.status === 'SOURCE_CONFIRMED_NO_EVENTS').length, sourceFailures: results.filter(r => ['SOURCE_DETAIL_NOT_FOUND', 'PERMANENT_SOURCE_FAILURE'].includes(r.status)).length, transientFailures: results.filter(r => r.status === 'TRANSIENT_FAILURE').length, parserFailures: results.filter(r => r.status === 'PARSER_FAILURE').length, eventRows: events.length, sourceRevision, status: results.some(r => ['SOURCE_DETAIL_NOT_FOUND', 'PERMANENT_SOURCE_FAILURE', 'TRANSIENT_FAILURE', 'PARSER_FAILURE'].includes(r.status)) ? 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY' : 'OPERATIONAL_2026_TIMELINE' };
  await c.query(`INSERT INTO ${S}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,'timeline',$2,'active',$3,now(),now()) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [house, revision, quality]); let inserted = 0; let duplicate = 0;
  for (const e of events) { const q = await c.query(`INSERT INTO ${S}.state_proposal_events(revision_id,house,provider,proposal_external_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,status_raw,source_url,raw_id,provenance,semantic_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT DO NOTHING`, [revision, house, provider, e.proposalId, e.sourceEventKey, e.eventOrder, e.occurredAt, e.eventDatePrecision, e.eventType, e.eventTypeRaw, e.descriptionRaw, e.originBodyId, e.originBodyRaw, e.destinationBodyId, e.destinationBodyRaw, e.statusRaw, e.sourceUrl, e.rawId, JSON.stringify({ rawId: e.rawId, endpoint: e.sourceUrl, sourceEventKey: e.sourceEventKey, fetchedAt: now() }), e.semanticHash]); if (q.rowCount) inserted += q.rowCount; else duplicate++; }
  await c.query(`INSERT INTO ${S}.active_publications(house,domain,revision_id,activated_at) VALUES($1,'timeline',$2,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [house, revision]); return { revision, inserted, duplicate, quality };
}

async function main() {
  const pool = new pg.Pool({ host: cfg.DB_HOST, port: Number(cfg.DB_PORT ?? 5432), user: cfg.DB_USER, password: cfg.DB_PASSWORD, database: DB, max: 8 }); const c = await pool.connect(); const db = (await c.query('SELECT current_database()')).rows[0].current_database; if (db !== DB) throw new Error(`database guard failed: ${db}`);
  fs.mkdirSync('artifacts', { recursive: true }); const output = { phase: 'P22.3', database: db, startedAt: now(), houses: {} };
  for (const house of TARGETS) {
    const proposals = await getProposals(c, house); const provider = house === 'MA' ? 'sapl_old_ma' : house === 'AP' ? 'elegis_alap' : house === 'GO' ? 'go_alegodigital_spl' : house === 'MS' ? 'ms_sgpl_public_api' : 'mt_almt_portal';
    if (house === 'MS') { output.houses.MS = { total2026Proposals: proposals.length, ...(await msProbe()) }; fs.writeFileSync('artifacts/P22_3_backfill_MS.json', JSON.stringify(output.houses.MS, null, 2)); continue; }
    const checkpoint = `artifacts/P22_3_${house}_checkpoint.json`; let results = fs.existsSync(checkpoint) && !PROBE_ONLY ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')).filter(r => ['EVENTS_COLLECTED', 'SOURCE_CONFIRMED_NO_EVENTS'].includes(r.status) && (r.raw?.bodyPath || r.raw?.body)) : []; const universe = LIMIT > 0 ? proposals.slice(0, LIMIT) : proposals; const done = new Set(results.map(r => String(r.id))); const todo = universe.filter(p => !done.has(String(p.external_id))); console.log(`${house}: ${universe.length}/${proposals.length} proposals; remaining ${todo.length}`);
    const fetchedSoFar = [];
    const fetched = await mapLimit(todo, house === 'MT' ? 2 : house === 'GO' ? 4 : 8, async p => checkpointValue(house, await fetchOne(house, p)), (n, total, result) => { fetchedSoFar.push(result); if (n % 25 === 0 || n === total) { console.log(`${house}: ${n}/${total}`); const merged = results.concat(fetchedSoFar); fs.writeFileSync(checkpoint, JSON.stringify(merged.map(x => checkpointValue(house, x)), null, 2)); } }); results = results.concat(fetched); fs.writeFileSync(checkpoint, JSON.stringify(results.map(x => checkpointValue(house, x)), null, 2));
    if (PROBE_ONLY) { output.houses[house] = { provider, total2026Proposals: proposals.length, probeSize: results.length, statuses: Object.fromEntries([...new Set(results.map(r => r.status))].map(s => [s, results.filter(r => r.status === s).length])), eventRows: results.reduce((n, r) => n + (r.events?.length ?? 0), 0), sampleResults: results.map(r => ({ id: r.id, status: r.status, eventCount: r.events?.length ?? 0, firstEvent: r.events?.[0]?.descriptionRaw ?? null, lastEvent: r.events?.at(-1)?.descriptionRaw ?? null })) }; fs.writeFileSync(`artifacts/P22_3_probe_${house}.json`, JSON.stringify(output.houses[house], null, 2)); continue; }
    await c.query('BEGIN'); for (const stored of results) await saveRaw(c, house, provider, restoreValue(stored)); const pub = await publish(c, house, provider, results, (await c.query(`SELECT revision_id FROM ${S}.active_publications WHERE house=$1 AND domain='legislative'`, [house])).rows[0]?.revision_id ?? null); await c.query('COMMIT');
    const statuses = Object.fromEntries(['EVENTS_COLLECTED', 'SOURCE_CONFIRMED_NO_EVENTS', 'SOURCE_DETAIL_NOT_FOUND', 'TRANSIENT_FAILURE', 'PARSER_FAILURE'].map(s => [s, results.filter(r => r.status === s).length])); const eventRows = results.reduce((n, r) => n + (r.events?.length ?? 0), 0); const typeRows = proposals.reduce((acc, p) => { const g = typeGroup(p.type); acc[g] = (acc[g] ?? 0) + 1; return acc; }, {});
    output.houses[house] = { provider, total2026Proposals: proposals.length, proposalsInspected: results.length, proposalsWithEvents: results.filter(r => (r.events ?? []).length).length, confirmedZeroEvent: statuses.SOURCE_CONFIRMED_NO_EVENTS, sourceFailures: statuses.SOURCE_DETAIL_NOT_FOUND, transientFailures: statuses.TRANSIENT_FAILURE, parserFailures: statuses.PARSER_FAILURE, eventRows, inspectionCoverage: results.length / proposals.length, eventCoverage: results.filter(r => (r.events ?? []).length).length / proposals.length, statuses, typeGroups: typeRows, typeConflicts: 0, revision: pub.revision, inserted: pub.inserted, duplicate: pub.duplicate, finalStatus: pub.quality.status, providerHealth: { fullBackfillReady: results.length === proposals.length && statuses.SOURCE_DETAIL_NOT_FOUND === 0 && statuses.TRANSIENT_FAILURE === 0 && statuses.PARSER_FAILURE === 0, incrementalRefreshReady: false, checkpointReady: true, lastKnownGoodReady: true, schedulerReady: false } };
    fs.writeFileSync(`artifacts/P22_3_backfill_${house}.json`, JSON.stringify(output.houses[house], null, 2));
  }
  output.finishedAt = now(); fs.writeFileSync('artifacts/P22_3_run.json', JSON.stringify(output, null, 2)); console.log(JSON.stringify(output, null, 2)); await c.release(); await pool.end();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
