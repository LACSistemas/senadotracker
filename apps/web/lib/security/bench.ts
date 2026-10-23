import { BENCH_RATE_MIN_POPULATION, readCrimeRateBench, readMunicipalRateBench, readUfRateBench, sizeBandOf, type BenchPoint, type CrimeBenchYear, type SizeBand } from '@senadotracker/db';
import { stateDe } from './catalog.ts';
import { fmt } from './format.ts';
import { benchUnavailable, benchView } from './series.ts';
import type { BenchBandPoint, BenchView, Ruler, ScopeInfo } from './types.ts';

type Q = Parameters<typeof readUfRateBench>[0];
/**
 * Contratos de benchmark (P9.8). Regra de ouro: só há comparação quando a MESMA fonte, o MESMO indicador, a MESMA unidade e o MESMO ano formam um grupo com cobertura suficiente.
 * Ordem: (1) o próprio território no tempo [sempre]; (2) município × municípios da mesma UF de porte semelhante; (3) município × municípios da UF com 20 mil hab. ou mais; (4) UF × mediana das UFs.
 * Nunca: ranking, comparação entre fontes estaduais, taxa de ano sem população oficial, contagem absoluta como se fosse risco.
 */
export interface Own { t: string; v: number }
const toBand = (p: BenchPoint): BenchBandPoint => ({ t: p.period.slice(0, 4), p25: p.p25, p50: p.p50, p75: p.p75, n: p.n, universe: p.universe });

export function positionPhrase(own: number, b: { p25: number; p50: number; p75: number }, digits: number): string {
  if (own < b.p25) return `${fmt(own, digits)}, abaixo da faixa central`; if (own > b.p75) return `${fmt(own, digits)}, acima da faixa central`; return `${fmt(own, digits)}, dentro da faixa central`;
}
const FAIXA = 'A faixa central vai do 1º ao 3º quartil (metade dos municípios do grupo).';

function sentenceFor(o: { scope: ScopeInfo; label: string; cohort: string; unit: string; own: Own; point: BenchBandPoint; digits: number; isUf?: boolean; money?: boolean }): string {
  const pre = o.money ? 'R$ ' : '';
  const who = o.isUf ? 'Entre as UFs' : `Entre ${fmt(o.point.n)} ${o.cohort}`;
  return `${who}, a mediana de ${o.label} em ${o.point.t} foi ${pre}${fmt(o.point.p50, o.digits)} ${o.unit}; ${o.scope.name} registrou ${o.money ? 'R$ ' : ''}${positionPhrase(o.own.v, o.point, o.digits)}. ${o.isUf ? '' : FAIXA}`.replace(/\s+$/, '');
}

/** Benchmark de um indicador já publicado como taxa (SIM, VDE, finanças). `own` = a taxa do território no ano mais recente com taxa válida. */
export async function rateBench(q: Q, o: { scope: ScopeInfo; indicatorId: number; label: string; unit: string; digits: number; own: Own | null; population: number | null; basis: string; money?: boolean }): Promise<BenchView> {
  const { scope } = o;
  if (!o.own) return benchUnavailable(o.label, 'O território não tem taxa válida neste indicador; mostramos só a evolução dele.');
  if (scope.kind === 'uf') {
    const pts = await readUfRateBench(q, { indicatorId: o.indicatorId }); const at = pts.find(p => p.period.slice(0, 4) === o.own!.t);
    if (!at) return benchUnavailable(o.label, 'Sem mediana das UFs para o mesmo ano.');
    const band = pts.map(toBand); return benchView({ label: `Mediana das 27 UFs: ${o.label}`, cohort: 'unidades da federação', basis: o.basis, points: band, sentence: sentenceFor({ ...o, point: toBand(at), cohort: '', isUf: true, own: o.own }) });
  }
  const pop = o.population; const band = sizeBandOf(pop);
  if (pop == null || pop < BENCH_RATE_MIN_POPULATION) return benchUnavailable(o.label, `Municípios com menos de ${fmt(BENCH_RATE_MIN_POPULATION)} habitantes têm taxas muito instáveis (poucos casos mudam tudo); por isso não há comparação de taxa. Veja a evolução e as quantidades.`);
  const attempts: Array<{ cohort: string; band?: SizeBand }> = [...(band ? [{ cohort: `municípios ${stateDe(scope.uf, scope.stateName)} ${band.label}`, band }] : []), { cohort: `municípios ${stateDe(scope.uf, scope.stateName)} com ${fmt(BENCH_RATE_MIN_POPULATION)} habitantes ou mais` }];
  for (const a of attempts) {
    const pts = await readMunicipalRateBench(q, { ufCode: scope.ufCode, indicatorId: o.indicatorId, ...(a.band ? { band: { min: a.band.min, max: a.band.max } } : {}) });
    const at = pts.find(p => p.period.slice(0, 4) === o.own!.t); if (!at) continue;
    return benchView({ label: `Mediana dos ${a.cohort}`, cohort: a.cohort, basis: o.basis, points: pts.map(toBand), sentence: sentenceFor({ ...o, cohort: a.cohort, point: toBand(at), own: o.own }) });
  }
  return benchUnavailable(o.label, `Não há municípios suficientes ${stateDe(scope.uf, scope.stateName)} com taxa válida neste indicador e ano para formar um grupo comparável.`);
}

const REASON: Record<string, string> = {
  sem_populacao_do_ano: 'Sem estimativa oficial de população no ano (2022 e 2023 não têm): a taxa não é calculada nem interpolada.', ano_incompleto: 'Ano ainda incompleto na fonte: só anos completos entram na comparação.',
  cobertura_insuficiente: 'Menos de 80% dos municípios do grupo têm registro no ano; a mediana seria enviesada.', celulas_suprimidas: 'Há células suprimidas por privacidade neste indicador: o grupo ficaria distorcido.', grupo_pequeno: 'Poucos municípios no grupo para uma mediana confiável.', sem_dados: 'Sem dados.',
};
/** Benchmark de fonte estadual municipalizada (P9.6): taxa anual calculada = total do ano ÷ população do MESMO ano, entre municípios da mesma UF/fonte/definição. */
export async function crimeBench(q: Q, o: { scope: ScopeInfo; indicatorIds: number[]; label: string; source: string; digits?: number }): Promise<{ bench: BenchView; years: CrimeBenchYear[]; own: Own | null }> {
  const { scope } = o; const digits = o.digits ?? 1; const basisBase = `${o.source}; população IBGE do mesmo ano`;
  const pop = scope.population?.value ?? null; const band = sizeBandOf(pop);
  if (scope.kind === 'uf') return { bench: benchUnavailable(o.label, 'Entre estados, as fontes de criminalidade não têm equivalência oficial comprovada: não há mediana de UFs para este indicador.'), years: [], own: null };
  if (pop == null || pop < BENCH_RATE_MIN_POPULATION) return { bench: benchUnavailable(o.label, `Municípios com menos de ${fmt(BENCH_RATE_MIN_POPULATION)} habitantes têm taxas muito instáveis; por isso não há comparação de taxa. Veja a evolução e as quantidades.`), years: [], own: null };
  const attempts: Array<{ cohort: string; band?: SizeBand }> = [...(band ? [{ cohort: `municípios ${stateDe(scope.uf, scope.stateName)} ${band.label}`, band }] : []), { cohort: `municípios ${stateDe(scope.uf, scope.stateName)} com ${fmt(BENCH_RATE_MIN_POPULATION)} habitantes ou mais` }];
  let lastReason = REASON.sem_dados!; let own: Own | null = null; let lastYears: CrimeBenchYear[] = [];
  for (const a of attempts) {
    const years = await readCrimeRateBench(q, { ufCode: scope.ufCode, indicatorIds: o.indicatorIds, entityId: scope.entityId, fromYear: 2013, ...(a.band ? { band: { min: a.band.min, max: a.band.max } } : {}) }); lastYears = years;
    const ok = years.filter(y => y.status === 'ok' && y.own); const latest = ok.at(-1);
    if (!latest || !latest.own) { const blockers = years.filter(y => y.status !== 'ok' && y.status !== 'sem_populacao_do_ano' && y.status !== 'ano_incompleto').at(-1); lastReason = REASON[(blockers ?? years.at(-1))?.status ?? 'sem_dados'] ?? lastReason; continue; }
    own = { t: String(latest.year), v: latest.own.rate };
    const pts: BenchBandPoint[] = ok.map(y => ({ t: String(y.year), p25: y.p25!, p50: y.p50!, p75: y.p75!, n: y.n, universe: y.universe }));
    const at = pts.find(p => p.t === own!.t)!;
    const sentence = `Entre ${fmt(at.n)} ${a.cohort} com registro em ${at.t}, a mediana de ${o.label} foi ${fmt(at.p50, digits)} por 100 mil habitantes; ${scope.name} registrou ${positionPhrase(own.v, at, digits)}. ${FAIXA}`;
    return { bench: benchView({ label: `Mediana dos ${a.cohort}`, cohort: a.cohort, basis: basisBase, points: pts, sentence }), years, own };
  }
  return { bench: benchUnavailable(o.label, lastReason), years: lastYears, own };
}

/** Régua de comparação (própria × mediana e faixa central do grupo) a partir de um benchmark válido; null quando não há comparação. */
export function rulerOf(bench: BenchView | null | undefined, own: Own | null, o: { digits: number; unit: string; prefix?: string }): Ruler | null {
  if (!bench || bench.status !== 'ok' || !own) return null; const p = bench.points.find(x => x.t === own.t); if (!p) return null;
  return { own: own.v, p25: p.p25, p50: p.p50, p75: p.p75, digits: o.digits, unit: o.unit, year: own.t, cohort: bench.cohort, n: p.n, ...(o.prefix ? { prefix: o.prefix } : {}) };
}
