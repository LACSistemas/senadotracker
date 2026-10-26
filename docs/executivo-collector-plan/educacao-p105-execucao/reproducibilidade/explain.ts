import { openPool } from '../../../../scripts/exec/db.ts';
const p = openPool(1);
console.log((await p.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT f.entity_id,f.exercicio,max(f.valor) FILTER (WHERE k.code='EMP')
FROM civica_exec.exec_fin_fact f
JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30
JOIN civica_exec.exec_ref_code k ON k.ref_id=f.coluna_id AND k.domain=31
WHERE f.exercicio=2024 AND c.code='12'
AND f.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code=32)
GROUP BY f.entity_id,f.exercicio`)).rows.map(x => x['QUERY PLAN']));
await p.end();
