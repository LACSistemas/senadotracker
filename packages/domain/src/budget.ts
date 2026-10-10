/**
 * Domínio das emendas orçamentárias "Transferências Especiais" (Emenda Pix) — regras puras, sem I/O.
 *
 * - O código da emenda tem 12 dígitos: AAAA (ano da LOA) + código SIOP do autor (4) + sequencial (4).
 * - O código SIOP do autor NÃO é id da Câmara nem CodigoParlamentar do Senado: jamais pode ser comparado numericamente com eles.
 * - A atribuição a uma pessoa só vale por crosswalk datado e revisado (`isProfileAttributable`).
 */
export type BudgetHouse = 'camara' | 'senado';

export const SPECIAL_TRANSFER_KIND = 'Emenda Individual - Transferências Especiais';
export const WINDOW_START_MONTH_DAY = '08-01';
export const OPEN_END = '9999-12-31';

export const foldName = (value: unknown): string => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const TITLES = /^(dep|deputado|deputada|sen|senador|senadora|dr|dra|doutor|doutora|prof|profa|professor|professora|cabo|sargento|sgt|delegado|delegada|pastor|pastora|capitao|coronel|major|tenente|general|bispo|padre|dom|juiz|juiza)\s+/;
export function stripTitle(name: string): string { let out = name; for (let i = 0; i < 3 && TITLES.test(out); i++) out = out.replace(TITLES, ''); return out; }

/** `202040870001-Carlos Viana` → `202040870001`. Qualquer outra forma → null (nunca inventa código). */
export function amendmentCodeOf(formatted: unknown): string | null { const match = /^(\d{12})(?:\D|$)/.exec(String(formatted ?? '').trim()); return match ? match[1]! : null; }
export function authorCodeOfAmendment(code: string): string { if (!/^\d{12}$/.test(code)) throw new Error(`Código de emenda inválido: ${code}`); return code.slice(4, 8); }
export function amendmentYearOf(code: string): number { if (!/^\d{12}$/.test(code)) throw new Error(`Código de emenda inválido: ${code}`); return Number(code.slice(0, 4)); }

/** Decimal brasileiro do Portal ("1.234,56"). Vazio → null. */
export function parseBrDecimal(value: unknown): number | null {
  const text = String(value ?? '').trim(); if (!text) return null;
  const number = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export type EnteType = 'municipio' | 'estado' | 'distrito_federal' | 'outro';
/** Heurística pelo nome do beneficiário. NÃO produz código IBGE. */
export function classifyEnte(name: string | null | undefined): EnteType {
  const n = foldName(name);
  if (/^(municipio|prefeitura)( |$)/.test(n)) return 'municipio';
  if (/^distrito federal|^governo do distrito federal/.test(n)) return 'distrito_federal';
  if (/^(estado|governo do estado)( |$)/.test(n)) return 'estado';
  return 'outro';
}

// ---------------------------------------------------------------- identidade do autor (SIOP → pessoa)
export interface RosterExercise { start: string; end: string | null; role?: string | null }
export interface RosterRecord { house: BudgetHouse; externalId: string; personKey: string; names: string[]; ufs: string[]; exercises: RosterExercise[] }
export type MatchClass = 'EXACT' | 'HIGH' | 'AMBIGUOUS' | 'CONFLICT' | 'UNMATCHED';
export interface AuthorCodeInput { code: string; names: string[]; ufs: string[]; years: number[] }
export interface AuthorCodeResolution {
  code: string; cls: MatchClass; reason: string; personKey: string | null;
  /** registro do roster que sustenta a Casa em cada ano (`casa:id`). */
  byYear: Record<number, { house: BudgetHouse; recordKey: string } | null>;
  fallbackYears: number[]; method: string | null;
  /** todos os registros do roster cujo nome casou (evidência/revisão; não confirma nada). */
  candidates: string[];
}
export interface RosterIndex { records: RosterRecord[]; exact: Map<string, RosterRecord[]>; stripped: Map<string, RosterRecord[]>; /** nomes de autor (SIOP) conhecidos, dobrados: um nome mais longo que é autor por si só explica o homônimo parcial */ claimed: Set<string> }
export const recordKey = (record: Pick<RosterRecord, 'house' | 'externalId'>) => `${record.house}:${record.externalId}`;

export function buildRosterIndex(records: RosterRecord[], claimedNames: Iterable<string> = []): RosterIndex {
  const exact = new Map<string, RosterRecord[]>(), stripped = new Map<string, RosterRecord[]>();
  const push = (map: Map<string, RosterRecord[]>, key: string, record: RosterRecord) => { if (!key) return; const list = map.get(key) ?? []; if (!list.includes(record)) list.push(record); map.set(key, list); };
  for (const record of records) for (const raw of record.names) { const name = foldName(raw); push(exact, name, record); const s = stripTitle(name); if (s !== name) push(stripped, s, record); }
  return { records, exact, stripped, claimed: new Set([...claimedNames].map(foldName).filter(Boolean)) };
}

const overlaps = (record: RosterRecord, from: string, to: string) => record.exercises.some(e => e.start <= to && (e.end ?? OPEN_END) >= from);
/** Janela em que a emenda do ano Y é redigida (processo da LOA): ago–dez de Y−1. Regra empírica; ver docs. */
export const authoringWindow = (year: number): [string, string] => [`${year - 1}-${WINDOW_START_MONTH_DAY}`, `${year - 1}-12-31`];
const inAuthoringWindow = (record: RosterRecord, year: number) => overlaps(record, ...authoringWindow(year));
const inYear = (record: RosterRecord, year: number) => overlaps(record, `${year}-01-01`, `${year}-12-31`);

/**
 * Resolve um código SIOP. Toda classe positiva termina em evidência determinística: nome exato (ou sem tratamento) de um
 * registro oficial do roster + exercício datado na janela de autoria (ou, na falta, no ano da emenda). Fuzzy não entra.
 */
export function resolveAuthorCode(input: AuthorCodeInput, index: RosterIndex): AuthorCodeResolution {
  const years = [...new Set(input.years)].sort((a, b) => a - b);
  const candidates = new Map<RosterRecord, 'name_exact' | 'name_stripped_title'>();
  const empty = (cls: MatchClass, reason: string): AuthorCodeResolution => ({ code: input.code, cls, reason, personKey: null, byYear: Object.fromEntries(years.map(y => [y, null])), fallbackYears: [], method: null, candidates: [...candidates.keys()].map(recordKey) });
  for (const raw of input.names) {
    const name = foldName(raw); if (!name) continue;
    for (const r of index.exact.get(name) ?? []) candidates.set(r, 'name_exact');
    const s = stripTitle(name);
    for (const r of index.exact.get(s) ?? []) if (!candidates.has(r)) candidates.set(r, 'name_stripped_title');
    for (const r of index.stripped.get(name) ?? []) if (!candidates.has(r)) candidates.set(r, 'name_stripped_title');
  }
  if (!candidates.size) return empty('UNMATCHED', 'no_name_in_roster');
  const ufSet = new Set(input.ufs);
  const ufOk = (r: RosterRecord) => !ufSet.size || r.ufs.some(u => ufSet.has(u));
  const pool = [...candidates.keys()].filter(ufOk);
  const fallback: Record<number, boolean> = {};
  const activeFor = (records: RosterRecord[], year: number, mark: boolean) => {
    let found = records.filter(r => inAuthoringWindow(r, year));
    if (!found.length) { found = records.filter(r => inYear(r, year)); if (found.length && mark) fallback[year] = true; }
    return found;
  };
  const perYear = new Map<number, RosterRecord[]>(years.map(y => [y, activeFor(pool, y, true)]));
  const peoplePerYear = (y: number) => [...new Set(perYear.get(y)!.map(r => r.personKey))];
  const ambiguousYears = years.filter(y => peoplePerYear(y).length > 1);
  if (ambiguousYears.length) return { ...empty('AMBIGUOUS', `multiple_people_in_year:${ambiguousYears.join(',')}`) };
  const people = new Set(years.flatMap(peoplePerYear));
  if (people.size > 1) return empty('CONFLICT', 'different_people_across_years');
  const byYearFor = (person: string, source: Map<number, RosterRecord[]>) => Object.fromEntries(years.map(y => { const r = source.get(y)!.find(x => x.personKey === person); return [y, r ? { house: r.house, recordKey: recordKey(r) } : null]; })) as AuthorCodeResolution['byYear'];
  if (people.size === 0) {
    if (pool.length) return empty('CONFLICT', 'name_found_but_no_exercise_in_emenda_years');
    // nome achado, mas a UF da emenda (localidade de aplicação) difere da do parlamentar: aceita só se for uma única pessoa com exercício
    const all = [...candidates.keys()];
    const noUf = new Map<number, RosterRecord[]>(years.map(y => [y, activeFor(all, y, false)]));
    const noUfPeople = new Set(years.flatMap(y => noUf.get(y)!.map(r => r.personKey)));
    if (noUfPeople.size === 1 && years.every(y => new Set(noUf.get(y)!.map(r => r.personKey)).size <= 1)) {
      const person = [...noUfPeople][0]!;
      return { code: input.code, cls: 'HIGH', reason: 'uf_of_emenda_differs_from_parliamentarian_uf', personKey: person, byYear: byYearFor(person, noUf), fallbackYears: [], method: 'name_exact+exercise', candidates: [...candidates.keys()].map(recordKey) };
    }
    return empty('UNMATCHED', 'name_found_but_uf_incompatible');
  }
  const person = [...people][0]!;
  // homônimo parcial: outra pessoa, ativa no mesmo período, cujo nome oficial COMEÇA pelo nome do autor (ex.: "João Carlos Bacelar" × "João Carlos Bacelar Batista")
  const siopNames = input.names.map(foldName).filter(Boolean);
  const competitors = index.records.filter(r => r.personKey !== person && ufOk(r) && years.some(y => inAuthoringWindow(r, y) || inYear(r, y))
    && r.names.some(n => { const f = foldName(n); return !index.claimed.has(f) && siopNames.some(sn => f !== sn && f.startsWith(`${sn} `)); }));
  if (competitors.length) return { ...empty('AMBIGUOUS', `name_prefix_competitor:${[...new Set(competitors.map(recordKey))].join(',')}`), candidates: [...new Set([...candidates.keys(), ...competitors].map(recordKey))] };
  const gaps = years.filter(y => peoplePerYear(y).length === 0);
  const fb = Object.keys(fallback).map(Number).sort((a, b) => a - b);
  const kinds = new Set([...candidates.entries()].filter(([r]) => r.personKey === person).map(([, k]) => k));
  const strong = kinds.has('name_exact') && ufSet.size > 0 && !gaps.length && !fb.length;
  const reason = strong ? 'name+uf+exercise_each_year' : gaps.length ? `exercise_missing_years:${gaps.join(',')}` : fb.length ? `exercise_in_year_not_in_authoring_window:${fb.join(',')}` : !ufSet.size ? 'uf_unknown' : 'name_stripped_title';
  return { code: input.code, cls: strong ? 'EXACT' : 'HIGH', reason, personKey: person, byYear: byYearFor(person, perYear), fallbackYears: fb, method: strong ? 'name_exact+exercise+uf' : 'name_exact+exercise', candidates: [...candidates.keys()].map(recordKey) };
}

/** Pares candidatos "mesma pessoa em Câmara e Senado" por nome civil completo exato. Candidatos, nunca confirmações. */
export interface CivilNameRecord { house: BudgetHouse; externalId: string; civilName: string }
export function crossHouseCandidates(records: CivilNameRecord[]): Array<{ camara: CivilNameRecord; senado: CivilNameRecord; civilName: string }> {
  const groups = new Map<string, CivilNameRecord[]>();
  for (const r of records) { const key = foldName(r.civilName); if (!key || key.split(' ').length < 2) continue; (groups.get(key) ?? groups.set(key, []).get(key)!).push(r); }
  const out: Array<{ camara: CivilNameRecord; senado: CivilNameRecord; civilName: string }> = [];
  for (const [key, group] of groups) { const c = group.filter(r => r.house === 'camara'), s = group.filter(r => r.house === 'senado'); for (const a of c) for (const b of s) out.push({ camara: a, senado: b, civilName: key }); }
  return out;
}

// ---------------------------------------------------------------- regra de uso e semântica financeira
export interface CrosswalkVisibility { reviewed: boolean; confidence: string | null; personId: string | null }
/** Única regra de atribuição a perfis: revisado, EXACT|HIGH e com pessoa. UNMATCHED/sem pessoa nunca. */
export function isProfileAttributable(row: CrosswalkVisibility): boolean { return row.reviewed === true && (row.confidence === 'EXACT' || row.confidence === 'HIGH') && Boolean(row.personId); }

/**
 * Contrato financeiro. Cada campo diz de que fonte vem e o que NÃO significa.
 * - destined: soma custeio+investimento dos planos de ação (Transferegov). Não é dinheiro recebido.
 * - committed: Portal (nível da emenda). `plansCommitted` (empenhos do Transferegov) é medida distinta, por plano.
 * - liquidated/paid: Portal (nível da emenda). `paid` significa pagamento/ordem bancária; NÃO significa obra executada.
 * - paidByPlanDocuments: documentos hábeis com OB no Transferegov (2023+); não existe de forma confiável para 2020–2022.
 * - executedByEnte: relatório de gestão do ente (parcial). Nunca equivale a pago.
 */
export interface PixFinancials {
  destinedAmount: number; committedAmount: number | null; liquidatedAmount: number | null; paidAmount: number | null;
  outstandingPayables: number | null; plansCommittedAmount: number; paidByPlanDocumentsAmount: number; executedByEnteAmount: number | null;
}
export const PIX_FINANCIAL_NOTES = {
  paid: 'Pago/transferido segundo o Portal da Transparência; não indica execução física da obra.',
  executedByEnte: 'Executado pelo ente (relatório de gestão) é parcial e não equivale a pago.',
  paid2020to2022: 'Para emendas de 2020 a 2022 o pago só é confiável no nível da emenda (Portal); não há documento hábil por plano no Transferegov.',
} as const;

const UF_BY_NAME: Record<string, string> = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO' };
/** "AMAPÁ" → "AP". "MÚLTIPLO", "Sem informação" e valores desconhecidos → null (nunca chuta). */
export function ufSigla(value: unknown): string | null { const v = String(value ?? '').trim(); if (/^[A-Za-z]{2}$/.test(v) && Object.values(UF_BY_NAME).includes(v.toUpperCase())) return v.toUpperCase(); return UF_BY_NAME[foldName(v)] ?? null; }
