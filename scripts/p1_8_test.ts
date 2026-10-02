import pg from 'pg'; import {postgresPropositionRepository} from '../packages/db/src/postgres-propositions.ts'; const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'}); const c=await p.connect(); const x=(await c.query('select a.source,a.proposal_id from civica_poc.proposal_detail_atoms a join civica_poc.proposals p on p.source=a.source and p.external_id=a.proposal_id limit 1')).rows[0];  c.release(); const d=await postgresPropositionRepository(p).detail(x.source,x.proposal_id); console.log({identity:x,works:!!d,movements:d?.movements?.length}); await p.end();




