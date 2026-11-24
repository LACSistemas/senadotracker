'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminCredentials } from '@/lib/auth/verify';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Preencha email e senha.' };

  const ok = await verifyAdminCredentials(email, password);
  if (!ok) return { error: 'Email ou senha incorretos.' };

  const token = await createSessionToken(email);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  redirect('/admin/analytics');
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/admin/login');
}
