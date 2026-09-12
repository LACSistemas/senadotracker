import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Check, FileSearch, Gavel, Landmark, MapPinned, Scale, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { homeOverview } from '@/lib/data';

const legislativeDetails = [
  'Senadores e deputados federais, com perfis e histórico de atuação',
  'Partidos, estados e composição das Casas',
  'Gastos, cotas e estrutura de funcionamento',
  'Votações, projetos de lei e atividade legislativa',
];

const judiciaryDetails = [
  'Tribunais e sua estrutura em todo o país',
  'Magistrados, com perfis e informações institucionais',
  'Custos da Justiça e dados orçamentários',
  'Processos, tempo de tramitação e produtividade',
];

const judiciaryItems: Array<[string, string, LucideIcon]> = [
  ['Tribunais', 'STF, STJ, TJs e mais', Landmark],
  ['Magistrados', 'Juízes, desembargadores e ministros', Users],
  ['Justiça em números', 'Custos, produtividade e estrutura', Scale],
  ['Processos', 'Tempo de tramitação e indicadores', FileSearch],
];

export default async function HomePage() {
  const overview = homeOverview();
  const counts = overview.status === 'available'
    ? overview.data.counts
    : { senators: 81, deputies: 513, parties: 0 };
  const legislativeItems = [
    ['Senadores', `${counts.senators} senadores`, '/legislativo/senadores', Landmark],
    ['Deputados Federais', `${counts.deputies} deputados`, '/legislativo/deputados', Users],
    ['Partidos', counts.parties ? `${counts.parties} siglas representadas` : 'Todos os partidos', '/legislativo/partidos', Building2],
    ['Quem me representa?', 'Por estado e cidade', '/quem-me-representa', MapPinned],
  ] as const;

  return (
    <main id="conteudo" tabIndex={-1}>
      <div className="page-shell py-8 sm:py-10">
        <InstitutionHero
          context="Congresso Nacional · dados oficiais"
          title="Entenda quem representa você. Pelos dados."
          description="Organizamos informações oficiais sobre parlamentares, gastos, participação, atividade legislativa e gabinetes, sempre com período, cobertura e fonte."
          imageUrl="/congresso.svg"
          location="Brasília · DF"
        />
      </div>

      <section className="page-shell pb-14 pt-3">
        <div className="grid gap-4 xl:grid-cols-2">
          <InstitutionPortal
            kind="legislative"
            title="Poder Legislativo"
            description="Senadores, deputados federais, partidos, estados, gastos, votações e atividade legislativa."
            action={<Link className={buttonVariants()} href="/legislativo">Explorar Legislativo <ArrowRight size={15} /></Link>}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {legislativeItems.map(([title, subtitle, href, Icon]) => (
                <Link key={title} href={href} className="focus-ring group min-h-24 rounded-xl border bg-background/75 p-3 transition hover:-translate-y-0.5 hover:border-primary hover:bg-background">
                  <Icon size={17} className="text-primary" />
                  <strong className="mt-2 block text-sm leading-tight">{title}</strong>
                  <span className="mt-1 block text-xs leading-4 text-muted-foreground">{subtitle}</span>
                </Link>
              ))}
            </div>
          </InstitutionPortal>

          <InstitutionPortal
            kind="judiciary"
            title="Poder Judiciário"
            description="Tribunais, magistrados, custos da Justiça, processos, tempo de tramitação e estrutura."
            action={<span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm font-bold text-muted-foreground" aria-disabled="true">Explorar Judiciário <ArrowRight size={15} /></span>}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {judiciaryItems.map(([title, subtitle, Icon]) => (
                <div key={String(title)} className="min-h-24 rounded-xl border border-dashed bg-muted/35 p-3">
                  <Icon size={17} className="text-muted-foreground" />
                  <strong className="mt-2 block text-sm leading-tight">{title}</strong>
                  <span className="mt-1 block text-xs leading-4 text-muted-foreground">{subtitle}</span>
                </div>
              ))}
            </div>
          </InstitutionPortal>
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="page-shell py-14">
          <p className="eyebrow">Explore por Poder</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">O que você encontra em cada área?</h2>
          <div className="mt-8 grid gap-10 md:grid-cols-2 md:divide-x">
            <AreaDetails title="No Poder Legislativo, você encontra dados oficiais sobre:" items={legislativeDetails} />
            <AreaDetails className="md:pl-10" title="No Poder Judiciário, você encontrará dados oficiais sobre:" items={judiciaryDetails} future />
          </div>
        </div>
      </section>

      <SourcesBand />
    </main>
  );
}

function InstitutionPortal({ kind, title, description, action, children }: { kind: 'legislative' | 'judiciary'; title: string; description: string; action: ReactNode; children: ReactNode }) {
  const legislative = kind === 'legislative';
  return (
    <article className={cn('overflow-hidden rounded-3xl border bg-card shadow-sm', !legislative && 'bg-stone-100/70')}>
      <div className="grid min-h-48 grid-cols-[115px_1fr] gap-5 p-6 sm:grid-cols-[155px_1fr]">
        <div className={cn('relative grid place-items-center overflow-hidden rounded-2xl', legislative ? 'bg-primary text-primary-foreground' : 'bg-slate-800 text-white')} aria-hidden="true">
          {legislative ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(180deg, rgba(29,53,87,.12), rgba(29,53,87,.72)), url('/congresso.svg')" }} />
          ) : (
            <><Scale size={72} strokeWidth={1.25} /><Gavel className="absolute bottom-5 right-5 text-amber-300" size={29} /></>
          )}
        </div>
        <div className="flex flex-col items-start justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black">{title}</h2>
            {!legislative && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Em breve</span>}
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-5">{action}</div>
        </div>
      </div>
      <div className="border-t p-3">{children}</div>
    </article>
  );
}

function AreaDetails({ title, items, future = false, className }: { title: string; items: string[]; future?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', future ? 'bg-slate-200 text-slate-700' : 'bg-secondary text-primary')}>
          {future ? <Scale size={19} /> : <Landmark size={19} />}
        </span>
        <h3 className="max-w-md text-lg font-bold">{title}</h3>
      </div>
      <ul className="mt-6 space-y-4">
        {items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><Check className={future ? 'text-slate-500' : 'text-primary'} size={18} /><span>{item}</span></li>)}
      </ul>
      {future && <p className="mt-6 text-xs font-semibold text-muted-foreground">Área planejada. Ainda não há dados judiciais publicados neste produto.</p>}
    </div>
  );
}

function SourcesBand() {
  const sources = [
    ['/source-logos/senado.png', 'Senado Federal', 'conectada', 'h-9 w-9'],
    ['/source-logos/camara.png', 'Câmara dos Deputados', 'conectada', 'h-7 w-32'],
    ['/source-logos/tse.png', 'Tribunal Superior Eleitoral', 'conectada', 'h-9 w-9'],
    ['/source-logos/cnj.png', 'Conselho Nacional de Justiça', 'futura', 'h-9 w-9'],
    ['/source-logos/datajud.jpg', 'DataJud', 'futura', 'h-9 w-16'],
    ['/source-logos/stj.svg', 'Superior Tribunal de Justiça', 'futura', 'h-8 w-20'],
  ] as const;
  return (
    <section aria-label="Fontes oficiais" className="border-b bg-white">
      <div className="page-shell flex min-h-16 items-center gap-5 overflow-x-auto py-2.5">
        <strong className="shrink-0 border-r pr-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fontes oficiais</strong>
        <div className="flex min-w-max flex-1 items-center justify-between gap-8">
          {sources.map(([src, name, status, size]) => (
            <div key={name} title={`${name} · ${status}`} className={cn('relative flex h-10 items-center justify-center', status === 'futura' && 'grayscale opacity-45')}>
              <img src={src} alt={name} className={cn('object-contain', size)} />
              <span className={cn('absolute -right-2 top-0 size-1.5 rounded-full', status === 'conectada' ? 'bg-emerald-500' : 'bg-slate-300')} aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
