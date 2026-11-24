import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';

const SESSION_COOKIE = 'civica_admin_session';

/** Guarda `/admin/*` (exceto o próprio login). Verificação otimista: só decodifica o cookie assinado,
 * nunca consulta o banco aqui — Proxy roda em toda rota, inclusive prefetch. */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/admin/login') {
    if (session) return NextResponse.redirect(new URL('/admin/analytics', request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') && !session) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
