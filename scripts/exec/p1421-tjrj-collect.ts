import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { TJRJ_SOURCES, downloadToD, parseAnexoIVA, parseAnexoIVB, type PersonnelRow } from '../../apps/collector/src/judiciary-tjrj.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjrj');
const PES_REVISION_ID = 'p1421-tjrj-personnel-20261109';
const PARSER = 'p14.21-tjrj-v1';
const PERSONNEL_PERIOD = { year: 2026, month: 8 }; // "Mês/Ano Base: 08/2026", confirmado ao vivo no próprio PDF

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJRJ:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjrjId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJRJ'`)).rows[0]?.tribunal_id;
  if (!tjrjId) throw new Error('TJRJ tribunal missing from jud_tribunal');

  const ivaSrc = TJRJ_SOURCES.anexoIVA(PERSONNEL_PERIOD.year, 'agosto');
  const ivbSrc = TJRJ_SOURCES.anexoIVB(PERSONNEL_PERIOD.year, 'agosto');
  const ivaDl = await downloadToD(ivaSrc.url, PES_DIR, `anexo-iv-a-agosto-${PERSONNEL_PERIOD.year}.pdf`);
  const ivbDl = await downloadToD(ivbSrc.url, PES_DIR, `anexo-iv-b-agosto-${PERSONNEL_PERIOD.year}.pdf`);

  const ivaRows: PersonnelRow[] = await parseAnexoIVA(ivaDl.path);
  const ivbRows: PersonnelRow[] = await parseAnexoIVB(ivbDl.path);
  if (!ivaRows.length) throw new Error('Anexo IV-A TJRJ sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!ivbRows.length) throw new Error('Anexo IV-B TJRJ sem linhas reconhecidas');
  const personnelRows: Array<PersonnelRow & { sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }> = [
    ...ivaRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_A' as const })),
    ...ivbRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_B' as const })),
  ];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, await snapshotMeta(ivaDl, 'TJRJ', ivaSrc.url, ivaRows.length, ivaRows.length));
    const ivbSnap = await insertSnapshot(c, await snapshotMeta(ivbDl, 'TJRJ', ivbSrc.url, ivbRows.length, ivbRows.length));
    const snapFor = (annex: 'ANEXO_IV_A' | 'ANEXO_IV_B') => annex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;

    const semanticPes = sha(JSON.stringify({ tjrj: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJRJ', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjrjId]);
      for (const r of personnelRows) {
        const id = `TJRJ:PES:${r.sourceAnnex}:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJRJ',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjrjId, PERSONNEL_PERIOD.year, PERSONNEL_PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snapFor(r.sourceAnnex), sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo ${r.sourceAnnex === 'ANEXO_IV_A' ? 'IV-A' : 'IV-B'} TJRJ (pdf, extração de texto)` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // Financeiro: página "Valores Pagos aos Contratados" carrega mas o corpo vem vazio (confirmado ao vivo,
    // sem erro de rede) — lacuna real do próprio site do TJRJ, não falta de investigação. Registrado contra
    // a revisão JUD_FINANCE já ativa (coverage é upsert por chave estável, não precisa revisão nova).
    const activeFin = (await c.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id;
    if (activeFin) {
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJRJ:COV:${sha('TJRJ|SUPPLIER_PAYMENTS').slice(0, 32)}`, activeFin, 'TJRJ', 'SUPPLIER_PAYMENTS', 'SOURCE_PAGE_BROKEN', null, null, 0, 'Página "Valores Pagos aos Contratados" (Resolução CNJ 215/2015 e 265/2018) carrega mas devolve corpo vazio no próprio site do TJRJ — confirmado ao vivo, sem erro de rede. Não coletado neste piloto.']);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, ivA: { rows: ivaRows.length }, ivB: { rows: ivbRows.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
