import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { downloadAnexoIVA, downloadAnexoIVB, downloadAnexoI, parseAnexoIVA, parseAnexoIVB, parseAnexoI, type PersonnelRow, type FinanceRow } from '../../apps/collector/src/judiciary-tjpi.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjpi');
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjpi');
const PES_REVISION_ID = 'p1426-tjpi-personnel-20261110';
const FIN_REVISION_ID = 'p1426-tjpi-finance-20261110';
const PARSER = 'p14.26-tjpi-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 7 }; // "Dados a partir de 1/2014 até 7/2026", confirmado ao vivo na própria página
const ANEXO_I_PERIOD = { year: 2026, month: 9 }; // "Mês de Referência (MM/AAAA) 09/2026", confirmado ao vivo

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
function snapshotMeta(provider: string, resourceName: string, sourceUrl: string, dl: { path: string; bytes: number; sha256: string }, sourceRows: number, parsedRows: number): SnapshotMeta {
  return { snapshotId: `TJPI:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName, sourceUrl, fetchedAt: new Date().toISOString(), bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
}
async function insertSnapshot(c: import('pg').PoolClient, s: SnapshotMeta): Promise<string> {
  const existing = (await c.query(`SELECT snapshot_id FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE sha256=$1`, [s.sha256])).rows[0]?.snapshot_id;
  if (existing) return existing;
  await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,200,'text/html; charset=utf-8',$6,$7,$8,$9,$10,$11,0,0,'ACQUIRED','{}'::jsonb)`,
    [s.snapshotId, s.provider, s.resourceName, s.sourceUrl, s.fetchedAt, s.bytes, s.sha256, s.rawPath, PARSER, s.sourceRows, s.parsedRows]);
  return s.snapshotId;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const tjpiId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJPI'`)).rows[0]?.tribunal_id;
  if (!tjpiId) throw new Error('TJPI tribunal missing from jud_tribunal');

  const ivaDl = await downloadAnexoIVA(PES_DIR, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month);
  const ivbDl = await downloadAnexoIVB(PES_DIR, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month);
  const anexoIDl = await downloadAnexoI(FIN_DIR, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month);

  // parsers verificam a soma contra o TOTAL/"Total Geral" da própria fonte usando os valores CRUS (inclusive
  // negativos) — nunca alterado aqui. Mas `headcount` no banco não aceita negativo (CHECK constraint, pego
  // rodando contra produção): a fonte real do TJPI tem 7 linhas de "Vagos" negativo no Anexo IV-b (mais gente
  // ocupando o cargo do que vagas oficialmente previstas — anomalia real da fonte, não erro de parsing,
  // confirmado comparando com a soma total que bate exatamente incluindo esses negativos). Essas 7 linhas são
  // excluídas aqui, depois da verificação, nunca escondidas — documentadas na memória do projeto.
  const rawPersonnelRows: PersonnelRow[] = [...parseAnexoIVA(ivaDl.html), ...parseAnexoIVB(ivbDl.html)];
  const negativeRows = rawPersonnelRows.filter(r => r.headcount < 0);
  const personnelRows = rawPersonnelRows.filter(r => r.headcount > 0);
  if (negativeRows.length) console.log(`AVISO: ${negativeRows.length} linha(s) com headcount negativo na fonte (anomalia real, excluídas do banco):`, JSON.stringify(negativeRows));
  const financeRows: FinanceRow[] = parseAnexoI(anexoIDl.html);
  if (!personnelRows.length) throw new Error('Anexo IV TJPI sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!financeRows.length) throw new Error('Anexo I TJPI sem linhas reconhecidas');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, snapshotMeta('TJPI', 'anexo-iv-a-2026-07', `https://www.tjpi.jus.br/transparencia/relatorios/anexo_iv_a?ano=${PERSONNEL_PERIOD.year}&mes=${PERSONNEL_PERIOD.month}`, ivaDl.meta, personnelRows.length, personnelRows.length));
    const ivbSnap = await insertSnapshot(c, snapshotMeta('TJPI', 'anexo-iv-b-2026-07', `https://www.tjpi.jus.br/transparencia/relatorios/anexo_iv_b?ano=${PERSONNEL_PERIOD.year}&mes=${PERSONNEL_PERIOD.month}`, ivbDl.meta, personnelRows.length, personnelRows.length));
    const anexoISnap = await insertSnapshot(c, snapshotMeta('TJPI', 'anexo-i-2026-09', `https://www.tjpi.jus.br/transparencia/siafe/cnj/appendix_i?ano=${ANEXO_I_PERIOD.year}&mes=${ANEXO_I_PERIOD.month}`, anexoIDl.meta, financeRows.length, financeRows.length));

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjpi: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJPI', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjpiId]);
      for (const r of personnelRows) {
        const id = `TJPI:PES:${sha(JSON.stringify(r)).slice(0, 40)}`;
        const snap = r.sourceAnnex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPI',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjpiId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snap, sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo IV TJPI (html), alínea ${r.sourceAnnex}` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro (escopo JUD_FINANCE, compartilhado entre tribunais) — Anexo I (sem fornecedores: não localizado como tabela/arquivo acessível)
    const semanticFin = sha(JSON.stringify({ tjpi: financeRows }));
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap]), semanticFin, financeRows.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJPI', parser: PARSER, sourceCutoff: '2026-11-10' })]);
      if (prevFin) {
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpiId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(aggregate_id,publication_revision_id,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance) SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpiId]);
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) SELECT payment_id,$1,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,supplier_cnpj,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjpiId]);
      }
      for (const r of financeRows) {
        const id = `TJPI:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJPI',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjpiId, ANEXO_I_PERIOD.year, ANEXO_I_PERIOD.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJPI (html)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string]> = [
        ['TJPI', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, `${ANEXO_I_PERIOD.year}-${String(ANEXO_I_PERIOD.month).padStart(2, '0')}`, financeRows.length, 'Anexo I por inciso/alínea, publicação mensal. Sem camada de fornecedores: "Valores Pagos aos Contratados - LDO" não foi encontrado como tabela ou arquivo diretamente acessível no reconhecimento (orçamento de tempo não permitiu investigar a fundo).'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJPI:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, financeRevision: FIN_REVISION_ID, anexoIVA: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_A').length }, anexoIVB: { rows: personnelRows.filter(r => r.sourceAnnex === 'ANEXO_IV_B').length }, anexoI: { rows: financeRows.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
