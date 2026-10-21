import pg from 'pg';
import fs from 'node:fs';
const DB='civica_postgres_lab', S='civica_state';
const pool=new pg.Pool({host:'localhost',port:5432,database:DB,user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const catalogs={ES:new Set(JSON.parse(fs.readFileSync('artifacts/P22_1R2_type_catalog_ES.json')).rows.map(r=>r.officialSourceTypeLabel)),BA:new Set(JSON.parse(fs.readFileSync('artifacts/P22_1R2_type_catalog_BA.json')).rows.map(r=>r.officialSourceTypeLabel))};
const rows=(await pool.query(`select p.house,p.type_code,p.type_label,count(*)::int n from ${S}.proposals p join ${S}.active_publications a on a.house=p.house and a.domain='legislative' and a.revision_id=p.revision_id where p.house in ('ES','BA') and p.year=2026 group by p.house,p.type_code,p.type_label`)).rows;
const bad=rows.filter(r=>!catalogs[r.house]?.has(String(r.type_label)));
if(bad.length){console.error(JSON.stringify({REGRESSION_TEST:'FAIL',bad},null,2));process.exitCode=1;}else console.log(JSON.stringify({REGRESSION_TEST:'PASS',sourceTypeLabelsChecked:rows.length,forbiddenActivityLabels:0},null,2));
await pool.end();
