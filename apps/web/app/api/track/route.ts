import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { recordEvent } from '../../../../../packages/db/src/postgres-analytics.ts';
import { analyticsPool } from '@/lib/analytics/db';
import { clientIpFromHeaders, lookupGeo } from '@/lib/analytics/geoip';

const VISITOR_COOKIE = 'civica_visitor_session';

/** Recebe pageviews (e, no futuro, outros eventos) do beacon do cliente. Nunca guarda o IP em si —
 * só o país/UF resolvidos por GeoIP. Falha silenciosamente em qualquer erro: analytics não pode
 * derrubar a navegação de ninguém. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const eventName = typeof b?.event_name === 'string' ? b.event_name : null;
  if (!eventName) return new NextResponse(null, { status: 400 });

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set(VISITOR_COOKIE, sessionId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }

  try {
    const geo = await lookupGeo(clientIpFromHeaders(request.headers));
    const userAgent = request.headers.get('user-agent') ?? '';
    const deviceType = /mobile/i.test(userAgent) ? 'mobile' : /tablet|ipad/i.test(userAgent) ? 'tablet' : 'desktop';
    await recordEvent(analyticsPool, {
      sessionId, eventName,
      path: typeof b.path === 'string' ? b.path.slice(0, 2048) : null,
      referrer: typeof b.referrer === 'string' ? b.referrer.slice(0, 2048) : null,
      ufVisitor: geo.uf, country: geo.country, cityVisitor: geo.city, deviceType,
      props: typeof b.props === 'object' && b.props ? (b.props as Record<string, unknown>) : {},
    });
  } catch {
    // analytics nunca deve afetar a navegação do visitante
  }

  return new NextResponse(null, { status: 204 });
}
