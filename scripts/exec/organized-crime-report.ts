import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OC_FAMILIES, OC_BY_INDICATOR, getOrganizedCrimeMunicipality, getOrganizedCrimeNational, getOrganizedCrimeState } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/** Relatórios da P9.7 (somente SELECT): catálogo de indicadores reaproveitados, cobertura territorial por indicador e desempenho dos read models. Uso: organized-crime-report.ts <pasta> */
const out = process.argv[2]; if (!out) throw new Error('informe a pasta de saída'); await mkdir(out, { recursive: true });
const csv = (rows: Array<Array<string | number | null>>) => rows.map(r => r.map(v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)).join(',')).join('\n') + '\n';
const pool = openPool(2);
try {
  const ids = [...OC_BY_INDICATOR.keys()];
  const defs = new Map((await pool.query(`SELECT indicator_id, code, label FROM civica_exec.exec_ind_def WHERE indicator_id = ANY($1::smallint[])`, [ids])).rows.map(r => [Number(r.indicator_id), r]));
  const cov = new Map((await pool.query(`SELECT v.indicator_id, count(*)::int n, count(DISTINCT v.entity_id) FILTER (WHERE e.kind = 3)::int ufs, count(DISTINCT v.entity_id) FILTER (WHERE e.kind = 4)::int muns, min(v.period_start)::text a, max(v.period_start)::text b,
      count(*) FILTER (WHERE v.value = 0)::int zeros, count(*) FILTER (WHERE (v.flags & 2) <> 0)::int prelim, count(*) FILTER (WHERE (v.flags & 8) <> 0)::int supp
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = ANY($1::smallint[]) GROUP BY 1`, [ids])).rows.map(r => [Number(r.indicator_id), r]));
  const unit = (m: string) => m;
  await writeFile(join(out, 'catalogo_indicadores_p97.csv'), csv([
    ['familia', 'indicator_id', 'codigo_origem', 'rotulo', 'fonte', 'abrangencia', 'medida', 'unidade', 'nivel_territorial', 'semantica', 'nota', 'id_novo_na_p97'],
    ...OC_FAMILIES.flatMap(f => f.indicators.map(i => [f.code, i.indicatorId, defs.get(i.indicatorId)?.code ?? null, defs.get(i.indicatorId)?.label ?? null, i.source, i.abrangencia, unit(i.measure), i.unit, i.level, f.semantics, i.note ?? null, 'não (reuso)']))]));
  await writeFile(join(out, 'cobertura_territorial_p97.csv'), csv([
    ['familia', 'indicator_id', 'fonte', 'abrangencia', 'nivel', 'linhas', 'ufs_com_dado', 'municipios_com_dado', 'primeiro_mes', 'ultimo_mes', 'zeros', 'preliminares', 'suprimidas'],
    ...OC_FAMILIES.flatMap(f => f.indicators.map(i => { const c = cov.get(i.indicatorId); return [f.code, i.indicatorId, i.source, i.abrangencia, i.level, c?.n ?? 0, c?.ufs ?? 0, c?.muns ?? 0, c?.a?.slice(0, 7) ?? null, c?.b?.slice(0, 7) ?? null, c?.zeros ?? 0, c?.prelim ?? 0, c?.supp ?? 0]; }))]));
  const perf: Record<string, unknown> = {};
  const time = async (name: string, f: () => Promise<unknown>) => { await f(); const a: number[] = []; for (let i = 0; i < 5; i++) { const s = performance.now(); await f(); a.push(performance.now() - s); } a.sort((x, y) => x - y); perf[name] = { ms_median: +a[2]!.toFixed(1), ms_max: +a[4]!.toFixed(1) }; };
  await time('brasil', () => getOrganizedCrimeNational(pool));
  for (const uf of [31, 32, 33, 35, 43, 26, 53]) await time(`uf_${uf}`, () => getOrganizedCrimeState(pool, uf));
  for (const m of [3106200, 3205309, 3205002, 3200359, 3304557, 3550308, 4314902, 2611606]) await time(`municipio_${m}`, () => getOrganizedCrimeMunicipality(pool, m));
  await writeFile(join(out, 'desempenho_consultas.json'), JSON.stringify({ geradoEm: new Date().toISOString(), nota: 'mediana de 5 execuções após aquecimento, PostgreSQL de produção; 1 consulta por escopo (sem N+1)', ...perf }, null, 2));
  console.log(JSON.stringify(perf));
} finally { await pool.end(); }
