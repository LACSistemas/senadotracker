import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BudgetError, VolumeError, assertCanStore, assertVolume, registerLocalRaw, sha256File, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';

const base = { PATH: process.env.PATH ?? '' } as NodeJS.ProcessEnv;

test('sem CIVICA_EXEC_ROOT mantém o comportamento original (disco interno, sem guarda de volume)', async () => {
  const cfg = storageConfig(base);
  assert.equal(cfg.rootDir, null); assert.equal(cfg.volumeGuid, null);
  assert.match(cfg.rawDir, /data[\\/]exec-raw$/);
  await assertVolume(cfg);   // sem GUID configurado: não bloqueia
});

test('com raiz configurada, raw/staging/logs derivam dela e a reserva padrão é de 50 GiB', () => {
  const cfg = storageConfig({ ...base, CIVICA_EXEC_ROOT: 'X:\\Civica', CIVICA_EXEC_VOLUME_ID: 'ABC' });
  assert.match(cfg.rawDir, /Civica[\\/]raw$/); assert.match(cfg.stagingDir, /Civica[\\/]staging$/); assert.match(cfg.logsDir, /logs[\\/]collectors$/);
  assert.equal(cfg.minFreeBytes, 50 * 1024 ** 3); assert.equal(cfg.volumeGuid, 'abc');
});

test('volume diferente do esperado bloqueia com VolumeError antes de qualquer gravação', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-vol-'));
  const real = await volumeGuidOf(dir);
  if (process.platform !== 'win32' || !real) return;   // a identidade por mountvol só existe no Windows
  const cfg = storageConfig({ ...base, CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_VOLUME_ID: '00000000-0000-0000-0000-000000000000' });
  await assert.rejects(assertVolume(cfg), VolumeError);
  await assert.rejects(assertCanStore(cfg, 1), VolumeError);
  await assertVolume({ ...cfg, volumeGuid: real });     // volume correto passa
});

test('orçamento de RAW excedido interrompe com BudgetError (retomável)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-raw-'));
  await mkdir(join(dir, 'raw'), { recursive: true }); await writeFile(join(dir, 'raw', 'a.bin'), Buffer.alloc(2048));
  const cfg = { ...storageConfig({ ...base, CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st') }), rawBudgetBytes: 1000, minFreeBytes: 0 };
  await assert.rejects(assertCanStore(cfg, 10), BudgetError);
});

test('registerLocalRaw é idempotente e não duplica entradas do manifesto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-man-'));
  const cfg = storageConfig({ ...base, CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st') });
  await mkdir(join(dir, 'raw', 'ref'), { recursive: true }); await writeFile(join(dir, 'raw', 'ref', 'x.jsonl'), '{"a":1}\n');
  const spec = { url: 'https://exemplo/x', relPath: 'ref/x.jsonl', competence: null, uf: 0, retention: 1 as const, dataset: 'teste' };
  const a = await registerLocalRaw(cfg, spec); const b = await registerLocalRaw(cfg, spec);
  assert.equal(a.sha256, b.sha256); assert.equal(a.sha256, await sha256File(join(dir, 'raw', 'ref', 'x.jsonl')));
  assert.equal((await readFile(join(dir, 'raw', 'MANIFEST.jsonl'), 'utf8')).trim().split('\n').length, 1);
});
