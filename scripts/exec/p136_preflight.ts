import {openPool} from './db.ts';
const p=openPool(1);
for(const [n,s] of Object.entries({
db:'select current_database() database,pg_database_size(current_database())::bigint bytes,current_setting(\'data_directory\') data_directory',
schema:'select pg_total_relation_size(\'civica_exec\'::regnamespace)::bigint bytes',
indexes:'select indexrelname,pg_relation_size(indexrelid)::bigint bytes from pg_stat_user_indexes where schemaname=\'civica_exec\' order by bytes desc limit 20',
wal:'select pg_current_wal_lsn() lsn',
temp:'select datname,temp_files,temp_bytes from pg_stat_database where datname=current_database()'
})){try{console.log(n,(await p.query(s)).rows)}catch(e){console.log(n,String(e))}}
await p.end();
