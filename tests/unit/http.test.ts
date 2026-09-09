import assert from 'node:assert/strict';
import test from 'node:test';
import { OfficialHttp } from '../../apps/collector/src/http.ts';
import type { RawResponse } from '../../apps/collector/src/raw.ts';
const url = 'https://dadosabertos.camara.leg.br/api/v2/deputados';
const json = (status = 200) => new Response('{"dados":[]}', { status, headers: { 'Content-Type': 'application/json' } });

test('HTTP 429 e 503 têm retry limitado, preservando também respostas de falha', async () => {
  const saved: RawResponse[] = []; const sleeps: number[] = []; let count = 0;
  const client = new OfficialHttp({ source: 'camara', delayMs: 0, sleep: async ms => { sleeps.push(ms); }, save: async raw => { saved.push(raw); return String(saved.length); }, fetch: async () => json([429,503,200][count++]!) });
  assert.equal((await client.json(url)).rawId, '3');
  assert.deepEqual(saved.map(raw => raw.status), [429,503,200]); assert.equal(count, 3);
  assert.ok(sleeps.some(ms => ms >= 500));
});

test('HTML com status 200 é arquivado e rejeitado; não é cadastro vazio', async () => {
  let saved = false;
  const client = new OfficialHttp({ source: 'camara', delayMs: 0, sleep: async () => {}, save: async () => { saved = true; return 'html'; }, fetch: async () => new Response('<html>erro</html>', { headers: { 'Content-Type': 'text/html' } }) });
  await assert.rejects(client.json(url), /não é JSON/); assert.equal(saved, true);
});

test('timeout aborta requisição e tentativas param no limite', async () => {
  let attempts = 0;
  const client = new OfficialHttp({ source: 'camara', delayMs: 0, timeoutMs: 5, maxAttempts: 2, sleep: async () => {}, save: async () => 'none', fetch: async (_url, options) => {
    attempts++;
    return new Promise<Response>((_resolve, reject) => { options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
  } });
  await assert.rejects(client.json(url), /timeout/); assert.equal(attempts, 2);
});

test('404 não é repetido; destino não oficial nunca é requisitado', async () => {
  let attempts = 0;
  const client = new OfficialHttp({ source: 'camara', delayMs: 0, sleep: async () => {}, save: async () => 'not-found', fetch: async () => { attempts++; return json(404); } });
  await assert.rejects(client.json(url), /404/); assert.equal(attempts, 1);
  await assert.rejects(client.json('https://example.org/data'), /oficial/); assert.equal(attempts, 1);
});

test('Retry-After excessivo é limitado a 30s e UTF-8 inválido é rejeitado', async () => {
  const sleeps: number[] = []; let count = 0;
  const client = new OfficialHttp({ source: 'camara', delayMs: 0, sleep: async ms => { sleeps.push(ms); }, save: async () => 'raw', fetch: async () => count++ === 0 ? new Response('{}', { status: 429, headers: { 'Retry-After': '9999' } }) : new Response(new Uint8Array([0xff]), { headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(client.json(url), /UTF-8/); assert.ok(sleeps.includes(30000)); assert.ok(sleeps.every(ms => ms <= 30000));
});
