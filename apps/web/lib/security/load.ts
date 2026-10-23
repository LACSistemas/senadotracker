import type { Pool } from 'pg';
import {
  ALL_CRIME_DEFS, getOrganizedCrimeMunicipality, getOrganizedCrimeNational, getOrganizedCrimeState, getPrisonMunicipality, getPrisonState, getSecurityFinanceMunicipality, getSecurityFinanceState, getSecurityStaffingNational,
  getSecurityStaffingState, getSecurityStructureMunicipality, getSegMunicipality, getSegState, getStateCrimeMunicipality, getStateCrimeState, getTrafficMunicipality, getTrafficState, listExplorableIndicators, listSecurityContracts, readIndicatorBounds,
  readIndicatorSeries, readPopulationSeries, type SeriesRead,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { loadMunicipalities, loadMunicipality, loadState, loadStates } from '@/lib/exec-territory';
import { crimeBench, rateBench, type Own } from './bench.ts';
import { buildCrimeChapter, type PopYear, type SegPayload, type StateCrimePayloadLite } from './build-crime.ts';
import { buildFinanceChapter, type FinancePayload } from './build-finance.ts';
import { buildPoliceChapter, type OcNationalLite, type OcPayloadLite } from './build-police.ts';
import { buildPrisonChapter, type PrisonMuniPayload, type PrisonStatePayload } from './build-prison.ts';
import { buildStructureChapter, type StaffMuni, type StaffNational, type StaffState } from './build-structure.ts';
import { buildTrafficChapter, type TrafficPayload } from './build-traffic.ts';
import { VDE_RATE_ID } from './catalog.ts';
import { buildHero } from './hero.ts';
import { crimeNarrative, financeNarrative, policeNarrative, prisonNarrative, structureNarrative, trafficNarrative } from './narrative.ts';
import type { BenchView, ContractPreview, ScopeInfo, SecurityPageData, SourceStamp } from './types.ts';

type Q = Pick<Pool, 'query'>;
export interface Counter { n: number; ms: number; durations?: number[] }
/** Envolve o pool para contar comandos SQL e o tempo acumulado de banco desta montagem de página. */
export function instrument(pool: Pool): { q: Q; stats: Counter } {
  const stats: Counter = { n: 0, ms: 0, durations: [] };
  const q = { query: ((...a: unknown[]) => { stats.n++; const t = performance.now(); return (pool.query as (...x: unknown[]) => Promise<unknown>)(...a)      .finally(() => { const d = performance.now() - t; stats.ms += d; stats.durations?.push(d); }); }) as unknown as Pool['query'] } satisfies Q;
  return { q, stats };
}

/** Leituras que valem para todos os municípios de uma UF (payload estadual): memoizadas por 5 minutos no processo; a competência publicada muda raramente. */
const TTL_MS = 5 * 60_000; const memoMap = new Map<string, { at: number; v: Promise<unknown> }>();
export function memo<T>(key: string, fn: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = memoMap.get(key); const now = Date.now(); if (hit && now - hit.at < ttl) return hit.v as Promise<T>;
  const v = fn(); memoMap.set(key, { at: now, v }); v.catch(() => memoMap.delete(key)); if (memoMap.size > 400) { for (const [k, e] of memoMap) if (now - e.at >= ttl) memoMap.delete(k); } return v;
}
export const clearSecurityCache = () => memoMap.clear();

export async function scopeOf(kind: 'uf' | 'municipio', code: string): Promise<ScopeInfo | null> {
  if (kind === 'uf') { const s = await loadState(code); if (!s || s.ufCode == null) return null; return { kind, entityId: s.entityId, ufCode: s.ufCode, uf: s.uf ?? code.toUpperCase(), name: s.name, stateName: s.name, population: s.population ?? null }; }
  const m = await loadMunicipality(code); if (!m || m.ufCode == null) return null;
  return { kind, entityId: m.entityId, ufCode: m.ufCode, uf: m.uf ?? '', name: m.name, stateName: m.stateName, population: m.population ?? null };
}

/** Resolve o território pelo id de entidade (UF: 2 dígitos; município: IBGE de 7). */
export async function scopeFromEntity(entityId: number): Promise<ScopeInfo | null> {
  if (!Number.isInteger(entityId) || entityId <= 0) return null;
  if (entityId < 100) { const list = await memo('states', () => loadStates()); const s = list.find(x => x.ufCode === entityId); return s ? scopeOf('uf', s.uf) : null; }
  return scopeOf('municipio', String(entityId));
}
const sourceStamp = (label: string, period: string, note?: string): SourceStamp => ({ label, period, ...(note ? { note } : {}) });

export async function loadSecurityPage(scope: ScopeInfo): Promise<SecurityPageData> {
  const t0 = performance.now(); const { q, stats } = instrument(webPostgresPool()); const isUf = scope.kind === 'uf'; const uf = scope.ufCode; const id = scope.entityId;
  const dbStart = performance.now();
  const srcIds = ALL_CRIME_DEFS.filter(d => d.ufCode === uf).map(d => d.id);
  const [seg, segState, tra, efeM, efeS, efeN, priM, priS, finP, sc, oc, ocN, pop, contracts, boundsRows] = await Promise.all([
    isUf ? memo(`seg:uf:${uf}`, () => getSegState(q, uf)) : getSegMunicipality(q, id),
    isUf ? Promise.resolve(null) : memo(`seg:uf:${uf}`, () => getSegState(q, uf)),
    isUf ? memo(`tra:uf:${uf}`, () => getTrafficState(q, uf)) : getTrafficMunicipality(q, id),
    isUf ? Promise.resolve(null) : getSecurityStructureMunicipality(q, scope.entityId),
    memo(`efe:uf:${uf}`, () => getSecurityStaffingState(q, uf)),
    isUf ? memo('efe:nat', () => getSecurityStaffingNational(q)) : Promise.resolve(null),
    isUf ? Promise.resolve(null) : getPrisonMunicipality(q, id),
    memo(`pri:uf:${uf}`, () => getPrisonState(q, uf)),
    isUf ? memo(`fin:uf:${uf}`, () => getSecurityFinanceState(q, uf)) : getSecurityFinanceMunicipality(q, id),
    isUf ? memo(`cr:uf:${uf}`, () => getStateCrimeState(q, uf)) : getStateCrimeMunicipality(q, id),
    isUf ? memo(`oc:uf:${uf}`, () => getOrganizedCrimeState(q, uf)) : getOrganizedCrimeMunicipality(q, id),
    isUf ? memo('oc:nat', () => getOrganizedCrimeNational(q)) : Promise.resolve(null),
    readPopulationSeries(q, id),
    listSecurityContracts(q, { entityId: id, limit: 1 }),
    srcIds.length ? memo(`bounds:${uf}`, () => readIndicatorBounds(q, { entityId: uf, indicatorIds: srcIds })) : Promise.resolve([]),
  ]);
  const bounds = new Map(boundsRows.map(b => [b.indicatorId, { first: b.first, last: b.last }]));
  const popYears: PopYear[] = pop;
  const crime0 = buildCrimeChapter({ scope, seg: seg as unknown as SegPayload | null, segState: segState as unknown as SegPayload | null, sc: sc as unknown as StateCrimePayloadLite | null, pop: popYears, bounds });
  const structure = buildStructureChapter({ scope, muni: efeM as unknown as StaffMuni | null, state: efeS as unknown as StaffState | null, national: efeN as unknown as StaffNational | null });
  const traffic = buildTrafficChapter({ scope, t: tra as unknown as TrafficPayload | null });
  const prison = buildPrisonChapter({ scope, muni: priM as unknown as PrisonMuniPayload | null, state: priS as unknown as PrisonStatePayload | null });
  const police = buildPoliceChapter({ scope, oc: oc as unknown as OcPayloadLite | null, national: ocN as unknown as OcNationalLite | null });
  const contractPreview: ContractPreview | null = contracts.total > 0 ? { total: contracts.total, entityId: id, byYear: contracts.sumCentsByYear.map(y => ({ year: y.year, contracts: y.contracts, valueCents: Number(y.valueCents) })), partialYear: new Date().getUTCFullYear() } : null;
  // finanças: benchmark da despesa paga por habitante (indicador publicado 7032) para o último exercício fechado
  const finPre = buildFinanceChapter({ scope, fin: finP as unknown as FinancePayload | null, contracts: contractPreview, bench: null });
  const lastFy = finPre.years.filter(y => !y.preliminary && y.perCapitaPaid != null).at(-1);
  const finBenchP: Promise<BenchView | null> = lastFy ? rateBench(q, { scope, indicatorId: 7032, label: 'despesa paga em Segurança por habitante', unit: 'por habitante', money: true, digits: 0, own: { t: String(lastFy.exercicio), v: lastFy.perCapitaPaid! }, population: scope.population?.value ?? null, basis: 'Siconfi DCA; população IBGE do mesmo ano' }) : Promise.resolve(null);
  const heroIn = { bounds, financeBench: finBenchP, scope, crime: crime0, traffic, finance: finPre, structure, sc: sc as unknown as StateCrimePayloadLite | null, population: scope.population?.value ?? null };
  const [finBench, { hero, benchByKpi }] = await Promise.all([finBenchP, buildHero(q, heroIn)]);
  const finance = finBench ? buildFinanceChapter({ scope, fin: finP as unknown as FinancePayload | null, contracts: contractPreview, bench: finBench }) : finPre;
  const dbWall = performance.now() - dbStart;
  // narrativas (descrevem o que os dados mostram; sem causa)
  const crime = { ...crime0 }; const cN = crimeNarrative(scope, crime, benchByKpi.letal?.status === 'ok' ? benchByKpi.letal.sentence ?? null : null); crime.narrative = { ...crime.narrative, ...cN };
  structure.narrative = { ...structure.narrative, ...structureNarrative(scope, structure) };
  traffic.narrative = { ...traffic.narrative, ...trafficNarrative(scope, traffic, benchByKpi.transito?.status === 'ok' ? benchByKpi.transito.sentence ?? null : null) };
  prison.narrative = { ...prison.narrative, ...prisonNarrative(scope, prison) };
  finance.narrative = { ...finance.narrative, ...financeNarrative(scope, finance) };
  police.narrative = { ...police.narrative, ...policeNarrative(scope, police) };
  const explorable = await memo(`expl:${id}`, () => listExplorableIndicators(q, id).catch(() => []));
  const sources: SourceStamp[] = [
    sourceStamp('Sinesp VDE (MJSP) e SIM/DATASUS', 'criminalidade nacional'), ...(crime.stateSource ? [sourceStamp(crime.stateSource, 'criminalidade estadual por município')] : []),
    sourceStamp('Senatran, RENAEST, PRF, SIM', 'trânsito'), sourceStamp('FBSP, ESTADIC e MUNIC (IBGE)', 'efetivos e estrutura'), sourceStamp('SISDEPEN/SENAPPEN', 'sistema prisional'), sourceStamp('Siconfi, PNCP e Transferegov', 'finanças'),
  ];
  const buildMs = performance.now() - t0;
  return { scope, hero, crime, structure, traffic, prison, finance, police, sources, explorerCount: explorable.length, meta: { sqlStatements: stats.n, dbMs: Math.round(dbWall), buildMs: Math.round(buildMs), maxStatementMs: Math.round(Math.max(0, ...(stats.durations ?? []))), statementMs: (stats.durations ?? []).map(d => Math.round(d)) } };
}

export function groupOf(id: number): string {
  if (id < 4000) return 'Criminalidade nacional'; if (id < 5000) return 'Trânsito'; if (id < 6000) return 'Efetivos e estrutura'; if (id < 7000) return 'Sistema prisional'; if (id < 8000) return 'Finanças'; return 'Criminalidade estadual';
}
export function sourceOf(id: number, code: string): string { if (id >= 8000) { const d = ALL_CRIME_DEFS.find(x => x.id === id); return d?.source ?? 'Fonte estadual'; } return code.includes('-SIM-') ? 'SIM' : code.includes('-VDE-') ? 'Sinesp VDE' : code.split('-')[1] ?? ''; }

/** Benchmark sob demanda (rota de API): recalcula o mesmo contrato usado no herói para a opção escolhida. */
export async function loadOptionBench(entityId: number, optionId: string): Promise<BenchView | null> {
  const scope = await scopeFromEntity(entityId); if (!scope) return null;
  const { q } = instrument(webPostgresPool());
  const ownOf = async (rateId: number): Promise<Own | null> => { const s = await readIndicatorSeries(q, { entityId, indicatorId: rateId }); const p = s?.points.filter(x => x.value != null && ((x.flags & 8) === 0)).at(-1); return p ? { t: p.period.slice(0, 4), v: p.value! } : null; };
  const pop = scope.population?.value ?? null;
  if (optionId.startsWith('vde:')) { const slug = optionId.slice(4); const rid = VDE_RATE_ID[slug]; if (!rid) return null; return rateBench(q, { scope, indicatorId: rid, label: 'taxa por 100 mil habitantes', unit: 'por 100 mil habitantes', digits: 1, own: await ownOf(rid), population: pop, basis: 'Sinesp VDE; população IBGE do mesmo ano' }); }
  if (optionId === 'sim:agr') return rateBench(q, { scope, indicatorId: 3006, label: 'mortes por agressão (taxa)', unit: 'por 100 mil habitantes', digits: 1, own: await ownOf(3006), population: pop, basis: 'SIM; população IBGE do mesmo ano' });
  if (optionId === 'tra:rate') return rateBench(q, { scope, indicatorId: 4021, label: 'mortes no trânsito (taxa)', unit: 'por 100 mil habitantes', digits: 1, own: await ownOf(4021), population: pop, basis: 'SIM; população IBGE do mesmo ano' });
  if (optionId.startsWith('st:')) {
    const [, src, ...rest] = optionId.split(':'); const codeX = decodeURIComponent(rest.join(':')); const srcKey = decodeURIComponent(src ?? ''); const def = ALL_CRIME_DEFS.find(d => d.source === srcKey && d.code === codeX); if (!def) return null;
    return (await crimeBench(q, { scope, indicatorIds: [def.id], label: def.label.toLowerCase(), source: srcKey })).bench;
  }
  return null;
}

/** Série bruta de um indicador para o modo "Explorar os dados" (valor, numerador, denominador e estado de cada ponto). */
export async function loadExplorerSeries(entityId: number, indicatorId: number): Promise<(SeriesRead & { source: string; group: string }) | null> {
  const { q } = instrument(webPostgresPool()); const s = await readIndicatorSeries(q, { entityId, indicatorId }); if (!s) return null;
  return { ...s, source: sourceOf(indicatorId, s.code), group: groupOf(indicatorId) };
}
export { listSecurityContracts };

/** Índice do modo "Explorar os dados": indicadores com valor para o território (carregado quando a seção é aberta). */
export async function loadExplorerIndex(entityId: number): Promise<Array<{ id: number; label: string; group: string; source: string; unit: string; grain: string; first: string; last: string; points: number }>> {
  const { q } = instrument(webPostgresPool()); const list = await memo(`expl:${entityId}`, () => listExplorableIndicators(q, entityId));
  return list.map(e => ({ id: e.indicatorId, label: e.label, group: groupOf(e.indicatorId), source: sourceOf(e.indicatorId, e.code), unit: e.unit, grain: e.grain, first: e.first, last: e.last, points: e.points }));
}
/** Uma opção do capítulo de criminalidade com todas as séries (quantidade, taxa, mensal), sob demanda. */
export async function loadCrimeOption(scope: ScopeInfo, optionId: string) {
  const { q } = instrument(webPostgresPool()); const isUf = scope.kind === 'uf'; const uf = scope.ufCode; const id = scope.entityId;
  const srcIds = ALL_CRIME_DEFS.filter(d => d.ufCode === uf).map(d => d.id);
  const [seg, segState, sc, pop, boundsRows] = await Promise.all([
    isUf ? memo(`seg:uf:${uf}`, () => getSegState(q, uf)) : getSegMunicipality(q, id), isUf ? Promise.resolve(null) : memo(`seg:uf:${uf}`, () => getSegState(q, uf)),
    isUf ? memo(`cr:uf:${uf}`, () => getStateCrimeState(q, uf)) : getStateCrimeMunicipality(q, id), readPopulationSeries(q, id),
    srcIds.length ? memo(`bounds:${uf}`, () => readIndicatorBounds(q, { entityId: uf, indicatorIds: srcIds })) : Promise.resolve([]),
  ]);
  const bounds = new Map(boundsRows.map(b => [b.indicatorId, { first: b.first, last: b.last }]));
  const ch = buildCrimeChapter({ scope, seg: seg as unknown as SegPayload | null, segState: segState as unknown as SegPayload | null, sc: sc as unknown as StateCrimePayloadLite | null, pop, bounds, full: new Set([optionId]) });
  return ch.options.find(o => o.id === optionId) ?? null;
}

export type CompareResult = { ok: true; name: string; entityId: number; points: Array<{ t: string; v: number | null; state: string }>; note: string } | { ok: false; reason: string };
/** Municípios da mesma UF elegíveis para comparação de taxa (população ≥ 20 mil): lista leve para o seletor. */
export async function compareCandidates(entityId: number): Promise<Array<{ id: number; name: string; population: number }>> {
  const scope = await scopeFromEntity(entityId); if (!scope || scope.kind !== 'municipio') return [];
  return (await loadMunicipalities(scope.ufCode)).filter(m => m.entityId !== entityId && (m.population ?? 0) >= 20000).sort((a, b) => b.population! - a.population!).map(m => ({ id: m.entityId, name: m.name, population: m.population! }));
}
/** Compara a TAXA anual de dois municípios na mesma opção. Exige mesma UF, mesma fonte e indicador, população ≥ 20 mil nos dois e opção com taxa; nunca compara contagens absolutas. */
export async function compareMunicipalities(entityId: number, otherId: number, optionId: string): Promise<CompareResult> {
  const [a, b] = await Promise.all([scopeFromEntity(entityId), scopeFromEntity(otherId)]);
  if (!a || !b || a.kind !== 'municipio' || b.kind !== 'municipio') return { ok: false, reason: 'A comparação é entre dois municípios.' };
  if (a.ufCode !== b.ufCode) return { ok: false, reason: 'Só comparamos municípios do mesmo estado: fontes estaduais têm definições próprias.' };
  if ((a.population?.value ?? 0) < 20000 || (b.population?.value ?? 0) < 20000) return { ok: false, reason: 'Municípios com menos de 20 mil habitantes têm taxas instáveis: a comparação de taxa não é feita.' };
  const opt = await loadCrimeOption(b, optionId); const rate = opt?.measures.find(m => m.key === 'rate');
  if (!opt || opt.scope !== 'municipio' || !rate || !rate.chart.series[0]) return { ok: false, reason: `${b.name} não tem taxa publicada para este indicador (ou o dado só existe para o estado).` };
  return { ok: true, name: b.name, entityId: b.entityId, points: rate.chart.series[0].points, note: `Taxa por 100 mil habitantes calculada com a população do mesmo ano, na mesma fonte (${opt.source}).` };
}

/** Versão com cache curto (60 s) para a vitrine da página inicial do território, que reaproveita a montagem quando o usuário abre a leitura completa logo depois. */
export const loadSecurityPageCached = (scope: ScopeInfo): Promise<SecurityPageData> => memo(`page:${scope.entityId}`, () => loadSecurityPage(scope), 60_000);
