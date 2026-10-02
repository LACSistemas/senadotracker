process.env.DB_HOST='localhost';process.env.DB_PORT='5432';process.env.DB_NAME='projetoeleitor_db';process.env.DB_USER='projetoeleitor_user';process.env.DB_PASSWORD='projetoeleitorsenha';
import * as legacy from '../apps/web/lib/data.ts';
import * as pg from '../apps/web/lib/data-postgres.ts';
const a=await legacy.legislativeOverview({page:1,pageSize:1}); const b=await pg.legislativeOverview({page:1,pageSize:1});
console.log('legacy',JSON.stringify(a.data?.result?.items?.[0]??a.result?.items?.[0],null,2));
console.log('pg',JSON.stringify(b.data?.result?.items?.[0]??b.result?.items?.[0],null,2));
