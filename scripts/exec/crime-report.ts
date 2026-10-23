import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_CRIME_DEFS, CRIME_SOURCES, CRIME_VERSION, crimeIdsOf } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Relatórios da P9.6 a partir do banco (somente SELECT): catálogo de indicadores, cobertura UF × fonte, crosswalk de taxonomia e volumetria.
 *   npx tsx scripts/exec/crime-report.ts <diretório de saída>
 */
const out = process.argv[2] ?? 'docs/executivo-collector-plan/seguranca-publica-p96-execucao';
const csv = (rows: Array<Array<string | number | null>>) => rows.map(r => r.map(v => v == null ? '' : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)).join(',')).join('\n') + '\n';
const pool = openPool(2);
try {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'catalogo_indicadores_estaduais.csv'), csv([
    ['indicator_id', 'fonte', 'uf_code', 'codigo_fonte', 'rotulo', 'grupo', 'unidade', 'canonico', 'composto_de', 'comparabilidade', 'sensivel', 'derivado_de_microdado', 'semantica_zero', 'temporal'],
    ...ALL_CRIME_DEFS.map(d => [d.id, d.source, d.ufCode, d.code, d.label, d.group, d.unit, d.canonical, d.composite?.join('|') ?? null, d.comparability, d.sensitive ? 1 : 0, d.derived ? 1 : 0, d.zero, d.temporal]),
  ]));
  const canon = new Map<string, typeof ALL_CRIME_DEFS>(); for (const d of ALL_CRIME_DEFS) if (d.canonical) canon.set(d.canonical, [...(canon.get(d.canonical) ?? []), d]);
  await writeFile(join(out, 'crosswalk_criminalidade_ibge.csv'), csv([
    ['categoria_canonica', 'fonte', 'uf_code', 'codigo_fonte', 'unidade', 'comparabilidade', 'observacao'],
    ...[...canon.entries()].sort().flatMap(([c, ds]) => ds.map(d => [c, d.source, d.ufCode, d.code, d.unit, d.comparability, 'rótulo equivalente por nome; equivalência oficial NÃO comprovada: não comparar entre UFs'])),
  ]));
  const cov: Array<Array<string | number | null>> = [['fonte', 'uf', 'indicadores', 'linhas_valor', 'municipios_com_dado', 'primeiro_mes', 'ultimo_mes', 'celulas_suprimidas', 'linhas_preliminares']];
  const vol: Array<Array<string | number | null>> = [['fonte', 'linhas_exec_ind_value']];
  for (const s of CRIME_SOURCES) {
    const ids = crimeIdsOf(s.slot); if (!ids.length) { cov.push([s.key, s.uf, 0, 0, 0, null, null, 0, 0]); continue; }
    const r = (await pool.query(`SELECT count(*)::int n, count(DISTINCT v.entity_id) FILTER (WHERE e.kind = 4)::int muns, min(v.period_start)::text a, max(v.period_start)::text b, count(*) FILTER (WHERE (v.flags & 8) <> 0)::int supp, count(*) FILTER (WHERE (v.flags & 2) <> 0)::int prelim
      FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = ANY($1::smallint[])`, [ids])).rows[0];
    cov.push([s.key, s.uf, ids.length, r.n, r.muns, r.a?.slice(0, 7) ?? null, r.b?.slice(0, 7) ?? null, r.supp, r.prelim]); vol.push([s.key, r.n]);
  }
  await writeFile(join(out, 'cobertura_estadual_municipal.csv'), csv(cov));
  const size = (await pool.query(`SELECT pg_total_relation_size('civica_exec.exec_ind_value')::bigint b, pg_total_relation_size('civica_exec.exec_crime_indicator')::bigint c`)).rows[0];
  await writeFile(join(out, 'armazenamento_execucao.csv'), csv([...vol, ['exec_ind_value (tabela inteira, bytes)', Number(size.b)], ['exec_crime_indicator (bytes)', Number(size.c)], ['contrato', CRIME_VERSION.contract]]));
  console.log(JSON.stringify({ coverage: cov.slice(1).map(r => ({ fonte: r[0], linhas: r[3], municipios: r[4], de: r[5], ate: r[6], suprimidas: r[7] })) }));
} finally { await pool.end(); }
