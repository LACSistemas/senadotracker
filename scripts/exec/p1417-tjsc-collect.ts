import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { TJSC_SOURCES, downloadToD, parseCargosEfetivos, parseContratados, type PersonnelRow, type SupplierPaymentRow } from '../../apps/collector/src/judiciary-tjsc.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjsc');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjsc');
const PES_REVISION_ID = 'p1417-tjsc-personnel-20261109';
const FIN_REVISION_ID = 'p1417-tjsc-finance-20261109b'; // 'b': linha "TOTAL" (rollup) da planilha de contratados excluída do parser depois da 1ª tentativa — só fornecedores (sem jud_fin_fact: orçamento é PDF, não coletado neste piloto)
const PARSER = 'p14.17-tjsc-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // Agosto/2026, confirmado ao vivo na página do TJSC

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJSC:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjscId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJSC'`)).rows[0]?.tribunal_id;
  if (!tjscId) throw new Error('TJSC tribunal missing from jud_tribunal');

  const cargosDl = await downloadToD(TJSC_SOURCES.CARGOS_EFETIVOS.url, PES_DIR, 'anexo-iva-agosto-2026.xlsx');
  const contratadosDl = await downloadToD(TJSC_SOURCES.CONTRATADOS.url, FIN_DIR, 'valores-pagos-a-contratados-2026.xlsx');

  const efetivosRows: PersonnelRow[] = await parseCargosEfetivos(cargosDl.path);
  const supplierRowsRaw: SupplierPaymentRow[] = await parseContratados(contratadosDl.path);
  if (!efetivosRows.length) throw new Error('Anexo IVa TJSC sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!supplierRowsRaw.length) throw new Error('Contratados TJSC sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const cargosSnap = await insertSnapshot(c, await snapshotMeta(cargosDl, 'TJSC', TJSC_SOURCES.CARGOS_EFETIVOS.url, efetivosRows.length, efetivosRows.length));
    const contratadosSnap = await insertSnapshot(c, await snapshotMeta(contratadosDl, 'TJSC', TJSC_SOURCES.CONTRATADOS.url, supplierRowsRaw.length, supplierRowsRaw.length));

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjsc: efetivosRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([cargosSnap]), semanticPes, efetivosRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJSC', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjscId]);
      for (const r of efetivosRows) {
        const id = `TJSC:PES:ANEXO_IV_A:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJSC',$4,$5,'ANEXO_IV_A',$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
          [id, PES_REVISION_ID, tjscId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, cargosSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo IVa TJSC (xlsx)' })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — só fornecedores
    const semanticFin = sha(JSON.stringify({ tjsc: supplierRowsRaw }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([contratadosSnap]), semanticFin, supplierRowsRaw.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJSC', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjscId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjscId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjscId]);
      }
      for (const r of supplierRowsRaw) {
        const id = `TJSC:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,supplier_name,supplier_cnpj,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJSC',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [id, FIN_REVISION_ID, tjscId, 2026, r.month, r.supplierName, r.supplierCnpj, r.expenseDescription, Math.round(r.amountReais * 100), contratadosSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Valores pagos a contratados TJSC (xlsx, formato largo por mês)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string | null]> = [
        ['TJSC', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', '2026-01', '2026-10', supplierRowsRaw.length, 'Arquivo anual com 1 coluna por mês; cobre jan-out/2026 nesta edição (confirmado linha a linha, não suposição). Inclui CNPJ real do credor.'],
        ['TJSC', 'BUDGET_ANNEX_II', 'DOCUMENTED_PDF_ONLY', null, null, 0, 'Anexo II só existe em PDF por mês nesta fonte — não coletado neste piloto (sem ferramenta de extração de tabela de PDF validada ainda).'],
        ['TJSC', 'PAYROLL', 'DOCUMENTED_JS_PORTAL_ONLY', null, null, 0, 'Folha nominal (servidores e magistrados) só existe num portal SPA (thema.inf.br) sem arquivo de download — não investigado nesta rodada.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJSC:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, cargosEfetivos: { period: PERSONNEL_PERIOD, rows: efetivosRows.length }, contratados: { rows: supplierRowsRaw.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
