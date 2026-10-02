import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const c=await p.connect();
try {
  const q=await c.query("select batch_id from civica.active_complement_publications where source='senado' and scope='house-operations-2026'");
  const id=q.rows[0].batch_id;
  const r=await c.query("select payload from civica.legislative_complements where batch_id=$1 and external_key='house-operations:2026'",[id]);
  const x=r.rows[0].payload; const v=typeof x.value==='string'?JSON.parse(x.value):x.value;
  v.norm=70; v.resultingNorms=70; x.value=JSON.stringify(v);
  await c.query("update civica.legislative_complements set payload=$1 where batch_id=$2 and external_key='house-operations:2026'",[JSON.stringify(x),id]);
  await c.query("update civica.ingestion_runs set reconciliation_json=jsonb_set(reconciliation_json,'{norm}','70'::jsonb,true) where id=$1",[id]);
  console.log(JSON.stringify({batch:id,norm:70}));
} finally {c.release();await p.end();}
