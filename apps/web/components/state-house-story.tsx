import { Banknote, FileText, Landmark, Users } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import type { StateHouseStory } from '@senadotracker/db';
import { PartyHemicycle } from '@/components/party-hemicycle';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { AreaTrend, RankedBars, type ChartDatum } from '@/components/charts';
import { MIN_LINKED_PCT } from '@/lib/state-house-story';
import { brl, count, percent } from '@/lib/format';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const month = (value: string) => { const [year, mm] = value.split('-'); return `${MONTHS[Number(mm) - 1] ?? mm}/${(year ?? '').slice(2)}`; };
const cov = (availability: DataCoverage['availability'], note: string, from: string | null, to: string | null, sampleSize: number | null = null, grain: DataCoverage['period']['grain'] = 'month'): DataCoverage => ({ availability, source: 'multiple', period: { from, to, grain }, batchId: null, note, sampleSize });
const SOURCE_NOTE = 'Publicado pela própria Casa e lido na revisão ativa do Cívica.';

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return <section id={id} className="section-hairline space-y-6 pt-8">
    <header className="max-w-3xl"><p className="eyebrow">{eyebrow}</p><h2 className="display-title mt-2 text-3xl sm:text-5xl">{title}</h2>{lede && <p className="mt-3 text-base leading-7 text-muted-foreground">{lede}</p>}</header>
    {children}
  </section>;
}

function Note({ children }: { children: React.ReactNode }) { return <p className="text-xs leading-5 text-muted-foreground">{children}</p>; }

/** Narrativa da Assembleia. Cada ato só existe quando a Casa publica o domínio; o que falta vira uma frase, nunca um zero. */
export function StateHouseStoryView({ house, story, noun, singular, memberHref }: { house: string; story: StateHouseStory; noun: string; singular: string; memberHref: (id: string) => string }) {
  const { seats, proposals, finance } = story;
  const partiesWithSeats = seats?.parties.filter(p => p.party !== 'Sem partido') ?? [];
  const top = partiesWithSeats[0];
  const missing = [!proposals && 'produção legislativa', !finance && 'gastos parlamentares'].filter(Boolean) as string[];
  const financeRanked = finance && (finance.linkedValuePct ?? 0) >= MIN_LINKED_PCT;
  const authorsRanked = proposals && (proposals.authorsLinkedPct ?? 0) >= MIN_LINKED_PCT;

  return <>
    {seats && <KpiGrid>
      <KpiCard label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} em exercício`} value={count(seats.total)} icon={Users} comparison={null} coverage={cov('available', SOURCE_NOTE, null, null, seats.total, 'snapshot')} detail={seats.unresolved ? `${seats.unresolved} sem partido resolvido no cadastro` : undefined} />
      <KpiCard label="Partidos com cadeira" value={count(partiesWithSeats.length)} icon={Landmark} comparison={top ? `Maior bancada: ${top.party} (${percent(top.seats / seats.total)})` : null} coverage={cov('available', SOURCE_NOTE, null, null, seats.total, 'snapshot')} />
      {proposals
        ? <KpiCard label={`Proposições em ${proposals.year}`} value={count(proposals.total)} icon={FileText} comparison={proposals.byType[0] ? `Mais comum: ${proposals.byType[0].type} (${percent(proposals.byType[0].n / Math.max(1, proposals.total))})` : null} coverage={cov('available', SOURCE_NOTE, proposals.byMonth[0]?.month ?? null, proposals.byMonth.at(-1)?.month ?? null, proposals.total)} />
        : <KpiCard label="Proposições" value="—" icon={FileText} comparison={null} coverage={cov('unavailable', 'A Casa não tem produção legislativa publicada no Cívica.', null, null)} />}
      {finance
        ? <KpiCard label="Gastos parlamentares publicados" value={brl(finance.totalCents)} icon={Banknote} comparison={finance.from && finance.to ? `${month(finance.from)} a ${month(finance.to)}` : null} coverage={cov('available', SOURCE_NOTE, finance.from, finance.to, finance.people)} detail={financeRanked && finance.people ? `Média de ${brl(Math.round(finance.totalCents / finance.people))} por parlamentar com lançamento` : undefined} />
        : <KpiCard label="Gastos parlamentares" value="—" icon={Banknote} comparison={null} coverage={cov('unavailable', 'A Casa não publica gastos parlamentares em formato que o Cívica consiga ler.', null, null)} />}
    </KpiGrid>}

    {seats && <Section id="representacao" eyebrow="1 · Representação" title={top ? `${top.party} tem a maior bancada, com ${top.seats} de ${seats.total} cadeiras` : `${seats.total} ${noun} em exercício`} lede="Cada círculo é um parlamentar em exercício. Passe o mouse num partido para destacar a bancada; clicar na legenda filtra a lista abaixo.">
      <PartyHemicycle composition={{ total: seats.total, parties: seats.parties }} labels={{ noun, one: singular, partyHrefTemplate: `/legislativo/estaduais/${house}/deputados?partido={party}#parlamentares` }} />
    </Section>}

    {proposals && proposals.total > 0 && <Section id="producao" eyebrow="2 · Produção legislativa" title={`${count(proposals.total)} proposições em ${proposals.year}`} lede="O que chegou à Casa neste ano, mês a mês e por tipo de proposição, segundo os códigos publicados pela própria Assembleia.">
      <div className="grid gap-5 lg:grid-cols-2">
        {proposals.byMonth.length > 1 && <AreaTrend title="Proposições apresentadas por mês" data={proposals.byMonth.map<ChartDatum>(m => ({ label: month(m.month), value: m.n }))} coverage={cov('available', SOURCE_NOTE, proposals.byMonth[0]!.month, proposals.byMonth.at(-1)!.month, proposals.total)} />}
        <RankedBars title="Tipos de proposição" items={proposals.byType.slice(0, 8).map(t => ({ key: t.type, label: t.type, value: t.n, meta: percent(t.n / proposals.total) }))} coverage={cov('available', SOURCE_NOTE, null, null, proposals.total, 'year')} formatValue={v => count(v)} />
      </div>
      {authorsRanked
        ? <div className="grid gap-5 lg:grid-cols-2">
          <RankedBars title="Quem mais apresenta" items={proposals.topAuthors.slice(0, 8).map(a => ({ key: a.id, label: a.name, value: a.n, href: memberHref(a.id), ...(a.party ? { meta: a.party } : {}) }))} coverage={cov('available', 'Autorias vinculadas ao cadastro corrente. Uma proposição com vários autores conta para cada um.', null, null, proposals.authored, 'year')} formatValue={v => `${count(v)} proposições`} />
          <RankedBars title="Proposições por partido" items={proposals.byParty.slice(0, 8).map(p => ({ key: p.party, label: p.party, value: p.proposals, ...(p.seats ? { meta: `${p.seats} cadeiras · ${count(Math.round(p.proposals / p.seats))} por cadeira` } : {}) }))} coverage={cov('available', 'Soma das autorias dos parlamentares de cada partido.', null, null, proposals.authored, 'year')} formatValue={v => count(v)} />
        </div>
        : <Note>Autoria por parlamentar não é exibida: só {proposals.authorsLinkedPct === null ? 'uma parte' : percent(proposals.authorsLinkedPct / 100, 0)} dos autores publicados pela Casa foi ligada ao cadastro atual, e um ranking parcial seria enganoso.</Note>}
      <Note>Quantidade de proposições não mede qualidade nem desempenho: requerimentos e projetos entram na mesma contagem.</Note>
    </Section>}

    {finance && <Section id="dinheiro" eyebrow="3 · Dinheiro público" title={`${brl(finance.totalCents)} em gastos parlamentares publicados`} lede="Verbas e cotas que a Casa divulga por parlamentar, somadas por competência. Cada Assembleia usa regras e rubricas próprias, então esta Casa só se compara a ela mesma.">
      <div className="grid gap-5 lg:grid-cols-2">
        {finance.monthly.length > 1 && <AreaTrend title="Gasto publicado por mês (R$)" data={finance.monthly.map<ChartDatum>(m => ({ label: month(m.month), value: Math.round(m.cents / 100) }))} coverage={cov('available', SOURCE_NOTE, finance.from, finance.to, finance.monthly.reduce((s, m) => s + m.n, 0))} />}
        {finance.semantics !== 'unusable' && finance.labels.length > 0 && <RankedBars title={finance.semantics === 'supplier' ? 'Maiores favorecidos' : 'Para onde vai o dinheiro'} items={finance.labels.slice(0, 8).map(l => ({ key: l.label, label: l.label, value: l.cents, meta: `${count(l.n)} lançamentos` }))} coverage={cov('available', finance.semantics === 'supplier' ? 'Esta Casa publica o favorecido no lugar da categoria de despesa.' : SOURCE_NOTE, finance.from, finance.to, finance.labels.reduce((s, l) => s + l.n, 0))} formatValue={v => brl(v)} />}
      </div>
      {financeRanked
        ? <div className="grid gap-5 lg:grid-cols-2">
          <RankedBars title="Maiores gastos por parlamentar" items={finance.topMembers.slice(0, 8).map(m => ({ key: m.id, label: m.name, value: m.cents, href: memberHref(m.id), ...(m.party ? { meta: m.party } : {}) }))} coverage={cov('available', 'Valores publicados no período; não indicam irregularidade.', finance.from, finance.to, finance.people)} formatValue={v => brl(v)} />
          <RankedBars title="Média por parlamentar, por partido" items={finance.byParty.filter(p => p.members >= 2).map(p => ({ key: p.party, label: p.party, value: Math.round(p.cents / p.members), meta: `${p.members} parlamentares com lançamento` })).sort((a, b) => b.value - a.value).slice(0, 8)} coverage={cov('available', 'Só partidos com 2 ou mais parlamentares com lançamento.', finance.from, finance.to, finance.people)} formatValue={v => brl(v)} />
        </div>
        : <Note>Gasto por parlamentar não é exibido: apenas {finance.linkedValuePct === null ? 'parte' : percent(finance.linkedValuePct / 100, 0)} do valor publicado foi ligado ao cadastro atual de parlamentares.</Note>}
      {financeRanked && finance.linkedValuePct !== null && finance.linkedValuePct < 99.5 && <Note>{percent((100 - finance.linkedValuePct) / 100)} do valor publicado não foi atribuído a um parlamentar (lançamentos sem identificação, de ex-parlamentares ou de estruturas da Casa) e por isso fica fora dos rankings por pessoa. Os parlamentares são identificados pelo código da Casa ou, quando a Casa só informa o nome, por nome exato e único.</Note>}
      <Note>Meses com poucos lançamentos não significam ausência de gasto: refletem o que a Casa já publicou.{finance.ignoredFutureRows ? ` ${finance.ignoredFutureRows} lançamento(s) com competência futura foram desconsiderados.` : ''} Gasto alto não é, por si só, irregularidade.</Note>
    </Section>}

    {(missing.length > 0 || !story.fresh) && <aside className="rounded-2xl border bg-secondary/50 p-5 text-sm leading-6" aria-label="Cobertura desta Casa">
      {missing.length > 0 && <p><strong>O que esta Casa ainda não permite mostrar:</strong> {missing.join(' e ')}. Depende do que cada Assembleia publica; quando passar a publicar, aparece aqui sozinho.</p>}
      {!story.fresh && <p className={missing.length ? 'mt-2' : ''}><strong>Atualização pendente:</strong> os gráficos refletem a última apuração e podem não incluir a revisão de dados mais recente.</p>}
    </aside>}
  </>;
}
