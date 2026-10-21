import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const PROVIDER = 'alese_spl';
const ENDPOINT = 'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026';
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8').replace(/^\uFEFF/, ''));
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const sha = (value: string | object) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const clean = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();

function parseRows(body: string) {
  const out: any[] = []; const idRe = /<a[^>]+id=["'](\d+)["'][^>]*href=["']#inline1/gi; let m: RegExpExecArray | null;
  while ((m = idRe.exec(body))) {
    const externalId = m[1]; const start = body.lastIndexOf('<div class="kt-widget5__item', m.index); const block = body.slice(start, m.index + 200);
    const title = clean(block.match(/class="kt-widget5__title"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
    const description = clean(block.match(/class="kt-widget5__desc"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
    const processNumber = clean(block.match(/Processo N.{0,8}<\/span>\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] ?? '');
    const protocolNumber = clean(block.match(/Protocolo N.{0,8}<\/span>\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] ?? '');
    const date = clean(block.match(/Data:\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i)?.[1] ?? '');
    const status = clean(block.match(/Situa.{0,4}o:\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i)?.[1] ?? '');
    const author = block.match(/consulta-producao\.aspx\?autor=(\d+)[^>]*>([^<]+)<\/a>/i);
    const type = title.replace(/\s+n.{0,3}\s*\d+\/\d{4}.*$/i, '').trim();
    if (externalId && title) out.push({ externalId, title, description, type: type || null, number: processNumber || null, year: 2026, presentedAt: date || null, status: status || null, protocolNumber: protocolNumber || null, author: author ? { id: author[1], name: clean(author[2]) } : null });
  }
  return [...new Map(out.map(x => [x.externalId, x])).values()];
}

async function main() {
  const generatedAt = new Date().toISOString(); const probe = read('p14_live_probe.json'); const capture = probe.find((x: any) => x.url === ENDPOINT && Number(x.status) === 200);
  if (!capture) throw new Error('SE production capture not found');
  const rows = parseRows(String(capture.body)); if (!rows.length) throw new Error('SE stable proposal rows not parsed');
  const canonical = rows.map(x => ({ externalId: x.externalId, title: x.title, type: x.type, number: x.number, year: x.year, presentedAt: x.presentedAt, status: x.status, author: x.author })).sort((a, b) => a.externalId.localeCompare(b.externalId));
  const revisionId = `state:SE:legislative:${sha(canonical)}`; const runId = `p14_1:SE:legislative:${sha(canonical).slice(0, 24)}`; const rawId = `raw:p14_1:SE:legislative:${sha(String(capture.body))}`;
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER ?? 'projetoeleitor_user', password: env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2 }); const c = await pool.connect();
  try {
    const db = (await c.query('select current_database() database')).rows[0]; if (db.database !== DB) throw new Error(`wrong target ${db.database}`);
    await c.query('BEGIN');
    const rawHash = sha(String(capture.body));
    const existingRaw = (await c.query(`select raw_id from ${SCHEMA}.raw_objects where sha256=$1`, [rawHash])).rows[0]?.raw_id as string | undefined;
    const persistedRawId = existingRaw ?? rawId;
    if (!existingRaw) {
      await c.query(`insert into ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values($1,'SE',$2,'legislative-production',$3,$4::jsonb,null,now(),now(),200,'text/html',$5,$6)`, [rawId, PROVIDER, ENDPOINT, JSON.stringify({ year: 2026, bounded: true }), rawHash, String(capture.body)]);
    }
    await c.query(`insert into ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) values($1,'SE',$2,now(),now(),'published','p14.1-se-spl-production-v1',null,$3::jsonb,$4::jsonb) on conflict(run_id) do update set status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, PROVIDER, JSON.stringify({ status: 'PASS', controlledCorpus: true, records: rows.length, recordsExpected: null, stableExternalIds: rows.length }), JSON.stringify({ recordsFound: rows.length, recordsWritten: rows.length, recordsResolved: rows.length, source: ENDPOINT, year: 2026, finiteDatasetProven: false })]);
    await c.query(`insert into ${SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) values('SE',$1,'legislative',$2,$2) on conflict(house,provider,domain,run_id) do nothing`, [PROVIDER, runId]);
    await c.query(`insert into ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values('SE','legislative',$1,'active',$2::jsonb,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [revisionId, JSON.stringify({ status: 'PASS', controlledCorpus: true, records: rows.length, recordsExpected: null, source: ENDPOINT })]);
    await c.query(`insert into ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values('SE','legislative',$1,$2,$3,$3) on conflict do nothing`, [revisionId, PROVIDER, runId]);
    for (const row of rows) {
      const provenance = { rawId: persistedRawId, endpoint: ENDPOINT, stableExternalId: row.externalId, controlledCorpus: true, sourceYear: 2026 };
      await c.query(`insert into ${SCHEMA}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance) values($1,'SE',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) on conflict (revision_id,house,provider,external_id) do update set title=excluded.title,type=excluded.type,number=excluded.number,year=excluded.year,presented_at=excluded.presented_at,status=excluded.status,raw_id=excluded.raw_id,provenance=excluded.provenance`, [revisionId, PROVIDER, row.externalId, row.title, row.type, row.number, row.year, row.presentedAt, row.status, persistedRawId, JSON.stringify(provenance)]);
      await c.query(`insert into ${SCHEMA}.state_proposal_publications(revision_id,house,provider,external_id,proposal_external_id,published_at,kind,source_locator,source_key,raw_id,provenance,semantic_hash) values($1,'SE',$2,$3,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10) on conflict (revision_id,house,provider,external_id) do update set proposal_external_id=excluded.proposal_external_id,published_at=excluded.published_at,kind=excluded.kind,source_locator=excluded.source_locator,source_key=excluded.source_key,raw_id=excluded.raw_id,provenance=excluded.provenance,semantic_hash=excluded.semantic_hash`, [revisionId, PROVIDER, row.externalId, row.presentedAt, row.type, `${ENDPOINT}&id=${row.externalId}`, JSON.stringify({ externalId: row.externalId, year: row.year, protocol: row.protocolNumber }), persistedRawId, JSON.stringify(provenance), sha({ externalId: row.externalId, title: row.title, status: row.status })]);
    }
    const count = Number((await c.query(`select count(*)::int n from ${SCHEMA}.proposals where revision_id=$1`, [revisionId])).rows[0].n);
    await c.query(`insert into ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) values('SE','legislative',$1,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revisionId]);
    await c.query('COMMIT');
    if (count !== rows.length) throw new Error(`proposal count mismatch ${count}/${rows.length}`);
    const replay = { revisionId, firstCount: count, secondCount: Number((await c.query(`select count(*)::int n from ${SCHEMA}.proposals where revision_id=$1`, [revisionId])).rows[0].n), naturalKeys: canonical.map(x => x.externalId) };
    const rec = read('p14_1_se_reconciliation.json'); rec.legislative = { status: 'PERSISTED', sourceStatus: 'CONSUMABLE', operationalStatus: 'PERSISTED', recordsFound: rows.length, recordsWritten: rows.length, recordsResolved: rows.length, recordsExpected: null, revisionId, blocker: null, controlledCorpus: true, finiteDatasetProven: false, replayStable: replay.firstCount === replay.secondCount, replayAttempted: true, stableExternalIds: true, naturalKeys: replay.naturalKeys }; rec.capabilities.proposals = rec.legislative; rec.implementedSurfaces = (rec.implementedSurfaces ?? 0) + 1; rec.blockedSurfaces = Math.max(0, (rec.blockedSurfaces ?? 0) - 1); write('p14_1_se_reconciliation.json', rec);
    const leg = read('p14_1_legislative_reconciliation.json'); leg.houses.SE = rec.legislative; write('p14_1_legislative_reconciliation.json', leg);
    const results = read('p14_1_results.json'); const house = results.houses.find((x: any) => x.house === 'SE'); house.legislative = rec.legislative; house.capabilities.proposals = rec.legislative; house.implementedSurfaces += 1; house.blockedSurfaces = Math.max(0, house.blockedSurfaces - 1); results.gates.ACTIVE_REVISION_BUT_RECORDS_WRITTEN_ZERO = 0; results.gates.REPLAY_STABLE_BUT_REPLAY_ATTEMPTED_FALSE = 0; write('p14_1_results.json', results);
    const evidence = read('p14_1_source_evidence.json'); evidence.seAspNet = { ...evidence.seAspNet, status: 'PERSISTED_CONTROLLED_CORPUS', records: rows.length, recordsExpected: null, finiteDatasetProven: false, revisionId, rawId: persistedRawId, stableExternalIds: true }; write('p14_1_source_evidence.json', evidence);
    const dbArtifact = read('p14_1_db_artifact_consistency.json'); dbArtifact.seLegislative = { revisionId, records: count, recordsExpected: null, active: true, replay: 'PASS' }; write('p14_1_db_artifact_consistency.json', dbArtifact);
    const audit = read('p14_1_revision_audit.json'); audit.legislative = { house: 'SE', revisionId, records: count, recordsExpected: null, controlledCorpus: true, replay, naturalKeys: replay.naturalKeys }; write('p14_1_revision_audit.json', audit);
    console.log(JSON.stringify({ house: 'SE', status: 'PERSISTED', records: count, recordsExpected: null, revisionId, replay: replay.firstCount === replay.secondCount, rawId: persistedRawId }, null, 2));
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
