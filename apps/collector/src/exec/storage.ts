import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, open, readdir, rename, rm, stat, statfs, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import type { Pool } from 'pg';

/**
 * Armazenamento RAW configurável. A raiz (CIVICA_EXEC_ROOT, ex.: D:\Civica) contém raw/, staging/, manifests/, logs/ e reports/.
 * Sem CIVICA_EXEC_ROOT, mantém o comportamento original (data/exec-raw e data/exec-staging no disco interno).
 * Quando CIVICA_EXEC_VOLUME_ID (GUID persistente do volume) está definido, TODA gravação confere que a letra da unidade ainda
 * identifica esse volume; senão o collector aborta com VolumeError (retomável) e nunca grava em outro lugar.
 */
export interface StorageConfig { rootDir: string | null; rawDir: string; stagingDir: string; manifestsDir: string; logsDir: string; rawBudgetBytes: number; stagingBudgetBytes: number; minFreeBytes: number; decodeRatio: number; volumeGuid: string | null; maxWorkers: number; pgProbeDir: string; pgMinFreeBytes: number }
const GIB = 1024 ** 3;
export function storageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  if (env === process.env) { try { (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env'); } catch { /* sem .env */ } }
  const num = (k: string, d: number) => (env[k] ? Number(env[k]) : d);
  const root = env.CIVICA_EXEC_ROOT ? resolve(env.CIVICA_EXEC_ROOT) : null;
  return {
    rootDir: root,
    rawDir: resolve(env.CIVICA_EXEC_RAW_DIR ?? (root ? join(root, 'raw') : 'data/exec-raw')),
    stagingDir: resolve(env.CIVICA_EXEC_STAGING_DIR ?? (root ? join(root, 'staging') : 'data/exec-staging')),
    manifestsDir: resolve(env.CIVICA_EXEC_MANIFESTS_DIR ?? (root ? join(root, 'manifests') : 'data/exec-raw')),
    logsDir: resolve(env.CIVICA_EXEC_LOGS_DIR ?? (root ? join(root, 'logs', 'collectors') : 'data/exec-logs')),
    rawBudgetBytes: num('CIVICA_EXEC_RAW_BUDGET_GIB', root ? 300 : 6) * GIB, stagingBudgetBytes: num('CIVICA_EXEC_STAGING_BUDGET_GIB', root ? 20 : 3) * GIB,
    minFreeBytes: num('CIVICA_EXEC_MIN_FREE_GIB', root ? 50 : 30) * GIB, decodeRatio: num('CIVICA_EXEC_DECODE_RATIO', 15),
    volumeGuid: env.CIVICA_EXEC_VOLUME_ID?.trim().toLowerCase() || null, maxWorkers: num('CIVICA_EXEC_MAX_WORKERS', 2),
    pgProbeDir: resolve(env.CIVICA_EXEC_PG_PROBE_DIR ?? 'C:/Program Files/PostgreSQL/17/data'), pgMinFreeBytes: num('CIVICA_EXEC_PG_MIN_FREE_GIB', 20) * GIB,
  };
}
export class VolumeError extends Error { constructor(message: string) { super(message); this.name = 'VolumeError'; } }
const volCache = new Map<string, { at: number; guid: string }>();
/** GUID do volume montado na letra de `path` (mountvol não exige privilégio). */
export async function volumeGuidOf(path: string): Promise<string | null> {
  const letter = parse(resolve(path)).root; // "D:\\"
  if (!/^[A-Za-z]:\\$/.test(letter)) return null;
  const hit = volCache.get(letter); if (hit && Date.now() - hit.at < 20_000) return hit.guid;
  const r = await new Promise<{ code: number; out: string }>(res => { const p = spawn('mountvol', [letter, '/L']); let out = ''; p.stdout.on('data', d => out += d); p.on('error', () => res({ code: -1, out: '' })); p.on('close', code => res({ code: code ?? -1, out })); });
  const m = /Volume\{([0-9a-f-]{36})\}/i.exec(r.out); if (!m) return null;
  const guid = m[1]!.toLowerCase(); volCache.set(letter, { at: Date.now(), guid }); return guid;
}
/** Falha (retomável) se o volume esperado não está montado onde o RAW deveria estar. Sem GUID configurado, não faz nada. */
export async function assertVolume(cfg: StorageConfig): Promise<void> {
  if (!cfg.volumeGuid) return;
  for (const dir of [cfg.rawDir, cfg.stagingDir]) {
    const guid = await volumeGuidOf(dir);
    if (guid === null) throw new VolumeError(`volume de ${dir} indisponível (SSD desconectado?). Nenhuma gravação foi feita; reconecte e retome.`);
    if (guid !== cfg.volumeGuid) throw new VolumeError(`a unidade de ${dir} agora é o volume ${guid}, não o esperado ${cfg.volumeGuid}. Abortado sem gravar.`);
  }
  if (cfg.rootDir) {
    try { const m = JSON.parse(await readFile(join(cfg.rootDir, '.civica-volume.json'), 'utf8')) as { volumeGuid?: string }; if (m.volumeGuid?.toLowerCase() !== cfg.volumeGuid) throw new Error('marcador diferente'); }
    catch (e) { throw new VolumeError(`marcador .civica-volume.json ausente ou divergente em ${cfg.rootDir}: ${e instanceof Error ? e.message : String(e)}`); }
  }
}
export class BudgetError extends Error { constructor(message: string) { super(message); this.name = 'BudgetError'; } }

export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: Dirent[];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) { const p = join(dir, e.name); total += e.isDirectory() ? await dirSize(p) : (await stat(p)).size; }
  return total;
}
export async function freeBytes(dir: string): Promise<number> {
  await mkdir(dir, { recursive: true });
  const s = await statfs(dir); return Number(s.bavail) * Number(s.bsize);
}
/** Interrompe de forma segura (retomável) quando o orçamento de RAW ou a reserva mínima de disco seria violada. */
const usage = new Map<string, { at: number; bytes: number }>();
/** Uso de uma pasta com cache curto: varrer milhares de arquivos a cada download tornaria o backfill quadrático. */
async function cachedDirSize(dir: string, ttlMs = 120_000): Promise<number> {
  const hit = usage.get(dir); if (hit && Date.now() - hit.at < ttlMs) return hit.bytes;
  const bytes = await dirSize(dir); usage.set(dir, { at: Date.now(), bytes }); return bytes;
}
/** Disco do PostgreSQL abaixo da reserva: nenhuma nova publicação (não se libera espaço apagando histórico). */
export async function assertPgHeadroom(cfg: StorageConfig): Promise<void> {
  let free: number; try { const s = await statfs(cfg.pgProbeDir); free = Number(s.bavail) * Number(s.bsize); } catch { return; }
  if (free < cfg.pgMinFreeBytes) throw new BudgetError(`disco do PostgreSQL abaixo da reserva: livre ${(free / GIB).toFixed(1)} GiB, mínimo ${(cfg.pgMinFreeBytes / GIB).toFixed(1)} GiB`);
}
export async function assertCanStore(cfg: StorageConfig, incomingBytes: number): Promise<void> {
  await assertVolume(cfg);
  const used = await cachedDirSize(cfg.rawDir);
  if (used + incomingBytes > cfg.rawBudgetBytes) throw new BudgetError(`orçamento de RAW excedido: ${((used + incomingBytes) / GIB).toFixed(2)} GiB > ${(cfg.rawBudgetBytes / GIB).toFixed(2)} GiB`);
  const free = await freeBytes(cfg.rawDir);
  if (free - incomingBytes < cfg.minFreeBytes) throw new BudgetError(`reserva mínima de disco violada: livre ${(free / GIB).toFixed(1)} GiB, mínimo ${(cfg.minFreeBytes / GIB).toFixed(1)} GiB`);
}
export async function assertCanDecode(cfg: StorageConfig, dbcBytes: number): Promise<void> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const used = await dirSize(cfg.stagingDir); const peak = dbcBytes * cfg.decodeRatio;
  if (used + peak > cfg.stagingBudgetBytes) throw new BudgetError(`pico de descompressão ${(peak / GIB).toFixed(2)} GiB excede o staging (${(cfg.stagingBudgetBytes / GIB).toFixed(2)} GiB)`);
  const free = await freeBytes(cfg.stagingDir);
  if (free - peak < cfg.minFreeBytes) throw new BudgetError(`reserva mínima de disco violada na descompressão (livre ${(free / GIB).toFixed(1)} GiB)`);
}

export async function sha256File(path: string): Promise<string> {
  const h = createHash('sha256');
  await new Promise<void>((ok, fail) => createReadStream(path).on('data', d => h.update(d)).on('end', () => ok()).on('error', fail));
  return h.digest('hex');
}

export interface ManifestEntry { url: string; relPath: string; sha256: string; bytes: number; fetchedAt: string; sourceModifiedAt: string | null; competence: number | null; uf: number | null; retention: 1 | 2 | 3 | 4; dataset: string }
const MANIFEST = 'MANIFEST.jsonl';
/** O manifesto acompanha o RAW (mesma pasta) para que a cópia seja autossuficiente. */
const manifestPath = (cfg: StorageConfig) => join(cfg.rawDir, MANIFEST);
export async function readManifest(cfg: StorageConfig): Promise<Map<string, ManifestEntry>> {
  const m = new Map<string, ManifestEntry>();
  try { for (const line of (await readFile(manifestPath(cfg), 'utf8')).split('\n')) if (line.trim()) { const e = JSON.parse(line) as ManifestEntry; m.set(e.relPath, e); } } catch { /* sem manifesto ainda */ }
  return m;
}
function curl(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise(res => { const p = spawn('curl.exe', args); let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('close', code => res({ code: code ?? -1, out, err })); });
}
/** Tamanho remoto e data de modificação (FTP/HTTP) sem baixar. */
export async function remoteInfo(url: string): Promise<{ bytes: number | null; modified: string | null }> {
  const r = await curl(['-sS', '-I', '--max-time', '30', url]);
  if (r.code !== 0) return { bytes: null, modified: null };
  const len = /content-length:\s*(\d+)/i.exec(r.out)?.[1]; const mod = /last-modified:\s*(.+)/i.exec(r.out)?.[1]?.trim();
  return { bytes: len ? Number(len) : null, modified: mod ? new Date(mod).toISOString() : null };
}

/** Baixa (com retomada e .part), confere tamanho, calcula SHA-256 e registra no manifesto local. Idempotente: arquivo igual já registrado não é rebaixado. */
export async function fetchRaw(cfg: StorageConfig, spec: { url: string; relPath: string; competence: number | null; uf: number | null; retention: 1 | 2 | 3 | 4; dataset: string; dedupeByHash?: boolean; /** User-Agent de navegador (gov.br recusa clientes sem ele) */ userAgent?: string; /** Valida o início do arquivo baixado (ex.: portal devolve HTML em vez do arquivo quando limita a taxa); se falhar, o download é descartado e a chamada falha. */ accept?: (head: Buffer) => boolean; /** Tentativas do próprio curl (padrão 5) */ retries?: number }): Promise<ManifestEntry & { reused: boolean }> {
  const dest = join(cfg.rawDir, spec.relPath); await mkdir(dirname(dest), { recursive: true });
  const manifest = await readManifest(cfg); const known = manifest.get(spec.relPath);
  try { const s = await stat(dest); if (known && s.size === known.bytes) return { ...known, reused: true }; } catch { /* ainda não existe */ }
  await assertCanStore(cfg, 150 * 1024 * 1024);
  const part = `${dest}.part`;
  // Cada tentativa é uma nova execução do curl com `-C -`: o deslocamento é recalculado a partir do .part que ficou em disco (retomada real; o --retry interno do curl não retoma).
  let r = { code: -1, out: '', err: '' }; const attempts = (spec.retries ?? 5) + 1;
  for (let i = 1; i <= attempts; i++) {
    r = await curl(['-sS', '-L', '--fail', '-C', '-', '--max-time', '1800', ...(spec.userAgent ? ['-A', spec.userAgent] : []), '-w', '%{filetime}', '-o', part, spec.url]);
    if (r.code === 0) break;
    if (r.code === 33) { r = { ...r, code: 0 }; break; }   // intervalo não satisfazível: o .part já está completo
    if (i < attempts) await new Promise(res => setTimeout(res, Math.min(3000 * i, 15000)));
  }
  if (r.code !== 0) throw new Error(`download falhou (${r.code}): ${spec.url} ${r.err.trim().slice(0, 200)}`);
  const size = (await stat(part)).size;
  if (size === 0) { await rm(part, { force: true }); throw new Error(`arquivo vazio: ${spec.url}`); }
  if (spec.accept) {
    const fh = await open(part, 'r'); const head = Buffer.alloc(512);
    try { const { bytesRead } = await fh.read(head, 0, 512, 0); if (!spec.accept(head.subarray(0, bytesRead))) { await fh.close(); await rm(part, { force: true }); throw new Error(`conteúdo inesperado (não é o arquivo esperado): ${spec.url}`); } }
    finally { await fh.close().catch(() => undefined); }
  }
  const ft = Number(r.out.trim()); const modified = Number.isFinite(ft) && ft > 0 ? new Date(ft * 1000).toISOString() : null;
  await rename(part, dest);
  if (spec.dedupeByHash) {   // fonte republicada sem mudança: mantém uma só cópia (a primeira) em vez de duplicar o arquivo
    const sha = await sha256File(dest); const same = [...manifest.values()].find(e => e.sha256 === sha && e.relPath !== spec.relPath);
    if (same) { await rm(dest, { force: true }); return { ...same, reused: true }; }
  }
  const entry: ManifestEntry = { url: spec.url, relPath: spec.relPath, sha256: await sha256File(dest), bytes: size, fetchedAt: new Date().toISOString(), sourceModifiedAt: modified, competence: spec.competence, uf: spec.uf, retention: spec.retention, dataset: spec.dataset };
  await appendFile(manifestPath(cfg), JSON.stringify(entry) + '\n');
  return { ...entry, reused: false };
}

/** Registra no manifesto um arquivo RAW que o próprio collector gravou (ex.: respostas paginadas de API reunidas em JSONL). */
export async function registerLocalRaw(cfg: StorageConfig, spec: { url: string; relPath: string; competence: number | null; uf: number | null; retention: 1 | 2 | 3 | 4; dataset: string }): Promise<ManifestEntry> {
  await assertVolume(cfg);
  const abs = join(cfg.rawDir, spec.relPath); const sha = await sha256File(abs);
  const known = (await readManifest(cfg)).get(spec.relPath); if (known && known.sha256 === sha) return known;
  const entry: ManifestEntry = { url: spec.url, relPath: spec.relPath, sha256: sha, bytes: (await stat(abs)).size, fetchedAt: new Date().toISOString(), sourceModifiedAt: null, competence: spec.competence, uf: spec.uf, retention: spec.retention, dataset: spec.dataset };
  await appendFile(manifestPath(cfg), JSON.stringify(entry) + '\n'); return entry;
}

/** Espelha a entrada do manifesto no banco (exec_raw_manifest). O vínculo com o run é opcional. */
export async function recordManifest(pool: Pool, e: ManifestEntry, runId: number | null = null): Promise<void> {
  await pool.query(`INSERT INTO civica_exec.exec_raw_manifest (run_id, source_url, rel_path, sha256, bytes, source_modified_at, competence, uf, fetched_at, state, retention_class)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,2,$10) ON CONFLICT (sha256) DO NOTHING`, [runId, e.url, e.relPath, Buffer.from(e.sha256, 'hex'), e.bytes, e.sourceModifiedAt, e.competence, e.uf, e.fetchedAt, e.retention]);
}
export function runPython(script: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise(res => { const p = spawn('python', ['-I', script, ...args], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }); let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('close', code => res({ code: code ?? -1, out, err })); });
}

/** Confere o CRC de todo o ZIP baixado; arquivo corrompido/truncado é removido (o manifesto não o reaproveita) e a coleta falha de forma retomável. */
export async function assertZipIntact(cfg: StorageConfig, relPath: string): Promise<void> {
  const r = await runPython('scripts/exec/zip_test.py', [join(cfg.rawDir, relPath)]);
  if (r.code !== 0) { await rm(join(cfg.rawDir, relPath), { force: true }); throw new Error(`ZIP corrompido ou truncado (CRC): ${relPath}; arquivo removido, rode a coleta de novo`); }
}
