import {openPool} from './db.ts'; const p=openPool(2); try {console.log((await p.query("select pg_database_size(current_database())::bigint bytes")).rows)} finally{await p.end()}
