import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { TJES_SOURCES, downloadToD, parseAnexoIVA, parseAnexoIVB, parseContratados, type PersonnelRow, type SupplierPaymentRow } from '../../apps/collector/src/judiciary-tjes.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjes');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjes');
const PES_REVISION_ID = 'p1420-tjes-personnel-20261109';
const FIN_REVISION_ID = 'p1420-tjes-finance-20261109';
const PARSER = 'p14.20-tjes-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // Agosto/2026, confirmado ao vivo no nome do arquivo e no título da planilha

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJES:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjesId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJES'`)).rows[0]?.tribunal_id;
  if (!tjesId) throw new Error('TJES tribunal missing from jud_tribunal');

  const ivaSrc = TJES_SOURCES.anexoIVA(PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month);
  const ivbSrc = TJES_SOURCES.anexoIVB(PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month);
  const ivaDl = await downloadToD(ivaSrc.url, PES_DIR, `anexo-iv-a-${PERSONNEL_PERIOD.year}${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.xls`);
  const ivbDl = await downloadToD(ivbSrc.url, PES_DIR, `anexo-iv-b-${PERSONNEL_PERIOD.year}${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.xls`);
  const contratadosDl = await downloadToD(TJES_SOURCES.contratados.url, FIN_DIR, 'contratados-2026.ods');

  const ivaRows: PersonnelRow[] = await parseAnexoIVA(ivaDl.path);
  const ivbRows: PersonnelRow[] = await parseAnexoIVB(ivbDl.path);
  const supplierRowsRaw: SupplierPaymentRow[] = await parseContratados(contratadosDl.path);
  if (!ivaRows.length) throw new Error('Anexo IV-A TJES sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!ivbRows.length) throw new Error('Anexo IV-B TJES sem linhas reconhecidas');
  if (!supplierRowsRaw.length) throw new Error('Contratados TJES sem linhas reconhecidas');
  const personnelRows: Array<PersonnelRow & { sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }> = [
    ...ivaRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_A' as const })),
    ...ivbRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_B' as const })),
  ];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, await snapshotMeta(ivaDl, 'TJES', ivaSrc.url, ivaRows.length, ivaRows.length));
    const ivbSnap = await insertSnapshot(c, await snapshotMeta(ivbDl, 'TJES', ivbSrc.url, ivbRows.length, ivbRows.length));
    const contratadosSnap = await insertSnapshot(c, await snapshotMeta(contratadosDl, 'TJES', TJES_SOURCES.contratados.url, supplierRowsRaw.length, supplierRowsRaw.length));
    const snapFor = (annex: 'ANEXO_IV_A' | 'ANEXO_IV_B') => annex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjes: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJES', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjesId]);
      for (const r of personnelRows) {
        const id = `TJES:PES:${r.sourceAnnex}:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJES',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjesId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snapFor(r.sourceAnnex), sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo ${r.sourceAnnex === 'ANEXO_IV_A' ? 'IV-A' : 'IV-B'} TJES (xls)` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — só fornecedores
    const semanticFin = sha(JSON.stringify({ tjes: supplierRowsRaw }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([contratadosSnap]), semanticFin, supplierRowsRaw.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJES', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjesId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjesId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjesId]);
      }
      for (const r of supplierRowsRaw) {
        const id = `TJES:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJES',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
          [id, FIN_REVISION_ID, tjesId, 2026, r.month, r.documentNumber, r.supplierName, r.supplierCnpj, r.biddingType, r.processNumber, r.expenseDescription, Math.round(r.amountReais * 100), contratadosSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Execução orçamentária dos contratos TJES (ods, Despesas Liquidadas por mês)' })]);
      }
      const monthsPresent = [...new Set(supplierRowsRaw.map(r => r.month))].sort((a, b) => a - b);
      const firstPeriod = `2026-${String(monthsPresent[0]).padStart(2, '0')}`;
      const lastPeriod = `2026-${String(monthsPresent[monthsPresent.length - 1]).padStart(2, '0')}`;
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJES', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', firstPeriod, lastPeriod, supplierRowsRaw.length, `Execução orçamentária dos contratos por órgão/contrato, 1 coluna por mês; cobre ${firstPeriod}..${lastPeriod} nesta edição (confirmado linha a linha). Valor é "Despesas Liquidadas" (reconhecimento da obrigação), não necessariamente já pago ao fornecedor — ver limitação §4.3 do catálogo. Inclui CNPJ real quando o credor é pessoa jurídica; credor pessoa física (CPF) nunca tem o documento armazenado, só o nome.`],
        ['TJES', 'BUDGET_ANNEX_I_II', 'NOT_ATTEMPTED', null, null, 0, 'Anexos I/II (despesas orçamentárias agregadas) não investigados neste piloto — escopo centrado em pessoal e fornecedores, como nos tribunais anteriores.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJES:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, ivA: { rows: ivaRows.length }, ivB: { rows: ivbRows.length }, contratados: { rows: supplierRowsRaw.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
