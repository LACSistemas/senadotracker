import { appendFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Pool } from 'pg';
import { assertVolume, recordManifest, registerLocalRaw, type StorageConfig } from './storage.ts';

/**
 * Enriquecimento DEMAS (apidadosabertos.saude.gov.br/cnes/estabelecimentos): nome, razão social, endereço, CEP e coordenadas de estabelecimentos INSTITUCIONAIS
 * (hospitais, UBS). Limite do serviço: 20 itens por página, paginação por offset; o filtro por codigo_tipo_unidade funciona. Não coleta telefone, e-mail nem
 * consultórios individuais (nome de pessoa física). Atualiza somente colunas descritivas de exec_sau_cnes_estab; nunca cria estabelecimento nem toca em intervalos.
 */
const BASE = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export interface DemasSummary { tpUnid: number; pages: number; fetched: number; updated: number; withCoords: number; unknownCnes: number; bytes: number; sha256: string; seconds: number; httpErrors: number }

export async function enrichDemas(pool: Pool, cfg: StorageConfig, o: { tpUnid: number; delayMs?: number; maxPages?: number; log?: (m: string) => void }): Promise<DemasSummary> {
  await assertVolume(cfg);
  const t0 = Date.now(); const today = new Date().toISOString().slice(0, 10);
  const rel = `referencias/demas/estabelecimentos_tp${o.tpUnid}_${today}.jsonl`; const abs = join(cfg.rawDir, rel);
  await mkdir(dirname(abs), { recursive: true }); await rm(abs, { force: true });
  const rows: Array<Record<string, unknown>> = []; let pages = 0, httpErrors = 0;
  for (let offset = 0; ; offset += 20) {
    if (o.maxPages && pages >= o.maxPages) break;
    type Page = { estabelecimentos?: Array<Record<string, unknown>> };
    let body = null as Page | null;
    for (let attempt = 1; attempt <= 4 && !body; attempt++) {
      try {
        const r = await fetch(`${BASE}?codigo_tipo_unidade=${o.tpUnid}&status=1&limit=20&offset=${offset}`, { headers: { 'User-Agent': 'civica-exec/1.0 (pesquisa de dados abertos)' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        body = await r.json() as Page;
      } catch { httpErrors++; await sleep(1500 * attempt); }
    }
    if (!body) throw new Error(`DEMAS: página offset=${offset} falhou após 4 tentativas (tipo ${o.tpUnid})`);
    const items = body.estabelecimentos ?? []; pages++;
    if (!items.length) break;
    await appendFile(abs, items.map(i => JSON.stringify(i)).join('\n') + '\n'); rows.push(...items);
    if (pages % 50 === 0) o.log?.(`tp${o.tpUnid}: ${pages} páginas, ${rows.length} registros`);
    await sleep(o.delayMs ?? 350);
  }
  const entry = await registerLocalRaw(cfg, { url: `${BASE}?codigo_tipo_unidade=${o.tpUnid}&status=1`, relPath: rel, competence: null, uf: 0, retention: 1, dataset: 'demas_estab' });
  await recordManifest(pool, entry);
  const seen = new Set<number>(); const batch: Array<Record<string, unknown>> = [];
  for (const i of rows) {
    const cnes = Number(i.codigo_cnes); if (!cnes || seen.has(cnes)) continue; seen.add(cnes);
    const lat = Number(i.latitude_estabelecimento_decimo_grau), lon = Number(i.longitude_estabelecimento_decimo_grau);
    const ok = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -34 && lat <= 6 && lon >= -74 && lon <= -33;
    const addr = [i.endereco_estabelecimento, i.numero_estabelecimento, i.bairro_estabelecimento].filter(Boolean).join(', ');
    batch.push({
      cnes, name: i.nome_fantasia || i.nome_razao_social || null, legal_name: i.nome_razao_social ?? null, address: addr || null,
      cep: /^\d{8}$/.test(String(i.codigo_cep_estabelecimento)) ? Number(i.codigo_cep_estabelecimento) : null, lat: ok ? lat : null, lon: ok ? lon : null,
      descr_updated_at: /^\d{4}-\d{2}-\d{2}/.test(String(i.data_atualizacao)) ? String(i.data_atualizacao).slice(0, 10) : null,
    });
  }
  let updated = 0;
  for (let k = 0; k < batch.length; k += 2000) {
    const r = await pool.query(`UPDATE civica_exec.exec_sau_cnes_estab t SET name = s.name, legal_name = s.legal_name, address = s.address, cep = s.cep, lat = s.lat, lon = s.lon, descr_updated_at = s.descr_updated_at
      FROM jsonb_to_recordset($1::jsonb) AS s(cnes integer, name text, legal_name text, address text, cep integer, lat real, lon real, descr_updated_at date) WHERE t.cnes = s.cnes
      AND (t.name, t.legal_name, t.address, t.cep, t.lat, t.lon, t.descr_updated_at) IS DISTINCT FROM (s.name, s.legal_name, s.address, s.cep, s.lat, s.lon, s.descr_updated_at)`, [JSON.stringify(batch.slice(k, k + 2000))]);
    updated += r.rowCount ?? 0;
  }
  const known = Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_sau_cnes_estab WHERE cnes = ANY($1::int[])`, [batch.map(b => b.cnes)])).rows[0].n);
  return { tpUnid: o.tpUnid, pages, fetched: batch.length, updated, withCoords: batch.filter(b => b.lat !== null).length, unknownCnes: batch.length - known, bytes: entry.bytes, sha256: entry.sha256, seconds: Math.round((Date.now() - t0) / 1000), httpErrors };
}
