import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { TJBA_SOURCES, downloadToD, parseFornecedores, parseLotacao, type PersonnelRow, type SupplierPaymentRow } from '../../apps/collector/src/judiciary-tjba.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjba');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjba');
const PES_REVISION_ID = 'p1418-tjba-personnel-20261109';
const FIN_REVISION_ID = 'p1418-tjba-finance-20261109'; // só fornecedores (sem jud_fin_fact: orçamento é sistema dinâmico sipof.wsp, não arquivo — não coletado neste piloto)
const PARSER = 'p14.18-tjba-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 7 }; // "Data de Referência 01/07/2026", confirmado ao vivo nas 2 planilhas TLP

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJBA:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjbaId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJBA'`)).rows[0]?.tribunal_id;
  if (!tjbaId) throw new Error('TJBA tribunal missing from jud_tribunal');

  const fornecedoresDl = await downloadToD(TJBA_SOURCES.FORNECEDORES.url, FIN_DIR, 'item-42-jan-set-2026.ods');
  const tlp2Dl = await downloadToD(TJBA_SOURCES.TLP2.url, PES_DIR, 'tlp2-1grau.ods');
  const tlp3Dl = await downloadToD(TJBA_SOURCES.TLP3.url, PES_DIR, 'tlp3-administracao.ods');

  const supplierRowsRaw: SupplierPaymentRow[] = await parseFornecedores(fornecedoresDl.path);
  const tlp2Rows: PersonnelRow[] = await parseLotacao(tlp2Dl.path);
  const tlp3Rows: PersonnelRow[] = await parseLotacao(tlp3Dl.path);
  if (!supplierRowsRaw.length) throw new Error('Fornecedores TJBA sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!tlp2Rows.length) throw new Error('TLP2 TJBA sem linhas reconhecidas');
  if (!tlp3Rows.length) throw new Error('TLP3 TJBA sem linhas reconhecidas');
  const personnelRows: Array<PersonnelRow & { sourceAnnex: 'TLP_1_GRAU' | 'TLP_ADMINISTRACAO' }> = [
    ...tlp2Rows.map(r => ({ ...r, sourceAnnex: 'TLP_1_GRAU' as const })),
    ...tlp3Rows.map(r => ({ ...r, sourceAnnex: 'TLP_ADMINISTRACAO' as const })),
  ];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const tlp2Snap = await insertSnapshot(c, await snapshotMeta(tlp2Dl, 'TJBA', TJBA_SOURCES.TLP2.url, tlp2Rows.length, tlp2Rows.length));
    const tlp3Snap = await insertSnapshot(c, await snapshotMeta(tlp3Dl, 'TJBA', TJBA_SOURCES.TLP3.url, tlp3Rows.length, tlp3Rows.length));
    const fornecedoresSnap = await insertSnapshot(c, await snapshotMeta(fornecedoresDl, 'TJBA', TJBA_SOURCES.FORNECEDORES.url, supplierRowsRaw.length, supplierRowsRaw.length));
    const snapFor = (annex: 'TLP_1_GRAU' | 'TLP_ADMINISTRACAO') => annex === 'TLP_1_GRAU' ? tlp2Snap : tlp3Snap;

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjba: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([tlp2Snap, tlp3Snap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJBA', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjbaId]);
      for (const r of personnelRows) {
        const id = `TJBA:PES:${r.sourceAnnex}:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJBA',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjbaId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snapFor(r.sourceAnnex), sha(JSON.stringify(r)), JSON.stringify({ source: `TLP TJBA (${r.sourceAnnex}, ods)` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — só fornecedores
    const semanticFin = sha(JSON.stringify({ tjba: supplierRowsRaw }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([fornecedoresSnap]), semanticFin, supplierRowsRaw.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJBA', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjbaId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjbaId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjbaId]);
      }
      for (const r of supplierRowsRaw) {
        const id = `TJBA:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,supplier_name,supplier_cnpj,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJBA',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [id, FIN_REVISION_ID, tjbaId, 2026, r.month, r.supplierName, r.supplierCnpj, r.expenseDescription, Math.round(r.amountReais * 100), fornecedoresSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Item 42 CNJ TJBA (ods, formato largo por mês)' })]);
      }
      const monthsPresent = [...new Set(supplierRowsRaw.map(r => r.month))].sort((a, b) => a - b);
      const firstPeriod = `2026-${String(monthsPresent[0]).padStart(2, '0')}`;
      const lastPeriod = `2026-${String(monthsPresent[monthsPresent.length - 1]).padStart(2, '0')}`;
      const coverageRows: Array<[string, string, string, string, string, number, string | null]> = [
        ['TJBA', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', firstPeriod, lastPeriod, supplierRowsRaw.length, `Arquivo anual "item 42" (padrão CNJ), 1 coluna por mês; cobre ${firstPeriod}..${lastPeriod} nesta edição (meses presentes confirmados linha a linha, não suposição). Inclui CNPJ real do credor (nenhum CPF de pessoa física encontrado nas 1.542 linhas coletadas).`],
        ['TJBA', 'BUDGET_ANNEX_I_II', 'DOCUMENTED_SYSTEM_ONLY', null, null, 0, 'Anexos I/II são sistema dinâmico de consulta (sipof.wsp), não arquivo de download — não coletado neste piloto (sem ferramenta de automação desse sistema validada ainda).'],
        ['TJBA', 'PAYROLL', 'DOCUMENTED_PDF_ONLY', null, null, 0, 'Folha nominal e estruturas remuneratórias (cargos efetivos/comissão/magistrados) só existem em PDF — não coletado neste piloto (sem ferramenta de extração de tabela de PDF validada ainda).'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJBA:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, tlp2: { rows: tlp2Rows.length }, tlp3: { rows: tlp3Rows.length }, fornecedores: { rows: supplierRowsRaw.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
