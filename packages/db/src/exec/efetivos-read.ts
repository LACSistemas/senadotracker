import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';
import { EFE_DEF_BY_ID, ESTADIC_VARS, FBSP_CORPS, FBSP_PLANS, FBSP_RATES, MUNIC_UF_AGG, MUNIC_VARS, SIAPE_ORGS, type EfeDef, type EfeSource } from './efetivos-defs.ts';

/**
 * Contratos de leitura de efetivos e estrutura institucional (P9.3) para as futuras páginas de Segurança. Somente SELECT; cada função faz no máximo 4 consultas (UF: 3; município: 4; Brasil: 3),
 * todas por (entidade × indicador): nenhuma varre município para obter um número de UF, e nada é distribuído entre territórios.
 * REGRAS DE APRESENTAÇÃO (carregadas no payload em `restrictions`): efetivo estadual NÃO é lotação municipal; fontes diferentes (FBSP, ESTADIC, MUNIC, SIAPE) nunca viram um número só;
 * ausência (indisponível, não informou, recusa, inexistente) é estado, nunca zero; existência de delegacia não é quantidade de delegacias.
 */
type Q = Pick<Pool, 'query'>;
export type StaffStatus = 'reported' | 'unavailable' | 'not_informed' | 'refused' | 'inexistent' | 'included_in_other';
export interface StaffPoint {
  indicatorId: number; code: string; label: string; unit: string; source: EfeSource; granularity: 'brasil' | 'uf' | 'municipio'; measure: string; corporation: string | null;
  value: number | null; numerator: number | null; denominator: number | null; status: StaffStatus; flags: string[];
  /** janela de referência da linha ("data-base"), não o ano de publicação */ period: { start: string; end: string }; definition: string; comparability: string;
}
export interface StaffSourceStamp { dataset: 'fbsp_raiox' | 'estadic' | 'munic' | 'siape'; competence: number; activatedAt: string | null }
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const flagNames = (f: number): string[] => (Object.entries(FLAG) as Array<[string, number]>).filter(([, b]) => (f & b) !== 0).map(([k]) => k);
export function statusOf(value: number | null, flags: number): StaffStatus {
  if (value != null) return (flags & FLAG.inexistent) ? 'inexistent' : 'reported';
  if (flags & FLAG.refused) return 'refused'; if (flags & FLAG.notInformed) return 'not_informed'; if (flags & FLAG.composite) return 'included_in_other';
  return 'unavailable';
}
interface RawRow { indicator_id: number; entity_id: number; period_start: unknown; period_end: unknown; value: number | null; numerator: number | null; denominator: number | null; flags: number }
const point = (r: RawRow): StaffPoint => {
  const d = EFE_DEF_BY_ID.get(Number(r.indicator_id)) as EfeDef;
  return { indicatorId: d.id, code: d.code, label: d.label, unit: d.unit, source: d.source, granularity: d.level === 'municipio' ? 'municipio' : d.level === 'brasil' ? 'brasil' : 'uf', measure: d.measure, corporation: d.corporation,
    value: r.value == null ? null : Number(r.value), numerator: r.numerator == null ? null : Number(r.numerator), denominator: r.denominator == null ? null : Number(r.denominator),
    status: statusOf(r.value == null ? null : Number(r.value), Number(r.flags)), flags: flagNames(Number(r.flags)), period: { start: iso(r.period_start), end: iso(r.period_end) }, definition: d.definition, comparability: d.comparability };
};
async function rowsOf(q: Q, entityIds: number[], ids: number[]): Promise<RawRow[]> {
  const r = await q.query(`SELECT indicator_id, entity_id, period_start, period_end, value, numerator, denominator, flags FROM civica_exec.exec_ind_value
    WHERE entity_id = ANY($1::int[]) AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [entityIds, ids]);
  return r.rows as RawRow[];
}
async function stamps(q: Q, ufCode: number | null): Promise<StaffSourceStamp[]> {
  const r = await q.query(`SELECT dataset_id, max(competence)::int AS competence, max(activated_at) AS at FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 24 AND 27 AND ($1::int IS NULL OR uf = $1 OR uf = 0) GROUP BY 1 ORDER BY 1`, [ufCode]);
  const name = (id: number) => id === 24 ? 'fbsp_raiox' : id === 25 ? 'estadic' : id === 26 ? 'munic' : 'siape';
  return r.rows.map(x => ({ dataset: name(Number(x.dataset_id)) as StaffSourceStamp['dataset'], competence: Number(x.competence), activatedAt: iso(x.at) }));
}

export const STAFF_RESTRICTIONS = [
  'Efetivo estadual (PM, PC, bombeiros, perícia, polícia penal) é um total da UF: não é o efetivo lotado em um município e não é distribuído por população, território ou delegacia.',
  'FBSP (2025, portais da transparência), ESTADIC (2018 e 2022, declaração do órgão gestor) e SIAPE (vínculos administrativos) têm conceitos e datas diferentes: os valores são mostrados lado a lado, nunca somados nem fundidos. Duas edições não formam série anual.',
  'Quadro previsto não é efetivo existente. A ocupação do quadro (existente ÷ previsto) mede o preenchimento de cargos, não a cobertura do policiamento do território.',
  'Não existe "policiais por habitante" somando corporações: cada taxa é de uma corporação. Número de policiais não mede segurança nem eficiência.',
  'Ausência de informação (indisponível, não informou, recusa) é um estado explícito, nunca zero. "Inexistente" (ex.: UF sem guarda municipal) vale zero por definição da fonte.',
  'Existência de delegacia ou de guarda (MUNIC) é uma declaração da prefeitura em 2019/2023: não informa quantidade, endereço, lotação, área atendida nem que a estrutura continue em funcionamento hoje.',
];

// ---------------------------------------------------------------- UF
export interface StaffEdition { edition: number; referenceDate: string; points: StaffPoint[] }
export interface StaffComparison { corporation: 'PM' | 'PC'; fbsp: StaffPoint | null; estadic: Array<{ edition: number; point: StaffPoint }>; comparable: false; note: string }
export interface StaffUfState {
  entityId: number; ufCode: number;
  fbsp: { existing: StaffPoint[]; plans: Array<{ corporation: string; planned: StaffPoint | null; occupancy: StaffPoint | null; difference: StaffPoint | null }>; ratesPer100k: StaffPoint[]; municipalGuardsFbsp: StaffPoint[] };
  estadic: StaffEdition[];
  municipalGuards: { editions: Array<{ survey: string; municipalitiesWithGuard: StaffPoint | null; staffSum: StaffPoint | null; municipalitiesNoAnswer: StaffPoint | null; municipalitiesWithPoliceStation: StaffPoint | null }>; note: string };
  divergences: StaffComparison[];
  sources: StaffSourceStamp[]; restrictions: string[];
}
const FBSP_EXIST_IDS = FBSP_CORPS.map(c => c.id);
const ESTADIC_IDS_ALL = ESTADIC_VARS.map(v => v.id);
const MUNIC_AGG_IDS = Object.values(MUNIC_UF_AGG);
/** Perfil institucional de uma UF: 3 consultas (UF × indicadores; publicações; nada mais). */
export async function getSecurityStaffingState(q: Q, ufCode: number): Promise<StaffUfState | null> {
  const e = await q.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [ufCode]); if (!e.rows[0]) return null;
  const entityId = Number(e.rows[0].entity_id);
  const ids = [...FBSP_EXIST_IDS, ...FBSP_PLANS.flatMap(p => [p.previsto, p.ocupacao, p.diferenca]), ...FBSP_RATES.map(r => r.id), 5020, 5021, 5022, ...ESTADIC_IDS_ALL, ...MUNIC_AGG_IDS];
  const [rows, src] = await Promise.all([rowsOf(q, [entityId], ids), stamps(q, ufCode)]);
  const by = (id: number) => rows.filter(r => Number(r.indicator_id) === id).map(point);
  const one = (id: number) => by(id)[0] ?? null;
  const editions = [...new Set(rows.filter(r => ESTADIC_IDS_ALL.includes(Number(r.indicator_id))).map(r => iso(r.period_start)))].sort();
  const estadic: StaffEdition[] = editions.map(start => ({ edition: Number(start.slice(0, 4)) + (start.endsWith('12-31') ? 1 : 0), referenceDate: start, points: rows.filter(r => ESTADIC_IDS_ALL.includes(Number(r.indicator_id)) && iso(r.period_start) === start).map(point) }));
  const surveys = [...new Set(rows.filter(r => Number(r.indicator_id) === MUNIC_UF_AGG.guardas).map(r => iso(r.period_start)))].sort();
  const aggAt = (id: number, year: number): StaffPoint | null => { const r = rows.find(x => Number(x.indicator_id) === id && (iso(x.period_start).slice(0, 4) === String(year) || iso(x.period_start) === `${year - 1}-12-31`)); return r ? point(r) : null; };
  const municipalGuards = surveys.map(s => { const y = Number(s.slice(0, 4));
    return { survey: s, municipalitiesWithGuard: aggAt(MUNIC_UF_AGG.guardas, y), staffSum: aggAt(MUNIC_UF_AGG.efetivo, y), municipalitiesNoAnswer: aggAt(MUNIC_UF_AGG.semResposta, y), municipalitiesWithPoliceStation: aggAt(MUNIC_UF_AGG.delegacia, y) }; });
  const divergences: StaffComparison[] = (['PM', 'PC'] as const).map(corp => ({
    corporation: corp, fbsp: one(corp === 'PM' ? 5001 : 5003), estadic: estadic.flatMap(ed => { const p = ed.points.find(x => x.indicatorId === (corp === 'PM' ? 5101 : 5104)); return p ? [{ edition: ed.edition, point: p }] : []; }),
    comparable: false as const, note: 'FBSP (efetivo da ativa, 2025) e ESTADIC (efetivo existente declarado pelo órgão gestor, 2018/2022) têm fonte, definição e data-base diferentes: não são a mesma medida nem uma série contínua.' }));
  return {
    entityId, ufCode,
    fbsp: { existing: FBSP_CORPS.filter(c => c.byUf).map(c => one(c.id)).filter((x): x is StaffPoint => x !== null),
      plans: FBSP_PLANS.map(p => ({ corporation: p.corp, planned: one(p.previsto), occupancy: one(p.ocupacao), difference: one(p.diferenca) })),
      ratesPer100k: FBSP_RATES.map(r => one(r.id)).filter((x): x is StaffPoint => x !== null), municipalGuardsFbsp: [5020, 5021, 5022].map(one).filter((x): x is StaffPoint => x !== null) },
    estadic, municipalGuards: { editions: municipalGuards, note: 'Soma das declarações das prefeituras (MUNIC) da UF; município que não informou fica fora da soma e é contado à parte. Não é o efetivo da PM nem da PC.' },
    divergences, sources: src, restrictions: STAFF_RESTRICTIONS,
  };
}

// ---------------------------------------------------------------- município
export type StationState = 'yes' | 'no' | 'none_of_the_listed' | 'not_informed' | 'refused' | 'not_asked';
export interface StaffMunicipalityEdition {
  survey: string;
  guard: { state: 'yes' | 'no' | 'not_informed' | 'refused' | 'not_asked'; staff: StaffPoint | null; men: StaffPoint | null; women: StaffPoint | null; existence: StaffPoint | null };
  policeStation: { state: StationState; existence: StaffPoint | null; note: string };
  specializedStations: Array<{ code: string; label: string; state: StationState; point: StaffPoint | null }>;
  otherStructures: Array<{ code: string; label: string; point: StaffPoint | null }>;
}
export interface StaffMunicipality {
  entityId: number; ibge7: number; name: string; ufCode: number; kind: 4 | 5;
  editions: StaffMunicipalityEdition[];
  /** contexto estadual, explicitamente rotulado: NÃO é lotação nem efetivo do município */
  stateContext: { label: string; notice: string; ufCode: number; pmFbsp: StaffPoint | null; pcFbsp: StaffPoint | null };
  rates: { guardsPer100k: null; reason: string };
  sources: StaffSourceStamp[]; restrictions: string[];
}
const stateOf = (p: StaffPoint | null): 'yes' | 'no' | 'not_informed' | 'refused' | 'not_asked' => !p ? 'not_asked' : p.status === 'not_informed' ? 'not_informed' : p.status === 'refused' ? 'refused' : p.value === 1 ? 'yes' : 'no';
/** Estrutura institucional de um município (código IBGE de 7 dígitos): 4 consultas por índice (entidade+UF; linhas do município; linhas da UF; publicações). Sem efetivo estadual como se fosse do município. */
export async function getSecurityStructureMunicipality(q: Q, ibge7: number): Promise<StaffMunicipality | null> {
  const e = await q.query(`SELECT e.entity_id, e.name, e.uf_code, e.kind, u.entity_id AS uf_entity FROM civica_exec.exec_entity e JOIN civica_exec.exec_entity u ON u.kind = 3 AND u.uf_code = e.uf_code WHERE e.kind IN (4, 5) AND e.ibge7 = $1`, [ibge7]);
  const m = e.rows[0]; if (!m) return null;
  const entityId = Number(m.entity_id); const ufEntity = Number(m.uf_entity);
  const munIds = MUNIC_VARS.map(v => v.id);
  const [rows, ctx, src] = await Promise.all([rowsOf(q, [entityId], munIds), rowsOf(q, [ufEntity], [5001, 5003]), stamps(q, Number(m.uf_code))]);
  const surveys = [...new Set(rows.filter(r => Number(r.indicator_id) === 5201).map(r => iso(r.period_start)))].sort();
  const editions: StaffMunicipalityEdition[] = surveys.map(survey => {
    const year = Number(survey.slice(0, 4));
    const at = (id: number): StaffPoint | null => { const r = rows.find(x => Number(x.indicator_id) === id && (iso(x.period_start).slice(0, 4) === String(year) || iso(x.period_start) === `${year - 1}-12-31`)); return r ? point(r) : null; };
    const none = at(5221); const dpc = at(5211);
    const stationState = (p: StaffPoint | null): StationState => p ? (p.status === 'not_informed' ? 'not_informed' : p.status === 'refused' ? 'refused' : p.value === 1 ? 'yes' : 'no') : none?.value === 1 ? 'none_of_the_listed' : 'not_asked';
    return {
      survey, guard: { state: stateOf(at(5201)), existence: at(5201), staff: at(5202), men: at(5203), women: at(5204) },
      policeStation: { state: stationState(dpc), existence: dpc, note: 'Existência declarada, não quantidade: a fonte não informa número de delegacias, endereço, efetivo ou área atendida.' },
      specializedStations: MUNIC_VARS.filter(v => v.id >= 5212 && v.id <= 5220).map(v => { const p = at(v.id); return { code: v.v, label: v.label, state: stationState(p), point: p }; }),
      otherStructures: MUNIC_VARS.filter(v => v.id >= 5222 && v.id <= 5224).map(v => ({ code: v.v, label: v.label, point: at(v.id) })),
    };
  });
  const c = (id: number) => { const r = ctx.filter(x => Number(x.indicator_id) === id).at(-1); return r ? point(r) : null; };
  return {
    entityId, ibge7, name: String(m.name), ufCode: Number(m.uf_code), kind: Number(m.kind) as 4 | 5, editions,
    stateContext: { label: 'Contexto estadual (FBSP, 2025)', notice: 'Total da UF inteira: não é o efetivo lotado neste município.', ufCode: Number(m.uf_code), pmFbsp: c(5001), pcFbsp: c(5003) },
    rates: { guardsPer100k: null, reason: 'Sem estimativa populacional oficial carregada para 2018 e 2022 (datas-base da MUNIC); a taxa não é calculada nem interpolada.' },
    sources: src, restrictions: STAFF_RESTRICTIONS,
  };
}

// ---------------------------------------------------------------- Brasil
export interface StaffNational { entityId: number; fbsp: StaffPoint[]; siape: Array<{ organ: string; code: string; series: Array<{ month: string; registros: number; cargo: number }>; note: string }>; sources: StaffSourceStamp[]; restrictions: string[] }
/** Totais nacionais por corporação (FBSP) e a série de registros de vínculo SIAPE de PF e PRF, sempre separados. 3 consultas. */
export async function getSecurityStaffingNational(q: Q): Promise<StaffNational | null> {
  const e = await q.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`); if (!e.rows[0]) return null; const entityId = Number(e.rows[0].entity_id);
  const siapeIds = SIAPE_ORGS.flatMap(o => [o.total, o.cargo]);
  const [rows, src] = await Promise.all([rowsOf(q, [entityId], [...FBSP_EXIST_IDS, ...siapeIds]), stamps(q, null)]);
  const fbsp = FBSP_CORPS.map(c => rows.filter(r => Number(r.indicator_id) === c.id).map(point)[0]).filter((x): x is StaffPoint => !!x);
  const siape = SIAPE_ORGS.map(o => { const tot = rows.filter(r => Number(r.indicator_id) === o.total); const car = new Map(rows.filter(r => Number(r.indicator_id) === o.cargo).map(r => [iso(r.period_start), Number(r.value)]));
    return { organ: o.label, code: o.key, series: tot.map(r => ({ month: iso(r.period_start).slice(0, 7), registros: Number(r.value), cargo: car.get(iso(r.period_start)) ?? 0 })),
      note: 'Registros de vínculo do cadastro SIAPE (órgão de exercício). Não é efetivo policial nem substitui o FBSP; cargo, situação e UF vêm sigilosos. Meses não listados não foram coletados (sem interpolação).' }; });
  return { entityId, fbsp, siape, sources: src, restrictions: STAFF_RESTRICTIONS };
}
