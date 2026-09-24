import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { openDatabase } from '@senadotracker/db';

const path=process.env.SENADOTRACKER_DB_PATH??resolve(process.cwd(),'data/senadotracker.sqlite');
if(!existsSync(path)){console.error(`Banco não encontrado em ${path}`);process.exit(1)}
const db=openDatabase(path,true), revision=String(db.prepare('SELECT revision_id FROM active_supplier_aggregate_revision WHERE singleton=1').get()?.revision_id??''), year=Number(db.prepare('SELECT max(year) year FROM supplier_global_yearly WHERE revision_id=?').get(revision)?.year??0);
const global=Number(db.prepare('SELECT coalesce(sum(parliamentary_net_scaled),0) value FROM supplier_global_yearly WHERE revision_id=? AND year=?').get(revision,year)?.value??0);
const houses=Number(db.prepare("SELECT coalesce(sum(parliamentary_net_scaled),0) value FROM supplier_global_house_yearly WHERE revision_id=? AND year=?").get(revision,year)?.value??0);
const suppliers=Number(db.prepare('SELECT count(*) n FROM supplier_global_yearly WHERE revision_id=? AND year=? AND parliamentary_net_scaled IS NOT NULL').get(revision,year)?.n??0);
const links=Number(db.prepare('SELECT count(*) n FROM expense_supplier_links WHERE match_status=\'confirmed\'').get()?.n??0);
const result={revision,year,globalCents:global,houseCents:houses,differenceCents:global-houses,suppliers,confirmedLinks:links,ok:global===houses&&global>=0};
console.log(JSON.stringify(result,null,2));db.close();if(!result.ok)process.exitCode=1;
