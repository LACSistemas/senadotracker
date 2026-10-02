import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { openDatabase } from '@senadotracker/db';
import { parseSenateProcess } from '../apps/collector/src/senate-processes.ts';
import { parseCamaraThemes } from '../apps/collector/src/themes.ts';

for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
if (process.env.DB_NAME !== 'projetoeleitor_db') throw new Error(`wrong target ${process.env.DB_NAME}`);
const sqlite=openDatabase('data/senadotracker.sqlite',true);
const rows=[];
for(const source of ['camara','senado']){
  const ids=sqlite.prepare(`SELECT DISTINCT p.external_id FROM profiles p JOIN active_publications a ON a.source=? AND a.batch_id=p.batch_id WHERE json_extract(p.payload,'$.uf') IS NOT NULL`).all(source).map(x=>String(x.external_id));
  if(!ids.length) continue; const marks=ids.map(()=>'?').join(',');
  rows.push(...sqlite.prepare(`SELECT DISTINCT c.source,c.proposal_id,c.deliberation_id,c.external_key,c.batch_id,c.raw_id,c.payload
    FROM proposal_authors x JOIN active_activity_publications aa ON aa.batch_id=x.batch_id AND aa.source=?
    JOIN legislative_complements c ON c.source=aa.source AND c.proposal_id=x.proposal_id
    JOIN active_complement_publications ac ON ac.source=c.source AND ac.batch_id=c.batch_id
    WHERE x.person_external_id IN (${marks}) AND c.kind='theme'`).all(source,...ids));
  rows.push(...sqlite.prepare(`SELECT DISTINCT c.source,c.proposal_id,c.deliberation_id,c.external_key,c.batch_id,c.raw_id,c.payload
    FROM legislative_votes v JOIN active_legislative_publications al ON al.batch_id=v.batch_id AND al.source=?
    JOIN legislative_complements c ON c.source=al.source AND c.deliberation_id=v.deliberation_id
    JOIN active_complement_publications ac ON ac.source=c.source AND ac.batch_id=c.batch_id
    WHERE v.external_id IN (${marks}) AND c.kind='theme'`).all(source,...ids));
}
const target=new Map(); for(const row of rows){const key=`${row.source}|${row.external_key}`;if(!target.has(key))target.set(key,row);}
const rawMeta=new Map(); for(const row of target.values()){const meta=sqlite.prepare('SELECT id,url,fetched_at,status,content_type,sha256,path,bytes FROM raw_objects WHERE id=?').get(row.raw_id);if(!meta?.path)throw new Error(`missing raw evidence ${row.raw_id}`);rawMeta.set(meta.id,meta);}
const byRaw=new Map(); for(const row of target.values()){if(!byRaw.has(row.raw_id))byRaw.set(row.raw_id,[]);byRaw.get(row.raw_id).push(row);}
const parsed=[];
for(const [rawId,sourceRows] of byRaw){const meta=rawMeta.get(rawId);const bytes=fs.readFileSync(meta.path);const url=String(meta.url);let records=[];
  if(sourceRows[0].source==='senado' && url.includes('/processo/')){const document=JSON.parse(bytes.toString('utf8'));records=parseSenateProcess(document,rawId,String(sourceRows[0].proposal_id)).filter(r=>r.kind==='theme');}
  else if(sourceRows[0].source==='camara' && url.includes('proposicoesTemas')){const allowed=new Set(sourceRows.map(r=>String(r.proposal_id)));records=parseCamaraThemes(bytes,rawId,2026,allowed);}
  else if(sourceRows[0].source==='camara' && /\/proposicoes\/\d+\/temas/.test(url)){const document=JSON.parse(bytes.toString('utf8'));const proposalId=String(sourceRows[0].proposal_id);const normalized={dados:Array.isArray(document.dados)?document.dados.map(x=>({...x,idProposicao:x.idProposicao??proposalId,uriProposicao:x.uriProposicao??`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${proposalId}`})):[]};records=parseCamaraThemes(new TextEncoder().encode(JSON.stringify(normalized)),rawId,2026,new Set([proposalId]));}
  else throw new Error(`unsupported official theme raw source ${url}`);
  const wanted=new Set(sourceRows.map(r=>`${r.source}|${r.external_key}`)); for(const record of records){const key=`${record.source}|${record.externalKey}`;if(wanted.has(key))parsed.push({record,meta});}
}
const missing=[...target.keys()]; const parsedKeys=new Set(parsed.map(x=>`${x.record.source}|${x.record.externalKey}`)); const unresolved=missing.filter(k=>!parsedKeys.has(k)); if(unresolved.length)throw new Error(`official parser unresolved ${unresolved.length}: ${unresolved.slice(0,20).join(',')}`);
const pool=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD}); const client=await pool.connect(); const runIds={camara:`pg-state-topics:national:camara:2026:${randomUUID()}`,senado:`pg-state-topics:national:senado:2026:${randomUUID()}`}; const now=new Date().toISOString();
try{await client.query('BEGIN'); for(const [source,runId] of Object.entries(runIds)){const records=parsed.filter(x=>x.record.source===source);const raws=[...new Set(records.map(x=>x.meta.id))];await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,finished_at,status,parser_version,roster_complete,expected_count,reconciliation_json) VALUES($1,$2,$3,$3,'published','state-topics-national-v1',1,$4,$5)`,[runId,source,now,records.length,JSON.stringify({source,scope:'state-topics-2026',records:records.length,rawObjects:raws.length,mode:'official-parser-from-preserved-raw'})]);for(const meta of raws.map(id=>rawMeta.get(id))){await client.query(`INSERT INTO civica.raw_objects(id,run_id,url,fetched_at,status,content_type,sha256,path,bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,[meta.id,runId,meta.url,meta.fetched_at,meta.status,meta.content_type,meta.sha256,meta.path,meta.bytes]);}await client.query(`INSERT INTO civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json) VALUES($1,$2,'state-topics-2026',$3,$4,$5)`,[runId,source,now,records.length,JSON.stringify({source,scope:'state-topics-2026',parser:'parseSenateProcess/parseCamaraThemes',records:records.length,rawObjects:raws.length})]);for(const {record} of records){await client.query(`INSERT INTO civica.legislative_complements(batch_id,source,external_key,kind,person_external_id,proposal_id,deliberation_id,body_id,occurred_at,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(batch_id,external_key) DO UPDATE SET payload=excluded.payload`,[runId,record.source,record.externalKey,record.kind,record.personExternalId,record.proposalId,record.deliberationId,record.bodyId,record.occurredAt,record.rawId,JSON.stringify(record)]);}await client.query(`INSERT INTO civica.active_complement_publications(source,scope,batch_id) VALUES($1,'state-topics-2026',$2) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id`,[source,runId]);}
  await client.query('COMMIT'); console.log(JSON.stringify({targetKeys:target.size,parsed:parsed.length,unresolved:unresolved.length,runIds,bySource:Object.fromEntries(Object.keys(runIds).map(s=>[s,parsed.filter(x=>x.record.source===s).length]))},null,2));
}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();sqlite.close();await pool.end();}
