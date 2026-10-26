import { writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

/** Números finais da P10.7 (somente leitura) + CSV de cobertura. npx tsx scripts/exec/edu-results.ts <results_banco.json> <cobertura.csv> */
const [out, csv] = process.argv.slice(2); const pool = openPool(2); const q = async (s: string) => (await pool.query(s)).rows;
try {
  const R: Record<string, unknown> = {};
  R.por_ano = await q(`SELECT year, count(*)::int contratos, coalesce(sum(valor_global) FILTER (WHERE NOT outlier),0)::bigint centavos, count(*) FILTER (WHERE outlier)::int outliers FROM civica_exec.exec_edu_contract WHERE best_confidence <= 2 GROUP BY year ORDER BY year`);
  R.por_categoria = await q(`SELECT k.category, count(*)::int contratos, coalesce(sum(k.valor) FILTER (WHERE NOT k.outlier),0)::bigint centavos FROM civica_exec.exec_edu_contract_class k WHERE k.confidence <= 2 GROUP BY 1 ORDER BY 1`);
  R.por_confianca = await q(`SELECT best_confidence, count(*)::int contratos, coalesce(sum(valor_global) FILTER (WHERE NOT outlier),0)::bigint centavos FROM civica_exec.exec_edu_contract GROUP BY 1 ORDER BY 1`);
  R.municipios_com_contrato = (await q(`SELECT count(DISTINCT entity_id)::int n FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4`))[0].n;
  R.ufs_com_contrato = (await q(`SELECT count(DISTINCT uf)::int n FROM civica_exec.exec_edu_contract WHERE uf > 0`))[0].n;
  R.fornecedores_pj = (await q(`SELECT count(DISTINCT supplier)::int n FROM civica_exec.exec_edu_contract WHERE supplier IS NOT NULL`))[0].n;
  R.orgaos = (await q(`SELECT count(DISTINCT org_cnpj)::int n FROM civica_exec.exec_edu_contract`))[0].n;
  R.contratos_pf_sem_fornecedor = (await q(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract WHERE supplier IS NULL`))[0].n;
  R.compras = (await q(`SELECT count(*)::int n, count(*) FILTER (WHERE sigiloso)::int sigilosas, coalesce(sum(valor_estimado),0)::bigint est, coalesce(sum(valor_homologado),0)::bigint hom FROM civica_exec.exec_edu_procurement`))[0];
  R.termos = (await q(`SELECT count(*)::int n, count(DISTINCT pncp_id)::int contratos FROM civica_exec.exec_edu_contract_term`))[0];
  R.obras = await q(`SELECT situacao, count(*)::int n, count(*) FILTER (WHERE valor_previsto IS NOT NULL)::int com_valor, count(*) FILTER (WHERE valor_placeholder)::int placeholder, count(*) FILTER (WHERE edu_basis IN (3,4))::int com_contrato_cipi FROM civica_exec.exec_edu_work GROUP BY 1 ORDER BY 2 DESC`);
  R.obras_por_uf = await q(`SELECT uf, count(*)::int n FROM civica_exec.exec_edu_work GROUP BY 1 ORDER BY 1`);
  R.contratos_cipi = (await q(`SELECT count(*)::int n, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM civica_exec.exec_edu_work w WHERE w.work_id = c.cipi))::int com_obra FROM civica_exec.exec_edu_contract c WHERE cipi IS NOT NULL`))[0];
  R.top_fornecedores = await q(`SELECT lpad(c.supplier::text, 14, '0') cnpj, s.name, count(*)::int contratos, sum(c.valor_global) FILTER (WHERE NOT c.outlier)::bigint centavos FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_fin_supplier s ON s.cnpj = c.supplier WHERE c.best_confidence <= 2 GROUP BY 1, 2 ORDER BY 4 DESC NULLS LAST LIMIT 5`);
  R.casos = await q(`SELECT e.name, e.ibge7, count(*)::int contratos, coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier),0)::bigint centavos FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_entity e USING (entity_id) WHERE c.best_confidence <= 2 AND e.ibge7 IN (3205309, 3205002, 3200359, 3550308, 3304557, 3106200, 2611606) GROUP BY 1, 2 ORDER BY 2`);
  const cov = await q(`SELECT kind, year, uf, rows_in, rows_out, rejected, no_value, pending FROM civica_exec.exec_edu_ctr_cov ORDER BY kind, year, uf`);
  const KIND: Record<number, string> = { 1: 'contratos PNCP', 2: 'compras PNCP', 3: 'termos PNCP', 4: 'obras Obrasgov' };
  await writeFile(csv!, 'fonte,ano,uf_codigo,lidos_ou_esperados,publicados,rejeitados,sem_valor,pendentes_de_coleta,situacao\n' + cov.map(r => `${KIND[r.kind]},${r.year},${r.uf},${r.rows_in},${r.rows_out},${r.rejected},${r.no_value},${r.pending},${r.pending > 0 ? 'PARTIAL' : 'COMPLETE_NA_FATIA'}`).join('\n') + '\n');
  await writeFile(out!, JSON.stringify(R, (_, v) => typeof v === 'bigint' ? Number(v) : v, 1)); console.log('ok');
} finally { await pool.end(); }
