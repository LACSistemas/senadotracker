import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, publishedSupplierMarket, publishedSupplierExplorer } from '@senadotracker/db';

const path=process.env.SENADOTRACKER_DB_PATH??resolve(process.cwd(),'data/senadotracker.sqlite');
if(!existsSync(path)){console.error(`Banco nÃ£o encontrado em ${path}`);process.exit(1)}
const db=openDatabase(path,true);db.exec('PRAGMA cache_size=-32768; PRAGMA mmap_size=268435456; PRAGMA temp_store=MEMORY;');
const year=Number(db.prepare('SELECT max(year) year FROM active_expense_publications').get()?.year??new Date().getUTCFullYear());
const measure=(label:string,fn:()=>unknown)=>{const samples:number[]=[];for(let i=0;i<7;i++){const start=performance.now();fn();samples.push(performance.now()-start)}samples.sort((a,b)=>a-b);const pct=(p:number)=>samples[Math.min(samples.length-1,Math.floor(samples.length*p))]!;console.log(`${label}: p50=${pct(.5).toFixed(1)} ms p95=${pct(.95).toFixed(1)} ms cold=${samples[0]!.toFixed(1)} ms`)};
measure('market',()=>publishedSupplierMarket(db,{year,limit:1000}));
measure('market filtered',()=>publishedSupplierMarket(db,{year,house:'CAMARA',search:'a',category:'Combustíveis',limit:500}));
measure('explorer',()=>publishedSupplierExplorer(db,{year,page:1,pageSize:25}));
db.close();

