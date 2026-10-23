import type { ReactNode } from 'react';
import type { SecurityPageData } from '@/lib/security/types';
import { ChapterNav } from './chapter-nav';
import { CrimeExplorer } from './crime-explorer';
import { ExplorerPanel } from './explorer-panel';
import { FinanceChapterBody } from './finance-chapter';
import { PoliceChapterBody } from './police-chapter';
import { PrisonChapterBody } from './prison-chapter';
import { ChapterShell, DataStatesLegend, EmptyNote } from './security-ui';
import { SecurityHero } from './security-hero';
import { StructureChapterBody } from './structure-chapter';
import { TrafficChapterBody } from './traffic-chapter';

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><div className="mt-3"><EmptyNote title="Sem dados publicados aqui">{reason}</EmptyNote></div></div></section>;
}

/** Página de Segurança: uma narrativa contínua (panorama → criminalidade → estrutura → trânsito → prisões → finanças → atuação policial → explorar), com o mesmo desenho para estado e município. */
export function SecurityPage({ data }: { data: SecurityPageData }) {
  const { scope, crime, structure, traffic, prison, finance, police } = data; const isMuni = scope.kind === 'municipio'; const where = scope.name;
  const nav = [{ id: 'panorama', label: 'Panorama', available: data.hero.kpis.length > 0 }, { id: 'criminalidade', label: 'Criminalidade', available: crime.available }, { id: 'estrutura', label: 'Estrutura', available: structure.available }, { id: 'transito', label: 'Trânsito', available: traffic.available },
    { id: 'prisional', label: 'Sistema prisional', available: prison.available }, { id: 'financas', label: 'Finanças', available: finance.available }, { id: 'apreensoes', label: 'Atuação policial', available: police.available }, { id: 'explorar', label: 'Explorar os dados', available: data.explorerCount > 0 }];
  const chapter = (ok: boolean, id: string, n: number, title: string, reason: string, node: ReactNode) => ok ? node : <Pending id={id} number={n} title={title} reason={reason} />;
  return (
    <div className="space-y-10">
      <SecurityHero data={data} />
      <ChapterNav items={nav} />
      <DataStatesLegend />
      {chapter(crime.available, 'criminalidade', 1, 'Criminalidade', 'Ainda não há registros de criminalidade publicados para este território.',
        <ChapterShell id="criminalidade" number={1} title={crime.title} narrative={crime.narrative} limits={[crime.sourceNote, 'Registro policial não é condenação nem crime comprovado; vítimas e ocorrências são medidas diferentes.', 'Os registros estaduais não são comparáveis entre estados: cada secretaria usa definições próprias.', 'Ausência de registro não é zero; valores ocultos por privacidade não são zero; o último período costuma ser preliminar.', 'O SIM conta óbitos pelo certificado de óbito (saúde pública) e o Sinesp conta registros policiais: são medidas distintas.']} sources={`Fontes: Sinesp VDE (MJSP), SIM/DATASUS${crime.stateSource ? `, ${crime.stateSource}` : ''}.`}>
          <CrimeExplorer chapter={crime} entityId={scope.entityId} scopeName={where} isMunicipality={isMuni} /></ChapterShell>)}
      {chapter(structure.available, 'estrutura', 2, 'Estrutura e capacidade institucional', 'Não há declaração de estrutura publicada para este território.',
        <ChapterShell id="estrutura" number={2} title={structure.title} narrative={structure.narrative} tone="strip" limits={structure.restrictions} sources="Fontes: FBSP (2025), ESTADIC (2018 e 2022) e MUNIC (2019 e 2023), IBGE.">
          <StructureChapterBody ch={structure} scope={scope} /></ChapterShell>)}
      {chapter(traffic.available, 'transito', 3, 'Segurança viária', traffic.emptyReason ?? '',
        <ChapterShell id="transito" number={3} title={traffic.title} narrative={traffic.narrative} limits={traffic.restrictions} sources="Fontes: SIM/DATASUS, Senatran, RENAEST e PRF."><TrafficChapterBody ch={traffic} name={where} /></ChapterShell>)}
      {chapter(prison.available, 'prisional', 4, 'Sistema prisional', prison.emptyReason ?? '',
        <ChapterShell id="prisional" number={4} title={prison.title} narrative={prison.narrative} tone="strip" limits={prison.restrictions} sources="Fonte: SISDEPEN/SENAPPEN (formulário semestral)."><PrisonChapterBody ch={prison} name={where} /></ChapterShell>)}
      {chapter(finance.available, 'financas', 5, 'Finanças da Segurança', finance.emptyReason ?? '',
        <ChapterShell id="financas" number={5} title={finance.title} narrative={finance.narrative} limits={finance.restrictions} sources="Fontes: Siconfi (DCA e RREO), PNCP e Transferegov."><FinanceChapterBody ch={finance} scope={scope} /></ChapterShell>)}
      {chapter(police.available, 'apreensoes', 6, 'Apreensões e atuação policial', police.emptyReason ?? '',
        <ChapterShell id="apreensoes" number={6} title={police.title} narrative={police.narrative} tone="strip" limits={police.restrictions} sources="Fontes: Sinesp VDE e registros das secretarias estaduais (RJ, RS, SP)."><PoliceChapterBody ch={police} /></ChapterShell>)}
      <section id="explorar" aria-labelledby="explorar-h" className="scroll-mt-28 rounded-3xl border bg-[#14304f] p-5 text-white sm:p-8">
        <p className="eyebrow !text-[#9bd7bd]">Capítulo 7</p><h2 id="explorar-h" className="display-title mt-1 text-3xl sm:text-4xl">Explore os dados</h2><p className="mt-2 font-display text-lg italic text-white/80 sm:text-xl">O que mais você quer investigar?</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">Todos os indicadores de Segurança com dado para {where}: séries completas, valores exatos, numerador e denominador, fonte e marcas de preliminar ou supressão. Dá para exportar o recorte em CSV com os metadados.</p>
        <div className="mt-5 text-[#14304f]"><ExplorerPanel entityId={scope.entityId} scopeName={where} count={data.explorerCount} /></div>
      </section>
      <section aria-labelledby="fontes-h" className="rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
        <ul className="mt-2 space-y-1 text-muted-foreground">{data.sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Esta página reúne registros oficiais; ela não classifica o território como seguro ou perigoso, não cria índice único e não atribui causas às variações. Números pequenos oscilam muito e nem toda fonte cobre todos os anos.</p></section>
    </div>
  );
}
