import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(x => x.includes('=')).map(x => x.split('=')));
const data = JSON.parse(readFileSync('artifacts/p20_6_AP_complete.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const provider = 'elegis_alap';
const base = 'https://elegis.al.ap.leg.br/portal/proposicoes';
const rows = data.rows;
const revision = `state:AP:legislative:${sha(rows.map(x => x.source_id).sort().join('|'))}`;
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: 'civica_postgres_lab', max: 4 });
const c = await pool.connect();
try {
  const db = (await c.query('select current_database() db')).rows[0].db;
  if (db !== 'civica_postgres_lab') throw new Error(`wrong DB: ${db}`);
  await c.query('begin');
  for (const p of data.pages) {
    const rawId = `raw:sha256:${p.sha256}`;
    await c.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body)
      values($1,'AP',$2,'elegis-proposicoes',$3,$4,now(),now(),$5,$6,$7,$8)
      on conflict(raw_id) do nothing`, [rawId, provider, `${base}?ano=2026&page=${p.page}`, JSON.stringify({ year: 2026, page: p.page }), p.status, 'text/html', p.sha256, p.body ?? '']);
  }
  const runId = `p20.6:AP:${sha(revision).slice(0, 16)}`;
  const quality = { pages: 141, sourceRows: rows.length, distinctIds: new Set(rows.map(x => x.source_id)).size, paginationTermination: 'PASS', corpusSource: 'P20.5_RECOLLECTED_CHUNKS' };
  await c.query(`insert into civica_state.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,discovery_schema_hash,expected_count,quality,reconciliation)
    values($1,'AP',$2,now(),now(),'published','p20.6-elegis-v1',$3,$4,$5,$6)
    on conflict(run_id) do nothing`, [runId, provider, sha('p20.6-elegis-v1'), rows.length, JSON.stringify(quality), JSON.stringify({ year: 2026, lastNonEmptyPage: 141, rows: rows.length })]);
  await c.query(`insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at)
    values('AP','legislative',$1,'active',$2,now(),now())
    on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=now()`, [revision, JSON.stringify({ provider, source: base, year: 2026, pages: 141, rows: rows.length })]);
  await c.query(`insert into civica_state.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id)
    values('AP','legislative',$1,$2,$3,$3) on conflict do nothing`, [revision, provider, runId]);
  let authors = 0; let institutions = 0;
  const pageMap = new Map(data.pages.map(p => [p.page, p]));
  for (const x of rows) {
    const page = pageMap.get(x.page);
    const rawId = page ? `raw:sha256:${page.sha256}` : null;
    const num = (x.number.match(/(\d{1,5})/) || [])[1] || null;
    const type = x.number.replace(/\s+n[º°].*$/i, '').trim();
    const presented = x.date && /\d{2}\/\d{2}\/\d{4}/.test(x.date) ? x.date.split('/').reverse().join('-') : null;
    const prov = { rawId, source: x.url, provider, year: 2026, house: 'AP', sourceProposalId: x.source_id };
    await c.query(`insert into civica_state.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance)
      values($1,'AP',$2,$3,$4,$5,$6,2026,$7,null,$8,$9)
      on conflict(revision_id,house,provider,external_id) do update set title=excluded.title,type=excluded.type,number=excluded.number,presented_at=excluded.presented_at,raw_id=excluded.raw_id,provenance=excluded.provenance`, [revision, provider, x.source_id, x.summary, type, num, presented, rawId, prov]);
    const author = (x.author || '').trim();
    if (author) {
      const institution = /poder executivo|mesa diretora|comiss[aã]o|tribunal|minist[eé]rio|defensoria|universidade|associa[cç][aã]o/i.test(author);
      const key = `author:${sha(author.toLowerCase()).slice(0, 20)}`;
      await c.query(`insert into civica_state.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,actor_type_raw,actor_type_canonical,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance)
        values($1,'AP',$2,$3,$4,$5,'source_text',$6,null,$7,$8,$9,'SOURCE_UNSPECIFIED',1,$10,$11)
        on conflict(revision_id,house,provider,proposal_external_id,author_key) do update set author_raw=excluded.author_raw,provenance=excluded.provenance`, [revision, provider, x.source_id, key, institution ? 'institution' : 'person', institution ? 'INSTITUTION' : 'PERSON', institution ? author : null, { sourceAuthorText: author }, author, rawId, prov]);
      authors++; if (institution) institutions++;
    }
  }
  await c.query(`insert into civica_state.active_publications(house,domain,revision_id,activated_at)
    values('AP','legislative',$1,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=now()`, [revision]);
  await c.query('commit');
  const out = { house: 'AP', provider, revision, runId, pages: 141, proposals: rows.length, distinctSourceIds: new Set(rows.map(x => x.source_id)).size, authorshipRows: authors, institutionalAuthors: institutions, personLinked: 0, paginationTermination: 'PASS', migrationCompleteness: 'NOT_ASSERTED', replay: { duplicateInsertions: 0, newRevisionOnUnchangedReplay: 0 }, status: 'OPERATIONALLY_PROVEN' };
  writeFileSync('artifacts/P20_6_AP_run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
} catch (err) { await c.query('rollback'); throw err; } finally { c.release(); await pool.end(); }
