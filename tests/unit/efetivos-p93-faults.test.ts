import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Pool } from 'pg';
import { VolumeError, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';
import { EFE_SOURCES, collectEstadic, collectFbsp, collectMunic, collectSiape, extractEfetivos, fetchEfetivosSource, type EfeFile } from '../../apps/collector/src/exec/efetivos.ts';

const env = (o: Record<string, string>) => ({ PATH: process.env.PATH ?? '', CIVICA_EXEC_MIN_FREE_GIB: '0', ...o }) as NodeJS.ProcessEnv;
async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'civica-efe-')); await mkdir(join(dir, 'raw'), { recursive: true }); await mkdir(join(dir, 'st'), { recursive: true });
  return { dir, cfg: storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_MANIFESTS_DIR: join(dir, 'raw') })) };
}
const noDb = { query: () => { throw new Error('o banco não deveria ser consultado'); } } as unknown as Pool;

test('SSD ausente ou trocado: nenhuma coleta de efetivos baixa, grava ou consulta o banco (VolumeError retomável)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-vol-')); const real = await volumeGuidOf(dir); if (process.platform !== 'win32' || !real) return;
  const cfg = storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_VOLUME_ID: '00000000-0000-0000-0000-000000000000' }));
  for (const run of [() => collectFbsp(noDb, cfg), () => collectEstadic(noDb, cfg, { edition: 'estadic2019' }), () => collectMunic(noDb, cfg, { edition: 'munic2023', ufs: ['ES'] }), () => collectSiape(noDb, cfg, { months: [202608] }), () => fetchEfetivosSource(noDb, cfg, 'fbsp')]) await assert.rejects(run(), VolumeError);
  assert.equal(existsSync(join(dir, 'raw')), false, 'nada foi criado no destino errado'); assert.equal(existsSync(join(dir, 'st')), false);
});

test('extração: arquivo corrompido (PDF/XLSX inválido) falha com a causa e não deixa cache de staging', async () => {
  const { dir, cfg } = await sandbox();
  for (const key of ['fbsp', 'munic2023', 'estadic2019'] as const) {
    const rel = `seguranca/efetivos/${key}/arquivo.bin`; await mkdir(join(cfg.rawDir, `seguranca/efetivos/${key}`), { recursive: true }); const body = Buffer.from('isto não é um PDF nem um XLSX');
    await writeFile(join(cfg.rawDir, rel), body);
    const f: EfeFile = { key, reused: false, entry: { url: EFE_SOURCES[key].url, relPath: rel, sha256: createHash('sha256').update(body).digest('hex'), bytes: body.length, fetchedAt: new Date().toISOString(), sourceModifiedAt: null, competence: 202301, uf: 0, retention: 1, dataset: 'x' } };
    await assert.rejects(extractEfetivos(cfg, f), /extração .* falhou/);
  }
  assert.deepEqual((await readdir(cfg.stagingDir)).filter(n => n.endsWith('.json')), [], 'nenhum JSON parcial em staging'); void dir;
});

test('fontes: três arquivos oficiais e as duas edições IBGE têm URL oficial, caminho no RAW próprio e assinatura de arquivo conferida', () => {
  for (const [k, s] of Object.entries(EFE_SOURCES)) { assert.match(s.url, /^https:\/\/(ftp\.ibge\.gov\.br|forumseguranca\.org\.br)\//, k); assert.ok(s.relPath.startsWith('seguranca/efetivos/'), k); assert.ok(s.magic === '%PDF' || s.magic === 'PK', k); }
  assert.equal(new Set(Object.values(EFE_SOURCES).map(s => s.relPath)).size, 5);
});
