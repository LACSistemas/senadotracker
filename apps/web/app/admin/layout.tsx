import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { logout } from './login/actions';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  return (
    <div className="min-h-screen bg-muted/30">
      {session && (
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm">
            <span className="font-bold">Painel administrativo</span>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{session.email}</span>
              <form action={logout}><button type="submit" className="focus-ring font-bold underline">Sair</button></form>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
