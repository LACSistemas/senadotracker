import type { ReactNode } from 'react';
import type { WellbeingObservation } from '@senadotracker/db';
import type { WellbeingPageData } from '@/lib/wellbeing/types';
import { ChapterNav } from '@/components/security/chapter-nav';
import { ChapterShell, EmptyNote } from '@/components/security/security-ui';
import { TrendChart } from '@/components/security/trend-chart';
import { Block, BarList, DataTable, StatGrid, WellbeingLegend } from './wellbeing-ui';
import { TerritoryCompareRow } from './territory-compare';
import { IndicatorDetails } from './indicator-disclosure';
import { cn } from '@/lib/utils';

/** Fecho de cada capítulo: um `<IndicatorDetails>` por indicador que o sustenta — fonte, período, universo, cobertura,
 * revisão e link oficial, tudo já carregado pelo capítulo (nenhuma consulta extra). Omitido quando não há observação. */
function Disclosures({ items }: { items: WellbeingObservation[] }) {
  if (items.length === 0) return null;
  return <div className="mt-2 space-y-1 border-t pt-3">{items.map(o => <IndicatorDetails key={o.indicatorCode} o={o} />)}</div>;
}

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

/** Página de Bem-estar: retrato seletivo → condições de vida → trabalho → rede socioassistencial → cotidiano digital →
 * ação pública → evolução; mesmo desenho para estado e município, capítulos adaptados ao que cada escopo permite. */
export function WellbeingPage({ data }: { data: WellbeingPageData }) {
  const { scope, portrait, conditions, work, social, digital, action, evolution } = data; const where = scope.name;
  const nav = [
    { id: 'retrato', label: 'Retrato', available: portrait.facts.length > 0 }, { id: 'condicoes', label: 'Condições de vida', available: conditions.available },
    { id: 'trabalho', label: 'Trabalho', available: work.available }, { id: 'rede-social', label: 'Rede socioassistencial', available: social.available },
    { id: 'digital', label: 'Cotidiano digital', available: digital.available }, { id: 'acao-publica', label: 'Ação pública', available: action.available },
    { id: 'evolucao', label: 'Evolução', available: evolution.available }, { id: 'fontes', label: 'Fontes', available: true },
  ];
  const chapter = (ok: boolean, c: { id: string; number: number; title: string; emptyReason?: string }, node: ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason ?? 'Sem dados publicados.'} />;

  return (
    <div className="space-y-10">
      <section id="retrato" aria-labelledby="retrato-h" className="scroll-mt-28 space-y-5">
        <header><p className="eyebrow">Retrato de Bem-estar</p><h2 id="retrato-h" className="display-title mt-1 text-2xl sm:text-4xl">Como se vive {scope.kind === 'uf' ? `no estado de ${where}` : `em ${where}`}?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{portrait.lede}</p></header>
        {portrait.facts.length > 0 ? (
          <div className={cn('grid gap-4 sm:grid-cols-2', portrait.facts.length >= 3 && 'lg:grid-cols-4')}>
            {portrait.facts.map(f => (
              <article key={f.label} className="flex flex-col gap-1 rounded-2xl border bg-[#e8f3ee] p-5 card-elevated">
                <p className="eyebrow">{f.label}</p>
                <p className="hero-figure tnum text-3xl text-[#14304f] sm:text-4xl">{f.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{f.unit}</span></p>
                <p className="mt-auto text-xs text-muted-foreground">{f.source} · {f.period}</p>
              </article>
            ))}
          </div>
        ) : <EmptyNote title="Sem fatos para o retrato">Ainda não há indicadores de Bem-estar publicados para este território.</EmptyNote>}
      </section>
      <ChapterNav items={nav} />
      <WellbeingLegend />

      {chapter(conditions.available, conditions, <ChapterShell id="condicoes" number={1} title={conditions.title} narrative={conditions.narrative} limits={conditions.limits} sources={conditions.sources}>
        <BarList title="Renda domiciliar per capita: média e mediana (Censo 2022)" rows={conditions.incomeBars} caption="A média é puxada para cima por quem ganha mais; a mediana mostra o valor do domicílio do meio." />
        {conditions.incomeCompare && <Block><TerritoryCompareRow c={conditions.incomeCompare} /></Block>}
        <BarList title="Condições dos domicílios" rows={conditions.housing} max={100} caption="Percentual de domicílios particulares permanentes com cada condição adequada, segundo o Censo 2022." />
        {conditions.gini && <StatGrid items={[conditions.gini]} />}
        <Disclosures items={conditions.disclosures} />
      </ChapterShell>)}

      {chapter(work.available, work, <ChapterShell id="trabalho" number={2} title={work.title} narrative={work.narrative} tone="strip" limits={work.limits} sources={work.sources}>
        <StatGrid items={work.stats} />
        {work.cagedChart && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Admissões, desligamentos e saldo mensal</h3><TrendChart chart={work.cagedChart} hideControls /></Block>}
        {work.raisChart && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Estoque anual (RAIS)</h3><TrendChart chart={work.raisChart} hideControls /></Block>}
        {work.remuneration && <StatGrid items={[work.remuneration]} />}
        <Disclosures items={work.disclosures} />
      </ChapterShell>)}

      {chapter(social.available, social, <ChapterShell id="rede-social" number={3} title={social.title} narrative={social.narrative} limits={social.limits} sources={social.sources}>
        <StatGrid items={[...social.cras, ...(social.creas ? [social.creas] : [])]} />
        {social.creasNote && <p className="text-xs text-muted-foreground">{social.creasNote}</p>}
        {social.crasCapacity.length > 0 && <BarList title="CRAS por faixa de capacidade de referenciamento" rows={social.crasCapacity} caption="Capacidade declarada de famílias referenciadas; não é quantas foram atendidas." />}
        {social.indices.length > 0 && <StatGrid items={social.indices} />}
        <Disclosures items={social.disclosures} />
      </ChapterShell>)}

      {chapter(digital.available, digital, <ChapterShell id="digital" number={4} title={digital.title} narrative={digital.narrative} tone="strip" limits={digital.limits} sources={digital.sources}>
        {digital.items.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">{digital.items.map(i => (
            <li key={i.code} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm">
              <span className="font-semibold text-[#14304f]">{i.label}</span>
              <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold', i.status === 'sim' ? 'border-primary bg-primary/10 text-primary' : i.status === 'nao' ? 'bg-secondary text-muted-foreground' : 'border-dashed text-muted-foreground')}>
                {i.status === 'sim' ? 'Sim' : i.status === 'nao' ? 'Não' : 'Sem resposta válida'}
              </span>
            </li>
          ))}</ul>
        )}
        {digital.distribution.length > 0 && <BarList title="Respostas declaradas pelas prefeituras do estado" rows={digital.distribution} max={100} caption="Barra = percentual de prefeituras respondentes que declararam Sim; o rótulo mostra os números absolutos." />}
        <Disclosures items={digital.disclosures} />
      </ChapterShell>)}

      {chapter(action.available, action, <ChapterShell id="acao-publica" number={5} title={action.title} narrative={action.narrative} limits={action.limits} sources={action.sources}>
        <StatGrid items={action.stats} />
        {action.table && <Block><DataTable t={action.table} /></Block>}
      </ChapterShell>)}

      {chapter(evolution.available, evolution, <ChapterShell id="evolucao" number={6} title={evolution.title} narrative={evolution.narrative} tone="strip" limits={evolution.limits} sources={evolution.sources}>
        {evolution.series.map(s => <Block key={s.title}><h3 className="mb-3 font-display text-xl text-[#14304f]">{s.title}</h3><TrendChart chart={s.chart} hideControls /></Block>)}
      </ChapterShell>)}

      <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
        <ul className="mt-2 space-y-1 text-muted-foreground">{data.sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Esta página reúne registros oficiais de fontes e anos diferentes; ela não cria um índice único de bem-estar, não classifica o território como bom ou ruim e não atribui causas às variações. Ausência de valor significa que a fonte não publicou, nunca zero.</p></section>
    </div>
  );
}
