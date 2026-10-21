import type { BenchSeriesStory, EvolutionPoint, HospitalShare, ResidentMonth, ResidentSummary, SeriesBench, YearStat } from '@senadotracker/db';

/** Funções puras do storytelling de Saúde (evolução, hospitais, residentes). Sem I/O: entradas prontas, saídas serializáveis para componentes cliente. */
const FLAG = { smallN: 1, preliminary: 2, noDenominator: 64 } as const;
const pt = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export interface TabSpec { code: string; title: string; unit: string; digits: number; scale: number; smooth: boolean; minDenominator: number; extraCode?: string; extraTitle?: string; note: string }
export const EVOLUTION_TABS: ReadonlyArray<TabSpec> = [
  { code: 'IND-SAU-05', title: 'Leitos por 1.000 hab.', unit: 'leitos/1.000 hab.', digits: 2, scale: 1, smooth: false, minDenominator: 0, extraCode: 'IND-SAU-05S', extraTitle: 'Leitos SUS', note: 'Dezembro de cada ano (e o último mês publicado). Leitos por residente ignoram o fluxo regional. Sem estimativa populacional oficial em 2022 e 2023.' },
  { code: 'IND-SAU-08', title: 'Mortalidade infantil', unit: 'por mil nascidos', digits: 1, scale: 1000, smooth: true, minDenominator: 100, note: 'Óbitos de menores de 1 ano por mil nascidos vivos, por residência. Em município a linha é a média móvel de 3 anos (pontos finos: valor do ano); 2025 é preliminar.' },
  { code: 'IND-SAU-10', title: 'ICSAP', unit: '% das internações', digits: 1, scale: 100, smooth: false, minDenominator: 100, note: 'Internações SUS por condições sensíveis à atenção primária, em % das internações de residentes. Proporção anual (último ano parcial); não é taxa padronizada.' },
  { code: 'IND-SAU-12', title: 'Partos cesáreos', unit: '% dos partos', digits: 1, scale: 100, smooth: true, minDenominator: 100, note: 'Taxa bruta, sem ajuste pelo perfil das gestantes e sem faixa de referência. Em município a linha é a média móvel de 3 anos.' },
];

export interface EvoPoint { year: number; v: number | null; raw: number | null; partial: boolean; prelim: boolean; small: boolean }
export interface EvoBandPoint { year: number; n: number; p25: number; p50: number; p75: number }
export interface EvoTab {
  code: string; title: string; unit: string; digits: number; note: string; smoothed: boolean;
  points: EvoPoint[]; extra: { title: string; points: EvoPoint[] } | null;
  group: EvoBandPoint[]; groupLabel: string; ref: EvoBandPoint[]; refLabel: string; gapYears: number[];
  story: string; chips: Array<{ label: string; value: string; tone?: 'good' | 'alert' | 'neutral' }>;
}

/** Média móvel centrada de 3 anos por soma de numerador e denominador (estável para município pequeno). Ano sem numerador/denominador ou com pouco denominador fica nulo. */
export function smooth3(points: EvolutionPoint[], scale: number, minDen: number): EvoPoint[] {
  const by = new Map(points.map(p => [p.year, p]));
  return points.map(p => {
    let n = 0, d = 0; let used = 0;
    for (const y of [p.year - 1, p.year, p.year + 1]) { const q = by.get(y); if (q && q.numerator !== null && q.denominator !== null && !(q.flags & FLAG.noDenominator)) { n += q.numerator; d += q.denominator; used++; } }
    const raw = p.value;
    return { year: p.year, v: used >= 2 && d >= minDen ? n / d * scale : null, raw, partial: p.partial, prelim: !!(p.flags & FLAG.preliminary), small: !!(p.flags & FLAG.smallN) };
  });
}
export const plain = (points: EvolutionPoint[]): EvoPoint[] => points.map(p => ({ year: p.year, v: p.value, raw: p.value, partial: p.partial, prelim: !!(p.flags & FLAG.preliminary), small: !!(p.flags & FLAG.smallN) }));

const toBand = (m: Record<string, YearStat> | undefined): EvoBandPoint[] => Object.entries(m ?? {}).map(([y, s]) => ({ year: Number(y), n: s[0], p25: s[1], p50: s[2], p75: s[3] })).sort((a, b) => a.year - b.year);
const at = <T extends { year: number }>(xs: T[], y: number) => xs.find(x => x.year === y);
/** Variação relativa entre o último ponto e o de `back` anos antes (ou o mais antigo disponível no intervalo); null sem base. */
export function relChange(vals: Array<{ year: number; v: number | null }>, back = 5): { from: number; to: number; pct: number } | null {
  const ok = vals.filter(x => x.v !== null) as Array<{ year: number; v: number }>;
  const last = ok.at(-1); if (!last) return null;
  const base = ok.filter(x => x.year <= last.year - back).at(-1) ?? ok.find(x => x.year < last.year && x.year >= last.year - back);
  if (!base || base.v === 0) return null;
  return { from: base.year, to: last.year, pct: (last.v - base.v) / Math.abs(base.v) * 100 };
}
const verb = (pct: number) => Math.abs(pct) < 1 ? 'ficou estável' : pct > 0 ? `subiu ${pt(0).format(Math.abs(pct))}%` : `caiu ${pt(0).format(Math.abs(pct))}%`;
const quartileWord = (v: number, b: EvoBandPoint) => v < b.p25 ? 'faixa mais baixa' : v < b.p50 ? 'abaixo da mediana' : v <= b.p75 ? 'acima da mediana' : 'faixa mais alta';

/** Monta uma aba de evolução com comparativos, lacunas e a frase de leitura (fatos comparativos, sem juízo clínico). */
export function buildEvolutionTab(o: { spec: TabSpec; series: Record<string, EvolutionPoint[]>; scope: string; kind: 'uf' | 'municipio'; ufName: string; ufCode: number; bench: BenchSeriesStory }): EvoTab {
  const { spec } = o; const base = o.series[spec.code] ?? [];
  const isMuni = o.kind === 'municipio'; const smoothed = spec.smooth && isMuni;
  const points = smoothed ? smooth3(base, spec.scale, spec.minDenominator) : plain(base);
  const extraBase = spec.extraCode ? o.series[spec.extraCode] : undefined;
  const groupBag: SeriesBench | undefined = isMuni ? o.bench.municipalitiesByUf[String(o.ufCode)] : o.bench.ufs;
  const refBag: SeriesBench = isMuni ? o.bench.brazilMunicipalities : o.bench.brazilMunicipalities;
  const group = toBand(groupBag?.[spec.code]); const ref = toBand(refBag[spec.code]);
  const groupLabel = isMuni ? `municípios de ${o.ufName}` : 'as 27 UFs'; const refLabel = isMuni ? 'municípios do Brasil' : 'municípios do Brasil';
  const gapYears = base.filter(p => p.value === null && (p.flags & FLAG.noDenominator)).map(p => p.year);
  const cur = [...points].reverse().find(p => p.v !== null);
  const ch = relChange(points, 5); const gch = relChange(group.map(b => ({ year: b.year, v: b.p50 })), 5); const rch = relChange(ref.map(b => ({ year: b.year, v: b.p50 })), 5);
  let story = '';
  if (cur && ch) {
    story = `${spec.title} em ${o.scope} ${verb(ch.pct)} entre ${ch.from} e ${ch.to}`;
    const cmp: string[] = [];
    if (gch && gch.from === ch.from) cmp.push(`a mediana ${isMuni ? 'dos municípios de ' + o.ufName : 'das UFs'} ${verb(gch.pct)}`);
    if (rch && rch.from === ch.from) cmp.push(`a do Brasil ${verb(rch.pct)}`);
    story += cmp.length ? `, enquanto ${cmp.join(' e ')}.` : '.';
  } else if (cur) story = `${spec.title} em ${o.scope}: ${pt(spec.digits).format(cur.v!)} em ${cur.year}; série curta para comparar com anos anteriores.`;
  else story = `Sem série publicada de ${spec.title.toLowerCase()} para ${o.scope}.`;
  const gNow = cur ? at(group, cur.year) : undefined;
  const chips: EvoTab['chips'] = [];
  if (cur) chips.push({ label: `Em ${cur.year}${cur.partial ? (spec.code === 'IND-SAU-05' ? ' (último mês publicado)' : ' (até o último mês)') : ''}`, value: `${pt(spec.digits).format(cur.v!)}${spec.unit.startsWith('%') ? '%' : ''}` });
  if (ch) chips.push({ label: `Em 5 anos (${ch.from}→${ch.to})`, value: `${ch.pct > 0 ? '+' : '−'}${pt(0).format(Math.abs(ch.pct))}%` });
  if (cur && gNow && !(cur.small && !smoothed)) chips.push({ label: `Entre ${groupLabel}`, value: quartileWord(cur.v!, gNow) });
  else chips.push({ label: 'Comparação', value: 'indisponível no período' });
  return { code: spec.code, title: spec.title, unit: spec.unit, digits: spec.digits, note: spec.note, smoothed, points, extra: extraBase && spec.extraTitle ? { title: spec.extraTitle, points: plain(extraBase) } : null, group, groupLabel, ref, refLabel, gapYears, story, chips };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Hospitais

export interface HospitalRow { cnes: number; name: string; typeLabel: string; sus: boolean; aih: number; share: number; stay: number | null; lethality: number | null; bedsExisting: number; bedsSus: number }
export interface HospitalStory { rows: HospitalRow[]; others: { n: number; aih: number; share: number }; total: number; top1Share: number; top3Share: number; ratio: number | null; poloWord: 'polo' | 'equilibrado' | 'parte-fora' | null; story: string }
export function buildHospitalStory(o: { hs: { hospitals: HospitalShare[]; hospitalsTotalAih: number; residentsAih: number }; scope: string; kind: 'uf' | 'municipio'; limit?: number }): HospitalStory | null {
  const { hs } = o; const total = hs.hospitalsTotalAih; if (!total || hs.hospitals.length === 0) return null;
  const limit = o.limit ?? 8;
  const rows: HospitalRow[] = hs.hospitals.slice(0, limit).map(h => ({ cnes: h.cnes, name: h.name ?? `Estabelecimento CNES ${h.cnes}`, typeLabel: h.typeLabel, sus: h.sus, aih: h.aih, share: h.aih / total, stay: h.aih > 0 ? h.days / h.aih : null, lethality: h.aih >= 100 ? h.deaths / h.aih * 100 : null, bedsExisting: h.bedsExisting, bedsSus: h.bedsSus }));
  const shown = rows.reduce((n, r) => n + r.aih, 0); const restN = Math.max(0, hs.hospitals.length - rows.length);
  const top1 = rows[0]!.share; const top3 = rows.slice(0, 3).reduce((n, r) => n + r.share, 0);
  const ratio = o.kind === 'municipio' && hs.residentsAih > 0 ? total / hs.residentsAih : null;
  const poloWord = ratio === null ? null : ratio > 1.2 ? 'polo' : ratio < 0.8 ? 'parte-fora' : 'equilibrado';
  const lead = rows[0]!;
  let story = `${rows.length >= 3 ? `3 estabelecimentos concentram ${pt(0).format(top3 * 100)}% das internações atendidas em ${o.scope}` : `${lead.name} concentra ${pt(0).format(top1 * 100)}% das internações atendidas em ${o.scope}`}; o maior é ${lead.name}.`;
  if (ratio !== null) story += poloWord === 'polo' ? ` O município atendeu ${pt(1).format(ratio)} internação para cada internação de morador: é referência para outros municípios.` : poloWord === 'parte-fora' ? ` Atendeu ${pt(1).format(ratio)} internação por internação de morador: parte dos moradores se trata fora.` : ` Atendeu em torno de uma internação por internação de morador.`;
  return { rows, others: { n: restN, aih: total - shown, share: (total - shown) / total }, total, top1Share: top1, top3Share: top3, ratio, poloWord, story };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Residentes

export interface ResidentYear { year: number; aih: number; outside: number; icsap: number; rate: number | null; inMun: number | null; partial: boolean }
export interface HeatCell { year: number; month: number; aih: number | null; index: number | null }
export interface ResidentStory {
  lastCompetence: number; window: { aih: number; rate: number | null; inMun: number | null; stay: number | null; lethality: number | null; avgValue: number | null; icsapPct: number | null };
  years: ResidentYear[]; heat: HeatCell[][]; heatOk: boolean; baselineMonthly: number | null; peakMonth: number | null; covidDip: number | null; story: string;
  group: EvoBandPoint[]; ref: EvoBandPoint[]; groupInMun: EvoBandPoint[]; refInMun: EvoBandPoint[]; groupLabel: string;
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthName = (m: number) => MONTHS[m - 1]!;
const FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : null; };

export function buildResidentStory(o: { summary: ResidentSummary; scope: string; kind: 'uf' | 'municipio'; ufName: string; ufCode: number; bench: BenchSeriesStory }): ResidentStory | null {
  const months = o.summary.months; if (months.length === 0) return null;
  const last = months.at(-1)!; const by = new Map(months.map(m => [m.competence, m]));
  const pop = (y: number) => o.summary.population[String(y)] ?? null;
  // últimos 12 meses publicados
  const win: ResidentMonth[] = []; let c = last.competence;
  for (let i = 0; i < 12; i++) { const m = by.get(c); if (m) win.push(m); c = c % 100 === 1 ? c - 89 : c - 1; }
  const sum = (k: keyof ResidentMonth) => win.reduce((n, m) => n + Number(m[k]), 0);
  const aih = sum('aih'); const lastYear = Math.floor(last.competence / 100); const p = pop(lastYear) ?? pop(lastYear - 1);
  const window = { aih, rate: p && win.length === 12 ? aih / p * 1000 : null, inMun: aih > 0 ? (1 - sum('outside') / aih) * 100 : null, stay: aih > 0 ? sum('days') / aih : null, lethality: aih >= 100 ? sum('deaths') / aih * 100 : null, avgValue: aih > 0 ? sum('valueCents') / 100 / aih : null, icsapPct: aih >= 100 ? sum('icsap') / aih * 100 : null };
  // anos
  const ys = new Map<number, { aih: number; outside: number; icsap: number; n: number }>();
  for (const m of months) { const y = Math.floor(m.competence / 100); const a = ys.get(y) ?? { aih: 0, outside: 0, icsap: 0, n: 0 }; a.aih += m.aih; a.outside += m.outside; a.icsap += m.icsap; a.n++; ys.set(y, a); }
  const years: ResidentYear[] = [...ys].map(([year, a]) => { const pp = pop(year); const full = a.n === 12; return { year, aih: a.aih, outside: a.outside, icsap: a.icsap, rate: pp && full ? a.aih / pp * 1000 : null, inMun: a.aih >= 100 ? (1 - a.outside / a.aih) * 100 : null, partial: !full }; }).sort((x, y) => x.year - y.year);
  // calendário: índice sobre o mês típico de 2013–2019 (mediana mensal), sem depender de população
  const base = months.filter(m => m.competence < 202000).map(m => m.aih); const baseline = median(base) ?? median(months.map(m => m.aih));
  const heatOk = !!baseline && baseline >= 20;
  const heat: HeatCell[][] = years.map(y => Array.from({ length: 12 }, (_, i) => { const m = by.get(y.year * 100 + i + 1); return { year: y.year, month: i + 1, aih: m ? m.aih : null, index: m && baseline ? m.aih / baseline * 100 : null }; }));
  const seasonal = Array.from({ length: 12 }, (_, i) => { const v = months.filter(m => m.competence % 100 === i + 1 && m.competence < 202000).map(m => m.aih); return { m: i + 1, v: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }; });
  const peak = heatOk ? seasonal.reduce((a, b) => b.v > a.v ? b : a).m : null;
  const y2019 = years.find(y => y.year === 2019); const y2020 = years.find(y => y.year === 2020);
  const covidDip = y2019 && y2020 && !y2020.partial && y2019.aih > 0 ? (y2020.aih - y2019.aih) / y2019.aih * 100 : null;
  const isMuni = o.kind === 'municipio'; const bag = isMuni ? o.bench.municipalitiesByUf[String(o.ufCode)] : o.bench.ufs;
  const groupLabel = isMuni ? `municípios de ${o.ufName}` : 'as 27 UFs';
  const lastFull = [...years].reverse().find(y => !y.partial && y.inMun !== null);
  const g = lastFull ? (bag?.['SIH-NO-MUN']?.[String(lastFull.year)]) : undefined;
  let story = '';
  if (lastFull && lastFull.inMun !== null) {
    story = `Em ${lastFull.year}, ${pt(0).format(lastFull.inMun)}% dos moradores de ${o.scope} internados foram atendidos ${isMuni ? 'no próprio município' : 'no município onde moram'}`;
    if (g) story += `; a mediana ${isMuni ? 'dos municípios de ' + o.ufName : 'das UFs'} é ${pt(0).format(g[2])}%`;
    story += '.';
  }
  if (peak && heatOk) story += ` O mês de maior movimento, em média, é ${FULL[peak - 1]}.`;
  if (covidDip !== null) story += ` Em 2020 as internações ${covidDip < 0 ? 'caíram' : 'subiram'} ${pt(0).format(Math.abs(covidDip))}% em relação a 2019.`;
  const band = (code: string) => (bag?.[code] ? Object.entries(bag[code]!).map(([y, s]) => ({ year: Number(y), n: s[0], p25: s[1], p50: s[2], p75: s[3] })).sort((a, b) => a.year - b.year) : []);
  const bandRef = (code: string) => Object.entries(o.bench.brazilMunicipalities[code] ?? {}).map(([y, s]) => ({ year: Number(y), n: s[0], p25: s[1], p50: s[2], p75: s[3] })).sort((a, b) => a.year - b.year);
  return { lastCompetence: last.competence, window, years, heat, heatOk, baselineMonthly: baseline, peakMonth: peak, covidDip, story: story.trim(), group: band('SIH-TAXA'), ref: bandRef('SIH-TAXA'), groupInMun: band('SIH-NO-MUN'), refInMun: bandRef('SIH-NO-MUN'), groupLabel };
}

/** Cor do calendário: índice 100 = mês típico pré-pandemia. Faixas fixas (rampa sequencial única do produto). */
export const heatBand = (index: number | null): number => index === null ? -1 : index < 60 ? 0 : index < 85 ? 1 : index < 110 ? 2 : index < 135 ? 3 : 4;
