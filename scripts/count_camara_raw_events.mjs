import {readFile} from 'node:fs/promises';
const p='C:/Projetos/senadotracker/data/raw/34/34e241bf3f69a218bcd14ca7d26dd2c34793acf03462a9705f10ea9bc69ac263.bin';
const x=JSON.parse(await readFile(p,'utf8')); const rows=Array.isArray(x?.dados)?x.dados:Array.isArray(x)?x:[];
const y=rows.filter(r=>String(r.dataHoraInicio??'').slice(0,10)>='2026-01-01'&&String(r.dataHoraInicio??'').slice(0,10)<='2026-12-31');
const filtered=y.filter(r=>{const k=String(r.descricaoTipo??'').toLowerCase();return k.includes('deliber')||k.includes('audi');});
console.log({rows:rows.length,year:y.length,filtered:filtered.length,types:[...new Set(filtered.map(r=>r.descricaoTipo))]});
