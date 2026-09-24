import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '@senadotracker/db';
const path=process.env.SENADOTRACKER_DB_PATH??resolve(process.cwd(),'data/senadotracker.sqlite');
if(!existsSync(path)){console.error(`Banco não encontrado em ${path}`);process.exit(1)}
const db=openDatabase(path,true);const count=(sql:string)=>Number(db.prepare(sql).get()?.n??0);
const result={processes:count('SELECT count(*) n FROM procurement_processes'),tenders:count('SELECT count(*) n FROM tenders'),contracts:count('SELECT count(*) n FROM institutional_contracts'),contractItems:count('SELECT count(*) n FROM contract_items'),amendments:count('SELECT count(*) n FROM contract_amendments'),commitments:count('SELECT count(*) n FROM commitments'),movements:count('SELECT count(*) n FROM financial_movements'),contractsWithoutSupplier:count('SELECT count(*) n FROM institutional_contracts WHERE supplier_id IS NULL'),contractsWithoutTender:count('SELECT count(*) n FROM institutional_contracts WHERE tender_id IS NULL'),commitmentsWithoutContract:count('SELECT count(*) n FROM commitments WHERE contract_id IS NULL'),movementsWithoutCommitment:count('SELECT count(*) n FROM financial_movements WHERE commitment_id IS NULL'),payments:count("SELECT count(*) n FROM financial_movements WHERE phase='payment'"),ok:true};
console.log(JSON.stringify(result,null,2));db.close();
