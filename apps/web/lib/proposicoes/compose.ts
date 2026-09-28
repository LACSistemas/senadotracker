import 'server-only';
import {
  activityCalendar, activityDnaByAuthor, activityRhythm, buildEditorialFacts, collectEvidence, loadAuthorLinks, loadEvents, loadUniverse,
  principalStageFlow, principalStaleness, proposalFunctionalOverview, proposalRelationSummary, proposalThemeGroupSummary, recentLegislativeEvents,
  type ActivityCalendar, type ActivityDna, type ActivityRhythm, type EditorialFact, type FunctionalOverview, type PrincipalStaleness,
  type PropositionHouse, type RecentEvents, type StageFlow, type openDatabase,
} from '@senadotracker/db';

type Db = ReturnType<typeof openDatabase>;
const HOUSES: readonly PropositionHouse[] = ['camara', 'senado'];
type ByHouse<T> = Record<PropositionHouse, T>;
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Id da MPV 1343/2026 na Câmara: o caso excepcional e didático da página. */
export const MPV_CASE = { source: 'camara' as const, id: '2610975' };

/**
 * Tudo o que a página /legislativo/proposicoes precisa, calculado de uma vez para o ano escolhido. As três visões
 * (Congresso, Câmara, Senado) saem do mesmo pacote: o cliente alterna entre elas sem novo pedido ao servidor.
 */
export interface OperationalBundle {
  year: number;
  years: FunctionalOverview['years'];
  updatedThrough: string | null;
  overview: FunctionalOverview;
  flow: ByHouse<StageFlow>;
  staleness: ByHouse<PrincipalStaleness>;
  dna: { party: ActivityDna; member: ActivityDna };
  rhythm: { presented: ActivityRhythm; events: ActivityRhythm };
  calendar: ByHouse<ActivityCalendar>;
  recent: ByHouse<RecentEvents>;
  facts: EditorialFact[];
  themes: { coverageRatio: number; themedProposals: number; totalProposals: number } | null;
  relation: ReturnType<typeof proposalRelationSummary>;
}

export function composeOperationalBundle(db: Db, requestedYear: number | undefined, groupLabels: Record<string, string>): OperationalBundle {
  const overview = proposalFunctionalOverview(db, requestedYear === undefined ? {} : { year: requestedYear }), year = overview.year;
  const today = new Date().toISOString().slice(0, 10);
  const universe = {} as ByHouse<ReturnType<typeof loadUniverse>>, events = {} as ByHouse<ReturnType<typeof loadEvents>>, authors = {} as ByHouse<ReturnType<typeof loadAuthorLinks>>;
  const evidence = {} as ByHouse<ReturnType<typeof collectEvidence>>;
  for (const source of HOUSES) {
    universe[source] = loadUniverse(db, source); events[source] = loadEvents(db, source); authors[source] = loadAuthorLinks(db, source);
    evidence[source] = collectEvidence(db, source, today, events[source]);
  }
  const shared = (source: PropositionHouse) => ({ universe: universe[source], events: events[source], evidence: evidence[source] });
  const flow = {} as ByHouse<StageFlow>, staleness = {} as ByHouse<PrincipalStaleness>, calendar = {} as ByHouse<ActivityCalendar>, recent = {} as ByHouse<RecentEvents>;
  for (const source of HOUSES) {
    flow[source] = principalStageFlow(db, source, year, shared(source));
    staleness[source] = principalStaleness(db, source, { ...shared(source), year });
    calendar[source] = activityCalendar(db, source, year, { universe: universe[source], events: events[source] });
    recent[source] = recentLegislativeEvents(db, source, 7, { universe: universe[source], events: events[source] });
  }
  const dna = {
    party: activityDnaByAuthor(db, { dimension: 'party', year, universe, authors }),
    member: activityDnaByAuthor(db, { dimension: 'member', year, universe, authors }),
  };
  const rhythm = { presented: activityRhythm(db, { mode: 'presented', year, universe }), events: activityRhythm(db, { mode: 'events', year, universe, events }) };
  const themeSummary = proposalThemeGroupSummary(db, 'camara'), health = themeSummary.themes.find(theme => fold(theme.theme) === 'saude');
  const facts = buildEditorialFacts({ overview, staleness, themes: health ? { theme: health.theme, themedProposals: health.themedProposals, groups: health.groups } : null, groupLabels });
  const updatedThrough = HOUSES.flatMap(source => [flow[source].updatedThrough, staleness[source].updatedThrough]).filter((value): value is string => Boolean(value)).sort().at(-1) ?? overview.updatedThrough;
  return {
    year, years: overview.years, updatedThrough, overview, flow, staleness, dna, rhythm, calendar, recent, facts,
    themes: themeSummary.totalProposals ? { coverageRatio: themeSummary.coverageRatio, themedProposals: themeSummary.themedProposals, totalProposals: themeSummary.totalProposals } : null,
    relation: proposalRelationSummary(db, MPV_CASE.source, MPV_CASE.id),
  };
}
