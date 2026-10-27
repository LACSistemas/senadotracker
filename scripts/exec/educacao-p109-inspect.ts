import { openPool } from './db.ts';
const p = openPool(2);
try {
  const qs = [
    `SELECT count(*)::int rows,count(DISTINCT municipality_siafi)::int codes,count(DISTINCT entity_id) FILTER(WHERE entity_id IS NOT NULL)::int linked FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`,
    `SELECT municipality_siafi,uf,count(*)::int rows,min(provenance::text) prov FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND municipality_siafi IS NOT NULL GROUP BY 1,2 ORDER BY 1 LIMIT 20`,
    `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='civica_exec' AND table_name='exec_entity_external_id' ORDER BY ordinal_position`,
    `SELECT source,count(*)::int n,min(code),max(code) FROM civica_exec.exec_entity_external_id GROUP BY source ORDER BY source`,
    `SELECT x.code,e.ibge7,e.name,e.uf FROM civica_exec.exec_entity_external_id x JOIN civica_exec.exec_entity e USING(entity_id) WHERE x.source=1 ORDER BY x.code LIMIT 20`,
    `SELECT x.code,e.ibge7,e.name,e.uf FROM civica_exec.exec_entity_external_id x JOIN civica_exec.exec_entity e USING(entity_id) WHERE x.source=1 AND x.code IN ('110000','110001','110002','320530')`,
    `SELECT DISTINCT municipality_siafi,uf,provenance->>'municipality_name' municipality_name FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND municipality_siafi IS NOT NULL ORDER BY uf,municipality_siafi LIMIT 10`,
  ];
  for (const q of qs) console.log(JSON.stringify((await p.query(q)).rows, null, 2));
  const facts = (await p.query(`SELECT DISTINCT municipality_siafi,uf,provenance->>'municipality_name' municipality_name FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND municipality_siafi IS NOT NULL`)).rows;
  const entities = (await p.query(`SELECT entity_id,ibge7,uf_code,name FROM civica_exec.exec_entity WHERE kind=4`)).rows;
  const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const by = new Map<string, any[]>(); for (const e of entities) { const k = `${e.uf_code}|${norm(e.name)}`; by.set(k, [...(by.get(k) ?? []), e]); }
  let unique=0,ambiguous=0,missing=0; for (const f of facts) { const x=by.get(`${f.uf}|${norm(f.municipality_name)}`) ?? []; if(x.length===1) unique++; else if(x.length>1) ambiguous++; else missing++; }
  console.log(JSON.stringify({exactNameUnique:unique,ambiguous,missing,totalCodes:facts.length},null,2));
} finally { await p.end(); }
