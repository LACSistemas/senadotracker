import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadToD, parseAnexoIVA, parseAnexoIVB, parseAnexoIVE, parseAnexoI, parseContratados, type PersonnelRow, type FinanceRow, type SupplierPaymentRow } from '../../apps/collector/src/judiciary-tjpa.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjpa');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjpa');
const PES_REVISION_ID = 'p1424-tjpa-personnel-20261110';
const FIN_REVISION_ID = 'p1424-tjpa-finance-20261110';
const PARSER = 'p14.24-tjpa-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "TJPA - ANEXO IV ... Agosto de 2026", confirmado ao vivo
const ANEXO_I_PERIOD = { year: 2026, month: 9 }; // "Mês de Referência: Setembro de 2026", confirmado ao vivo no próprio arquivo

// URLs reais descobertas via navegação ao vivo (CMS institucional, link só identificável pelo TEXTO "XLS/CSV/PDF", não pela URL)
const ANEXO_IV_URL = 'https://www.tjpa.jus.br/CMSPortal/VisualizarArquivo?idArquivo=2278707';
const ANEXO_I_URL = 'https://www.tjpa.jus.br/CMSPortal/VisualizarArquivo?idArquivo=2282733';
const CONTRATADOS_URL = 'https://www.tjpa.jus.br/CMSPortal/VisualizarArquivo?idArquivo=2279688';

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJPA:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
}
async function insertSnapshot(c: import('pg').PoolClient, s: SnapshotMeta): Promise<string> {
  const existing = (await c.query(`SELECT snapshot_id FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE sha256=$1`, [s.sha256])).rows[0]?.snapshot_id;
  if (existing) return existing;
  await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0,'ACQUIRED','{}'::jsonb)`,
    [s.snapshotId, s.provider, s.resourceName, s.sourceUrl, s.fetchedAt, s.httpStatus, s.contentType, s.bytes, s.sha256, s.rawPath, PARSER, s.sourceRows, s.parsedRows]);
  return s.snapshotId;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const tjpaId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJPA'`)).rows[0]?.tribunal_id;
  if (!tjpaId) throw new Error('TJPA tribunal missing from jud_tribunal');

  const ivDl = await downloadToD(ANEXO_IV_URL, PES_DIR, `anexo-iv-completo-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.xls`);
  const anexoIDl = await downloadToD(ANEXO_I_URL, FIN_DIR, `anexo-i-${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}.xls`);
  const contratadosDl = await downloadToD(CONTRATADOS_URL, FIN_DIR, `contratados-${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}.xls`);

  const personnelRows: PersonnelRow[] = [...await parseAnexoIVA(ivDl.path), ...await parseAnexoIVB(ivDl.path), ...await parseAnexoIVE(ivDl.path)];
  const financeRows: FinanceRow[] = await parseAnexoI(anexoIDl.path);
  const supplierRowsRaw: SupplierPaymentRow[] = await parseContratados(contratadosDl.path);
  if (!personnelRows.length) throw new Error('Anexo IV TJPA sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!financeRows.length) throw new Error('Anexo I TJPA sem linhas reconhecidas');
  if (!supplierRowsRaw.length) throw new Error('Contratados TJPA sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivSnap = await insertSnapshot(c, await snapshotMeta(ivDl, 'TJPA', ANEXO_IV_URL, personnelRows.length, personnelRows.length));
    const anexoISnap = await insertSnapshot(c, await snapshotMeta(anexoIDl, 'TJPA', ANEXO_I_URL, financeRows.length, financeRows.length));
    const contratadosSnap = await insertSnapshot(c, await snapshotMeta(contratadosDl, 'TJPA', CONTRATADOS_URL, supplierRowsRaw.length, supplierRowsRaw.length));

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjpa: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJPA', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjpaId]);
      for (const r of personnelRows) {
        const id = `TJPA:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPA',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjpaId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, ivSnap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJPA (xls), alínea ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — Anexo I + fornecedores
    const semanticFin = sha(JSON.stringify({ tjpa: { financeRows, supplierRowsRaw } }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap, contratadosSnap]), semanticFin, financeRows.length + supplierRowsRaw.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJPA', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpaId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpaId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpaId]);
      }
      for (const r of financeRows) {
        const id = `TJPA:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPA',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjpaId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJPA (xls)' })]);
      }
      for (const r of supplierRowsRaw) {
        const id = `TJPA:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,supplier_name,supplier_cnpj,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPA',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [id, FIN_REVISION_ID, tjpaId, 2026, r.month, r.supplierName, r.supplierCnpj, r.expenseDescription, Math.round(r.amountReais * 100), contratadosSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Valores Pagos aos Contratados TJPA (xls, formato largo por mês; CPF de pessoa física nunca armazenado, nem mascarado)' })]);
      }
      const monthsPresent = [...new Set(supplierRowsRaw.map(r => r.month))].sort((a, b) => a - b);
      const firstPeriod = `2026-${String(monthsPresent[0]).padStart(2, '0')}`;
      const lastPeriod = `2026-${String(monthsPresent[monthsPresent.length - 1]).padStart(2, '0')}`;
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJPA', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Anexo I por inciso/alínea, publicação mensal — categorias de despesa, não o valor pago a cada fornecedor individualmente.'],
        ['TJPA', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', firstPeriod, lastPeriod, supplierRowsRaw.length, `Valores Pagos aos Contratados, acumulado ${firstPeriod}..${lastPeriod} (confirmado linha a linha). Inclui CNPJ real quando o credor é pessoa jurídica; CPF de pessoa física (11 dígitos crus na fonte) nunca é armazenado, nem mascarado — só o nome do credor é gravado nesses casos.`],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJPA:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIV: { rows: personnelRows.length }, anexoI: { rows: financeRows.length }, contratados: { rows: supplierRowsRaw.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
