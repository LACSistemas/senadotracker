import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';

/**
 * Relatórios do cadastro de escolas publicado (P10.1), somente leitura. EXEC_DATABASE_URL aponta para banco de teste quando definido.
 *   npx tsx scripts/exec/educacao-report.ts <pasta_saida> <pasta_sinopse_json>
 * Gera COBERTURA_ESCOLAS_2007_2025.csv (edição × UF), TRANSICOES_ESCOLARES.csv (edição × UF × tipo de mudança) e transicoes_resumo.json (números para as perguntas do relatório).
 * Mudança = diferença entre a escola em edições CONSECUTIVAS publicadas; "ausente" = edição publicada, entre a primeira e a última presença da escola, em que ela não consta.
 */
const [outDir, sinopseDir] = process.argv.slice(2);
if (!outDir || !sinopseDir) throw new Error('uso: educacao-report.ts <pasta_saida> <pasta_sinopse_json>');
const pool = openPool(2);
const UF_NAME: Record<number, string> = { 11: 'Rondônia', 12: 'Acre', 13: 'Amazonas', 14: 'Roraima', 15: 'Pará', 16: 'Amapá', 17: 'Tocantins', 21: 'Maranhão', 22: 'Piauí', 23: 'Ceará', 24: 'Rio Grande do Norte', 25: 'Paraíba', 26: 'Pernambuco', 27: 'Alagoas', 28: 'Sergipe', 29: 'Bahia', 31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 41: 'Paraná', 42: 'Santa Catarina', 43: 'Rio Grande do Sul', 50: 'Mato Grosso do Sul', 51: 'Mato Grosso', 52: 'Goiás', 53: 'Distrito Federal' };
const csv = (rows: Array<Record<string, unknown>>) => rows.length ? [Object.keys(rows[0]!).join(','), ...rows.map(r => Object.values(r).map(v => v == null ? '' : String(v)).join(','))].join('\n') + '\n' : '';
try {
  const pub = (await pool.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_cov ORDER BY year`)).rows.map(r => Number(r.year));
  // transições entre edições publicadas consecutivas (rank denso sobre as edições publicadas)
  const trans = (await pool.query(`
    WITH pub AS (SELECT year, dense_rank() OVER (ORDER BY year) rk FROM (SELECT DISTINCT year FROM civica_exec.exec_edu_cov) x),
    y AS (SELECT s.inep, s.year, p.rk, s.entity_id, s.name, s.dep, s.loc, s.sit, e.uf_code FROM civica_exec.exec_edu_school_year s JOIN pub p USING (year) JOIN civica_exec.exec_entity e ON e.entity_id = s.entity_id),
    l AS (SELECT y.*, lag(rk) OVER w prk, lag(name) OVER w pname, lag(entity_id) OVER w pent, lag(dep) OVER w pdep, lag(loc) OVER w ploc, lag(sit) OVER w psit, lag(uf_code) OVER w puf, lag(year) OVER w pyear FROM y WINDOW w AS (PARTITION BY inep ORDER BY year))
    SELECT year, uf_code uf, count(*)::int rows,
      count(*) FILTER (WHERE prk IS NULL)::int first_appearance,
      count(*) FILTER (WHERE prk = rk - 1 AND pname <> name)::int name_change,
      count(*) FILTER (WHERE prk = rk - 1 AND pent <> entity_id)::int municipality_change,
      count(*) FILTER (WHERE prk = rk - 1 AND pdep <> dep)::int dependency_change,
      count(*) FILTER (WHERE prk = rk - 1 AND ploc IS DISTINCT FROM loc)::int location_change,
      count(*) FILTER (WHERE prk = rk - 1 AND psit <> sit)::int situation_change,
      count(*) FILTER (WHERE prk IS NOT NULL AND prk < rk - 1)::int reappeared_after_absence
    FROM l GROUP BY year, uf_code ORDER BY year, uf_code`)).rows;
  // ausências: edição publicada entre duas presenças consecutivas da escola, atribuída à UF do último registro anterior
  const absent = (await pool.query(`
    WITH pub AS (SELECT year, dense_rank() OVER (ORDER BY year) rk FROM (SELECT DISTINCT year FROM civica_exec.exec_edu_cov) x),
    y AS (SELECT s.inep, s.year, p.rk, e.uf_code FROM civica_exec.exec_edu_school_year s JOIN pub p USING (year) JOIN civica_exec.exec_entity e ON e.entity_id = s.entity_id),
    l AS (SELECT inep, year, rk, lag(rk) OVER w prk, lag(uf_code) OVER w puf FROM y WINDOW w AS (PARTITION BY inep ORDER BY year))
    SELECT pb.year, l.puf uf, count(*)::int absent FROM l JOIN pub pb ON pb.rk > l.prk AND pb.rk < l.rk WHERE l.prk < l.rk - 1 GROUP BY pb.year, l.puf ORDER BY pb.year, l.puf`)).rows;
  const absentBy = new Map(absent.map(r => [`${r.year}/${r.uf}`, Number(r.absent)]));
  const cov = (await pool.query(`SELECT year, uf, layout, rows_in, valid, rejected, active, with_mat, univ, muns FROM civica_exec.exec_edu_cov ORDER BY year, uf`)).rows;
  const sin = new Map<number, { ufs: Record<string, { E?: number }> }>();
  for (const y of pub) { try { sin.set(y, JSON.parse(await readFile(join(sinopseDir, `estab_${y}.json`), 'utf8'))); } catch { /* edição sem Sinopse extraída */ } }
  const tBy = new Map(trans.map(r => [`${r.year}/${r.uf}`, r]));
  const rows = cov.map(c => {
    const t = tBy.get(`${c.year}/${c.uf}`) ?? {}; const s = sin.get(Number(c.year))?.ufs[UF_NAME[Number(c.uf)]!]?.E; const first = Number(c.year) === pub[0];
    const sd = s == null ? null : Number(c.univ) - s;
    return {
      ano: c.year, uf: c.uf, uf_nome: UF_NAME[Number(c.uf)], layout: c.layout, escolas_no_arquivo: c.rows_in, codigos_unicos_validos: c.valid, rejeitadas: c.rejected, ativas_conforme_fonte: c.active, com_matricula: c.with_mat, recorte_ativa_com_matricula: c.univ,
      sinopse_estabelecimentos: s ?? '', diferenca_recorte_menos_sinopse: sd ?? '', ausentes_na_edicao_entre_presencas: absentBy.get(`${c.year}/${c.uf}`) ?? 0, identidades_novas: first ? 'baseline_primeira_edicao' : (t.first_appearance ?? 0), mudancas_de_nome: first ? '' : (t.name_change ?? 0),
      mudancas_de_municipio: first ? '' : (t.municipality_change ?? 0), mudancas_de_dependencia: first ? '' : (t.dependency_change ?? 0), mudancas_de_situacao: first ? '' : (t.situation_change ?? 0), reapareceram_apos_ausencia: first ? '' : (t.reappeared_after_absence ?? 0), municipios_cobertos: c.muns,
      divergencias: sd == null ? (Number(c.rejected) ? `${c.rejected} rejeitadas` : 'sem_sinopse_extraida') : (sd === 0 && Number(c.rejected) === 0 ? 0 : `dif_sinopse=${sd};rejeitadas=${c.rejected}`),
      status: sd == null ? 'PUBLICADO_SEM_CONFERENCIA_SINOPSE' : sd === 0 ? 'PUBLICADO_RECONCILIADO_SINOPSE' : 'PUBLICADO_COM_DIVERGENCIA',
    };
  });
  await writeFile(join(outDir, 'COBERTURA_ESCOLAS_2007_2025.csv'), csv(rows));
  await writeFile(join(outDir, 'TRANSICOES_ESCOLARES.csv'), csv(trans.map(t => ({ ano: t.year, uf: t.uf, uf_nome: UF_NAME[Number(t.uf)], escolas_na_edicao: t.rows, primeira_aparicao: Number(t.year) === pub[0] ? 'baseline_primeira_edicao' : t.first_appearance,
    mudou_nome: Number(t.year) === pub[0] ? '' : t.name_change, mudou_municipio: Number(t.year) === pub[0] ? '' : t.municipality_change, mudou_dependencia: Number(t.year) === pub[0] ? '' : t.dependency_change, mudou_localizacao: Number(t.year) === pub[0] ? '' : t.location_change,
    mudou_situacao: Number(t.year) === pub[0] ? '' : t.situation_change, reapareceu_apos_ausencia: Number(t.year) === pub[0] ? '' : t.reappeared_after_absence }))));
  // números para as perguntas
  const one = async (sql: string) => (await pool.query(sql)).rows[0] as Record<string, unknown>;
  const summary = {
    at: new Date().toISOString(), publishedEditions: pub,
    distinctSchools: Number((await one(`SELECT count(*)::int n FROM civica_exec.exec_edu_school`)).n),
    snapshots: Number((await one(`SELECT count(*)::int n FROM civica_exec.exec_edu_school_year`)).n),
    schoolsLatestEdition: (await pool.query(`SELECT year, count(*)::int n FROM civica_exec.exec_edu_school_year WHERE year = $1 GROUP BY year`, [pub.at(-1)])).rows[0],
    changes: await one(`
      WITH pub AS (SELECT year, dense_rank() OVER (ORDER BY year) rk FROM (SELECT DISTINCT year FROM civica_exec.exec_edu_cov) x),
      y AS (SELECT s.inep, p.rk, s.entity_id, s.name, s.dep, s.loc, s.sit FROM civica_exec.exec_edu_school_year s JOIN pub p USING (year)),
      l AS (SELECT y.*, lag(rk) OVER w prk, lag(name) OVER w pname, lag(entity_id) OVER w pent, lag(dep) OVER w pdep, lag(loc) OVER w ploc, lag(sit) OVER w psit FROM y WINDOW w AS (PARTITION BY inep ORDER BY rk))
      SELECT count(*) FILTER (WHERE prk = rk - 1 AND pname <> name)::int name_events, count(DISTINCT inep) FILTER (WHERE prk = rk - 1 AND pname <> name)::int schools_changed_name,
             count(*) FILTER (WHERE prk = rk - 1 AND pent <> entity_id)::int municipality_events, count(DISTINCT inep) FILTER (WHERE prk = rk - 1 AND pent <> entity_id)::int schools_changed_municipality,
             count(*) FILTER (WHERE prk = rk - 1 AND pdep <> dep)::int dependency_events, count(DISTINCT inep) FILTER (WHERE prk = rk - 1 AND pdep <> dep)::int schools_changed_dependency,
             count(*) FILTER (WHERE prk = rk - 1 AND ploc IS DISTINCT FROM loc)::int location_events, count(*) FILTER (WHERE prk = rk - 1 AND psit <> sit)::int situation_events,
             count(DISTINCT inep) FILTER (WHERE prk < rk - 1)::int schools_reappeared_after_absence, count(*) FILTER (WHERE prk < rk - 1)::int reappearance_events FROM l`),
    schoolsWithAnyChange: Number((await one(`
      WITH pub AS (SELECT year, dense_rank() OVER (ORDER BY year) rk FROM (SELECT DISTINCT year FROM civica_exec.exec_edu_cov) x),
      y AS (SELECT s.inep, p.rk, s.entity_id, s.name, s.dep FROM civica_exec.exec_edu_school_year s JOIN pub p USING (year)),
      l AS (SELECT y.*, lag(rk) OVER w prk, lag(name) OVER w pname, lag(entity_id) OVER w pent, lag(dep) OVER w pdep FROM y WINDOW w AS (PARTITION BY inep ORDER BY rk))
      SELECT count(DISTINCT inep)::int n FROM l WHERE prk = rk - 1 AND (pname <> name OR pent <> entity_id OR pdep <> dep)`)).n),
    rowsByYear: (await pool.query(`SELECT year, sum(rows_in)::int rows_in, sum(valid)::int valid, sum(rejected)::int rejected, sum(active)::int active, sum(with_mat)::int with_mat, sum(univ)::int univ FROM civica_exec.exec_edu_cov GROUP BY year ORDER BY year`)).rows,
    statusByYear: Object.fromEntries(pub.map(y => [y, rows.filter(r => Number(r.ano) === y).every(r => r.status === 'PUBLICADO_RECONCILIADO_SINOPSE') ? 'RECONCILIADO_SINOPSE' : rows.some(r => Number(r.ano) === y && r.status === 'PUBLICADO_COM_DIVERGENCIA') ? 'COM_DIVERGENCIA' : 'SEM_CONFERENCIA_SINOPSE'])),
  };
  await writeFile(join(outDir, 'transicoes_resumo.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ coverageRows: rows.length, transitionRows: trans.length, distinctSchools: summary.distinctSchools, snapshots: summary.snapshots, statusByYear: summary.statusByYear }));
} finally { await pool.end(); }
