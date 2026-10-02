import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:process.env.DB_PASSWORD});
const c=await p.connect();
try {
 await c.query('BEGIN');
 await c.query(`CREATE OR REPLACE FUNCTION civica_poc.search_compatible(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT translate(lower(coalesce(v,'')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') $$`);
 await c.query(`UPDATE civica_poc.proposals SET search_label=civica_poc.search_compatible(label),search_summary=civica_poc.search_compatible(summary),search_type=civica_poc.search_compatible(type::text),search_number=civica_poc.search_compatible(number::text)`);
 await c.query(`UPDATE civica_poc.proposal_authors SET search_name=civica_poc.search_compatible(name)`);
 await c.query('COMMIT');
 console.log((await c.query("select search_label,search_type,search_number from civica_poc.proposals where source='camara' and type is not null limit 1")).rows);
} catch(e){await c.query('ROLLBACK');throw e} finally {c.release();await p.end()}
