import { writeFile } from 'node:fs/promises';
import { FLOW_COLS, IDEB_MEASURES, INSE_LEVEL_COLS, SAEB_LEVEL_COLS, TRN_COLS } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Reconciliação da P10.4 (somente leitura): linhas e células publicadas × cobertura gravada, coerência interna do Ideb (N × P ≈ Ideb), faixas, e a cobertura por família × edição (CSV).
 *   npx tsx scripts/exec/educacao-p104-reconcilia.ts <saida.json> <cobertura.csv>      (EXEC_DATABASE_URL aponta o banco)
 */
const [outJson, outCsv] = process.argv.slice(2); const pool = openPool(2);
const cnt = (cols: string[]) => cols.map(c => `(${c} IS NOT NULL)::int`).join(' + ');
const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
try {
  const res: Record<string, unknown> = {}; const issues: string[] = [];
  const checks: Array<{ name: string; table: string; lvl: number; fam: number[]; covTable: string; cells: string }> = [
    { name: 'ideb_school', table: 'exec_edu_ideb_school', lvl: 1, fam: [1], covTable: 'exec_edu_ideb_cov', cells: cnt([...IDEB_MEASURES]) },
    { name: 'ideb_terr', table: 'exec_edu_ideb_terr', lvl: 2, fam: [1], covTable: 'exec_edu_ideb_cov', cells: cnt([...IDEB_MEASURES]) },
    { name: 'saeb_terr', table: 'exec_edu_saeb_terr', lvl: 2, fam: [2], covTable: 'exec_edu_saeb_cov', cells: cnt(['media', 'tx_alf', ...SAEB_LEVEL_COLS]) },
    { name: 'flow_school', table: 'exec_edu_flow_school', lvl: 1, fam: [3, 4], covTable: 'exec_edu_flow_cov', cells: cnt(FLOW_COLS) },
    { name: 'flow_terr', table: 'exec_edu_flow_terr', lvl: 2, fam: [3, 4], covTable: 'exec_edu_flow_cov', cells: cnt(FLOW_COLS) },
    { name: 'trn_terr', table: 'exec_edu_trn_terr', lvl: 2, fam: [5], covTable: 'exec_edu_trn_cov', cells: cnt(TRN_COLS) },
    { name: 'inse_school', table: 'exec_edu_inse_school', lvl: 1, fam: [6], covTable: 'exec_edu_inse_cov', cells: cnt(['qtd', 'media', ...INSE_LEVEL_COLS]) },
    { name: 'inse_terr', table: 'exec_edu_inse_terr', lvl: 2, fam: [6], covTable: 'exec_edu_inse_cov', cells: cnt(['qtd', 'media', ...INSE_LEVEL_COLS]) },
  ];
  const rec: Record<string, unknown>[] = [];
  for (const c of checks) {
    const t = await q(`SELECT year, count(*)::bigint rows, sum(${c.cells})::bigint cells FROM civica_exec.${c.table} GROUP BY year ORDER BY year`);
    const v = await q(`SELECT year, sum(valid)::bigint valid, sum(cells_num)::bigint cells FROM civica_exec.${c.covTable} WHERE lvl = $1 AND family = ANY($2) GROUP BY year ORDER BY year`, [c.lvl, c.fam]);
    const vm = new Map(v.map(r => [Number(r.year), r])); let rowsOk = 0, cellsOk = 0, n = 0;
    for (const r of t) {
      const cv = vm.get(Number(r.year)); n++;
      // flow: a linha única de uma escola reúne rendimento e distorção, então linhas ≤ soma dos "valid" das duas famílias; as células têm de bater exatamente
      const rowsMatch = c.fam.length > 1 ? Number(r.rows) <= Number(cv?.valid ?? -1) && Number(r.rows) >= Number(cv?.valid ?? 0) / 2 : Number(r.rows) === Number(cv?.valid);
      const cellsMatch = Number(r.cells) === Number(cv?.cells);
      if (rowsMatch) rowsOk++; else issues.push(`${c.name} ${r.year}: linhas ${r.rows} × cobertura ${cv?.valid}`);
      if (cellsMatch) cellsOk++; else issues.push(`${c.name} ${r.year}: células ${r.cells} × cobertura ${cv?.cells}`);
      rec.push({ table: c.name, year: Number(r.year), rows: Number(r.rows), covValid: Number(cv?.valid ?? 0), cells: Number(r.cells), covCells: Number(cv?.cells ?? 0), rowsMatch, cellsMatch });
    }
    res[c.name] = { years: n, rowsMatch: rowsOk, cellsMatch: cellsOk };
  }
  res.rowsVsCoverage = rec;
  // Ideb: N × P ≈ Ideb (o INEP arredonda o Ideb a 1 casa; N e P vêm com mais casas)
  for (const t of ['exec_edu_ideb_school', 'exec_edu_ideb_terr']) {
    const r = (await q(`SELECT count(*)::bigint n, count(*) FILTER (WHERE abs(nota_media * p - ideb) <= 0.05 + 1e-9)::bigint ok05, count(*) FILTER (WHERE abs(nota_media * p - ideb) <= 0.1 + 1e-9)::bigint ok10, max(abs(nota_media * p - ideb)) maxdev
      FROM civica_exec.${t} WHERE nota_media IS NOT NULL AND p IS NOT NULL AND ideb IS NOT NULL`))[0];
    res[`${t}_NxP`] = { checked: Number(r.n), within_0_05: Number(r.ok05), within_0_10: Number(r.ok10), maxDeviation: Number(r.maxdev) };
    const out = await q(`SELECT count(*)::bigint n FROM civica_exec.${t} WHERE ideb > 10 OR p > 1.0001 OR nota_media > 10 OR nota_mt > 500 OR nota_lp > 500`); res[`${t}_outOfRange`] = Number(out[0].n);
  }
  // Ideb de rede/município NÃO é a média dos Idebs das escolas: exemplo mensurável (anos iniciais, rede municipal, 2023)
  res.idebNotAverageOfSchools = await q(`SELECT e.name, t.ideb AS municipal_published, round(avg(s.ideb)::numeric, 3) AS mean_of_school_idebs, count(s.ideb)::int AS schools
    FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id
    JOIN civica_exec.exec_edu_school_year y ON y.entity_id = t.entity_id AND y.year = 2023
    JOIN civica_exec.exec_edu_ideb_school s ON s.inep = y.inep AND s.year = 2023 AND s.stage = 1 AND s.dep = 3
    WHERE t.year = 2023 AND t.stage = 1 AND t.dep = 3 AND e.ibge7 IN (3205309, 3550308, 3304557, 3106200, 2611606, 4314902, 3205002, 3200359) GROUP BY e.name, t.ideb ORDER BY e.name`);
  // soma dos níveis do Saeb ≈ 100 (quando a distribuição existe)
  res.saebLevelSum = (await q(`SELECT count(*)::bigint n, count(*) FILTER (WHERE abs(coalesce(nv0,0)+coalesce(nv1,0)+coalesce(nv2,0)+coalesce(nv3,0)+coalesce(nv4,0)+coalesce(nv5,0)+coalesce(nv6,0)+coalesce(nv7,0)+coalesce(nv8,0)+coalesce(nv9,0)+coalesce(nv10,0) - 10000) <= 30)::bigint ok FROM civica_exec.exec_edu_saeb_terr WHERE nv0 IS NOT NULL OR nv1 IS NOT NULL`))[0];
  // cobertura por família × edição (CSV)
  const cov = await q(`SELECT 'ideb' fam, year, lvl, sum(rows_in)::bigint rows_in, sum(valid)::bigint valid, sum(rejected)::bigint rejected, sum(no_identity)::bigint no_identity, sum(cells_num)::bigint cells_num, sum(cells_supp)::bigint cells_supp FROM civica_exec.exec_edu_ideb_cov GROUP BY year, lvl
    UNION ALL SELECT 'saeb', year, lvl, sum(rows_in), sum(valid), sum(rejected), sum(no_identity), sum(cells_num), sum(cells_supp) FROM civica_exec.exec_edu_saeb_cov GROUP BY year, lvl
    UNION ALL SELECT CASE family WHEN 3 THEN 'rendimento' ELSE 'distorcao' END, year, lvl, sum(rows_in), sum(valid), sum(rejected), sum(no_identity), sum(cells_num), sum(cells_supp) FROM civica_exec.exec_edu_flow_cov GROUP BY family, year, lvl
    UNION ALL SELECT 'transicao', year, lvl, sum(rows_in), sum(valid), sum(rejected), sum(no_identity), sum(cells_num), sum(cells_supp) FROM civica_exec.exec_edu_trn_cov GROUP BY year, lvl
    UNION ALL SELECT 'inse', year, lvl, sum(rows_in), sum(valid), sum(rejected), sum(no_identity), sum(cells_num), sum(cells_supp) FROM civica_exec.exec_edu_inse_cov GROUP BY year, lvl ORDER BY 1, 2, 3`);
  await writeFile(outCsv!, 'familia,edicao,nivel,linhas_lidas,linhas_validas,rejeitadas,sem_identidade_escolar,celulas_publicadas,celulas_suprimidas\n' + cov.map(r => [r.fam, r.year, r.lvl === 1 ? 'escola' : 'territorio', r.rows_in, r.valid, r.rejected, r.no_identity, r.cells_num, r.cells_supp].join(',')).join('\n') + '\n');
  res.issues = issues; await writeFile(outJson!, JSON.stringify(res, null, 1)); console.log(JSON.stringify({ issues: issues.length, first: issues.slice(0, 12), nxp: [res.exec_edu_ideb_school_NxP, res.exec_edu_ideb_terr_NxP], saebLevelSum: res.saebLevelSum }));
} finally { await pool.end(); }
