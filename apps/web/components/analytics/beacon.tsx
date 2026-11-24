'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics/track-client';

/** Pageview de primeira parte: dispara no primeiro render e em toda troca de rota client-side (Link
 * não recarrega a página, então sem isso navegação por SPA ficaria invisível pro painel). Nunca
 * registra a própria interação — é só "esta pessoa viu esta página". */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    if (pathname?.startsWith('/admin')) return; // não mistura visita ao próprio painel com tráfego público
    trackEvent('pageview', {}, pathname);
  }, [pathname]);

  return null;
}
