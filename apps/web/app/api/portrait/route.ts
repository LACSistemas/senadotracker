import { readFile } from 'node:fs/promises';
import { after, NextRequest } from 'next/server';
import { canonicalPortraitUrl, fetchPortraitFollowingRedirects, isPortraitUrlAllowed, mirrorPortrait, portraitDirectory, portraitKey, portraitPath, PORTRAIT_CONTENT_TYPE, PORTRAIT_EXTS } from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';

export const runtime = 'nodejs';

/**
 * Retrato oficial. 1º: cópia local (baixada e reduzida pelo espelho de retratos), servida sem tocar no site de origem.
 * 2º (só se ainda não houver cópia): busca ao vivo e, depois de responder, grava a cópia para as próximas vezes.
 */
export async function GET(request: NextRequest) {
  const given = request.nextUrl.searchParams.get('url');
  if (!given) return new Response(null, { status: 400 });
  const raw = canonicalPortraitUrl(given);
  let target: URL;
  try { target = new URL(raw); } catch { return new Response(null, { status: 400 }); }
  if (!isPortraitUrlAllowed(target)) return new Response(null, { status: 403 });

  const dir = portraitDirectory(), key = portraitKey(raw);
  for (const ext of PORTRAIT_EXTS) {
    try {
      const bytes = await readFile(portraitPath(dir, raw, ext)), etag = `"${key}-${bytes.length}"`;
      if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag } });
      return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': PORTRAIT_CONTENT_TYPE[ext], etag, 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
    } catch { /* sem cópia nesta extensão */ }
  }

  try {
    const upstream = await fetchPortraitFollowingRedirects(target);
    if (!upstream.ok) return new Response(null, { status: upstream.status });
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) return new Response(null, { status: 415 });
    after(async () => { try { await mirrorPortrait(webPostgresPool(), raw); } catch (error) { console.error('portrait mirror failed', error); } });
    return new Response(await upstream.arrayBuffer(), { status: 200, headers: { 'content-type': contentType, 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } });
  } catch { return new Response(null, { status: 502 }); }
}
