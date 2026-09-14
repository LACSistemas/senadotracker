import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const sqlitePath=resolve(process.argv.find(arg=>arg.startsWith('--sqlite='))?.slice(9)??'data/senadotracker.sqlite');
const schema=(process.env.DB_SCHEMA??'civica').replace(/[^a-zA-Z0-9_]/g,'');
if(!schema)throw new Error('DB_SCHEMA inválido');
const required=['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD'] as const;for(const key of required)if(!process.env[key])throw new Error(`${key} não configurado`);
const pool=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,max:2});
const sqlite=new DatabaseSync(sqlitePath,{readOnly:true});
type Column={cid:number;name:string;type:string;notnull:number;dflt_value:unknown;pk:number};
type ForeignKey={id:number;seq:number;table:string;from:string;to:string;on_update:string;on_delete:string;match:string};
const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;
const jsonColumn=(name:string)=>name==='payload'||name.endsWith('_json')||name==='evidence';
const pgType=(column:Column)=>jsonColumn(column.name)?'jsonb':column.type.toUpperCase().includes('INT')?'bigint':'text';
const tables=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));

const client=await pool.connect();const report:{startedAt:string;sqlite:string;postgres:string;schema:string;tables:Record<string,{sqlite:number;postgres:number}>;financial:Record<string,{sqlite:string;postgres:string}>;finishedAt?:string}={startedAt:new Date().toISOString(),sqlite:sqlitePath,postgres:`${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,schema,tables:{},financial:{}};
try{
  await client.query('BEGIN');await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE; CREATE SCHEMA ${quote(schema)};`);
  for(const table of tables){
    const columns=sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as unknown as Column[],primary=columns.filter(column=>column.pk).sort((a,b)=>a.pk-b.pk);
    const definitions=columns.map(column=>`${quote(column.name)} ${pgType(column)}${column.notnull?' NOT NULL':''}${column.dflt_value!==null&&column.dflt_value!==undefined?` DEFAULT ${String(column.dflt_value)}`:''}`);
    if(primary.length)definitions.push(`PRIMARY KEY (${primary.map(column=>quote(column.name)).join(',')})`);
    for(const index of sqlite.prepare(`PRAGMA index_list(${quote(table)})`).all()){if(String(index.origin)!=='u')continue;const keys=sqlite.prepare(`PRAGMA index_info(${quote(String(index.name))})`).all().map(row=>quote(String(row.name)));if(keys.length)definitions.push(`UNIQUE (${keys.join(',')})`)}
    await client.query(`CREATE TABLE ${quote(schema)}.${quote(table)} (${definitions.join(',')})`);
  }
  for(const table of tables){
    const columns=sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as unknown as Column[],names=columns.map(column=>column.name),batchSize=Math.max(50,Math.floor(50_000/names.length));let count=0;
    for(let offset=0;;offset+=batchSize){const batch=sqlite.prepare(`SELECT * FROM ${quote(table)} LIMIT ? OFFSET ?`).all(batchSize,offset);if(!batch.length)break;const values:unknown[]=[],groups=batch.map(row=>`(${names.map(name=>{values.push(row[name]);return`$${values.length}`}).join(',')})`);await client.query(`INSERT INTO ${quote(schema)}.${quote(table)} (${names.map(quote).join(',')}) VALUES ${groups.join(',')}`,values);count+=batch.length}
    report.tables[table]={sqlite:count,postgres:0};console.error(`${table}: ${count.toLocaleString('pt-BR')} linhas`);
  }
  for(const table of tables){
    const groups=new Map<number,ForeignKey[]>();for(const fk of sqlite.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all() as unknown as ForeignKey[]){const group=groups.get(fk.id)??[];group.push(fk);groups.set(fk.id,group)}
    for(const [id,parts] of groups){parts.sort((a,b)=>a.seq-b.seq);await client.query(`ALTER TABLE ${quote(schema)}.${quote(table)} ADD CONSTRAINT ${quote(`fk_${table}_${id}`)} FOREIGN KEY (${parts.map(part=>quote(part.from)).join(',')}) REFERENCES ${quote(schema)}.${quote(parts[0]!.table)} (${parts.map(part=>quote(part.to)).join(',')}) ON UPDATE ${parts[0]!.on_update} ON DELETE ${parts[0]!.on_delete}`)}
    for(const index of sqlite.prepare(`PRAGMA index_list(${quote(table)})`).all()){if(String(index.origin)!=='c')continue;const keys=sqlite.prepare(`PRAGMA index_xinfo(${quote(String(index.name))})`).all().filter(row=>Number(row.key)===1&&Number(row.cid)>=0).map(row=>quote(String(row.name)));if(keys.length)await client.query(`CREATE INDEX ${quote(String(index.name))} ON ${quote(schema)}.${quote(table)} (${keys.join(',')})`)}
  }
  await client.query(`CREATE OR REPLACE FUNCTION ${quote(schema)}.search_text(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT translate(lower(coalesce(value,'')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') $$`);
  await client.query(`CREATE INDEX proposals_label_search_pg ON ${quote(schema)}.proposals (upper(trim(payload->>'label'))); CREATE INDEX proposals_year_type_pg ON ${quote(schema)}.proposals (((payload->>'year')::bigint),(payload->>'type'),source,batch_id); CREATE INDEX votes_choice_pg ON ${quote(schema)}.legislative_votes (batch_id,${quote(schema)}.search_text(payload->>'vote'),deliberation_id,external_id); CREATE INDEX deliberations_body_date_pg ON ${quote(schema)}.deliberations (batch_id,(payload->>'chamberBody'),date);`);
  for(const table of tables){const count=Number((await client.query(`SELECT count(*)::bigint n FROM ${quote(schema)}.${quote(table)}`)).rows[0].n);report.tables[table]!.postgres=count;if(count!==report.tables[table]!.sqlite)throw new Error(`Contagem divergente em ${table}`)}
  for(const [name,query] of Object.entries({expenses:'SELECT coalesce(sum(net_cents-refund_cents),0)::text value FROM expenses',assets:'SELECT coalesce(sum(value_cents),0)::text value FROM electoral_assets',campaign:'SELECT coalesce(sum(value_cents),0)::text value FROM campaign_transactions',expanded:'SELECT coalesce(sum(value_cents),0)::text value FROM expanded_costs'})){const sqliteValue=String(sqlite.prepare(query.replace('::text','')).get()!.value),postgresValue=String((await client.query(query.replace(/ FROM /,` FROM ${quote(schema)}.`))).rows[0].value);report.financial[name]={sqlite:sqliteValue,postgres:postgresValue};if(sqliteValue!==postgresValue)throw new Error(`Somatório divergente em ${name}`)}
  await client.query(`ANALYZE ${quote(schema)}.profiles; ANALYZE ${quote(schema)}.expenses; ANALYZE ${quote(schema)}.proposals; ANALYZE ${quote(schema)}.legislative_votes; ANALYZE ${quote(schema)}.legislative_complements;`);
  await client.query('COMMIT');report.finishedAt=new Date().toISOString();await writeFile(resolve('data','postgres-migration-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({schema,tables:tables.length,rows:Object.values(report.tables).reduce((sum,item)=>sum+item.postgres,0),financial:report.financial,report:'data/postgres-migration-report.json'},null,2));
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end();sqlite.close()}
