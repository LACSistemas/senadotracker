import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadToD, parseAnexoIVA, parseAnexoIVB, scrapeAnexoI, parseAnexoI, type PersonnelRow, type FinanceRow } from '../../apps/collector/src/judiciary-tjmg.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjmg');
const PES_REVISION_ID = 'p1428-tjmg-personnel-20261110';
const FIN_REVISION_ID = 'p1428-tjmg-finance-20261110';
const PARSER = 'p14.28-tjmg-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "Data de referência: 31/08/2026", confirmado ao vivo nos próprios PDFs
const ANEXO_I_PERIOD = { year: 2026, month: 10 }; // "Mês de referência: 10/2026", confirmado ao vivo; colunas Jan(0)..Out(9)
const ANEXO_I_MONTH_INDEX = 9;

const IVA_URL = 'https://www.tjmg.jus.br/data/files/34/95/C7/2B/62290A103E9B380A9208CCA8/Anexo%20IV%20A%20SET%202026%20publicacao.pdf';
const IVB_URL = 'https://www.tjmg.jus.br/data/files/32/95/A6/2B/62290A103E9B380A9208CCA8/Anexo%20IV%20B%20SET%202026%20publicacao.pdf';
const ANEXO_I_FORM_URL = 'http://www8.tjmg.jus.br/transparencia/relatorios/execucaoOrcamentaria.jsf';

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number; details: Record<string, unknown> }
async function insertSnapshot(c: import('pg').PoolClient, s: SnapshotMeta): Promise<string> {
  const existing = (await c.query(`SELECT snapshot_id FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE snapshot_id=$1`, [s.snapshotId])).rows[0]?.snapshot_id;
  if (existing) return existing;
  await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0,'ACQUIRED',$14::jsonb)`,
    [s.snapshotId, s.provider, s.resourceName, s.sourceUrl, s.fetchedAt, s.httpStatus, s.contentType, s.bytes, s.sha256, s.rawPath, PARSER, s.sourceRows, s.parsedRows, JSON.stringify(s.details)]);
  return s.snapshotId;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const tjmgId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJMG'`)).rows[0]?.tribunal_id;
  if (!tjmgId) throw new Error('TJMG tribunal missing from jud_tribunal');

  const ivaDl = await downloadToD(IVA_URL, PES_DIR, `anexo-iv-a-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.pdf`);
  const ivbDl = await downloadToD(IVB_URL, PES_DIR, `anexo-iv-b-${PERSONNEL_PERIOD.year}-${String(PERSONNEL_PERIOD.month).padStart(2, '0')}.pdf`);
  const personnelRows: PersonnelRow[] = [...await parseAnexoIVA(ivaDl.path), ...await parseAnexoIVB(ivbDl.path)];
  if (!personnelRows.length) throw new Error('Anexo IV TJMG sem linhas reconhecidas — parser pode ter quebrado no layout real');

  const anexoIEvents = await scrapeAnexoI(ANEXO_I_PERIOD.year);
  const financeRows: FinanceRow[] = parseAnexoI(anexoIEvents, ANEXO_I_MONTH_INDEX);
  if (!financeRows.length) throw new Error('Anexo I TJMG sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, { snapshotId: `TJMG:ANEXO_IVA:${ivaDl.sha256.slice(0, 40)}`, provider: 'TJMG', resourceName: path.basename(ivaDl.path), sourceUrl: IVA_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/pdf', bytes: ivaDl.bytes, sha256: ivaDl.sha256, rawPath: ivaDl.path, sourceRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length, parsedRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length, details: { source: 'Anexo IV-a TJMG (PDF)' } });
    const ivbSnap = await insertSnapshot(c, { snapshotId: `TJMG:ANEXO_IVB:${ivbDl.sha256.slice(0, 40)}`, provider: 'TJMG', resourceName: path.basename(ivbDl.path), sourceUrl: IVB_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'application/pdf', bytes: ivbDl.bytes, sha256: ivbDl.sha256, rawPath: ivbDl.path, sourceRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length, parsedRows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length, details: { source: 'Anexo IV-b TJMG (PDF)' } });
    const anexoISnapSeed = sha(JSON.stringify(anexoIEvents));
    const anexoISnap = await insertSnapshot(c, { snapshotId: `TJMG:ANEXO_I:${anexoISnapSeed.slice(0, 40)}`, provider: 'TJMG', resourceName: `execucaoOrcamentaria-${ANEXO_I_PERIOD.year}`, sourceUrl: ANEXO_I_FORM_URL, fetchedAt: new Date().toISOString(), httpStatus: 200, contentType: 'text/html; charset=UTF-8', bytes: 0, sha256: anexoISnapSeed, rawPath: '(app JSF renderizado via Playwright, sem arquivo estático — ver details)', sourceRows: financeRows.length, parsedRows: financeRows.length, details: { note: 'TJMG não publica arquivo estático pro Anexo I; o app JSF foi consultado diretamente via Playwright (ver judiciary-tjmg.ts)' } });

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjmg: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJMG', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjmgId]);
      for (const r of personnelRows) {
        const id = `TJMG:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        const snap = r.sourceAnnex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJMG',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjmgId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJMG (PDF), ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — Anexo I (sem fornecedores: despesaFornecedores.jsf exige CNPJ/nome específico, sem listagem)
    const semanticFin = sha(JSON.stringify({ tjmg: financeRows }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap]), semanticFin, financeRows.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJMG', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjmgId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjmgId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjmgId]);
      }
      for (const r of financeRows) {
        const id = `TJMG:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJMG',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjmgId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJMG (app JSF, execucaoOrcamentaria.jsf)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJMG', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Anexo I por inciso/alínea (I-VI, incl. Repasses e Receitas), publicação mensal — valor reportado do mês selecionado (o app JSF traz o ano inteiro em colunas, só a coluna do mês de referência é usada). Sem camada de fornecedores: o módulo despesaFornecedores.jsf exige CNPJ ou nome específico pra consultar, sem opção de listar todos.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJMG:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIVA: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length }, anexoIVB: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length }, anexoI: { rows: financeRows.length, total: financeRows.reduce((s, r) => s + r.amountReais, 0) } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
