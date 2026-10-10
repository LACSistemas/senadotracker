import type { StateNumbersInput } from '@senadotracker/db';

export interface StateLegislativeNumbers {
  deputies: number; districtDeputies: number; houses: number;
  cost: { month: string; totalCents: number; meanCents: number; deputies: number; houses: string[]; excluded: Array<{ house: string; reason: string }> } | null;
  proposals: { year: number; total: number; houses: number; perHouse: number } | null;
  parties: number;
}

const DISTRICT = new Set(['DF']);
const SUBSIDY_POSITIONS = new Set(['STATE_DEPUTY', 'DISTRICT_DEPUTY', 'STATE_DEPUTY_INSTITUTIONAL']);
/** Casa precisa ter ao menos esta fração de lançamentos por parlamentar no mês para o mês contar como "publicado de forma utilizável". */
export const MIN_ENTRIES_PER_DEPUTY = 0.5;
/** O mês de referência é o mais recente em que pelo menos esta fração das Casas com despesas confiáveis atende ao mínimo acima. */
export const MIN_HOUSE_SHARE = 0.7;
/** Casas com menos proposições que isto no ano (AM, PB e RS: coleta bloqueada ou parcial) não entram na média por Assembleia. */
export const MIN_PROPOSALS_FOR_AVERAGE = 50;

const subsidyAt = (input: StateNumbersInput, house: string, month: string): number | null => {
  const first = `${month}-01`, last = `${month}-28`;
  const rows = input.subsidies.filter(s => s.house === house && SUBSIDY_POSITIONS.has(s.position) && s.from <= last && (s.to === null || s.to >= first)).sort((a, b) => b.from.localeCompare(a.from));
  return rows[0]?.cents ?? null;
};

/**
 * Regras (todas explícitas no cartão):
 * - custo = subsídio bruto vigente × parlamentares + cotas/verbas indenizatórias publicadas no mês; NÃO inclui gabinete;
 * - Casas com saldos de extrato misturados às despesas (valores não somáveis) e Casas sem mês utilizável ficam de fora;
 * - média = custo ÷ parlamentares das Casas incluídas (mesmo universo no numerador e no denominador);
 * - proposições: total do ano publicado ÷ número de Assembleias cuja revisão legislativa está operacional.
 */
export function computeStateNumbers(input: StateNumbersInput): StateLegislativeNumbers {
  const houses = input.houses.filter(h => h.deputies > 0);
  const deputies = houses.reduce((sum, h) => sum + h.deputies, 0), districtDeputies = houses.filter(h => DISTRICT.has(h.house)).reduce((sum, h) => sum + h.deputies, 0);

  const withFinance = houses.filter(h => h.finance?.reliable);
  const excluded: Array<{ house: string; reason: string }> = houses.filter(h => h.finance && !h.finance.reliable).map(h => ({ house: h.house, reason: 'valores misturam saldos de extrato com despesas' }));
  const usable = (h: (typeof houses)[number], month: string) => { const m = h.finance?.monthly.find(x => x.month === month); return Boolean(m && m.n >= MIN_ENTRIES_PER_DEPUTY * h.deputies); };
  const months = [...new Set(withFinance.flatMap(h => h.finance!.monthly.map(m => m.month)))].sort().reverse();
  const needed = Math.ceil(MIN_HOUSE_SHARE * withFinance.length);
  const month = months.find(candidate => withFinance.filter(h => usable(h, candidate) && subsidyAt(input, h.house, candidate) !== null).length >= needed) ?? null;

  let cost: StateLegislativeNumbers['cost'] = null;
  if (month) {
    const included = withFinance.filter(h => usable(h, month) && subsidyAt(input, h.house, month) !== null);
    for (const h of withFinance.filter(h => !included.includes(h))) excluded.push({ house: h.house, reason: `sem lançamentos suficientes em ${month}` });
    const total = included.reduce((sum, h) => sum + h.finance!.monthly.find(m => m.month === month)!.cents + subsidyAt(input, h.house, month)! * h.deputies, 0), n = included.reduce((sum, h) => sum + h.deputies, 0);
    cost = { month, totalCents: total, meanCents: Math.round(total / n), deputies: n, houses: included.map(h => h.house), excluded };
  }

  const operational = new Set(input.legislativeOperational);
  const withProposals = houses.filter(h => operational.has(h.house) && h.proposals !== null && h.proposals >= MIN_PROPOSALS_FOR_AVERAGE);
  const total = withProposals.reduce((sum, h) => sum + h.proposals!, 0);
  const proposals = withProposals.length ? { year: Math.max(...withProposals.map(h => h.proposalsYear ?? 0)), total, houses: withProposals.length, perHouse: Math.round(total / withProposals.length) } : null;

  return { deputies, districtDeputies, houses: houses.length, cost, proposals, parties: input.canonicalPartyCount };
}

