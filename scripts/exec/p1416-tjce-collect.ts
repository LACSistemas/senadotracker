import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import {
  TJCE_ANNEX, downloadToD, fetchTjceManifest, parseAnexoI, parseCargosComissao, parseCargosEfetivos, parseFornecedores, parseTerceirizados, parseTjceDate,
  type FinanceRow, type PersonnelRow, type SupplierPaymentRow, type TjceManifestEntry,
} from '../../apps/collector/src/judiciary-tjce.ts';

const ROOT = 'D:\\Civica\\judiciario';
const FIN_DIR = path.join(ROOT, 'financeiro', 'tjce');
const PES_DIR = path.join(ROOT, 'pessoal', 'tjce');
const FIN_REVISION_ID = 'p1416-tjce-finance-20261108b'; // "b": o hash do 1º run incluía prevRevision (bug corrigido), recalculado difere por construção, não por dado
const PES_REVISION_ID = 'p1416-tjce-personnel-20261108b'; // "b": corrige dupla-contagem de aposentados do 1º run
const PARSER = 'p14.16-tjce-v1';
const DATA_INICIO = '2025-11-01'; const DATA_FIM = '2025-12-31'; // janela de teste: confirmado ao vivo que é o período mais recente publicado

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }

/** "DD-MM-YYYY" → Date, pra ordenar por data real (não por string: "31-12-2025" não é "depois" de
 * "01-11-2025" só porque começa com dígito maior). */
const toDate = (d: string): Date => { const [dd, mm, yyyy] = d.split('-').map(Number); return new Date(yyyy!, mm! - 1, dd!); };

async function fetchLatestAndDownload(annex: keyof typeof TJCE_ANNEX, destDir: string): Promise<{ entry: TjceManifestEntry; download: Awaited<ReturnType<typeof downloadToD>> } | null> {
  const manifest = await fetchTjceManifest(annex, DATA_INICIO, DATA_FIM, 10);
  if (!manifest.length) return null;
  // Achado real: o índice às vezes mistura um relatório anual avulso ("RAP-...") sob o mesmo rótulo de
  // Anexo — esse arquivo tem layout diferente e quebra o parser do mês regular. Exclui nomes fora do
  // padrão do Anexo regular antes de pegar o mais recente.
  const regular = manifest.filter(e => !/^RAP-/i.test(path.basename(e.xls || e.pdf || e.ods || '')));
  const pool2 = regular.length ? regular : manifest;
  const latest = [...pool2].sort((a, b) => toDate(a.data).getTime() - toDate(b.data).getTime()).at(-1)!;
  const fileUrl = latest.xls || latest.ods || latest.csv; if (!fileUrl) return null;
  const download = await downloadToD(fileUrl, destDir);
  return { entry: latest, download };
}

async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJCE:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjceId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJCE'`)).rows[0]?.tribunal_id;
  if (!tjceId) throw new Error('TJCE tribunal missing from jud_tribunal');

  // ============================================================= Busca + download + parse
  const anexoI = await fetchLatestAndDownload('ANEXO_I', FIN_DIR);
  const fornecedores = await fetchLatestAndDownload('FORNECEDORES', FIN_DIR);
  const cargosEfetivos = await fetchLatestAndDownload('CARGOS_EFETIVOS', PES_DIR);
  const cargosComissao = await fetchLatestAndDownload('CARGOS_COMISSAO', PES_DIR);
  const terceirizados = await fetchLatestAndDownload('TERCEIRIZADOS', PES_DIR);
  if (!anexoI || !fornecedores || !cargosEfetivos || !cargosComissao || !terceirizados) throw new Error('um ou mais Anexos do TJCE não retornaram manifesto para a janela testada');

  const financeRows: FinanceRow[] = parseAnexoI(anexoI.download.path);
  const supplierRows: SupplierPaymentRow[] = parseFornecedores(fornecedores.download.path);
  const efetivosRows: PersonnelRow[] = await parseCargosEfetivos(cargosEfetivos.download.path);
  const comissaoRows: PersonnelRow[] = await parseCargosComissao(cargosComissao.download.path);
  const terceirizadosRows: PersonnelRow[] = await parseTerceirizados(terceirizados.download.path);

  if (!financeRows.length) throw new Error('Anexo I sem linhas de alínea reconhecidas — parser pode ter quebrado no layout real');
  if (!supplierRows.length) throw new Error('Fornecedores sem linhas reconhecidas');
  if (!efetivosRows.length) throw new Error('Cargos efetivos sem linhas reconhecidas');

  const anexoIPeriod = parseTjceDate(anexoI.entry.data);
  const fornecedoresPeriod = parseTjceDate(fornecedores.entry.data);
  const efetivosPeriod = parseTjceDate(cargosEfetivos.entry.data);
  const comissaoPeriod = parseTjceDate(cargosComissao.entry.data);
  const terceirizadosPeriod = parseTjceDate(terceirizados.entry.data);

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    // ============================================================= Snapshots
    const anexoISnap = await insertSnapshot(c, await snapshotMeta(anexoI.download, 'TJCE', anexoI.entry.xls, financeRows.length, financeRows.length));
    const fornecedoresSnap = await insertSnapshot(c, await snapshotMeta(fornecedores.download, 'TJCE', fornecedores.entry.xls, supplierRows.length, supplierRows.length));
    const efetivosSnap = await insertSnapshot(c, await snapshotMeta(cargosEfetivos.download, 'TJCE', cargosEfetivos.entry.xls, efetivosRows.length, efetivosRows.length));
    const comissaoSnap = await insertSnapshot(c, await snapshotMeta(cargosComissao.download, 'TJCE', cargosComissao.entry.xls, comissaoRows.length, comissaoRows.length));
    const terceirizadosSnap = await insertSnapshot(c, await snapshotMeta(terceirizados.download, 'TJCE', terceirizados.entry.xls, terceirizadosRows.length, terceirizadosRows.length));

    // ============================================================= Revisão financeira (escopo JUD_FINANCE): carrega pra frente os fatos já ativos
    // de outros tribunais (hoje só STJ) antes de ativar — o esquema compartilha UMA revisão ativa entre
    // tribunais; sem isso, ativar uma revisão só com fatos do TJCE apagaria o STJ da leitura "ativa".
    const prevFin = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    // NUNCA incluir o id da revisão anterior no hash semântico: isso tornaria o hash sempre diferente do
    // hash salvo na própria revisão anterior (que por sua vez referenciava UMA OUTRA revisão), quebrando
    // a detecção de "sem mudança" pra sempre — achado real, reproduzido numa 2ª rodada sem dado novo.
    const semanticFin = sha(JSON.stringify({ financeRows, supplierRows }));
    if (prevFin?.semantic_hash !== semanticFin) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_FINANCE'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_FINANCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [FIN_REVISION_ID, JSON.stringify([anexoISnap, fornecedoresSnap]), semanticFin, financeRows.length + supplierRows.length, prevFin?.revision_id ?? null, JSON.stringify({ provider: 'TJCE', parser: PARSER, sourceCutoff: '2026-11-08', dataWindow: `${DATA_INICIO}..${DATA_FIM}` })]);
      if (prevFin) {
        // Mesmo motivo do copy-forward de pessoal: exclui o próprio TJCE (os fatos novos abaixo já o
        // substituem) pra uma eventual rodada de correção nunca duplicar/misturar dado antigo com novo
        // do mesmo tribunal; outros tribunais (hoje só STJ) continuam preservados normalmente.
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,beneficiary_type,document_id,amount_cents,record_count,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjceId]);
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate SELECT aggregate_id,$1,tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,remuneracao_paradigma_cents,vantagens_pessoais_cents,subsidio_funcao_cents,indenizacoes_cents,vantagens_eventuais_cents,gratificacoes_cents,previdencia_publica_cents,imposto_renda_cents,descontos_diversos_cents,retencao_teto_cents,diarias_cents,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,remuneracao_orgao_origem_cents,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [FIN_REVISION_ID, prevFin.revision_id, tjceId]);
        // jud_fin_coverage tem PK simples (coverage_id, estável por provider+scope, não por revisão) —
        // reaponta pra nova revisão em vez de copiar linha (copiar violaria a PK, achado real).
        await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_fin_coverage SET publication_revision_id=$1 WHERE publication_revision_id=$2`, [FIN_REVISION_ID, prevFin.revision_id]);
      }
      for (const r of financeRows) {
        const id = `TJCE:FINFACT:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,account,budget_stage,expense_category,source_snapshot_id,amount_cents,raw_row_hash,provenance) VALUES($1,$2,$3,'TJCE',$4,$5,$6,'EXPENSE_REPORTED',$7,$8,$9,$10,$11::jsonb)`,
          [id, FIN_REVISION_ID, tjceId, anexoIPeriod.year, anexoIPeriod.month, r.account, r.category, anexoISnap, Math.round(r.amountReais * 100), sha(JSON.stringify(r)), JSON.stringify({ source: 'Anexo I TJCE (ods)', semantic: 'alínea-letra, nível não-dobrado' })]);
      }
      for (const r of supplierRows) {
        const id = `TJCE:SUPPLIER:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_supplier_payment(payment_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,funding_source,document_number,supplier_name,bidding_type,process_number,expense_description,amount_cents,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJCE',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
          [id, FIN_REVISION_ID, tjceId, fornecedoresPeriod.year, fornecedoresPeriod.month, r.fundingSource, r.documentNumber, r.supplierName, r.biddingType, r.processNumber, r.description, Math.round(r.amountReais * 100), fornecedoresSnap, sha(JSON.stringify(r)), JSON.stringify({ source: 'Relatório de Pagamentos a Fornecedores TJCE (xls)' })]);
      }
      const coverageRows: Array<[string, string, string, string, string, number, string | null]> = [
        ['TJCE', 'BUDGET_ANNEX_I', 'ACQUIRED_AND_PARSED', `${anexoIPeriod.year}-${String(anexoIPeriod.month).padStart(2, '0')}`, `${anexoIPeriod.year}-${String(anexoIPeriod.month).padStart(2, '0')}`, financeRows.length, 'Piloto de 1 mês (API REST documentada do TJCE); só o nível de alínea-letra, não os subitens numerados.'],
        ['TJCE', 'SUPPLIER_PAYMENTS', 'ACQUIRED_AND_PARSED', `${fornecedoresPeriod.year}-${String(fornecedoresPeriod.month).padStart(2, '0')}`, `${fornecedoresPeriod.year}-${String(fornecedoresPeriod.month).padStart(2, '0')}`, supplierRows.length, 'Arquivo do TJCE não publica CNPJ, só razão social. 3 fundos (FERMOJU/TESOURO/FUNSEG) somados.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJCE:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, FIN_REVISION_ID, provider, scope, status, first, last, count, lim]);
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [FIN_REVISION_ID]);
    }

    // ============================================================= Revisão de pessoal (escopo JUD_PERSONNEL): sem revisão anterior, inserção direta.
    const semanticPes = sha(JSON.stringify({ efetivosRows, comissaoRows, terceirizadosRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([efetivosSnap, comissaoSnap, terceirizadosSnap]), semanticPes, efetivosRows.length + comissaoRows.length + terceirizadosRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJCE', parser: PARSER, sourceCutoff: '2026-11-08', dataWindow: `${DATA_INICIO}..${DATA_FIM}` })]);
      // Exclui o próprio TJCE do copy-forward: ele está sendo atualizado nesta mesma corrida, os fatos
      // novos abaixo já o substituem por completo — copiar os antigos juntos duplicaria/misturaria dados
      // corrigidos com dados obsoletos do mesmo tribunal (achado real, numa rodada de correção de parser).
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjceId]);
      const insertPersonnel = async (rows: PersonnelRow[], annex: string, period: { year: number; month: number }, snapshotId: string, tag: string) => {
        for (const r of rows) {
          const id = `TJCE:PES:${annex}:${sha(JSON.stringify(r)).slice(0, 40)}`;
          await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJCE',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
            [id, PES_REVISION_ID, tjceId, period.year, period.month, annex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snapshotId, sha(JSON.stringify(r)), JSON.stringify({ source: tag })]);
        }
      };
      await insertPersonnel(efetivosRows, 'ANEXO_IV_A', efetivosPeriod, efetivosSnap, 'Anexo IV A TJCE (xlsx)');
      await insertPersonnel(comissaoRows, 'ANEXO_IV_B', comissaoPeriod, comissaoSnap, 'Anexo IV B TJCE (xlsx)');
      await insertPersonnel(terceirizadosRows, 'ANEXO_VI', terceirizadosPeriod, terceirizadosSnap, 'Anexo VI TJCE (xlsx), agregado por empresa+cargo — nunca nome individual');
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({
    database: db, financeRevision: FIN_REVISION_ID, personnelRevision: PES_REVISION_ID,
    anexoI: { period: anexoIPeriod, rows: financeRows.length }, fornecedores: { period: fornecedoresPeriod, rows: supplierRows.length },
    cargosEfetivos: { period: efetivosPeriod, rows: efetivosRows.length }, cargosComissao: { period: comissaoPeriod, rows: comissaoRows.length }, terceirizados: { period: terceirizadosPeriod, rows: terceirizadosRows.length },
  }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
