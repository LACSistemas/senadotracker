import { writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

/** Números do relatório da P10.4 (somente leitura): cobertura por família × edição × granularidade, Saeb 2025, rede/etapa, escolas e territórios. EXEC_DATABASE_URL aponta o banco avaliado. */
const out = process.argv[2]!; const pool = openPool(2);
const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v])));
try {
  const res: Record<string, unknown> = { at: new Date().toISOString() };
  // Ideb: escolas / municípios (rede pública) / UFs / regiões / Brasil com valor, por edição × etapa
  res.idebEscolas = await q(`SELECT year, stage, count(*) FILTER (WHERE ideb IS NOT NULL)::int com_ideb, count(*)::int linhas, count(*) FILTER (WHERE meta IS NOT NULL)::int com_meta FROM civica_exec.exec_edu_ideb_school GROUP BY year, stage ORDER BY year, stage`);
  res.idebMunicipiosPublica = await q(`SELECT t.year, t.stage, count(*) FILTER (WHERE t.ideb IS NOT NULL)::int com_ideb FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 AND t.dep = 5 GROUP BY 1, 2 ORDER BY 1, 2`);
  res.idebMunicipiosQualquerRede = await q(`SELECT t.year, t.stage, count(DISTINCT t.entity_id) FILTER (WHERE t.ideb IS NOT NULL)::int municipios FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 GROUP BY 1, 2 ORDER BY 1, 2`);
  res.idebUfRegiaoBrasil = await q(`SELECT t.year, t.stage, e.kind, count(DISTINCT t.entity_id) FILTER (WHERE t.ideb IS NOT NULL)::int territorios FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind IN (1, 2, 3) AND t.dep = 0 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`);
  res.idebBrasilTotal = await q(`SELECT year, stage, ideb, meta, round(nota_media::numeric, 3) n, round(p::numeric, 4) p FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 1 AND t.dep = 0 ORDER BY year, stage`);
  // Saeb
  res.saebPorEdicao = await q(`SELECT year, count(*)::int linhas, count(DISTINCT grade)::int series, count(DISTINCT subj)::int disciplinas, count(*) FILTER (WHERE media IS NOT NULL)::int com_media, count(*) FILTER (WHERE nv0 IS NOT NULL OR nv1 IS NOT NULL)::int com_niveis FROM civica_exec.exec_edu_saeb_terr GROUP BY year ORDER BY year`);
  res.saeb2025SerieDisciplina = await q(`SELECT s.grade, s.subj, count(*)::int linhas, count(DISTINCT s.entity_id)::int territorios, count(*) FILTER (WHERE s.media IS NOT NULL)::int com_media FROM civica_exec.exec_edu_saeb_terr s WHERE s.year = 2025 GROUP BY 1, 2 ORDER BY 1, 2`);
  res.saeb2025Brasil = await q(`SELECT s.grade, s.subj, round(s.media / 100.0, 2) media FROM civica_exec.exec_edu_saeb_terr s JOIN civica_exec.exec_entity e USING (entity_id) WHERE s.year = 2025 AND e.kind = 1 AND s.dep = 0 AND s.loc = 0 AND s.cap = 0 AND s.subj IN (1, 2) ORDER BY 1, 2`);
  res.saebAlfabetizacao = await q(`SELECT year, count(*) FILTER (WHERE tx_alf IS NOT NULL)::int linhas FROM civica_exec.exec_edu_saeb_terr GROUP BY year ORDER BY year`);
  // Fluxo
  res.fluxoEscolas = await q(`SELECT year, count(*)::int escolas, count(ap_fun)::int com_aprovacao_fund, count(td_fun)::int com_distorcao_fund, count(ap_med)::int com_aprovacao_medio FROM civica_exec.exec_edu_flow_school GROUP BY year ORDER BY year`);
  res.fluxoTerritorios = await q(`SELECT f.year, count(DISTINCT f.entity_id) FILTER (WHERE e.kind = 4)::int municipios, count(DISTINCT f.entity_id) FILTER (WHERE e.kind = 3)::int ufs, count(DISTINCT f.entity_id) FILTER (WHERE e.kind IN (1, 2))::int brasil_regioes, count(*)::int linhas FROM civica_exec.exec_edu_flow_terr f JOIN civica_exec.exec_entity e USING (entity_id) GROUP BY 1 ORDER BY 1`);
  res.brasilFluxo = await q(`SELECT f.year, round(f.ap_fun / 100.0, 1) ap_fund, round(f.rp_fun / 100.0, 1) rp_fund, round(f.ab_fun / 100.0, 1) ab_fund, round(f.td_fun / 100.0, 1) td_fund, round(f.ap_med / 100.0, 1) ap_med, round(f.td_med / 100.0, 1) td_med FROM civica_exec.exec_edu_flow_terr f JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 1 AND f.loc = 0 AND f.dep = 0 ORDER BY 1`);
  res.transicaoTerritorios = await q(`SELECT t.year, count(DISTINCT t.entity_id) FILTER (WHERE e.kind = 4)::int municipios, count(DISTINCT t.entity_id) FILTER (WHERE e.kind = 3)::int ufs, count(*)::int linhas FROM civica_exec.exec_edu_trn_terr t JOIN civica_exec.exec_entity e USING (entity_id) GROUP BY 1 ORDER BY 1`);
  res.brasilTransicao = await q(`SELECT t.year, round(t.pro_fun / 100.0, 1) pro, round(t.rep_fun / 100.0, 1) rep, round(t.eva_fun / 100.0, 1) eva, round(t.mej_fun / 100.0, 1) mej FROM civica_exec.exec_edu_trn_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 1 AND t.loc = 0 AND t.dep = 0 ORDER BY 1`);
  res.inse = await q(`SELECT year, count(*)::int escolas, round(avg(media) / 10000.0, 3) media_das_medias_escola FROM civica_exec.exec_edu_inse_school GROUP BY year ORDER BY year`);
  res.inseTerritorios = await q(`SELECT i.year, count(DISTINCT i.entity_id) FILTER (WHERE e.kind = 4)::int municipios, count(DISTINCT i.entity_id) FILTER (WHERE e.kind = 3)::int ufs FROM civica_exec.exec_edu_inse_terr i JOIN civica_exec.exec_entity e USING (entity_id) GROUP BY 1 ORDER BY 1`);
  // Escolas distintas por família e identidade
  res.escolasDistintas = (await q(`SELECT (SELECT count(DISTINCT inep) FROM civica_exec.exec_edu_ideb_school)::int ideb, (SELECT count(DISTINCT inep) FROM civica_exec.exec_edu_flow_school)::int fluxo, (SELECT count(DISTINCT inep) FROM civica_exec.exec_edu_inse_school)::int inse, (SELECT count(*) FROM civica_exec.exec_edu_school)::int cadastro`))[0];
  res.ideb2005Escolas = (await q(`SELECT count(*) FILTER (WHERE ideb IS NOT NULL)::int com_ideb, count(*)::int linhas FROM civica_exec.exec_edu_ideb_school WHERE year = 2005`))[0];
  // sigilo
  res.celulasSuprimidas = await q(`SELECT 'transicao' fam, sum(cells_supp)::int n FROM civica_exec.exec_edu_trn_cov UNION ALL SELECT 'fluxo', sum(cells_supp)::int FROM civica_exec.exec_edu_flow_cov UNION ALL SELECT 'ideb', sum(cells_supp)::int FROM civica_exec.exec_edu_ideb_cov UNION ALL SELECT 'saeb', sum(cells_supp)::int FROM civica_exec.exec_edu_saeb_cov UNION ALL SELECT 'inse', sum(cells_supp)::int FROM civica_exec.exec_edu_inse_cov`);
  res.publicacoes = await q(`SELECT dataset_id, count(*)::int fatias FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 75 AND 79 GROUP BY 1 ORDER BY 1`);
  await writeFile(out, JSON.stringify(res, null, 1)); console.log('ok', Object.keys(res).length);
} finally { await pool.end(); }
