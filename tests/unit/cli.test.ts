import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entrypoint = fileURLToPath(new URL('../../apps/collector/src/index.ts', import.meta.url));

function cli(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', entrypoint, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
}

test('CLI real exibe ajuda, encerra com zero e não inicia coleta', () => {
  const result = cli('--help');
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /collect --source/);
});

test('CLI rejeita comando desconhecido com stderr e exit code 2', () => {
  const result = cli('collect');
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Entrada inválida/);
});

test('CLI não esconde argumento inválido acompanhado de --help', () => {
  const result = cli('--help', '--invalid');
  assert.ifError(result.error);
  assert.equal(result.status, 2);
});
