import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';

/** P14.10 — remuneração de Ministros do STF (ativos e aposentados) e de quem ocupa o cargo comissionado
 * "Assessor de Ministro": fonte real, achada por investigação — `egesp-portal.stf.jus.br/transparencia/
 * rendimento_folha`, o Portal da Transparência de pessoal do próprio STF (divulgação voluntária desde
 * 2012; Rails + Ransack, formulário GET simples, sem bloqueio a fetch simples — diferente de
 * `transparencia.stf.jus.br`, que devolve 403 e não é tocado). Confirmado por teste real: Ago/2026 é o
 * último mês publicado em 2026-11 (Set/Out ainda vazios — a fonte publica com ~2 meses de defasagem).
 * Cada pessoa tem um detalhamento oficial por rubrica (A-S: vencimentos, vantagens, descontos,
 * benefícios), obtido por uma segunda chamada (`show_detalhes?id=`) — replicamos os valores exatamente
 * como a fonte publica, nunca um resumo nosso. Escopo deliberadamente restrito a estes dois grupos
 * (cargo efetivo MINISTRO=55; cargo comissionado ASSESSOR DE MINISTRO=1032) — não ao quadro de pessoal
 * inteiro do STF (milhares de nomes), que não foi pedido e que extrapolaria o que o produto se propõe a
 * mostrar nominalmente. */
const RAW_DIR = 'D:/Civica/judiciario/stf-rendimento';
const BASE_URL = 'https://egesp-portal.stf.jus.br/transparencia/rendimento_folha';
const DETAIL_URL = 'https://egesp-portal.stf.jus.br/transparencia/show_detalhes';
const USER_AGENT = 'civica-jud/1.0 (pesquisa de dados abertos)';
const EDITION_DATE = new Date().toISOString().slice(0, 10);
const REVISION = `p151-stf-payroll-${EDITION_DATE.replaceAll('-', '')}`;
const BASELINE = 34_715_315_347;
const MAX_GROWTH = 20_000_000;
const pool = openPool(2);

const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');
const nullable = (v: string | undefined | null) => { const t = (v ?? '').trim(); return t === '' || t === '-' ? null : t; };
const parseMoney = (v: string | undefined | null) => { const t = nullable(v); if (!t) return null; const n = Number(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
function parseBrDate(v: string | undefined | null) { const t = nullable(v); if (!t) return null; const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }

async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  let last: unknown;
  for (let n = 1; n <= tries; n++) {
    try { const r = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) } }); if (r.status !== 200) throw new Error(`HTTP ${r.status}`); return r; }
    catch (e) { last = e; await new Promise(res => setTimeout(res, 600 * n)); }
  }
  throw new Error(`falha ao obter ${url}: ${last instanceof Error ? last.message : String(last)}`);
}

interface Row {
  matricula: string; nome: string; role: 'MINISTRO' | 'ASSESSOR_MINISTRO';
  cargoEfetivo: string | null; cargoComissionado: string | null; nomeFuncao: string | null; lotacao: string | null; situacaoFuncional: string | null;
  bruto: number | null; liquido: number | null; detailId: string | null; rawRowHash: string;
}
function parseRoster(html: string, role: Row['role']): Row[] {
  const tStart = html.indexOf('<table'); const tEnd = html.indexOf('</table>', tStart);
  if (tStart < 0 || tEnd < 0) return [];
  const table = html.slice(tStart, tEnd);
  const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]!);
  const out: Row[] = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]!);
    if (cells.length < 10) continue;
    const strip = (c: string) => c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const matricula = strip(cells[0]!);
    if (!/^\d+$/.test(matricula)) continue;
    const idMatch = cells[9]!.match(/id=(\d+)/);
    out.push({
      matricula, nome: strip(cells[1]!), role,
      cargoEfetivo: nullable(strip(cells[2]!)), cargoComissionado: nullable(strip(cells[3]!)), nomeFuncao: nullable(strip(cells[4]!)),
      lotacao: nullable(strip(cells[5]!)), situacaoFuncional: nullable(strip(cells[6]!)),
      bruto: parseMoney(strip(cells[7]!)), liquido: parseMoney(strip(cells[8]!)),
      detailId: idMatch ? idMatch[1]! : null, rawRowHash: sha256(tr),
    });
  }
  return out;
}

const RUBRICA_KEYS: Record<string, string> = {
  'Vencimentos / Subsídios': 'vencimentos_subsidios', 'Vantagens Pessoais': 'vantagens_pessoais',
  'Vantagens de natureza periódica/eventual ou relativas às lotações dos servidores': 'vantagens_periodicas_eventuais',
  'Exercício de cargo em comissão/função comissionada': 'cargo_comissao', 'Rendimento Bruto antes do teto constitucional': 'bruto_antes_teto',
  'Total bruto após teto constitucional': 'bruto_apos_teto', 'Abono de Permanência': 'abono_permanencia',
  'Contribuição previdenciária': 'contribuicao_previdenciaria', 'Imposto de Renda': 'imposto_renda',
  'Total de descontos compulsórios': 'total_descontos_compulsorios', 'Abate teto': 'abate_teto', 'Descontos diversos': 'descontos_diversos',
  'Total de descontos': 'total_descontos', 'Férias': 'ferias', 'Gratificação natalina e antecipação': 'gratificacao_natalina',
  'Auxílios e benefícios': 'auxilios_beneficios', 'Indenizações': 'indenizacoes',
  'Exercícios Anteriores e licença prêmio convertida em pecúnia': 'exercicios_anteriores_licenca_premio', 'Auxílio Moradia': 'auxilio_moradia',
};
/** O HTML do modal tem 3 tabelas (remuneratórias A-G, descontos H-M, benefícios N-S); em cada uma, a
 * 1ª <tr> da <thead> traz os rótulos "(X) Nome" em <strong>, e a 2ª <tr> traz os valores "R$ ..." na
 * MESMA ordem de coluna — não lado a lado na mesma célula, por isso o zip é por posição, não por regex
 * de proximidade textual. */
function parseDetail(rawJs: string): { admissao: string | null; rubricas: Record<string, number> } {
  const m = rawJs.match(/html\("([\s\S]*)"\);/);
  let html = m ? m[1]! : rawJs;
  html = html.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/');
  const admMatch = html.match(/Data de Admiss[aã]o:\s*<\/[^>]+>\s*<[^>]+>\s*([^<]+)</);
  const admissao = parseBrDate(admMatch?.[1]);
  const rubricas: Record<string, number> = {};
  const tableBlocks = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map(t => t[1]!);
  for (const table of tableBlocks) {
    const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(t => t[1]!);
    if (trs.length < 2) continue;
    const labelCells = [...trs[0]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const valueCells = [...trs[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (labelCells.length !== valueCells.length || !labelCells.some(l => /^\([A-S]\)/.test(l))) continue;
    for (let i = 0; i < labelCells.length; i++) {
      const label = labelCells[i]!.replace(/^\([A-S]\)\s*/, '');
      const key = RUBRICA_KEYS[label];
      if (key) rubricas[key] = parseMoney(valueCells[i]) ?? 0;
    }
  }
  return { admissao, rubricas };
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);

  let ano = 0, mes = 0, html55 = '', html1032 = '';
  const now = new Date();
  for (let back = 1; back <= 6; back++) {
    const probe = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const pAno = probe.getFullYear(), pMes = probe.getMonth() + 1;
    const url = `${BASE_URL}?q%5Bano_eq%5D=${pAno}&q%5Bmes_eq%5D=${pMes}&q%5Bcdg_cargo_efetivo_in%5D%5B%5D=55`;
    const r = await fetchWithRetry(url);
    const h = await r.text();
    if (parseRoster(h, 'MINISTRO').length > 0) { ano = pAno; mes = pMes; html55 = h; break; }
  }
  if (!ano) throw new Error('SOURCE_EMPTY: nenhum mês recente com dados de Ministros');
  const r1032 = await fetchWithRetry(`${BASE_URL}?q%5Bano_eq%5D=${ano}&q%5Bmes_eq%5D=${mes}&q%5Bcdg_cargo_comissionado_in%5D%5B%5D=1032`);
  html1032 = await r1032.text();

  const rows = [...parseRoster(html55, 'MINISTRO'), ...parseRoster(html1032, 'ASSESSOR_MINISTRO')];
  if (rows.length < 20) throw new Error(`PARSE_SANITY_GATE failed: só ${rows.length} linhas (esperado >= 20 entre ministros e assessores)`);

  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.writeFile(path.join(RAW_DIR, `rendimento-ministros-${ano}-${String(mes).padStart(2, '0')}.html`), html55);
  await fs.writeFile(path.join(RAW_DIR, `rendimento-assessores-${ano}-${String(mes).padStart(2, '0')}.html`), html1032);

  type Full = Row & { admissao: string | null; rubricas: Record<string, number> };
  const full: Full[] = [];
  for (const row of rows) {
    if (!row.detailId) { full.push({ ...row, admissao: null, rubricas: {} }); continue; }
    const dr = await fetchWithRetry(`${DETAIL_URL}?id=${row.detailId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const dj = await dr.text();
    const { admissao, rubricas } = parseDetail(dj);
    full.push({ ...row, admissao, rubricas });
    await new Promise(res => setTimeout(res, 150));
  }

  const combinedBytes = Buffer.from(html55 + html1032, 'utf8');
  const snapshotId = `STF:PAYROLL:SNAP:${sha256(combinedBytes).slice(0, 40)}`;
  const before = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO civica_jud.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details)
       VALUES($1,'STF','ministro-rendimento-folha',$2,$3,200,'text/html',$4,$5,$6,'p14.10-v1',$7,$7,0,0,'COMPLETE',$8)
       ON CONFLICT(snapshot_id) DO UPDATE SET fetched_at=EXCLUDED.fetched_at WHERE civica_jud.jud_source_snapshot.sha256 IS DISTINCT FROM EXCLUDED.sha256`,
      [snapshotId, BASE_URL, new Date().toISOString(), combinedBytes.length, sha256(combinedBytes), RAW_DIR, full.length, JSON.stringify({ ano, mes })],
    );
    for (const p of full) {
      await client.query(
        `INSERT INTO civica_jud.jud_stf_rendimento_mensal(matricula,ano,mes,publication_revision_id,nome,role,cargo_efetivo,cargo_comissionado,nome_funcao,lotacao,situacao_funcional,remuneracao_bruta,remuneracao_liquida,data_admissao,rubricas,detail_source_id,source_snapshot_id,raw_row_hash,provenance)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT(matricula,ano,mes,publication_revision_id) DO UPDATE SET nome=EXCLUDED.nome,role=EXCLUDED.role,cargo_efetivo=EXCLUDED.cargo_efetivo,cargo_comissionado=EXCLUDED.cargo_comissionado,nome_funcao=EXCLUDED.nome_funcao,lotacao=EXCLUDED.lotacao,situacao_funcional=EXCLUDED.situacao_funcional,remuneracao_bruta=EXCLUDED.remuneracao_bruta,remuneracao_liquida=EXCLUDED.remuneracao_liquida,data_admissao=EXCLUDED.data_admissao,rubricas=EXCLUDED.rubricas,detail_source_id=EXCLUDED.detail_source_id,raw_row_hash=EXCLUDED.raw_row_hash
         WHERE civica_jud.jud_stf_rendimento_mensal.raw_row_hash IS DISTINCT FROM EXCLUDED.raw_row_hash`,
        [p.matricula, ano, mes, REVISION, p.nome, p.role, p.cargoEfetivo, p.cargoComissionado, p.nomeFuncao, p.lotacao, p.situacaoFuncional, p.bruto, p.liquido, p.admissao, JSON.stringify(p.rubricas), p.detailId, snapshotId, p.rawRowHash, JSON.stringify({})],
      );
    }
    const semantic = sha256(full.map(p => `${p.matricula}:${p.rawRowHash}`).sort().join('\n'));
    await client.query(
      `INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance)
       VALUES($1,'STF_MINISTER_PAYROLL',$2,$3,$4,'ACTIVE',true,true,(SELECT revision_id FROM civica_jud.jud_publication_revision WHERE scope='STF_MINISTER_PAYROLL' AND is_active=true AND revision_id<>$1 ORDER BY created_at DESC LIMIT 1),$5,$5,$6)
       ON CONFLICT(revision_id) DO UPDATE SET semantic_hash=EXCLUDED.semantic_hash,row_count=EXCLUDED.row_count,state='ACTIVE',is_active=true,last_known_good=true,activated_at=EXCLUDED.activated_at,snapshot_ids=EXCLUDED.snapshot_ids
       WHERE civica_jud.jud_publication_revision.semantic_hash IS DISTINCT FROM EXCLUDED.semantic_hash OR civica_jud.jud_publication_revision.is_active IS DISTINCT FROM true`,
      [REVISION, JSON.stringify([snapshotId]), semantic, full.length, new Date().toISOString(), JSON.stringify({ ano, mes, ministros: full.filter(p => p.role === 'MINISTRO').length, assessores: full.filter(p => p.role === 'ASSESSOR_MINISTRO').length })],
    );
    // desativa revisões antigas do mesmo escopo (só uma fica ativa, igual ao padrão dos demais escopos)
    await client.query(`UPDATE civica_jud.jud_publication_revision SET is_active=false WHERE scope='STF_MINISTER_PAYROLL' AND revision_id<>$1`, [REVISION]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }

  const after = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);
  const growth = after - BASELINE;
  if (growth > MAX_GROWTH) throw new Error(`DB_BUDGET_GATE failed: ${growth}`);
  console.log(JSON.stringify({
    database: db, revision: REVISION, ano, mes, total: full.length,
    ministros: full.filter(p => p.role === 'MINISTRO').length, assessores: full.filter(p => p.role === 'ASSESSOR_MINISTRO').length,
    dbBefore: before, dbAfter: after, dbGrowth: growth, dbRemaining: MAX_GROWTH - growth,
  }, null, 2));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
