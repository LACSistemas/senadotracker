import fs from 'node:fs';
const p='artifacts/full-web-sqlite-postgres-parity.json'; const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.validation={httpSweep:{routes:38,httpPass:38,httpFail:0,unexpectedEmpty:0,mojibake:0},typecheck:'PASS',build:'PASS',tests:{pass:200,fail:8,status:'FAIL'}};
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
