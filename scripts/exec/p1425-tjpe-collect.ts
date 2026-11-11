import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { scrapeAnexoIVA, scrapeAnexoIVB, scrapeAnexoI, parsePersonnelGridIVA, parsePersonnelGridIVB, parseFinanceGridAnexoI, countUniqueDetailRows, type PersonnelRow, type FinanceRow } from '../../apps/collector/src/judiciary-tjpe.ts';

const PES_REVISION_ID = 'p1425-tjpe-personnel-20261110';
const FIN_REVISION_ID = 'p1425-tjpe-finance-20261110';
const PARSER = 'p14.25-tjpe-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "Mês/Ano de Referência: 08/2026", confirmado ao vivo na própria grade
const ANEXO_I_PERIOD = { year: 2026, month: 9 }; // "Mês/Ano de Referência: 09/2026", confirmado ao vivo (Data de Publicação 19/10/2026)

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(provider: string, resourceName: string, sourceUrl: string, snapshotSeed: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJPE:${provider}:${sha(snapshotSeed).slice(0, 40)}`, provider, resourceName, sourceUrl, fetchedAt: new Date().toISOString(), sourceRows, parsedRows };
}
async function insertSnapshot(c: import('pg').PoolClient, s: SnapshotMeta): Promise<string> {
  const existing = (await c.query(`SELECT snapshot_id FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE snapshot_id=$1`, [s.snapshotId])).rows[0]?.snapshot_id;
  if (existing) return existing;
  await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,200,'text/html; charset=UTF-8',0,$6,'(grade ScriptCase renderizada via Playwright, sem arquivo estático — ver details)',$7,$8,$9,0,0,'ACQUIRED',$10::jsonb)`,
    [s.snapshotId, s.provider, s.resourceName, s.sourceUrl, s.fetchedAt, sha(s.snapshotId), PARSER, s.sourceRows, s.parsedRows, JSON.stringify({ note: 'TJPE não publica arquivo estático pra estes anexos; a grade ScriptCase foi lida diretamente via Playwright (ver judiciary-tjpe.ts)' })]);
  return s.snapshotId;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const tjpeId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJPE'`)).rows[0]?.tribunal_id;
  if (!tjpeId) throw new Error('TJPE tribunal missing from jud_tribunal');

  const ivaScrape = await scrapeAnexoIVA('08/2026');
  const ivaUnique = countUniqueDetailRows(ivaScrape.rows, 13);
  if (ivaScrape.declaredTotal !== null && ivaUnique !== ivaScrape.declaredTotal) throw new Error(`TJPE Anexo IV-a: paginação incompleta — grade declara ${ivaScrape.declaredTotal} registros, capturei ${ivaUnique} únicos`);
  const ivbScrape = await scrapeAnexoIVB('08/2026');
  const ivbUnique = countUniqueDetailRows(ivbScrape.rows, 7);
  if (ivbScrape.declaredTotal !== null && ivbUnique !== ivbScrape.declaredTotal) throw new Error(`TJPE Anexo IV-b: paginação incompleta — grade declara ${ivbScrape.declaredTotal} registros, capturei ${ivbUnique} únicos`);
  const anexoIRows = await scrapeAnexoI('09/2026');

  const personnelRows: PersonnelRow[] = [...parsePersonnelGridIVA(ivaScrape.rows), ...parsePersonnelGridIVB(ivbScrape.rows)];
  const financeRows: FinanceRow[] = parseFinanceGridAnexoI(anexoIRows);
  if (!personnelRows.length) throw new Error('Anexo IV TJPE sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!financeRows.length) throw new Error('Anexo I TJPE sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, await snapshotMeta('TJPE', 'ANEXO_4A-08-2026', 'https://scase.tjpe.jus.br/transparencia/ANEXO_4A/', `iva-${PERSONNEL_PERIOD.year}-${PERSONNEL_PERIOD.month}-${ivaUnique}`, ivaUnique, personnelRows.length));
    const ivbSnap = await insertSnapshot(c, await snapshotMeta('TJPE', 'ANEXO_4B-08-2026', 'https://scase.tjpe.jus.br/transparencia/ANEXO_4B/', `ivb-${PERSONNEL_PERIOD.year}-${PERSONNEL_PERIOD.month}-${ivbUnique}`, ivbUnique, personnelRows.length));
    const anexoISnap = await insertSnapshot(c, await snapshotMeta('TJPE', 'ANEXO_1-09-2026', 'https://scase.tjpe.jus.br/transparencia/ANEXO_1/', `anexoi-${ANEXO_I_PERIOD.year}-${ANEXO_I_PERIOD.month}-${financeRows.length}`, financeRows.length, financeRows.length));

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjpe: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJPE', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjpeId]);
      for (const r of personnelRows) {
        const id = `TJPE:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        const snap = r.sourceAnnex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPE',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjpeId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJPE (grade ScriptCase, sem arquivo estático), alínea ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — Anexo I (sem fornecedores: ContratosConvenios 403)
    const semanticFin = sha(JSON.stringify({ tjpe: financeRows }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap]), semanticFin, financeRows.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJPE', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpeId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpeId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpeId]);
      }
      for (const r of financeRows) {
        const id = `TJPE:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPE',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjpeId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJPE (grade ScriptCase, TOTAL CONSOLIDADO = UG-TJPE + UG-FERM)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJPE', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Anexo I por inciso/alínea, publicação mensal — TOTAL CONSOLIDADO soma 2 unidades gestoras (TJPE + FERM). Sem camada de fornecedores: o módulo de pagamentos a contratados do próprio TJPE devolve 403 Forbidden mesmo navegando pela página pública do portal.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJPE:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIVA: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length, uniqueDetail: ivaUnique, declared: ivaScrape.declaredTotal }, anexoIVB: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length, uniqueDetail: ivbUnique, declared: ivbScrape.declaredTotal }, anexoI: { rows: financeRows.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
