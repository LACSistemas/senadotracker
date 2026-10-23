import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Pool } from 'pg';
import { VolumeError, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';
import { PRI_CYCLES, collectPrisional, extractPriCycle, fetchPriCycle, type PriFile } from '../../apps/collector/src/exec/prisional.ts';

const env = (o: Record<string, string>) => ({ PATH: process.env.PATH ?? '', CIVICA_EXEC_MIN_FREE_GIB: '0', ...o }) as NodeJS.ProcessEnv;
async function sandbox() { const dir = await mkdtemp(join(tmpdir(), 'civica-pri-')); await mkdir(join(dir, 'raw'), { recursive: true }); await mkdir(join(dir, 'st'), { recursive: true }); return { dir, cfg: storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_MANIFESTS_DIR: join(dir, 'raw') })) }; }
const noDb = { query: () => { throw new Error('o banco não deveria ser consultado'); } } as unknown as Pool;

test('SSD ausente ou trocado: nenhuma coleta prisional baixa, grava ou consulta o banco (VolumeError retomável)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-vol-')); const real = await volumeGuidOf(dir); if (process.platform !== 'win32' || !real) return;
  const cfg = storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_VOLUME_ID: '00000000-0000-0000-0000-000000000000' }));
  await assert.rejects(fetchPriCycle(noDb, cfg, PRI_CYCLES[0]!), VolumeError); await assert.rejects(collectPrisional(noDb, cfg, {}), VolumeError);
  assert.equal(existsSync(join(dir, 'raw')), false); assert.equal(existsSync(join(dir, 'st')), false);
});

test('download: portal que devolve HTML (limite de taxa) é rejeitado e não deixa arquivo no RAW; ciclo oficial com cabeçalho válido é aceito', async () => {
  const { cfg } = await sandbox(); let body = Buffer.from('<html><body>Too many requests</body></html>'); let hits = 0;
  const srv: Server = createServer((_q, res) => { hits++; res.setHeader('content-type', 'text/csv'); res.end(body); }); await new Promise<void>(ok => srv.listen(0, ok)); const port = (srv.address() as { port: number }).port;
  try {
    await assert.rejects(fetchPriCycle(storedPool(), cfg, PRI_CYCLES[18]!, undefined, `http://127.0.0.1:${port}`), /conteúdo inesperado|download falhou/); assert.ok(hits >= 1);
    const rel = join(cfg.rawDir, 'seguranca', 'prisional', 'sisdepen', '2025-2'); assert.deepEqual(existsSync(rel) ? (await readdir(rel)).filter(f => !f.endsWith('.part')) : [], [], 'nenhum arquivo parcial publicado no RAW');
    body = Buffer.from('ciclo;Ano;Referência;Tipo do Estabelecimento\r\n19;2025;2025/2;Cela física\r\n', 'utf8'); const f = await fetchPriCycle(storedPool(), cfg, PRI_CYCLES[18]!, undefined, `http://127.0.0.1:${port}`);
    assert.equal(f.entry.sha256, createHash('sha256').update(body).digest('hex')); assert.equal(f.reused, false); assert.equal((await fetchPriCycle(storedPool(), cfg, PRI_CYCLES[18]!, undefined, `http://127.0.0.1:${port}`)).reused, true, 'mesmo arquivo: reutilizado');
  } finally { srv.close(); }
});
const storedPool = () => ({ query: async () => ({ rows: [], rowCount: 0 }) }) as unknown as Pool;

test('extração: CSV corrompido ou com cabeçalho diferente falha com a causa e não deixa JSON parcial em staging; valor não inteiro é recusado', async () => {
  const { cfg } = await sandbox(); const mk = async (name: string, csv: string): Promise<PriFile> => {
    const rel = `seguranca/prisional/${name}.csv`; await mkdir(join(cfg.rawDir, 'seguranca/prisional'), { recursive: true }); await writeFile(join(cfg.rawDir, rel), csv, 'utf8');
    return { cycle: 19, ref: '2025/2', reused: false, entry: { url: 'x', relPath: rel, sha256: createHash('sha256').update(csv).digest('hex'), bytes: Buffer.byteLength(csv), fetchedAt: new Date().toISOString(), sourceModifiedAt: null, competence: 202512, uf: 0, retention: 1, dataset: 'x' } };
  };
  await assert.rejects(extractPriCycle(cfg, await mk('a', 'isto não é o SISDEPEN\r\n1;2\r\n')), /extração SISDEPEN ciclo 19 falhou/);
  const head = ['ciclo', 'Ano', 'Referência', 'Tipo do Estabelecimento', 'Situação de Preenchimento', 'Nome do Estabelecimento', 'Situação do Estabelecimento', 'Outras Denominações', 'Endereço', 'Bairro', 'CEP', 'Âmbito', 'UF', 'Município', 'Código IBGE'];
  await assert.rejects(extractPriCycle(cfg, await mk('b', [...head.slice(0, 5), 'Nome', ...head.slice(6)].join(';') + '\r\n')), /extração SISDEPEN/);
  await assert.rejects(extractPriCycle(cfg, await mk('c', head.join(';') + ';1.1 Estabelecimento originalmente destinado a pessoa privadas de liberdade do sexo;1.2 Tipo de estabelecimento - originalmente destinado;1.4 Gestão do estabelecimento;1.3 Capacidade do estabelecimento | Masculino | Total\r\n19;2025;2025/2;Cela física;Validado;X;Ativo;;rua;b;29000000;Estadual;ES;Vitória;3205309;Masculino;x;Pública;12.5\r\n')), /não inteiro|extração SISDEPEN/);
  assert.deepEqual((await readdir(cfg.stagingDir)).filter(n => n.endsWith('.json')), [], 'nenhum JSON parcial em staging');
});

test('ciclos: 19 arquivos oficiais, referências 2016/2 a 2025/2 sem lacuna, URLs de gov.br/senappen', () => {
  assert.equal(PRI_CYCLES.length, 19); assert.deepEqual(PRI_CYCLES.map(c => c.cycle), Array.from({ length: 19 }, (_, i) => i + 1)); assert.equal(PRI_CYCLES[0]!.ref, '2016/2'); assert.equal(PRI_CYCLES[18]!.ref, '2025/2');
  for (let i = 1; i < 19; i++) { const [y0, s0] = PRI_CYCLES[i - 1]!.ref.split('/').map(Number) as [number, number]; const [y1, s1] = PRI_CYCLES[i]!.ref.split('/').map(Number) as [number, number]; assert.equal(y1 * 2 + s1, y0 * 2 + s0 + 1, `lacuna antes de ${PRI_CYCLES[i]!.ref}`); }
  assert.ok(PRI_CYCLES.every(c => /^20\d\d\/\d+o-ciclo-base-de-dados-.*\.csv$/.test(c.path)));
});
