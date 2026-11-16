import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadToD, parseAnexoI, type FinanceRow } from '../../apps/collector/src/judiciary-tjms.ts';

/** P14.39 — 2ª rodada: TJMS confirmado ao vivo (GET simples, dataRef=MM/YYYY) até jan/2015, sem
 * mudança de formato (HTML padrão, mesmo parser o tempo todo). Mesmo molde do backfill do TJCE. */
const ROOT = 'D:\\Civica\\judiciario';
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjms', 'backfill');
const FIN_REVISION_ID = 'p1436-tjms-finance-backfill-2015-2025';
const PARSER = 'p14.39-tjms-backfill-v1';
const YEARS = Array.from({ length: 2025 - 2015 + 1 }, (_, i) => 2015 + i);

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number; contentType: string }
function snapshotMeta(sourceUrl: string, dl: { path: string; bytes: number; sha256: string }, rows: number): SnapshotMeta {
  return { snapshotId: `TJMS:BACKFILL:${dl.sha256.slice(0, 40)}`, provider: 'TJMS', resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: 200, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows: rows, parsedRows: rows, contentType: 'text/html' };
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
  const tjmsId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJMS'`)).rows[0]?.tribunal_id;
  if (!tjmsId) throw new Error('TJMS tribunal missing from jud_tribunal');

  const byYear: Array<{ year: number; rows: FinanceRow[]; snap: Awaited<ReturnType<typeof downloadToD>>; sourceUrl: string }> = [];
  const skipped: number[] = [];
  for (const year of YEARS) {
    const url = `https://www5.tjms.jus.br/transparencia/resolucao102/anexo1/index.php?dataRef=01%2F${year}`;
    try {
      const dl = await downloadToD(url, FIN_DIR, `anexo-i-${year}-01.html`);
      const rows = parseAnexoI(dl.buf.toString('latin1'));
      if (!rows.length) { skipped.push(year); continue; }
      byYear.push({ year, rows, snap: dl, sourceUrl: url });
    } catch { skipped.push(year); }
  }
  if (!byYear.length) throw new Error('nenhum ano retornou dado — verificar janela/URL antes de prosseguir');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const snapIds = new Map<number, string>();
    for (const y of byYear) { const snapId = await insertSnapshot(c, snapshotMeta(y.sourceUrl, y.snap, y.rows.length)); snapIds.set(y.year, snapId); }

    const prevFin = (await c.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (!prevFin) throw new Error('nenhuma revisão JUD_FINANCE ativa');

    await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
    await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
      [FIN_REVISION_ID, JSON.stringify([...snapIds.values()]), sha(JSON.stringify(byYear.map(y => y.rows))), byYear.reduce((s, y) => s + y.rows.length, 0), prevFin.revision_id, JSON.stringify({ provider: 'TJMS', parser: PARSER, years: byYear.map(y => y.year), skipped })]);

    // Copy-forward sem exclusão de tribunal: backfill adiciona períodos que não existem ainda.
    await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
    await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
    await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
    await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);

    for (const y of byYear) {
      const snapId = snapIds.get(y.year)!;
      for (const r of y.rows) {
        const id = `TJMS:FINFACT:${y.year}01:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJMS',$4,1,$5,'EXPENSE_REPORTED',$6,$7,$8,$9,$10::jsonb)`,
          [id, FIN_REVISION_ID, tjmsId, y.year, r.account, r.category, snapId, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJMS (html, backfill histórico)' })]);
      }
    }

    const coverageId = `TJMS:COV:${sha('TJMS|BUDGET_ANNEX_I_BACKFILL').slice(0, 32)}`;
    await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
      [coverageId, FIN_REVISION_ID, 'TJMS', 'BUDGET_ANNEX_I_BACKFILL', 'ACQUIRED_AND_PARSED', `${byYear[0]!.year}-01`, `${byYear.at(-1)!.year}-01`, byYear.reduce((s, y) => s + y.rows.length, 0),
        `Histórico retroativo, janeiro de cada ano (${byYear.map(y => y.year).join(', ')}), só Anexo I.${skipped.length ? ` Anos sem dado publicado: ${skipped.join(', ')}.` : ''}`]);

    await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, revision: FIN_REVISION_ID, years: byYear.map(y => ({ year: y.year, rows: y.rows.length, total: y.rows.reduce((s, r) => s + r.amountReais, 0) })), skipped }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
