'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { GlobalSearch } from '@/components/global-search';

type SubLink = readonly [string, string];
type NavLink = readonly [string, string, ReadonlyArray<SubLink>?];

const legislativoSubLinks: SubLink[] = [
  ['/legislativo/senadores', 'Senadores'],
  ['/legislativo/deputados', 'Deputados Federais'],
  ['/legislativo/estaduais', 'Assembleias Legislativas'],
  ['/legislativo/proposicoes', 'Proposições'],
  ['/legislativo/fornecedores', 'Fornecedores'],
];

const links: NavLink[] = [
  ['/', 'Início'],
  ['/executivo', 'Executivo'],
  ['/legislativo', 'Legislativo', legislativoSubLinks],
  ['/estados', 'Estados'],
  ['/legislativo/partidos', 'Partidos'],
  ['/judiciario', 'Judiciário'],
  ['/legislativo/rankings', 'Ranking'],
  ['/comparar', 'Comparar'],
];

export function AppHeader() {
  const pathname = usePathname();
  const active = (href: string) => href === '/' ? pathname === href : pathname.startsWith(href);
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="page-shell flex min-h-18 items-center justify-between gap-3 py-3">
        <Link href="/" className="focus-ring flex shrink-0 items-center no-underline" aria-label="Cívica, página inicial"><Image src="/civica-logo.png" alt="Cívica" width={137} height={48} priority className="h-9 w-auto object-contain" /></Link>
        <nav aria-label="Navegação principal" className="hidden items-center text-sm font-semibold xl:flex">
          {links.map(([href, label, children]) => children ? (
            <div key={href} className="group relative">
              <Link href={href} aria-current={active(href) ? 'page' : undefined} className="focus-ring flex items-center gap-1 border-b-2 border-transparent px-3 py-3 hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-primary">{label}<ChevronDown size={14} aria-hidden /></Link>
              <div className="invisible absolute left-0 top-full z-10 w-56 rounded-2xl border bg-card p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {children.map(([childHref, childLabel]) => <Link key={childHref} href={childHref} aria-current={active(childHref) ? 'page' : undefined} className="focus-ring block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary aria-[current=page]:bg-secondary">{childLabel}</Link>)}
              </div>
            </div>
          ) : (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined} className="focus-ring border-b-2 border-transparent px-3 py-3 hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-primary">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <Link href="/legislativo" className="focus-ring hidden items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground sm:flex">Explorar <ArrowRight size={15} /></Link>
          <details className="relative xl:hidden">
            <summary className="focus-ring cursor-pointer list-none rounded-full border px-3 py-2 text-sm font-bold">Menu</summary>
            <nav aria-label="Navegação móvel" className="absolute right-0 mt-2 grid w-56 rounded-2xl border bg-card p-2 shadow-xl">
              {links.map(([href, label, children]) => (
                <div key={href}>
                  <Link href={href} aria-current={active(href) ? 'page' : undefined} className="focus-ring block rounded-xl px-3 py-2 text-sm font-semibold aria-[current=page]:bg-secondary">{label}</Link>
                  {children && <div className="ml-3 grid">{children.map(([childHref, childLabel]) => <Link key={childHref} href={childHref} aria-current={active(childHref) ? 'page' : undefined} className="focus-ring block rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground">{childLabel}</Link>)}</div>}
                </div>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
