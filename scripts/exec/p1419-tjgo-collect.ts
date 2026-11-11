import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { anexoIvaUrl, anexoIvbUrl, downloadToD, parseAnexoIVA, parseAnexoIVB, type PersonnelRow } from '../../apps/collector/src/judiciary-tjgo.ts';

const ROOT = 'D:\\Civica\\judiciario';
const PES_DIR = path.join(ROOT, 'pessoal', 'tjgo');
const PES_REVISION_ID = 'p1419-tjgo-personnel-20261109b'; // 'b': coluna "Vagos" do Anexo IV-A era total por cargo repetido por linha de classe/padrão — corrigido pra 1x por cargo depois da 1ª tentativa
const PARSER = 'p14.19-tjgo-v1';
const PERIOD = { year: 2026, month: 10 }; // Outubro/2026, confirmado ao vivo na própria planilha ("Referência: Outubro/2026")

const sha = (v: Buffer | string) => crypto.createHash('sha256').update(v).digest('hex');
const pool = openPool(4);

interface SnapshotMeta { snapshotId: string; provider: string; resourceName: string; sourceUrl: string; fetchedAt: string; httpStatus: number; contentType: string | null; bytes: number; sha256: string; rawPath: string; sourceRows: number; parsedRows: number }
async function snapshotMeta(dl: Awaited<ReturnType<typeof downloadToD>>, provider: string, sourceUrl: string, sourceRows: number, parsedRows: number): Promise<SnapshotMeta> {
  return { snapshotId: `TJGO:${provider}:${dl.sha256.slice(0, 40)}`, provider, resourceName: path.basename(dl.path), sourceUrl, fetchedAt: new Date().toISOString(), httpStatus: dl.httpStatus, contentType: dl.contentType, bytes: dl.bytes, sha256: dl.sha256, rawPath: dl.path, sourceRows, parsedRows };
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
  const tjgoId = (await pool.query(`SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE sigla='TJGO'`)).rows[0]?.tribunal_id;
  if (!tjgoId) throw new Error('TJGO tribunal missing from jud_tribunal');

  const ivaUrl = anexoIvaUrl(PERIOD.year, PERIOD.month);
  const ivbUrl = anexoIvbUrl(PERIOD.year, PERIOD.month);
  const ivaDl = await downloadToD(ivaUrl, PES_DIR, `anexo-iv-a-${PERIOD.year}-${String(PERIOD.month).padStart(2, '0')}.xlsx`);
  const ivbDl = await downloadToD(ivbUrl, PES_DIR, `anexo-iv-b-${PERIOD.year}-${String(PERIOD.month).padStart(2, '0')}.xlsx`);

  const ivaRows: PersonnelRow[] = await parseAnexoIVA(ivaDl.path);
  const ivbRows: PersonnelRow[] = await parseAnexoIVB(ivbDl.path);
  if (!ivaRows.length) throw new Error('Anexo IV-A TJGO sem linhas reconhecidas — parser pode ter quebrado no layout real');
  if (!ivbRows.length) throw new Error('Anexo IV-B TJGO sem linhas reconhecidas');
  const personnelRows: Array<PersonnelRow & { sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }> = [
    ...ivaRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_A' as const })),
    ...ivbRows.map(r => ({ ...r, sourceAnnex: 'ANEXO_IV_B' as const })),
  ];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const ivaSnap = await insertSnapshot(c, await snapshotMeta(ivaDl, 'TJGO', ivaUrl, ivaRows.length, ivaRows.length));
    const ivbSnap = await insertSnapshot(c, await snapshotMeta(ivbDl, 'TJGO', ivbUrl, ivbRows.length, ivbRows.length));
    const snapFor = (annex: 'ANEXO_IV_A' | 'ANEXO_IV_B') => annex === 'ANEXO_IV_A' ? ivaSnap : ivbSnap;

    // ============================================================= Pessoal (escopo JUD_PERSONNEL, compartilhado entre tribunais)
    const semanticPes = sha(JSON.stringify({ tjgo: personnelRows }));
    const prevPes = (await c.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
    if (prevPes?.semantic_hash !== semanticPes) {
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='JUD_PERSONNEL'`);
      await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'JUD_PERSONNEL',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`,
        [PES_REVISION_ID, JSON.stringify([ivaSnap, ivbSnap]), semanticPes, personnelRows.length, prevPes?.revision_id ?? null, JSON.stringify({ provider: 'TJGO', parser: PARSER, sourceCutoff: '2026-11-09' })]);
      if (prevPes) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) SELECT fact_id,$1,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$2 AND tribunal_id<>$3`, [PES_REVISION_ID, prevPes.revision_id, tjgoId]);
      for (const r of personnelRows) {
        const id = `TJGO:PES:${r.sourceAnnex}:${sha(JSON.stringify(r)).slice(0, 40)}`;
        await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_personnel_fact(fact_id,publication_revision_id,tribunal_id,source_institution,reference_year,reference_month,source_annex,career_track,position_title,class_level,status,headcount,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,'TJGO',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id, PES_REVISION_ID, tjgoId, PERIOD.year, PERIOD.month, r.sourceAnnex, r.careerTrack, r.positionTitle, r.classLevel, r.status, r.headcount, snapFor(r.sourceAnnex), sha(JSON.stringify(r)), JSON.stringify({ source: `Anexo ${r.sourceAnnex === 'ANEXO_IV_A' ? 'IV-A' : 'IV-B'} TJGO (xlsx, exportação parametrizada ano/mês)` })]);
      }
      await c.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,activated_at=now() WHERE revision_id=$1`, [PES_REVISION_ID]);
    }

    // ============================================================= Financeiro: TJGO não contribui nenhum fato — só registra a lacuna CONFIRMADA
    // (Anexo I/II e Lei 17.928/2012 são Power BI embutido, sem exportação) contra a revisão JUD_FINANCE já
    // ativa (não precisa criar revisão nova: coverage não tem copy-forward, é upsert por coverage_id estável).
    const activeFin = (await c.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id;
    if (activeFin) {
      const coverageRows: Array<[string, string, string, string | null, string | null, number, string]> = [
        ['TJGO', 'BUDGET_ANNEX_I_II', 'DOCUMENTED_POWERBI_ONLY', null, null, 0, 'Anexo I e II são relatório Power BI embutido (iframe app.powerbi.com), sem exportação de arquivo — confirmado ao vivo, não coletado neste piloto.'],
        ['TJGO', 'SUPPLIER_PAYMENTS', 'DOCUMENTED_POWERBI_ONLY', null, null, 0, 'Relatório de aquisições (Lei estadual 17.928/2012) também é Power BI embutido, sem exportação de arquivo — confirmado ao vivo, não coletado neste piloto.'],
      ];
      for (const [provider, scope, status, first, last, count, lim] of coverageRows) await c.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_fin_coverage(coverage_id,publication_revision_id,source_provider,scope,status,first_period,last_period,row_count,limitation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (coverage_id) DO UPDATE SET publication_revision_id=EXCLUDED.publication_revision_id,status=EXCLUDED.status,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,row_count=EXCLUDED.row_count,limitation=EXCLUDED.limitation`,
        [`TJGO:COV:${sha(`${provider}|${scope}`).slice(0, 32)}`, activeFin, provider, scope, status, first, last, count, lim]);
    }

    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }

  console.log(JSON.stringify({ database: db, personnelRevision: PES_REVISION_ID, ivA: { rows: ivaRows.length }, ivB: { rows: ivbRows.length } }, null, 2));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
