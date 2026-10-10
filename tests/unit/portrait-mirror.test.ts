import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { canonicalPortraitUrl, fetchPortraitFollowingRedirects, isPortraitUrlAllowed, mirrorPendingPortraits, mirrorPortrait, portraitKey, portraitPath, sniffImage } from '@senadotracker/db';

/** Pool falso com a tabela civica_media.portraits em memória. */
function fakePool() {
  const rows = new Map<string, Record<string, any>>();
  return {
    rows,
    async query(sql: string, params: any[] = []) {
      if (/^\s*(CREATE|ALTER)/i.test(sql)) return { rows: [] };
      if (/SELECT file_ext, etag/.test(sql)) { const row = rows.get(params[0]); return { rows: row ? [row] : [] }; }
      if (/SELECT source_url, status, checked_at, failures/.test(sql)) return { rows: [...rows.values()] };
      if (/INSERT INTO civica_media.portraits.*'failed'/s.test(sql)) { const old = rows.get(params[0]); rows.set(params[0], { ...old, source_url: params[0], status: old?.file_ext ? 'stale' : 'failed', checked_at: new Date(params[2]), failures: (old?.failures ?? 0) + 1, last_error: params[3] }); return { rows: [] }; }
      if (/INSERT INTO civica_media.portraits/.test(sql)) { rows.set(params[0], { source_url: params[0], file_ext: params[2], sha256: params[3], bytes: params[4], width: params[5], etag: params[7], last_modified: params[8], status: 'ok', checked_at: new Date(params[9]), failures: 0 }); return { rows: [] }; }
      if (/UPDATE civica_media.portraits SET checked_at/.test(sql)) { const row = rows.get(params[0])!; row.checked_at = new Date(params[1]); row.status = 'ok'; return { rows: [] }; }
      return { rows: [] };
    },
  };
}
const jpeg = (width = 1200) => sharp({ create: { width, height: Math.round(width * 1.25), channels: 3, background: '#2d7f93' } }).jpeg().toBuffer();
const URL_A = 'https://www.camara.leg.br/internet/deputado/bandep/160541.jpg';

test('retrato: host fora da lista é recusado e o nome do arquivo depende só da URL', () => {
  assert.equal(isPortraitUrlAllowed(new URL(URL_A)), true);
  assert.equal(isPortraitUrlAllowed(new URL('https://evil.example.com/a.jpg')), false);
  assert.equal(isPortraitUrlAllowed(new URL('file:///etc/passwd')), false);
  assert.equal(portraitKey(URL_A), portraitKey(URL_A));
  assert.notEqual(portraitKey(URL_A), portraitKey(`${URL_A}?x=1`));
  assert.equal(sniffImage(Buffer.from('<html>')), null);
});

test('retrato: redirecionamento só entre hosts permitidos (Senado http→https→legis)', async () => {
  const hops: string[] = [];
  const fetchImpl = async (url: URL) => {
    hops.push(url.href);
    if (url.protocol === 'http:') return new Response(null, { status: 301, headers: { location: 'https://www.senado.leg.br/x.jpg' } });
    if (url.hostname === 'www.senado.leg.br') return new Response(null, { status: 301, headers: { location: 'https://legis.senado.leg.br/final' } });
    return new Response('ok', { status: 200 });
  };
  const ok = await fetchPortraitFollowingRedirects(new URL('http://www.senado.leg.br/x.jpg'), {}, fetchImpl as never);
  assert.equal(ok.status, 200);
  assert.equal(hops.length, 3);
  const evil = await fetchPortraitFollowingRedirects(new URL(URL_A), {}, (async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } })) as never);
  assert.equal(evil.status, 403, 'redirect para fora da lista nunca é seguido');
});

test('retrato: baixa, reduz, grava; 304 não regrava; falha preserva a última foto boa', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'portraits-')), pool = fakePool();
  try {
    let mode: 'ok' | '304' | 'down' = 'ok';
    const seen: Array<Record<string, string>> = [];
    const body = await jpeg();
    const fetchImpl = async (_: URL, init: { headers: Record<string, string> }) => {
      seen.push(init.headers);
      if (mode === 'down') return new Response(null, { status: 503 });
      if (mode === '304') return new Response(null, { status: 304 });
      return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/jpeg', etag: '"v1"' } });
    };
    const first = await mirrorPortrait(pool as never, URL_A, { dir, fetchImpl: fetchImpl as never });
    assert.equal(first.status, 'stored');
    const file = portraitPath(dir, URL_A, 'webp');
    assert.ok(existsSync(file), 'gravou o arquivo reduzido');
    const meta = await sharp(await readFile(file)).metadata();
    assert.equal(meta.format, 'webp');
    assert.ok((meta.width ?? 9999) <= 480, 'largura reduzida a no máximo 480');

    mode = '304';
    const second = await mirrorPortrait(pool as never, URL_A, { dir, fetchImpl: fetchImpl as never });
    assert.equal(second.status, 'not_modified');
    assert.equal(seen.at(-1)?.['if-none-match'], '"v1"', 'requisição condicional');

    mode = 'down';
    const third = await mirrorPortrait(pool as never, URL_A, { dir, fetchImpl: fetchImpl as never });
    assert.equal(third.status, 'failed');
    assert.ok(existsSync(file), 'a foto boa continua no disco');
    assert.equal(pool.rows.get(URL_A)?.status, 'stale', 'marcada como velha, não como perdida');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('retrato: conteúdo que não é imagem e host proibido não são gravados', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'portraits-')), pool = fakePool();
  try {
    const html = (async () => new Response('<html>erro</html>', { status: 200, headers: { 'content-type': 'text/html' } })) as never;
    assert.equal((await mirrorPortrait(pool as never, URL_A, { dir, fetchImpl: html })).status, 'failed');
    assert.equal((await mirrorPortrait(pool as never, 'https://evil.example.com/a.jpg', { dir, fetchImpl: html })).status, 'skipped');
    assert.deepEqual(await readdir(dir), [], 'nada foi gravado');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('retrato: o lote só busca o que falta ou está velho', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'portraits-')), pool = fakePool();
  const B = 'https://www.camara.leg.br/internet/deputado/bandep/1.jpg', C = 'https://www.camara.leg.br/internet/deputado/bandep/2.jpg';
  try {
    const body = await jpeg();
    let calls = 0;
    const fetchImpl = (async () => { calls++; return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/jpeg' } }); }) as never;
    const t0 = new Date('2026-10-09T12:00:00Z');
    const first = await mirrorPendingPortraits(pool as never, { dir, fetchImpl, allSources: [B, C], now: () => t0, concurrency: 2 });
    assert.deepEqual([first.considered, first.stored], [2, 2]);
    const again = await mirrorPendingPortraits(pool as never, { dir, fetchImpl, allSources: [B, C], now: () => new Date(t0.getTime() + 86_400_000) });
    assert.equal(again.considered, 0, 'um dia depois ainda está fresco');
    const stale = await mirrorPendingPortraits(pool as never, { dir, fetchImpl, allSources: [B, C], now: () => new Date(t0.getTime() + 8 * 86_400_000) });
    assert.equal(stale.considered, 2, 'passados 7 dias revalida');
    assert.equal(calls, 4);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('retrato: cadastro antigo de SP (host da API, que dá 404) aponta para o host que serve a foto', () => {
  const old = 'https://legis-api-portal-prd.al.sp.gov.br/biografia/fotos/300607/678129ff.jpeg';
  assert.equal(canonicalPortraitUrl(old), 'https://www3.al.sp.gov.br/legis/biografia/fotos/300607/678129ff.jpeg');
  assert.equal(canonicalPortraitUrl('https://www3.al.sp.gov.br/legis/biografia/fotos/300607/678129ff.jpeg'), 'https://www3.al.sp.gov.br/legis/biografia/fotos/300607/678129ff.jpeg', 'idempotente');
  assert.equal(canonicalPortraitUrl(URL_A), URL_A, 'outros hosts não mudam');
  assert.equal(canonicalPortraitUrl('https://legis-api-portal-prd.al.sp.gov.br/outra-rota'), 'https://legis-api-portal-prd.al.sp.gov.br/outra-rota');
  assert.equal(isPortraitUrlAllowed(new URL(canonicalPortraitUrl(old))), true);
  assert.equal(canonicalPortraitUrl('não é url'), 'não é url');
});
