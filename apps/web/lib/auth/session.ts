import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'civica_admin_session';
const SESSION_TTL = '30d';

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET ausente no ambiente.');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

/** Nunca lança: cookie ausente, expirado ou adulterado só resulta em sessão inválida. */
export async function verifySessionToken(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return typeof payload.email === 'string' ? { email: payload.email } : null;
  } catch {
    return null;
  }
}
