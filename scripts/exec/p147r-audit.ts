import { openPool } from './db.ts';
const p=openPool(2);
try {
 const r=await p.query(`select i.indicator_id,i.public_name,i.official_name,i.source_variable,i.publication_status,count(o.observation_id)::int facts,count(*) filter(where o.value_numeric is not null)::int nonnull,count(*) filter(where o.value_numeric is null)::int nulls,count(distinct o.publication_revision_id)::int revisions from civica_jud.jud_jn_indicator i left join civica_jud.jud_jn_observation o on o.indicator_id=i.indicator_id where i.indicator_id like 'P146_%' group by i.indicator_id,i.public_name,i.official_name,i.source_variable,i.publication_status order by i.indicator_id`);
 console.log(JSON.stringify(r.rows,null,2));
 const orphan=await p.query(`select count(*)::int n from civica_jud.jud_jn_observation o left join civica_jud.jud_jn_indicator i on i.indicator_id=o.indicator_id where o.publication_revision_id='p146-jn-themes-20261105' and i.indicator_id is null`); console.log('orphan',orphan.rows[0]);
 const rev=await p.query(`select revision_id,scope,row_count,state,is_active,last_known_good,semantic_hash,provenance from civica_jud.jud_publication_revision where revision_id='p146-jn-themes-20261105'`); console.log('rev',JSON.stringify(rev.rows,null,2));
} finally {await p.end()}
