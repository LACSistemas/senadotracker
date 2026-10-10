import type { ParliamentarianPixSummary } from '../../../packages/db/src/postgres-budget-read.ts';

/**
 * Modelo de apresentação das Emendas Pix no perfil do parlamentar. Puro: recebe o resumo do read model
 * (`parliamentarianPixSummary`, que já contém SOMENTE autoria revisada) e devolve textos, proporções e séries.
 * Nenhuma regra de identidade vive aqui.
 */
export type PixProfileData =
  | { status: 'available'; summary: ParliamentarianPixSummary }
  | { status: 'empty'; reason: PixEmptyReason }
  | { status: 'unavailable' };
export type PixEmptyReason = 'none' | 'pending_authorship' | 'no_mandate_in_period';

export const PIX_PERIOD = { from: 2020, to: 2026 } as const;
export const PIX_PAGE_SIZE = 10;

const decimal = (value: number, digits: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** "R$ 36,4 bi", "R$ 3,2 mi", "R$ 950 mil", "R$ 120". Valor ausente → "—". */
export function brlCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `R$ ${decimal(value / 1e9, 2)} bi`;
  if (abs >= 1e6) return `R$ ${decimal(value / 1e6, abs >= 1e8 ? 1 : 2)} mi`;
  if (abs >= 1e4) return `R$ ${decimal(value / 1e3, 0)} mil`;
  return `R$ ${decimal(value, 0)}`;
}
/** Valor por extenso, sem centavos ("R$ 1.234.567"). */
export const brlFull = (value: number | null | undefined): string => value === null || value === undefined || !Number.isFinite(value) ? '—' : `R$ ${decimal(value, 0)}`;
export const percent = (part: number, whole: number): string | null => whole > 0 ? `${decimal(100 * part / whole, 1)}%` : null;
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em']);
const titleCase = (value: string) => value.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean).map((w, i) => i > 0 && SMALL.has(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)).join(' ');
export interface BeneficiaryLabel { title: string; kind: 'Município' | 'Estado' | 'Distrito Federal' | 'Outro ente'; original: string }
/** "MUNICIPIO DE VITORIA" → { title: "Vitoria", kind: "Município" }. A fonte não traz acentos nem código IBGE; nada é corrigido por adivinhação. */
export function beneficiaryLabel(name: string | null, enteType: string | null, municipalityName: string | null = null): BeneficiaryLabel {
  const original = (name ?? '').trim();
  if (!original) return { title: 'Beneficiário não informado', kind: 'Outro ente', original };
  if (enteType === 'municipio' && municipalityName) return { title: titleCase(municipalityName), kind: 'Município', original };
  if (enteType === 'municipio') return { title: titleCase(original.replace(/^(munic[ií]pio|prefeitura municipal)\s+d[eao]s?\s+/i, '')), kind: 'Município', original };
  if (enteType === 'estado') return { title: titleCase(original.replace(/^(estado|governo do estado)\s+d[eao]s?\s+/i, '')), kind: 'Estado', original };
  if (enteType === 'distrito_federal') return { title: 'Distrito Federal', kind: 'Distrito Federal', original };
  return { title: titleCase(original), kind: 'Outro ente', original };
}

export interface PixYearPoint { year: number; destined: number; paid: number | null; ongoing: boolean }
export interface PixStory {
  headline: string;
  paidShare: string | null;
  ladder: Array<{ label: string; amount: number | null; primary?: boolean }>;
  concentration: { top: number; share: string | null; sentence: string };
  reach: string;
  functions: { items: Array<{ code: number; name: string; amount: number; plans: number; exclusivePlans: number }>; sentence: string; multiFunctionNote: string | null; share: (amount: number) => string | null };
  expense: { investimento: number; custeio: number; investimentoShare: string | null; custeioShare: string | null; sentence: string };
  years: { points: PixYearPoint[]; sentence: string; hasOngoing: boolean };
  split: string | null;
  amendments: { rows: ParliamentarianPixSummary['amendments']; page: number; pageCount: number; total: number };
  authorship: string;
}

const houseLabel = (house: string | null) => house === 'senado' ? 'Senado' : house === 'camara' ? 'Câmara' : 'Casa não informada';

export function buildPixStory(summary: ParliamentarianPixSummary, options: { page?: number; pageSize?: number; currentYear?: number } = {}): PixStory {
  const f = summary.financials, destined = f.destinedAmount;
  const currentYear = options.currentYear ?? new Date().getFullYear(), pageSize = options.pageSize ?? PIX_PAGE_SIZE;
  const paidShare = f.paidAmount !== null ? percent(f.paidAmount, destined) : null;

  const top5 = summary.topBeneficiaries.slice(0, 5).reduce((s, b) => s + b.destinedAmount, 0);
  const top5Share = percent(top5, destined);
  const concentration = { top: Math.min(5, summary.topBeneficiaries.length), share: top5Share,
    sentence: summary.counts.beneficiaries <= 5 ? `Todos os ${plural(summary.counts.beneficiaries, 'beneficiário', 'beneficiários')} aparecem abaixo.` : top5Share ? `Os 5 maiores destinos concentram ${top5Share} do valor destinado.` : '' };
  const reach = `Os planos alcançaram ${plural(summary.counts.beneficiaries, 'beneficiário', 'beneficiários')} em ${summary.counts.ufs === 1 ? '1 estado' : `${summary.counts.ufs} estados`}.`;

  const fnItems = summary.byFunction.filter(x => x.exclusiveDestinedAmount > 0).map(x => ({ code: x.functionCode, name: x.functionName, amount: x.exclusiveDestinedAmount, plans: x.plans, exclusivePlans: x.exclusivePlans }));
  const fc = summary.functionCoverage;
  const topFn = fnItems[0];
  const fnSentence = topFn ? `A área com mais recursos em planos de uma só área é ${topFn.name} (${brlCompact(topFn.amount)}${percent(topFn.amount, fc.singleFunctionAmount) ? `, ${percent(topFn.amount, fc.singleFunctionAmount)} desse grupo` : ''}).` : 'Nenhum plano com uma única área de política pública foi publicado.';
  const multi = fc.multiFunctionPlans > 0 ? `${plural(fc.multiFunctionPlans, 'plano abrange', 'planos abrangem')} mais de uma área (${brlCompact(fc.multiFunctionAmount)}) e não ${fc.multiFunctionPlans === 1 ? 'é repartido' : 'são repartidos'} entre elas.` : null;
  const noFn = fc.plansWithoutFunction > 0 ? `${plural(fc.plansWithoutFunction, 'plano sem área informada', 'planos sem área informada')} (${brlCompact(fc.plansWithoutFunctionAmount)}).` : null;

  const inv = summary.byExpenseKind.investimento, cus = summary.byExpenseKind.custeio, kinds = inv + cus;
  const expenseSentence = kinds <= 0 ? 'Sem classificação de despesa publicada.' : inv >= cus ? `A maior parte foi para investimento (${percent(inv, kinds)}); custeio ficou com ${percent(cus, kinds)}.` : `A maior parte foi para custeio (${percent(cus, kinds)}); investimento ficou com ${percent(inv, kinds)}.`;

  const points: PixYearPoint[] = summary.byYear.map(y => ({ year: y.year, destined: y.destinedAmount, paid: y.paidAmount, ongoing: y.year >= currentYear }));
  const peak = points.length ? points.reduce((a, b) => b.destined > a.destined ? b : a) : null;
  const firstYear = points[0]?.year;
  const yearsSentence = !points.length ? '' : points.length === 1 ? `As Emendas Pix aparecem em ${firstYear}.` : `Começou em ${firstYear}; o maior valor destinado foi em ${peak!.year} (${brlCompact(peak!.destined)}).`;

  const total = summary.amendments.length, pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(options.page ?? 1) || 1), pageCount);
  const biggest = summary.amendments.reduce<ParliamentarianPixSummary['amendments'][number] | null>((a, b) => !a || b.plans > a.plans ? b : a, null);
  const split = biggest && biggest.plans > 1 ? `A emenda ${biggest.amendmentCode} (${biggest.year}) foi dividida em ${plural(biggest.plans, 'plano', 'planos')} para ${plural(biggest.beneficiaries, 'beneficiário', 'beneficiários')}. Cada plano de ação tem um destino; a emenda é só o agrupador.` : null;

  const codes = summary.authorCodes.map(c => `${c.authorCode} (${houseLabel(c.house)}, ${c.years[0] === c.years.at(-1) ? c.years[0] : `${c.years[0]}–${c.years.at(-1)}`})`).join('; ');
  return {
    headline: `${plural(summary.counts.plans, 'plano de ação', 'planos de ação')} em ${plural(summary.counts.amendments, 'emenda', 'emendas')}, para ${plural(summary.counts.beneficiaries, 'beneficiário', 'beneficiários')} em ${summary.counts.ufs === 1 ? '1 estado' : `${summary.counts.ufs} estados`}.`,
    paidShare,
    ladder: [{ label: 'Destinado nos planos de ação', amount: destined, primary: true }, { label: 'Empenhado', amount: f.committedAmount }, { label: 'Liquidado', amount: f.liquidatedAmount }, { label: 'Pago/transferido', amount: f.paidAmount }],
    concentration, reach,
    functions: { items: fnItems, sentence: [fnSentence, multi, noFn].filter(Boolean).join(' '), multiFunctionNote: multi, share: (amount: number) => percent(amount, fc.singleFunctionAmount) },
    expense: { investimento: inv, custeio: cus, investimentoShare: percent(inv, kinds), custeioShare: percent(cus, kinds), sentence: expenseSentence },
    years: { points, sentence: yearsSentence, hasOngoing: points.some(p => p.ongoing) },
    split,
    amendments: { rows: summary.amendments.slice((page - 1) * pageSize, page * pageSize), page, pageCount, total },
    authorship: `Autoria vinculada pelo cadastro oficial de autores de emendas: ${codes}.`,
  };
}

export const PIX_EMPTY_COPY: Record<PixEmptyReason, { title: string; description: string }> = {
  none: { title: 'Sem Emendas Pix atribuídas', description: 'Não encontramos Emendas Pix com autoria vinculada a este parlamentar nas fontes oficiais de 2020 a 2026. Isso não afirma que ele não tenha indicado recursos: só que não há autoria revisada neste cadastro.' },
  pending_authorship: { title: 'Autoria ainda em revisão', description: 'Há emendas Pix cuja autoria ainda não foi vinculada ao cadastro do Cívica. Elas não são contabilizadas aqui até a revisão.' },
  no_mandate_in_period: { title: 'Mandato fora do período das Emendas Pix', description: 'As Emendas Pix cobrem 2020 a 2026 e este mandato não se sobrepõe a esse período nos dados publicados.' },
};
