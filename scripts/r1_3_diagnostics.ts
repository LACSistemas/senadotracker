import pg from 'pg';
import { openDatabase, publishedParticipationRows } from '@senadotracker/db';
import { participation as pgParticipation } from '../apps/web/lib/data-postgres-wave4.ts';
const sqlite=openDatabase('data/senadotracker.sqlite',true);
const ids=(sqlite.prepare("SELECT p.external_id FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source='senado' ORDER BY p.external_id").all() as any[]).map(x=>String(x.external_id));
const pgpool=new pg.Pool();
const pgIds=(await pgpool.query("SELECT p.external_id::text id FROM civica.profiles p JOIN civica.active_publications a ON a.source='senado' AND a.batch_id=p.batch_id ORDER BY p.external_id")).rows.map(x=>String(x.id));
const sqliteMetrics=publishedParticipationRows(sqlite,'senado',2026,ids) as any;
const pgMetrics=await pgParticipation('senado',2026,pgIds);
const metric=(x:any)=>x&&x.numerator!=null&&x.denominator?`${x.numerator}/${x.denominator}`:'unavailable';
const s=new Map(Object.entries(sqliteMetrics).map(([id,v]:any)=>[String(id),metric(v.participation)]));const p=new Map([...pgMetrics.participation.entries()].map(([id,v]:any)=>[String(id),metric(v)]));
const sSet=new Set([...s].filter(([,v])=>v!=='unavailable').map(([id])=>id)),pSet=new Set([...p].filter(([,v])=>v!=='unavailable').map(([id])=>id));
const ratio=(x:any)=>x&&x.numerator!=null&&x.denominator?x.numerator/x.denominator:null;const sqliteMean=[...Object.values(sqliteMetrics as any)].map((x:any)=>ratio(x.participation)).filter((x:any):x is number=>x!=null).reduce((a,b)=>a+b,0)/sSet.size;const pgMean=[...pgMetrics.participation.values()].map((x:any)=>ratio(x)).filter((x:any):x is number=>x!=null).reduce((a,b)=>a+b,0)/pSet.size;const metricDiff=[...sSet].filter(id=>s.get(id)!==p.get(id)).map(id=>[id,s.get(id),p.get(id)]);const onlyS=[...sSet].filter(id=>!pSet.has(id)),onlyP=[...pSet].filter(id=>!sSet.has(id));
console.log(JSON.stringify({sqliteProfiles:ids.length,pgProfiles:pgIds.length,sqliteParticipants:sSet.size,pgParticipants:pSet.size,intersection:[...sSet].filter(id=>pSet.has(id)).length,onlySQLite:onlyS.slice(0,50),onlyPG:onlyP.slice(0,50),onlySQLiteMetrics:onlyS.map(id=>[id,s.get(id)]),onlyPGMetrics:onlyP.map(id=>[id,p.get(id)]),metricDiff,sqliteMean,pgMean},null,2));
await pgpool.end();sqlite.close();


