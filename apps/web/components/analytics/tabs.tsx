'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { UF_NAMES } from '@/lib/analytics/format';

const TABS = [
  { href: '/admin/analytics', label: 'Visão geral' },
  { href: '/admin/analytics/realtime', label: 'Tempo real' },
  { href: '/admin/analytics/acquisition', label: 'Aquisição' },
  { href: '/admin/analytics/behavior', label: 'Comportamento' },
  { href: '/admin/analytics/audience', label: 'Público' },
  { href: '/admin/analytics/product', label: 'Produto' },
];

/** Nav de abas + linha de filtro ativo, lida via useSearchParams (não dá pra ler query string em
 * layout.tsx — Next não repassa searchParams pra ele, só pra page.tsx). */
export function AnalyticsTabs() {
  const pathname = usePathname();
  const uf = useSearchParams().get('uf');
  const qs = uf ? `?uf=${uf}` : '';
  return (
    <div className="space-y-2">
      <nav className="flex flex-wrap gap-1 border-b" aria-label="Seções de analytics">
        {TABS.map(tab => {
          const active = tab.href === pathname;
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${qs}`}
              aria-current={active ? 'page' : undefined}
              className={`focus-ring -mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-bold ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <p className="text-sm text-muted-foreground">
        Últimos 30 dias
        {uf && (
          <>
            {' '}· Filtrado por visitantes de <strong>{UF_NAMES[uf] ?? uf}</strong> ·{' '}
            <Link href={pathname} className="font-bold text-primary underline">limpar filtro</Link>
          </>
        )}
      </p>
    </div>
  );
}
