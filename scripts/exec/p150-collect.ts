import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';

/** P14.9 — Repercussão Geral do STF: fonte real, achada por investigação (não documentada em nenhum
 * portal de dados abertos do STF — não existe `dadosabertos.stf.jus.br`). A página pública de temas
 * (`portal.stf.jus.br/jurisprudenciaRepercussao/todostemas.asp`) tem um botão "Exportar Dados" que baixa
 * de `exportarDados.asp` um HTML (com content-type `application/vnd.ms-excel`, não realmente .xls) — sem
 * JavaScript, fetch simples com User-Agent genérico funciona (confirmado, HTTP 200). A view declara
 * Charset=UTF-8 e está correta em todo o texto livre (título/descrição/tese com acentuação perfeita),
 * exceto a coluna "Há Repercussão", que vem com um bug de dupla-codificação só nela (achado real,
 * verificado byte a byte) — corrigido por mapa direto dos 4 valores possíveis, não por uma correção de
 * encoding universal (que quebraria o resto do texto, que já está certo). */
const RAW_DIR = 'D:/Civica/judiciario/stf';
const SOURCE_URL = 'https://portal.stf.jus.br/jurisprudenciaRepercussao/exportarDados.asp';
const EDITION_DATE = new Date().toISOString().slice(0, 10);
const REVISION = `p150-stf-rg-${EDITION_DATE.replaceAll('-', '')}`;
const BASELINE = 34_712_267_923;
const MAX_GROWTH = 50_000_000;
const USER_AGENT = 'civica-jud/1.0 (pesquisa de dados abertos)';
const pool = openPool(2);

const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');
const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&aacute;/g, 'á').replace(/\s+/g, ' ').trim();
const extractHref = (html: string): string | null => { const m = html.match(/href="([^"]+)"/); return m ? m[1]!.replace(/&amp;/g, '&') : null; };
const nullable = (v: string | undefined): string | null => { const t = (v ?? '').trim(); return t === '' || t === '-' ? null : t; };
function parseDate(v: string | undefined): string | null {
  const t = nullable(v); if (!t) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
/** Achado real: só esta coluna vem com dupla-codificação UTF-8 (bug da própria fonte) — o resto do texto
 * (título/descrição/tese) decodifica correto em UTF-8 simples, confirmado célula a célula. */
const HAS_REPERCUSSION: Record<string, { has: boolean | null; label: string }> = {
  'HÃ¡': { has: true, label: 'Há' },
  'NÃ£o hÃ¡': { has: false, label: 'Não há' },
  'HÃ¡ (com reafirmaÃ§Ã£o de jurisprudÃªncia)': { has: true, label: 'Há (com reafirmação de jurisprudência)' },
  'NÃ£o hÃ¡ (questÃ£o infraconstitucional)': { has: false, label: 'Não há (questão infraconstitucional)' },
};

interface Tema {
  temaNumber: string; leadingCase: string | null; relatorName: string | null; titulo: string | null; descricao: string | null;
  assuntos: string | null; manifestacaoUrl: string | null; acordaoSearchUrl: string | null; plenarioVirtual: string | null;
  hasRepercussion: boolean | null; situationLabel: string; judgmentDate: string | null; situation: string | null;
  thesis: string | null; thesisDate: string | null; observation: string | null; rawRowHash: string;
}
function parseRows(html: string): Tema[] {
  const bodyStart = html.indexOf('<tbody>'); const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const rowChunks = body.split('<tr>').slice(1);
  const temas: Tema[] = [];
  for (const chunk of rowChunks) {
    const row = chunk.split('</tr>')[0] ?? '';
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]!);
    if (cells.length < 15) continue;
    const temaNumber = stripTags(cells[0]!); if (!/^\d+$/.test(temaNumber)) continue;
    const hasRepRaw = stripTags(cells[9]!); const hasRep = HAS_REPERCUSSION[hasRepRaw] ?? { has: null, label: hasRepRaw };
    temas.push({
      temaNumber, leadingCase: nullable(stripTags(cells[1]!)), relatorName: nullable(stripTags(cells[2]!)),
      titulo: nullable(stripTags(cells[3]!)), descricao: nullable(stripTags(cells[4]!)), assuntos: nullable(stripTags(cells[5]!)),
      manifestacaoUrl: extractHref(cells[6]!), acordaoSearchUrl: extractHref(cells[7]!), plenarioVirtual: nullable(stripTags(cells[8]!)),
      hasRepercussion: hasRep.has, situationLabel: hasRep.label, judgmentDate: parseDate(stripTags(cells[10]!)),
      situation: nullable(stripTags(cells[11]!)), thesis: nullable(stripTags(cells[12]!)), thesisDate: parseDate(stripTags(cells[13]!)),
      observation: nullable(stripTags(cells[14]!)), rawRowHash: sha256(row),
    });
  }
  return temas;
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);

  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status !== 200) throw new Error(`STF export HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(RAW_DIR, { recursive: true });
  const rawPath = path.join(RAW_DIR, `RepercussaoGeral-${EDITION_DATE}.html`);
  await fs.writeFile(rawPath, buf);

  const html = buf.toString('utf8');
  const temas = parseRows(html);
  if (temas.length < 1000) throw new Error(`PARSE_SANITY_GATE failed: só ${temas.length} temas (esperado > 1000)`);

  const snapshotId = `STF:SNAP:${sha256(buf).slice(0, 40)}`;
  const before = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO civica_jud.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details)
       VALUES($1,'STF','repercussao-geral-export',$2,$3,200,$4,$5,$6,$7,'p14.9-v1',$8,$9,0,0,'COMPLETE',$10)
       ON CONFLICT(snapshot_id) DO UPDATE SET fetched_at=EXCLUDED.fetched_at WHERE civica_jud.jud_source_snapshot.sha256 IS DISTINCT FROM EXCLUDED.sha256`,
      [snapshotId, SOURCE_URL, new Date().toISOString(), res.headers.get('content-type') ?? 'application/vnd.ms-excel', buf.length, sha256(buf), rawPath, temas.length, temas.length, JSON.stringify({ exportedAt: EDITION_DATE })],
    );
    for (const t of temas) {
      await client.query(
        `INSERT INTO civica_jud.jud_stf_rg_tema(tema_number,publication_revision_id,leading_case,relator_name,titulo,descricao,assuntos,manifestacao_url,acordao_search_url,plenario_virtual,has_repercussion,judgment_date,situation,thesis,thesis_date,observation,source_snapshot_id,raw_row_hash,provenance)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT(tema_number,publication_revision_id) DO UPDATE SET leading_case=EXCLUDED.leading_case,relator_name=EXCLUDED.relator_name,titulo=EXCLUDED.titulo,descricao=EXCLUDED.descricao,assuntos=EXCLUDED.assuntos,manifestacao_url=EXCLUDED.manifestacao_url,acordao_search_url=EXCLUDED.acordao_search_url,plenario_virtual=EXCLUDED.plenario_virtual,has_repercussion=EXCLUDED.has_repercussion,judgment_date=EXCLUDED.judgment_date,situation=EXCLUDED.situation,thesis=EXCLUDED.thesis,thesis_date=EXCLUDED.thesis_date,observation=EXCLUDED.observation,raw_row_hash=EXCLUDED.raw_row_hash,provenance=EXCLUDED.provenance
         WHERE civica_jud.jud_stf_rg_tema.raw_row_hash IS DISTINCT FROM EXCLUDED.raw_row_hash`,
        [t.temaNumber, REVISION, t.leadingCase, t.relatorName, t.titulo, t.descricao, t.assuntos, t.manifestacaoUrl, t.acordaoSearchUrl, t.plenarioVirtual, t.hasRepercussion, t.judgmentDate, t.situation, t.thesis, t.thesisDate, t.observation, snapshotId, t.rawRowHash, JSON.stringify({ situationLabelRaw: t.situationLabel })],
      );
    }
    const semantic = sha256(temas.map(t => `${t.temaNumber}:${t.rawRowHash}`).sort().join('\n'));
    await client.query(
      `INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance)
       VALUES($1,'STF_REPERCUSSAO_GERAL',$2,$3,$4,'ACTIVE',true,true,(SELECT revision_id FROM civica_jud.jud_publication_revision WHERE scope='STF_REPERCUSSAO_GERAL' AND is_active=true AND revision_id<>$1 ORDER BY created_at DESC LIMIT 1),$5,$5,$6)
       ON CONFLICT(revision_id) DO UPDATE SET semantic_hash=EXCLUDED.semantic_hash,row_count=EXCLUDED.row_count,state='ACTIVE',is_active=true,last_known_good=true,activated_at=EXCLUDED.activated_at,snapshot_ids=EXCLUDED.snapshot_ids
       WHERE civica_jud.jud_publication_revision.semantic_hash IS DISTINCT FROM EXCLUDED.semantic_hash OR civica_jud.jud_publication_revision.is_active IS DISTINCT FROM true`,
      [REVISION, JSON.stringify([snapshotId]), semantic, temas.length, new Date().toISOString(), JSON.stringify({ sourceRows: temas.length, withThesis: temas.filter(t => t.thesis).length })],
    );
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }

  const after = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);
  const growth = after - BASELINE;
  if (growth > MAX_GROWTH) throw new Error(`DB_BUDGET_GATE failed: ${growth}`);
  console.log(JSON.stringify({
    database: db, revision: REVISION, sourceBytes: buf.length, temas: temas.length,
    withThesis: temas.filter(t => t.thesis).length, hasRepercussion: temas.filter(t => t.hasRepercussion === true).length,
    situationCounts: Object.fromEntries([...new Set(temas.map(t => t.situation ?? 'null'))].map(s => [s, temas.filter(t => (t.situation ?? 'null') === s).length])),
    dbBefore: before, dbAfter: after, dbGrowth: growth, dbRemaining: MAX_GROWTH - growth,
  }, null, 2));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
