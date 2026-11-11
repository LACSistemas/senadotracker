import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadToD, parseAnexoIVA, parseAnexoIVB, fetchExecucaoOrcamentariaUrl, extractPdfText, parseExecucaoOrcamentaria, parseContratadosPagos, type PersonnelRow, type FinanceRow, type SupplierPaymentRow } from '../../apps/collector/src/judiciary-tjsp.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjsp');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjsp');
const PES_REVISION_ID = 'p1429-tjsp-personnel-20261110';
const FIN_REVISION_ID = 'p1429-tjsp-finance-20261110';
const PARSER = 'p14.29-tjsp-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "Data de referência: 08/2026", confirmado ao vivo nos 2 PDFs (último mês publicado)
const ANEXO_I_PERIOD = { year: 2026, month: 9 }; // REO traz o ano inteiro em colunas; Set/2026 é o último mês com dado real (Out-Dez ainda zerados)
const ANEXO_I_MONTH_INDEX = 8; // Jan=0..Set=8
const CONTRATADOS_YEAR = 2026;

const IVA_URL = 'https://www.tjsp.jus.br/Download/Portal/CanaisComunicacao/Transparencia/ResCNJ102_Default/Anexo04a/rescnj215anexo04a202608.pdf';
const IVB_URL = 'https://www.tjsp.jus.br/Download/Portal/CanaisComunicacao/Transparencia/ResCNJ102_Default/Anexo04b/rescnj215anexo04b202608.pdf';
const CONTRATADOS_URL = `https://www.tjsp.jus.br/Download/Transparencia/Licitacoes/Contratados_Pagos_${CONTRATADOS_YEAR}.xlsx`;

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function insertSnapshot(c: import('pg').PoolClient, s: SnapshotMeta): Promise<string> {
  const existing = (await c.query(`SELECT snapshot_id FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE snapshot_id=$1`, [s.snapshotId])).rows[0]?.snapshot_id;
  if (existing) return existing;
  await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0,'ACQUIRED','{}'::jsonb)`,
    [s.snapshotId, s.provider, s.resourceName, s.sourceUrl, s.fetchedAt, s.httpStatus, s.contentType, s.bytes, s.sha256, s.rawPath, PARSER, s.sourceRows, s.parsedRows]);
  return s.snapshotId;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const tjspId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJSP'`)).rows[0]?.tribunal_id;
  if (!tjspId) throw new Error('TJSP tribunal missing from jud_tribunal');

  const ivaDl = await downloadToD(IVA_URL, PES_DIR, `anexo-iv-a-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.pdf`);
  const ivbDl = await downloadToD(IVB_URL, PES_DIR, `anexo-iv-b-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.pdf`);
  const personnelRows: PersonnelRow[] = [...await parseAnexoIVA(ivaDl.path), ...await parseAnexoIVB(ivbDl.path)];
  if (!personnelRows.length) throw new Error('Anexo IV TJSP sem linhas reconhecidas — parser pode ter quebrado no layout real');

  const reoUrl = await fetchExecucaoOrcamentariaUrl(ANEXO_I_PERIOD.year);
  const reoDl = await downloadToD(reoUrl, FIN_DIR, `reo-${ANEXO_I_PERIOD.year}.pdf`);
  const reoText = await extractPdfText(reoDl.path);
  const financeRows: FinanceRow[] = parseExecucaoOrcamentaria(reoText, ANEXO_I_MONTH_INDEX);
  if (!financeRows.length) throw new Error('REO TJSP sem linhas reconhecidas');

  const contratadosDl = await downloadToD(CONTRATADOS_URL, FIN_DIR, `contratados-pagos-${CONTRATADOS_YEAR}.xlsx`);
  const supplierRowsRaw: SupplierPaymentRow[] = parseContratadosPagos(readFileSync(contratadosDl.path));
  if (!supplierRowsRaw.length) throw new Error('Contratados Pagos TJSP sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, { snapshotId: `TJSP:ANEXO_IVA:${ivaDl.sha256.slice(0, 40)}`, provider: 'TJSP', resourceName: path.basename(ivaDl.path), sourceUrl: IVA_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/pdf', bytes: ivaDl.bytes, sha256: ivaDl.sha256, rawPath: ivaDl.path, sourceRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length, parsedRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length });
    const ivbSnap = await insertSnapshot(c, { snapshotId: `TJSP:ANEXO_IVB:${ivbDl.sha256.slice(0, 40)}`, provider: 'TJSP', resourceName: path.basename(ivbDl.path), sourceUrl: IVB_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/pdf', bytes: ivbDl.bytes, sha256: ivbDl.sha256, rawPath: ivbDl.path, sourceRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length, parsedRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length });
    const reoSnap = await insertSnapshot(c, { snapshotId: `TJSP:REO:${reoDl.sha256.slice(0, 40)}`, provider: 'TJSP', resourceName: path.basename(reoDl.path), sourceUrl: reoUrl, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/pdf', bytes: reoDl.bytes, sha256: reoDl.sha256, rawPath: reoDl.path, sourceRows: financeRows.length, parsedRows: financeRows.length });
    const contratadosSnap = await insertSnapshot(c, { snapshotId: `TJSP:CONTRATADOS:${contratadosDl.sha256.slice(0, 40)}`, provider: 'TJSP', resourceName: path.basename(contratadosDl.path), sourceUrl: CONTRATADOS_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: contratadosDl.bytes, sha256: contratadosDl.sha256, rawPath: contratadosDl.path, sourceRows: supplierRowsRaw.length, parsedRows: supplierRowsRaw.length });

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjsp: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJSP', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjspId]);
      for (const r of personnelRows) {
        const id = `TJSP:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        const snap = r.sourceAnnex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJSP',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjspId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJSP (PDF), ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — REO (resumo 4 categorias) + Contratados Pagos
    const semanticFin = sha(JSON.stringify({ tjsp: { financeRows, supplierRowsRaw } }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([reoSnap, contratadosSnap]), semanticFin, financeRows.length + supplierRowsRaw.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJSP', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjspId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjspId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjspId]);
      }
      for (const r of financeRows) {
        const id = `TJSP:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJSP',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjspId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, reoSnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Relatório da Execução Orçamentária TJSP (REO, PDF) — resumo CNJ 4 categorias' })]);
      }
      for (const r of supplierRowsRaw) {
        const id = `TJSP:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,supplier_name,supplier_cnpj,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJSP',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [id, FIN_REVISION_ID, tjspId, CONTRATADOS_YEAR, r.month, r.supplierName, r.supplierCnpj, r.expenseDescription, Math.round(r.amountReais * 100), contratadosSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Relação de Contratados Pagos TJSP (XLSX, aba CNPJ_Natureza da Despesa) — CPF de pessoa física já mascarado pela própria fonte' })]);
      }
      const monthsPresent = [...new Set(supplierRowsRaw.map(r => r.month))].sort((a, b) => a - b);
      const firstPeriod = `${CONTRATADOS_YEAR}-${String(monthsPresent[0]).padStart(2, '0')}`;
      const lastPeriod = `${CONTRATADOS_YEAR}-${String(monthsPresent[monthsPresent.length - 1]).padStart(2, '0')}`;
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJSP', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Relatório da Execução Orçamentária (REO), publicação mensal cumulativa (ano inteiro em colunas, só a coluna do mês de referência é usada) — só as 7 linhas do resumo final (padrão Inciso I-IV: Pessoal/Outras Despesas Correntes/Investimentos/Inversões Financeiras + 3 linhas deduzidas de Outras Despesas Correntes). As ~218 linhas de item individual (Natureza de Despesa) ficam de fora: sem código de classificação visível, têm hierarquia pai/filho não desambiguável com segurança (risco real de dupla contagem). Relatório é só de despesas — sem receita.'],
        ['TJSP', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', firstPeriod, lastPeriod, supplierRowsRaw.length, `Relação de Contratados Pagos, acumulado ${firstPeriod}..${lastPeriod}, por CNPJ/CPF × natureza de despesa × mês. CPF de pessoa física já vem mascarado pela própria fonte (ex. "***.***.878-**") — nunca armazenado em claro. Camada de Ordem Bancária individual (pagamento a pagamento, com texto livre de justificativa) existe na fonte mas fica fora de escopo (granularidade muito acima do padrão desta série, risco de texto livre incidental).`],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJSP:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIVA: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length }, anexoIVB: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length }, reo: { rows: financeRows.length, total: financeRows.reduce((s, r) => s + r.amountReais, 0) }, contratados: { rows: supplierRowsRaw.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
