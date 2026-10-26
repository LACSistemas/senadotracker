import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { HttpGate } from '../../apps/collector/src/exec/http-gate.ts';
import { recordManifest, registerLocalRaw, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * Coleta RAW complementar do PNCP para os contratos educacionais (P10.7), somente o necessário:
 *   compras  = a contratação (licitação/dispensa) de cada contrato: valor estimado e homologado, modalidade, situação   (API de consulta, 1 chamada por compra)
 *   termos   = termos aditivos, apostilamentos e rescisões de cada contrato (1 chamada por contrato; registros do tipo Empenho não têm termo e ficam de fora)
 * A fila vem da varredura de classificação (lista JSONL de contratos educacionais) e é ordenada por VALOR decrescente: o que concentra mais dinheiro é coletado primeiro, e a cobertura
 * ainda pendente é declarada, nunca presumida. Cada resposta é gravada verbatim (`{k, s, b}`) em lotes de 2.000 em raw/pncp/{compras,termos}/ e registrada no manifesto; retomável.
 *   npx tsx scripts/exec/pncp-complement.ts <compras|termos> <lista.jsonl> [limite] [simultaneidade] [espaçamento_ms]
 */
const [kind, listPath, limitArg, concArg, spacingArg] = process.argv.slice(2);
if (kind !== 'compras' && kind !== 'termos') throw new Error('use compras ou termos');
const cfg = storageConfig(); const pool = openPool(2);
const dir = join(cfg.rawDir, 'pncp', kind); await mkdir(dir, { recursive: true });
const gate = new HttpGate(Number(spacingArg ?? 130), 'civica-exec/1.0 (pesquisa de dados abertos)', 3000, 50, 0.85);
const API = kind === 'compras' ? 'https://pncp.gov.br/api/consulta/v1/orgaos' : 'https://pncp.gov.br/api/pncp/v1/orgaos';
const LOT = 2000; const cur = join(dir, 'current.jsonl');
const log = (m: Record<string, unknown>) => { const s = JSON.stringify({ at: new Date().toISOString(), ...m }); console.log(s); void appendFile(join(cfg.logsDir, `pncp-complement-${kind}.jsonl`), s + '\n'); };
await mkdir(cfg.logsDir, { recursive: true });

// ------------------------------------------------------------ chaves já coletadas (lotes fechados + parcial)
const done = new Set<string>(); let lotNo = 0;
for (const f of (await readdir(dir)).sort()) {
  if (!/^b\d+\.jsonl\.gz$/.test(f)) continue; lotNo = Math.max(lotNo, Number(/b(\d+)/.exec(f)![1]));
  for await (const l of createInterface({ input: createReadStream(join(dir, f)).pipe(createGunzip()), crlfDelay: Infinity })) { if (!l.trim()) continue; const x = JSON.parse(l) as { k: string; s: number }; if (x.s === 200 || x.s === 404 || x.s === 204) done.add(x.k); }
}
let curLines = 0; try { for (const l of (await readFile(cur, 'utf8')).split('\n')) { if (!l.trim()) continue; try { const x = JSON.parse(l) as { k: string; s: number }; curLines++; if (x.s === 200 || x.s === 404 || x.s === 204) done.add(x.k); } catch { /* truncada */ } } } catch { /* sem parcial */ }

// ------------------------------------------------------------ fila (por valor decrescente)
interface Item { k: string; url: string; v: number }
const queue = new Map<string, Item>();
const PNCP_ID = /^(\d{14})-(\d)-(\d+)\/(\d{4})$/;
for await (const l of createInterface({ input: createReadStream(listPath!), crlfDelay: Infinity })) {
  if (!l.trim()) continue; const c = JSON.parse(l) as { id: string; compra: string | null; tipo: number; v: number | null };
  const v = c.v ?? 0;
  if (kind === 'compras') {
    const m = c.compra ? PNCP_ID.exec(c.compra) : null; if (!m || done.has(c.compra!)) continue;
    const prev = queue.get(c.compra!); if (prev) { if (v > prev.v) prev.v = v; continue; }
    queue.set(c.compra!, { k: c.compra!, url: `${API}/${m[1]}/compras/${m[4]}/${Number(m[3])}`, v });
  } else {
    if (c.tipo === 7) continue; const m = PNCP_ID.exec(c.id); if (!m || done.has(c.id)) continue;
    queue.set(c.id, { k: c.id, url: `${API}/${m[1]}/contratos/${m[4]}/${Number(m[3])}/termos`, v });
  }
}
let items = [...queue.values()].sort((a, b) => b.v - a.v || (a.k < b.k ? -1 : 1)); if (limitArg && Number(limitArg) > 0) items = items.slice(0, Number(limitArg));
log({ kind, fila: items.length, ja_coletados: done.size });

// ------------------------------------------------------------ gravação em lotes
let written = 0, failed = 0, notFound = 0;
async function closeLot(): Promise<void> {
  if (curLines === 0) return; lotNo++; const rel = `pncp/${kind}/b${String(lotNo).padStart(5, '0')}.jsonl.gz`; const dest = join(cfg.rawDir, rel); const tmp = `${dest}.tmp`;
  await pipeline(createReadStream(cur), createGzip({ level: 6 }), createWriteStream(tmp)); await rename(tmp, dest); await rm(cur, { force: true }); curLines = 0;
  const e = await registerLocalRaw(cfg, { url: `${API}/…`, relPath: rel, competence: null, uf: 0, retention: 1, dataset: 'edu_contract' }); await recordManifest(pool, e);
}
let chain: Promise<void> = Promise.resolve();
const store = (line: string): Promise<void> => { const n = chain.then(async () => { await appendFile(cur, line + '\n'); curLines++; if (curLines >= LOT) await closeLot(); }); chain = n.catch(() => undefined); return n; };
let next = 0; const t0 = Date.now();
const worker = async () => {
  for (;;) {
    const i = next++; if (i >= items.length) return; const it = items[i]!;
    try {
      const r = await gate.get(it.url, { tries: 8 });
      if (r.status === 200) await store(JSON.stringify({ k: it.k, s: 200, b: r.body })); else { notFound++; await store(JSON.stringify({ k: it.k, s: r.status, b: '' })); }
    } catch (e) { failed++; await store(JSON.stringify({ k: it.k, s: 0, b: '', e: e instanceof Error ? e.message.slice(0, 160) : String(e) })); }
    written++; if (written % 500 === 0) log({ kind, feitos: written, de: items.length, falhas: failed, nao_encontrados: notFound, por_segundo: Math.round(written / ((Date.now() - t0) / 1000) * 10) / 10, gate: gate.stats() });
  }
};
await Promise.all(Array.from({ length: Number(concArg ?? 6) }, worker)); await chain; await closeLot();
log({ kind, fim: true, feitos: written, falhas: failed, nao_encontrados: notFound, lotes: lotNo });
await pool.end(); void stat;
