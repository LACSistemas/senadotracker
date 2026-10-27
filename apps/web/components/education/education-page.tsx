import type { ReactNode } from 'react';
import type { EducationPageData } from '@/lib/education/types';
import { ChapterNav } from '@/components/security/chapter-nav';
import { KpiCard } from '@/components/security/security-hero';
import { ChapterShell, EmptyNote } from '@/components/security/security-ui';
import { TrendChart } from '@/components/security/trend-chart';
import { ChartExplorer } from './chart-explorer';
import { Block, BarList, DataTable, EducationLegend, StatGrid } from './education-ui';
import { cn } from '@/lib/utils';

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

/** Página de Educação: panorama → quantos estudam → o que aprendem → quem fica pelo caminho → contexto → escolas → professores → dinheiro; mesmo desenho para estado e município. */
export function EducationPage({ data }: { data: EducationPageData }) {
  const { scope, hero, network, learning, trajectory, context, structure, teachers, money } = data; const where = scope.name; const n = hero.kpis.length;
  const nav = [{ id: 'panorama', label: 'Panorama', available: n > 0 }, { id: 'rede', label: 'Quantos estudam', available: network.available }, { id: 'aprendizagem', label: 'O que aprendem', available: learning.available }, { id: 'trajetoria', label: 'Quem fica pelo caminho', available: trajectory.available },
    { id: 'contexto', label: 'Contexto', available: context.available }, { id: 'estrutura', label: 'As escolas', available: structure.available }, { id: 'professores', label: 'Professores', available: teachers.available }, { id: 'recursos', label: 'Dinheiro e obras', available: money.available }, { id: 'fontes', label: 'Fontes', available: true }];
  const chapter = (ok: boolean, c: { id: string; number: number; title: string; emptyReason?: string }, node: ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason ?? 'Sem dados publicados.'} />;
  return (
    <div className="space-y-10">
      <section id="panorama" aria-labelledby="panorama-h" className="scroll-mt-28 space-y-4">
        <header><p className="eyebrow">Panorama</p><h2 id="panorama-h" className="display-title mt-1 text-2xl sm:text-4xl">Como está a educação {scope.kind === 'uf' ? `em ${where}` : `em ${where}`}?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{hero.lede}</p></header>
        {n > 0 ? <div className={cn('grid gap-4 md:grid-cols-2', n >= 4 && 'xl:grid-cols-4')}>{hero.kpis.map((k, i) => <KpiCard key={k.id} k={k} lead={i === 0} who={where} />)}</div> : <EmptyNote title="Sem indicadores para o panorama">Ainda não há dados de educação publicados para este território.</EmptyNote>}
      </section>
      <ChapterNav items={nav} />
      <EducationLegend />

      {chapter(network.available, network, <ChapterShell id="rede" number={1} title={network.title} narrative={network.narrative} limits={network.limits} sources={network.sources}>
        <StatGrid items={network.stats} />
        {network.enrollment && <TrendChart chart={network.enrollment} hideControls />}
        <div className="grid gap-6 lg:grid-cols-2"><BarList title="Alunos por etapa" rows={network.stages} /><BarList title="Alunos por rede" rows={network.dependency} /></div>
        <StatGrid items={network.special} /></ChapterShell>)}

      {chapter(learning.available, learning, <ChapterShell id="aprendizagem" number={2} title={learning.title} narrative={learning.narrative} tone="strip" limits={learning.limits} sources={learning.sources}>
        {learning.explorer && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Prova nacional (Saeb)</h3><ChartExplorer explorer={learning.explorer} /></Block>}
        {learning.ideb && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Ideb</h3><ChartExplorer explorer={learning.ideb} /></Block>}
        {learning.secondary && <Block><DataTable t={learning.secondary} /></Block>}</ChapterShell>)}

      {chapter(trajectory.available, trajectory, <ChapterShell id="trajetoria" number={3} title={trajectory.title} narrative={trajectory.narrative} limits={trajectory.limits} sources={trajectory.sources}>
        {trajectory.explorer && <Block><ChartExplorer explorer={trajectory.explorer} /></Block>}
        {trajectory.breakdown && <Block><DataTable t={trajectory.breakdown} /></Block>}
        {trajectory.transition.length > 0 && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Para onde vão os alunos de um ano para o outro ({trajectory.transitionYear}→{(trajectory.transitionYear ?? 0) + 1})</h3><StatGrid items={trajectory.transition} /><p className="mt-3 text-xs text-muted-foreground">Taxa de transição do INEP: de cada 100 alunos matriculados, quantos passaram de ano, repetiram ou deixaram a escola no ano seguinte. Existe só até 2021.</p></Block>}</ChapterShell>)}

      {chapter(context.available, context, <ChapterShell id="contexto" number={4} title={context.title} narrative={context.narrative} tone="strip" limits={context.limits} sources={context.sources}>
        <StatGrid items={context.stats} />
        {context.inse && <Block><TrendChart chart={context.inse} hideControls /></Block>}
        {context.classes.length > 0 && <Block><BarList title="Alunos por nível socioeconômico" rows={context.classes} caption="Percentual de alunos em cada um dos oito níveis do INSE (1 = mais baixo, 8 = mais alto)." /></Block>}</ChapterShell>)}

      {chapter(structure.available, structure, <ChapterShell id="estrutura" number={5} title={structure.title} narrative={structure.narrative} limits={structure.limits} sources={structure.sources}>
        <BarList title="Percentual de escolas que têm…" rows={structure.items} max={100} {...(structure.universe ? { caption: structure.universe } : {})} />
        {structure.explorer && <Block><h3 className="mb-3 font-display text-xl text-[#14304f]">Evolução, comparada com a referência</h3><ChartExplorer explorer={structure.explorer} /></Block>}</ChapterShell>)}

      {chapter(teachers.available, teachers, <ChapterShell id="professores" number={6} title={teachers.title} narrative={teachers.narrative} tone="strip" limits={teachers.limits} sources={teachers.sources}>
        <StatGrid items={teachers.stats} />
        {teachers.docentes && <Block><TrendChart chart={teachers.docentes} hideControls /></Block>}
        <div className="grid gap-6 lg:grid-cols-2">{teachers.formation.length > 0 && <BarList title="Formação dos professores do fundamental" rows={teachers.formation} max={100} caption="Grupo 1 = formação superior adequada à disciplina que leciona; os demais grupos têm formação diferente ou incompleta." />}{teachers.table && <DataTable t={teachers.table} />}</div></ChapterShell>)}

      {chapter(money.available, money, <ChapterShell id="recursos" number={7} title={money.title} narrative={money.narrative} limits={money.limits} sources={money.sources}>
        <StatGrid items={money.contractStats} />
        {money.contractsChart && <Block><TrendChart chart={money.contractsChart} hideControls /></Block>}
        {money.categories.length > 0 && <BarList title="No que os contratos se concentram (valor contratado)" rows={money.categories} />}
        <div className="grid gap-6 lg:grid-cols-2">{money.suppliers && <DataTable t={money.suppliers} />}{money.programs && <DataTable t={money.programs} />}</div>
        {money.finance && <DataTable t={money.finance} />}
        {money.works ? <DataTable t={money.works} /> : money.worksNote ? <EmptyNote title="Obras">{money.worksNote}</EmptyNote> : null}</ChapterShell>)}

      <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
        <ul className="mt-2 space-y-1 text-muted-foreground">{data.sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Esta página reúne registros oficiais; ela não classifica o município ou o estado como bom ou ruim em educação, não cria índice único e não atribui causas às variações. Resultados por escola (Saeb) não são publicados pela fonte; contratos não identificam a escola atendida. Resultado ausente significa que a fonte não divulgou, nunca zero.</p></section>
    </div>
  );
}
