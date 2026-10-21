import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchRaw, recordManifest, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * Piloto Siconfi (RREO) por ente: preserva a resposta RAW de cada chamada e mede latência/volume. NÃO publica fatos nem indicadores:
 * a despesa por função (Anexo 02) não é ASPS; o Anexo 12 (ASPS) não vem no RREO Simplificado e precisa de contrato próprio antes de qualquer indicador.
 * Uso: node --import tsx scripts/exec/siconfi-pilot.ts   (lista fixa abaixo; ~6 chamadas)
 */
const API = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo';
const calls = [
  { ente: 3205309, nome: 'Vitória (padrão)', tipo: 'RREO', anexo: 'RREO-Anexo 02' },
  { ente: 3205309, nome: 'Vitória (padrão)', tipo: 'RREO', anexo: 'RREO-Anexo 12' },
  { ente: 32, nome: 'Espírito Santo (estado)', tipo: 'RREO', anexo: 'RREO-Anexo 02' },
  { ente: 32, nome: 'Espírito Santo (estado)', tipo: 'RREO', anexo: 'RREO-Anexo 12' },
  { ente: 3200359, nome: 'Alto Rio Novo (simplificado)', tipo: 'RREO Simplificado', anexo: null },
];
const cfg = storageConfig(); const pool = openPool(2);
try {
  const out: Array<Record<string, unknown>> = [];
  for (const c of calls) {
    const t0 = Date.now();
    const qs = `an_exercicio=2024&nr_periodo=6&co_tipo_demonstrativo=${encodeURIComponent(c.tipo)}${c.anexo ? `&no_anexo=${encodeURIComponent(c.anexo)}` : ''}&id_ente=${c.ente}`;
    const rel = `siconfi/rreo/${c.ente}/2024_6_${(c.anexo ?? c.tipo).replace(/[^A-Za-z0-9]+/g, '_')}.json`;
    const f = await fetchRaw(cfg, { url: `${API}?${qs}`, relPath: rel, competence: 202412, uf: c.ente > 99 ? Number(String(c.ente).slice(0, 2)) : c.ente, retention: 1, dataset: 'siconfi_rreo', dedupeByHash: true });
    await recordManifest(pool, f);
    const j = JSON.parse(await readFile(join(cfg.rawDir, f.relPath), 'utf8')) as { items: Array<Record<string, unknown>>; hasMore: boolean };
    const saude = j.items.filter(x => x.cod_conta === 'RREO2TotalDespesas' && x.conta === 'Saúde' && String(x.coluna).startsWith('DESPESAS EMPENHADAS ATÉ O BIMESTRE'));
    const rec = { ...c, ms: Date.now() - t0, bytes: f.bytes, sha256: f.sha256.slice(0, 16), items: j.items.length, hasMore: j.hasMore, anexos: [...new Set(j.items.map(x => String(x.anexo)))], saudeEmpenhadaAteBimestre: saude[0]?.valor ?? null };
    out.push(rec); console.log(JSON.stringify(rec));
    await new Promise(r => setTimeout(r, 1500));
  }
  await writeFile('docs/executivo-collector-plan/execucao/saude-nacional-p1/siconfi_piloto.json', JSON.stringify(out, null, 2));
} finally { await pool.end(); }
