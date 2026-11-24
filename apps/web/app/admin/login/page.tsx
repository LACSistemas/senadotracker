'use client';
import { useActionState } from 'react';
import { login } from './actions';

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="display-title text-2xl font-black">Painel administrativo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acesso restrito.</p>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-bold">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-bold">Senha</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </div>
        {state?.error && <p role="alert" className="text-sm font-bold text-rose-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="focus-ring w-full rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
