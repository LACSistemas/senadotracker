import fs from 'fs';for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
import pg from 'pg';const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});const q=await p.query(`select p.external_id,p.name,p.search_name from civica.profiles p join civica.active_publications a on a.batch_id=p.batch_id where a.source='camara' and p.uf='MT'`);console.log(q.rows);await p.end();

