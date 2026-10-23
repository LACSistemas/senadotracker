import { fmt } from './format.ts';
import { mkChart, mkSeries } from './series.ts';
import type { ChartPoint, ChartView, PrisonChapter, PrisonUnitView, ScopeInfo } from './types.ts';

interface PPoint { competence: number; ref: string; period: { start: string; end: string }; value: number | null; flags?: string[] }
interface PSeries { indicatorId: number; code: string; label: string; unit: string; scope: string; kind: string; points: PPoint[] }
interface PUnit { unitId: number; name: string; ambito: string; tipo: string; firstRef: string; lastRef: string; observedCycles: number; identityReviewPending: number; latest: { ref: string; capacity: number | null; population: number | null; occupancyPct: number | null } | null }
export interface PrisonMuniPayload { units: PUnit[]; aggregateSeries: PSeries[]; latestRef: string | null; restrictions: string[] }
export interface PrisonStatePayload { series: PSeries[]; latestRef: string | null; restrictions: string[] }

const pts = (s: PSeries | undefined): ChartPoint[] => (s?.points ?? []).map(p => ({ t: p.period.start.slice(0, 7), v: p.value, state: p.value == null ? 'absent' as const : 'ok' as const }));
const names = (s: PSeries | undefined): Record<string, string> => Object.fromEntries((s?.points ?? []).map(p => [p.period.start.slice(0, 7), `${p.ref.slice(5)}º semestre de ${p.ref.slice(0, 4)}`]));
const semesterName = (ref: string) => `${ref.slice(0, 4)}, ${ref.endsWith('/1') ? '1º' : '2º'} semestre`;
const byCode = (list: PSeries[]) => new Map(list.map(s => [s.code, s]));

export function buildPrisonChapter(o: { scope: ScopeInfo; muni: PrisonMuniPayload | null; state: PrisonStatePayload | null }): PrisonChapter {
  const { scope, muni, state } = o; const isMuni = scope.kind === 'municipio'; const own = isMuni ? muni?.aggregateSeries ?? [] : state?.series ?? []; const m = byCode(own);
  const where = isMuni ? scope.name : scope.stateName;
  const mkCap = (list: Map<string, PSeries>, scopeLabel: string): ChartView | null => {
    const cap = list.get('IND-PRI-E-CAP'), pop = list.get('IND-PRI-E-POP'); if (!cap || !pop) return null;
    return mkChart({ id: `pri:capacity:${scopeLabel}`, title: `Vagas e pessoas em celas físicas — ${scopeLabel}`, unit: 'pessoas / vagas', digits: 0, grain: 'M', periodNames: { ...names(cap), ...names(pop) }, series: [mkSeries('pop', 'Pessoas em celas físicas', pts(pop)), mkSeries('cap', 'Vagas (capacidade declarada)', pts(cap), 'blue', true)],
      source: 'SISDEPEN/SENAPPEN — formulário semestral', coverage: `${cap.points[0]?.ref ?? '—'} a ${cap.points.at(-1)?.ref ?? '—'}`, notes: ['Só celas físicas do sistema estadual. Prisão domiciliar, monitoramento eletrônico e outras modalidades ficam fora destes números.', 'Unidade que deixa de aparecer na base não significa unidade fechada.'] });
  };
  const mkOcc = (list: Map<string, PSeries>, scopeLabel: string): ChartView | null => {
    const occ = list.get('IND-PRI-E-OCC'); if (!occ || !occ.points.some(p => p.value != null)) return null;
    return mkChart({ id: `pri:occ:${scopeLabel}`, title: `Taxa de ocupação das celas físicas — ${scopeLabel}`, unit: '% das vagas', digits: 0, grain: 'M', periodNames: names(occ), series: [mkSeries('occ', scopeLabel, pts(occ))],
      source: 'SISDEPEN/SENAPPEN', coverage: `${occ.points[0]?.ref ?? '—'} a ${occ.points.at(-1)?.ref ?? '—'}`, notes: ['Ocupação = pessoas ÷ vagas, calculada sobre a soma das unidades (não é média de taxas das unidades).', 'Acima de 100% indica mais pessoas que vagas declaradas; não mede a qualidade da custódia.'] });
  };
  const capVsPop = mkCap(m, where); const occupancy = mkOcc(m, where);
  const units: PrisonUnitView[] = (muni?.units ?? []).map(u => ({ name: u.name, ambito: u.ambito === 'estadual' ? 'Sistema estadual' : u.ambito === 'federal' ? 'Sistema federal' : u.ambito, tipo: u.tipo === 'cela_fisica' ? 'Celas físicas' : u.tipo === 'domiciliar' ? 'Domiciliar' : u.tipo,
    capacity: u.latest?.capacity ?? null, population: u.latest?.population ?? null, occupancyPct: u.latest?.occupancyPct ?? null, ref: u.latest?.ref ?? u.lastRef, cycles: u.observedCycles, pendingIdentity: u.identityReviewPending }));
  // Regimes (último ciclo) — só do escopo próprio, quando a fonte traz a abertura.
  const latestOf = (code: string) => { const s = m.get(code); const p = s?.points.at(-1); return p ? { v: p.value, ref: p.ref } : null; };
  const regimeDefs: Array<[string, string, string]> = [['Presos provisórios', 'IND-PRI-E-POP_PROV', 'IND-PRI-E-CAP_PROV'], ['Regime fechado', 'IND-PRI-E-POP_FECHADO', 'IND-PRI-E-CAP_FECHADO'], ['Regime semiaberto', 'IND-PRI-E-POP_SEMI', 'IND-PRI-E-CAP_SEMI'], ['Regime aberto', 'IND-PRI-E-POP_ABERTO', 'IND-PRI-E-CAP_ABERTO']];
  const regimes = regimeDefs.map(([label, p, c]) => ({ label, population: latestOf(p)?.v ?? null, capacity: latestOf(c)?.v ?? null })).filter(r => r.population != null || r.capacity != null);
  const regimesRef = latestOf('IND-PRI-E-POP_PROV')?.ref ?? null;
  // Contexto estadual para o município.
  const sm = state ? byCode(state.series) : null;
  const stateContext = isMuni && sm ? { occupancy: mkOcc(sm, scope.stateName), label: `Sistema prisional de ${scope.stateName} (contexto: a ocupação estadual não é a do município)` } : null;
  const dom = (() => { const s = state ? byCode(state.series) : null; const a = s?.get('IND-PRI-D-POP_COM'), b = s?.get('IND-PRI-D-POP_SEM'); if (!a && !b) return null; const v = (a?.points.at(-1)?.value ?? 0) + (b?.points.at(-1)?.value ?? 0); return { label: `Pessoas em prisão domiciliar no estado (${(a ?? b)!.points.at(-1)!.ref}) — fora da ocupação física`, value: v }; })();
  const latestRef = isMuni ? muni?.latestRef : state?.latestRef;
  const hasUnits = units.length > 0;
  const available = isMuni ? (hasUnits || !!stateContext?.occupancy) : !!(capVsPop || occupancy);
  const observed = isMuni ? (hasUnits ? `${fmt(units.length)} estabelecimento${units.length > 1 ? 's' : ''} identificado${units.length > 1 ? 's' : ''} em ${scope.name} no último ciclo (${latestRef ? semesterName(latestRef) : '—'}).` : `Nenhum estabelecimento identificado nesta base para ${scope.name} até o último ciclo${latestRef ? ` (${semesterName(latestRef)})` : ''}. Isso descreve o que a fonte registra, não prova que o município não tenha unidade.`) : '';
  return {
    id: 'prisional', number: 4, title: 'Sistema prisional', question: 'Qual é a capacidade de custódia e como ela evoluiu?', available, emptyReason: available ? '' : 'Sem dados do sistema prisional publicados para este território.',
    narrative: { question: 'Qual é a capacidade de custódia e como ela evoluiu?', answer: '', context: null, invite: 'Compare vagas e pessoas ao longo dos ciclos e veja a composição por regime.' },
    scopeKind: scope.kind, capacityVsPopulation: capVsPop, occupancy, units, regimes, regimesRef, stateContext, domiciliary: dom, observed,
    restrictions: ['Presídio localizado no município não indica a criminalidade dos moradores: as pessoas custodiadas vêm de todo o estado.', 'Prisão domiciliar não entra na ocupação de celas físicas.', 'Total e componentes não se somam; a ocupação estadual é razão de somas, não média das unidades.', 'A correspondência histórica entre unidades ainda tem casos pendentes de revisão.'],
  };
}
