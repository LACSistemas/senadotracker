'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-busca os dados do server component pai a cada `intervalMs` — usado só na aba "Tempo real", onde
 * esperar o usuário recarregar a página manualmente derrotaria o propósito da aba. */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
