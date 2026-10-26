import type { Pool } from 'pg';

export interface EducationFinanceRow { entity_id: number; exercicio: number; empenhado: number | null; liquidado: number | null; pago: number | null; population: number | null; }
/** Função 12 do Siconfi: soma em centavos na fonte e devolve reais. Nunca transforma ausência em zero. */
export async function getEducationFinanceByEntity(pool: Pool, year: number, uf = 0): Promise<EducationFinanceRow[]> {
  const r = await pool.query(`SELECT f.entity_id, f.exercicio,
    max(f.valor) FILTER (WHERE c.code='12' AND k.code='EMP')/100.0 AS empenhado,
    max(f.valor) FILTER (WHERE c.code='12' AND k.code='LIQ')/100.0 AS liquidado,
    max(f.valor) FILTER (WHERE c.code='12' AND k.code='PAG')/100.0 AS pago,
    max(p.value) AS population
    FROM civica_exec.exec_fin_fact f
    JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30
    JOIN civica_exec.exec_ref_code k ON k.ref_id=f.coluna_id AND k.domain=31
    LEFT JOIN civica_exec.exec_territory_population p ON p.entity_id=f.entity_id AND p.year=f.exercicio AND p.source=1
    WHERE f.exercicio=$1 AND c.code='12' AND ($2::smallint=0 OR f.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code=$2))
    GROUP BY f.entity_id,f.exercicio ORDER BY f.entity_id`, [year, uf]);
  return r.rows.map(x => ({ entity_id: Number(x.entity_id), exercicio: Number(x.exercicio), empenhado: x.empenhado == null ? null : Number(x.empenhado), liquidado: x.liquidado == null ? null : Number(x.liquidado), pago: x.pago == null ? null : Number(x.pago), population: x.population == null ? null : Number(x.population) }));
}

export async function getEducationFinanceSummary(pool: Pool, year: number, uf = 0) {
  const rows = await getEducationFinanceByEntity(pool, year, uf); const sum = (k: keyof EducationFinanceRow) => { const xs = rows.map(r => r[k]).filter((v): v is number => typeof v === 'number'); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
  return { year, uf, entities: rows.length, empenhado: sum('empenhado'), liquidado: sum('liquidado'), pago: sum('pago'), rows };
}

export async function getSiopeEducationSummary(pool: Pool, year: number, uf = 0) {
  const r = await pool.query(`SELECT f.componente,f.codigo,f.estagio,count(*)::int rows, sum(f.valor_cents)/100.0 AS total
    FROM civica_exec.exec_edu_siope_fact f WHERE f.exercicio=$1 AND ($2::smallint=0 OR f.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code=$2))
    GROUP BY f.componente,f.codigo,f.estagio ORDER BY f.componente,f.codigo,f.estagio`, [year, uf]);
  return { year, uf, rows: r.rows.map(x => ({ componente: Number(x.componente), codigo: String(x.codigo), estagio: String(x.estagio), rows: Number(x.rows), total: x.total == null ? null : Number(x.total) })) };
}

export async function getEducationFinanceCoverage(pool: Pool, year: number, uf = 0) {
  const r = await pool.query(`SELECT 'siconfi' source, c.status, count(*)::int entities FROM civica_exec.exec_fin_cov c WHERE c.exercicio=$1 AND c.fn12=1 AND ($2::smallint=0 OR c.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code=$2)) GROUP BY c.status
    UNION ALL SELECT 'siope', c.status, count(*)::int FROM civica_exec.exec_edu_siope_cov c WHERE c.exercicio=$1 AND ($2::smallint=0 OR c.uf=$2) GROUP BY c.status ORDER BY 1,2`, [year, uf]);
  return r.rows.map(x => ({ source: String(x.source), status: Number(x.status), entities: Number(x.entities) }));
}
