import fs from 'node:fs'; for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
const {webPostgresPool}=await import('../apps/web/lib/postgres-pool.ts');const pool=webPostgresPool();
for(const q of [
 ['activity batches',`SELECT * FROM civica.activity_batches ORDER BY source`],
 ['leg batches',`SELECT * FROM civica.legislative_batches ORDER BY source,year`],
 ['active comps',`SELECT * FROM civica.active_complement_publications ORDER BY source,scope`],
 ['ops comps',`SELECT source,kind,external_key,occurred_at,left(payload::text,300) payload FROM civica.legislative_complements WHERE kind IN ('movement','resulting_norm','theme','agenda_item') ORDER BY occurred_at DESC NULLS LAST LIMIT 5`],
 ['market snapshot',`SELECT payload FROM civica_finance_poc.supplier_category_snapshot LIMIT 3`]
]){console.log('Q',q[0]); const r=await pool.query(q[1]); console.log(JSON.stringify(r.rows));}
await pool.end();
