import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadToD, fetchAspJson, parseAnexoIVA, parseAnexoIVB, parseAnexoI, type PersonnelRow, type FinanceRow } from '../../apps/collector/src/judiciary-tjdft.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjdft');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjdft');
const PES_REVISION_ID = 'p1433-tjdft-personnel-20261111';
const FIN_REVISION_ID = 'p1433-tjdft-finance-20261111';
const PARSER = 'p14.33-tjdft-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "Selecione a data-base" — mais recente: 2026-08-31 (2º quadrimestre)
const ANEXO_I_PERIOD = { year: 2026, month: 9 }; // arquivo "anexo-i-base_set_2026.csv", mais recente publicado

const ANEXO_IVA_PAGE = 'https://rh.tjdft.jus.br/s287/transparencia/cargosefetivos/anexo_iv_a.asp';
const ANEXO_IVB_PAGE = 'https://rh.tjdft.jus.br/s287/transparencia/cargosefetivos/anexo_iv_b.asp';
const ANEXO_I_URL = 'https://www.tjdft.jus.br/transparencia/gestao-orcamentaria/anexo-i/anexo-i-2026/anexo-i-base_set_2026.csv';

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number; contentType: string }
function snapshotMeta(provider: string, sourceUrl: string, dl: { path: string; bytes: number; sha256: string }, sourceRows: number, parsedRows: number, contentType: string): SnapshotMeta {
  return { snapshotId: `TJDFT:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: 200, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows, contentType };
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
  const tjdftId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJDFT'`)).rows[0]?.tribunal_id;
  if (!tjdftId) throw new Error('TJDFT tribunal missing from jud_tribunal');

  const dateParam = `${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}-31`;
  const iva = await fetchAspJson(ANEXO_IVA_PAGE, 'ajaxBuscaQuantitativoCargosEfetivos.asp', dateParam, PES_DIR, `anexo-iv-a-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.json`);
  const ivb = await fetchAspJson(ANEXO_IVB_PAGE, 'ajaxBuscaQuantitativoFCCJ.asp', dateParam, PES_DIR, `anexo-iv-b-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.json`);
  const anexoIDl = await downloadToD(ANEXO_I_URL, FIN_DIR, `anexo-i-${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}.csv`);

  const personnelRows: PersonnelRow[] = [...parseAnexoIVA(iva.json), ...parseAnexoIVB(ivb.json)];
  const financeRows: FinanceRow[] = parseAnexoI(anexoIDl.buf);
  if (!personnelRows.length) throw new Error('Anexo IV TJDFT sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!financeRows.length) throw new Error('Anexo I TJDFT sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, snapshotMeta('TJDFT', ANEXO_IVA_PAGE, iva.snapshot, iva.json.length, iva.json.length, 'application/json'));
    const ivbSnap = await insertSnapshot(c, snapshotMeta('TJDFT', ANEXO_IVB_PAGE, ivb.snapshot, ivb.json.length, ivb.json.length, 'application/json'));
    const anexoISnap = await insertSnapshot(c, snapshotMeta('TJDFT', ANEXO_I_URL, anexoIDl, financeRows.length, financeRows.length, 'text/csv'));

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjdft: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJDFT', parser: PARSER, sourceCutoff: '2026-11-11' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjdftId]);
      for (const r of personnelRows) {
        const id = `TJDFT:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        const snap = r.sourceAnnex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJDFT',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjdftId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJDFT (json), alínea ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — só Anexo I, sem fornecedores (arquivo mais recente é de 01/2024, ~2 anos desatualizado)
    const semanticFin = sha(JSON.stringify({ tjdft: { financeRows } }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap]), semanticFin, financeRows.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJDFT', parser: PARSER, sourceCutoff: '2026-11-11' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjdftId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjdftId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjdftId]);
      }
      for (const r of financeRows) {
        const id = `TJDFT:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJDFT',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjdftId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJDFT (csv)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJDFT', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Anexo I por inciso/alínea (CSV), publicação mensal. Fonte não publica linha de TOTAL/subtotal — soma calculada aqui, não verificada contra a própria fonte (diferente das demais fontes desta série).'],
        ['TJDFT', 'SUPPLIER_PAYMENTS', 'DOCUMENTED_NO_BULK_EXPORT', '', '', 0, 'Categoria "Contratados Pagos LDO" existe mas o arquivo mais recente publicado é de 01/2024 — quase 2 anos desatualizado em relação ao pessoal/financeiro (08-09/2026) — não inserido para não misturar dado corrente com dado obsoleto.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJDFT:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first || null, last || null, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIVA: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length }, anexoIVB: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length }, anexoI: { rows: financeRows.length, total: financeRows.reduce((s, r) => s + r.amountReais, 0) } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
