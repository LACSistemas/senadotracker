import { Banknote, FileText, Landmark, Users } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import type { StateHouseStory } from '@senadotracker/db';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { AreaTrend, type ChartDatum } from '@/components/charts';
import { PositionStrip } from '@/components/position-strip';
import { MIN_LINKED_PCT } from '@/lib/state-house-story';
import { brl, count, percent } from '@/lib/format';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const month = (value: string) => { const [year, mm] = value.split('-'); return `${MONTHS[Number(mm) - 1] ?? mm}/${(year ?? '').slice(2)}`; };
const cov = (note: string, from: string | null, to: string | null, sampleSize: number | null, grain: DataCoverage['period']['grain'] = 'month'): DataCoverage => ({ availability: 'available', source: 'multiple', period: { from, to, grain }, batchId: null, note, sampleSize });
const median = (values: number[]) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; };
/** Posição (1 = maior valor); empates compartilham a melhor posição. */
const rankOf = (value: number, peers: number[]) => 1 + peers.filter(other => other > value).length;

function Section({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return <section className="section-hairline space-y-5 pt-8"><header className="max-w-3xl"><p className="eyebrow">{eyebrow}</p><h2 className="display-title mt-2 text-3xl sm:text-4xl">{title}</h2>{lede && <p className="mt-3 text-base leading-7 text-muted-foreground">{lede}</p>}</header>{children}</section>;
}

/** Visão geral do parlamentar construída só com os agregados da Casa (já em cache): nenhuma consulta nova por pessoa. */
export function StateProfileStory({ id, party, houseLabel, story, extra }: { id: string; party: string | null; houseLabel: string; story: StateHouseStory; extra: { amendments: number | null; timelineEvents: number | null } }) {
  const { seats, proposals, finance } = story;
  const roster = seats?.total ?? 0;
  const partySeats = party ? seats?.parties.find(item => item.party === party)?.seats ?? null : null;

  const proposalsOk = Boolean(proposals && (proposals.authorsLinkedPct ?? 0) >= MIN_LINKED_PCT && roster > 0);
  const mine = proposals && proposalsOk ? proposals.perMember[id] ?? 0 : null;
  const peerProposals: number[] = proposals && proposalsOk ? [...Object.values(proposals.perMember), ...new Array<number>(Math.max(0, roster - Object.keys(proposals.perMember).length)).fill(0)] : [];
  const proposalSeries = proposals && proposalsOk ? proposals.memberMonthly[id] : undefined;

  const financeOk = Boolean(finance && (finance.linkedValuePct ?? 0) >= MIN_LINKED_PCT);
  const spend = finance && financeOk ? finance.perMember[id] ?? null : null;
  const peerSpend: number[] = finance && financeOk ? Object.values(finance.perMember) : [];
  const spendSeries = finance && financeOk ? finance.memberMonthly[id] : undefined;

  return <>
    <KpiGrid>
      {proposals && <KpiCard label={`Proposições em ${proposals.year}`} value={mine === null ? '—' : count(mine)} icon={FileText} comparison={mine !== null ? `${rankOf(mine, peerProposals)}º de ${count(roster)} na Casa · mediana ${count(median(peerProposals) ?? 0)}` : 'A autoria desta Casa não pôde ser ligada ao cadastro'} coverage={cov('Autorias vinculadas ao cadastro corrente da Casa.', proposals.byMonth[0]?.month ?? null, proposals.byMonth.at(-1)?.month ?? null, proposals.authored)} />}
      {finance && <KpiCard label="Gasto publicado" value={spend === null ? (financeOk ? 'Sem lançamento' : '—') : brl(spend)} icon={Banknote} comparison={spend !== null ? `${rankOf(spend, peerSpend)}º de ${count(peerSpend.length)} com lançamento · mediana ${brl(Math.round(median(peerSpend) ?? 0))}` : financeOk ? 'Nenhum lançamento publicado para este parlamentar no período' : 'Os gastos desta Casa não puderam ser ligados a cada parlamentar'} coverage={cov('Verbas e cotas publicadas pela Casa; não indicam irregularidade.', finance.from, finance.to, finance.people)} />}
      {partySeats !== null && seats && <KpiCard label={`Bancada do ${party}`} value={`${partySeats} de ${count(seats.total)}`} icon={Users} comparison={`${percent(partySeats / seats.total)} das cadeiras da Casa`} coverage={cov('Cadastro corrente publicado pela Casa.', null, null, seats.total, 'snapshot')} />}
      <KpiCard label="Emendas estaduais" value={extra.amendments === null ? '—' : count(extra.amendments)} icon={Landmark} comparison={extra.timelineEvents ? `${count(extra.timelineEvents)} eventos de tramitação nas proposições` : null} coverage={cov('Emendas orçamentárias do exercício, quando a Casa as publica.', null, null, null, 'year')} />
    </KpiGrid>

    {proposals && proposalsOk && mine !== null && <Section eyebrow="Produção legislativa" title={mine ? `${count(mine)} proposições em ${proposals.year}, ${rankOf(mine, peerProposals)}º na Casa` : `Nenhuma proposição de autoria em ${proposals.year}`} lede={`Comparado com os ${count(roster)} ${houseLabel} da mesma Casa. Quantidade de proposições não mede qualidade nem desempenho.`}>
      <div className="grid gap-5 lg:grid-cols-2">
        {proposalSeries && proposalSeries.some(value => value > 0) && <AreaTrend title="Proposições por mês" data={proposals.byMonth.map<ChartDatum>((item, index) => ({ label: month(item.month), value: proposalSeries[index] ?? 0 }))} coverage={cov('Mês de apresentação publicado pela Casa.', proposals.byMonth[0]?.month ?? null, proposals.byMonth.at(-1)?.month ?? null, mine)} />}
        <PositionStrip title="Posição entre os colegas" peers={peerProposals} value={mine} median={median(peerProposals)} format={value => count(Math.round(value))} coverage={cov('Uma proposição conta uma vez por autor.', null, null, roster, 'year')} caption="Cada ponto cinza é um parlamentar da Casa. Posição alta pode refletir o tipo de proposição, e não esforço: requerimentos e projetos entram na mesma contagem." />
      </div>
    </Section>}

    {finance && financeOk && <Section eyebrow="Dinheiro público" title={spend === null ? 'Sem gasto publicado neste período' : `${brl(spend)} em gastos publicados`} lede="Verbas e cotas que a Assembleia divulga por parlamentar. Cada Casa tem regras próprias, então a comparação vale só dentro desta Assembleia.">
      <div className="grid gap-5 lg:grid-cols-2">
        {spendSeries && spendSeries.some(value => value > 0) && <AreaTrend title="Gasto publicado por mês (R$)" data={finance.monthly.map<ChartDatum>((item, index) => ({ label: month(item.month), value: spendSeries[index] ? Math.round(spendSeries[index]! / 100) : null }))} coverage={cov('Competência publicada pela Casa. Meses sem valor refletem o que já foi publicado.', finance.from, finance.to, finance.monthly.length)} />}
        {spend !== null && <PositionStrip title="Posição entre os colegas" peers={peerSpend.map(value => Math.round(value / 100))} value={Math.round(spend / 100)} median={Math.round((median(peerSpend) ?? 0) / 100)} format={value => brl(value * 100)} coverage={cov('Só parlamentares com lançamento no período.', finance.from, finance.to, peerSpend.length)} caption="Gasto alto não é, por si só, irregularidade: depende das rubricas que a Casa permite e do uso de cada gabinete." />}
      </div>
    </Section>}
  </>;
}
