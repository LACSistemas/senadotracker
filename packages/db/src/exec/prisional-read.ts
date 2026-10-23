import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';
import { CAP_REGIMES, POP_GROUPS, PRI_DEF_BY_ID, PRI_IDS, PRI_OCC_FORMULA, mid, type PriDef } from './prisional-defs.ts';

/**
 * Contratos de leitura do Sistema Prisional (P9.4) para as futuras páginas estaduais e municipais. Somente SELECT; no máximo 5 consultas por chamada, todas por
 * (entidade × indicador × período) ou (município × ciclo); nada carrega os estabelecimentos do Brasil para montar um perfil.
 * REGRAS (no payload, em `restrictions`): estabelecimento no município ≠ residência dos custodiados; população prisional não é indicador de criminalidade do município;
 * domiciliar não entra na ocupação; ciclos são semestres (estoque na data de referência), não meses; a fonte só traz respostas validadas: "sem estabelecimento" e "sem resposta" não se distinguem.
 */
type Q = Pick<Pool, 'query'>;
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const flagNames = (f: number): string[] => (Object.entries(FLAG) as Array<[string, number]>).filter(([, b]) => (f & b) !== 0).map(([k]) => k);
export const competenceRef = (c: number): string => `${Math.floor(c / 100)}/${c % 100 === 6 ? 1 : 2}`;
export const PRISON_RESTRICTIONS = [
  'A localização de um estabelecimento prisional não indica onde moram as pessoas custodiadas. População prisional não é população residente do município e não mede criminalidade do território.',
  'Cada ciclo é um semestre (estoque na data de referência: 30/06 ou 31/12). Nada é mensal e nenhum semestre foi interpolado.',
  'Pessoas em celas físicas, em prisão domiciliar com monitoramento e em prisão domiciliar sem monitoramento são universos distintos; a taxa de ocupação usa apenas celas físicas.',
  'Capacidade total e capacidade por regime (ou população total e margens por sexo/regime) são margens do mesmo universo: nunca se somam. A ocupação de um território é Σ população ÷ Σ capacidade, não a média das taxas das unidades.',
  'O arquivo só traz respostas validadas: ausência de um estabelecimento em um ciclo pode ser não resposta, não fechamento. Variação do número de unidades pode refletir queda de cobertura da pesquisa.',
  'A identidade histórica de um estabelecimento é uma chave interna do Cívica (o SISDEPEN não publica identificador estável); correspondências com revisão pendente não devem sustentar séries longitudinais por unidade.',
];
export interface PriPoint { competence: number; ref: string; period: { start: string; end: string }; value: number | null; numerator: number | null; denominator: number | null; flags: string[] }
export interface PriSeries { indicatorId: number; code: string; label: string; unit: string; scope: PriDef['scope']; kind: string; note: string; points: PriPoint[] }
interface Raw { indicator_id: number; period_start: unknown; period_end: unknown; value: number | null; numerator: number | null; denominator: number | null; flags: number }
const toComp = (d: unknown): number => { const s = iso(d); const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)); return m <= 6 ? y * 100 + 6 : y * 100 + 12; };
function seriesOf(rows: Raw[]): PriSeries[] {
  const by = new Map<number, PriPoint[]>();
  for (const r of rows) { const c = toComp(r.period_start); const a = by.get(Number(r.indicator_id)) ?? []; a.push({ competence: c, ref: competenceRef(c), period: { start: iso(r.period_start), end: iso(r.period_end) }, value: r.value == null ? null : Number(r.value), numerator: r.numerator == null ? null : Number(r.numerator), denominator: r.denominator == null ? null : Number(r.denominator), flags: flagNames(Number(r.flags)) }); by.set(Number(r.indicator_id), a); }
  return [...by.entries()].map(([id, points]) => { const d = PRI_DEF_BY_ID.get(id)!; return { indicatorId: id, code: d.code, label: d.label, unit: d.unit, scope: d.scope, kind: d.kind, note: d.note, points: points.sort((a, b) => a.competence - b.competence) }; }).sort((a, b) => a.indicatorId - b.indicatorId);
}
const indRows = async (q: Q, entityId: number): Promise<Raw[]> => (await q.query(`SELECT indicator_id, period_start, period_end, value, numerator, denominator, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [entityId, PRI_IDS])).rows as Raw[];
const stamps = async (q: Q, ufCode: number | null) => (await q.query(`SELECT dataset_id, count(*)::int AS slices, max(competence)::int AS last, min(competence)::int AS first, max(activated_at) AS at FROM civica_exec.exec_publication WHERE dataset_id IN (28, 29) AND ($1::int IS NULL OR uf = $1 OR uf = 0) GROUP BY 1 ORDER BY 1`, [ufCode])).rows.map(x => ({ dataset: Number(x.dataset_id) === 28 ? 'unidades_por_uf' : 'agregado_nacional', slices: Number(x.slices), firstCompetence: Number(x.first), lastCompetence: Number(x.last), activatedAt: iso(x.at) }));
export interface PriCoverage { competence: number; ref: string; unitsInFile: number; physicalCells: number; domesticWithoutMonitoring: number; domesticWithMonitoring: number; federal: number; newUnits: number; continuing: number; absentVsPrevious: number; incompleteCapacity: number; unassignedMunicipality: number; expectedUniverse: null; note: string }
const covOf = (x: Record<string, unknown>): PriCoverage => ({ competence: Number(x.competence), ref: competenceRef(Number(x.competence)), unitsInFile: Number(x.rows_in_file), physicalCells: Number(x.cela), domesticWithoutMonitoring: Number(x.dom_sem), domesticWithMonitoring: Number(x.dom_com), federal: Number(x.federal), newUnits: Number(x.new_units), continuing: Number(x.continuing), absentVsPrevious: Number(x.absent_vs_prev), incompleteCapacity: Number(x.cap_incomplete), unassignedMunicipality: Number(x.unassigned_mun), expectedUniverse: null,
  note: 'O arquivo só contém respostas validadas; o universo esperado de estabelecimentos não consta da fonte. "Ausentes vs ciclo anterior" não é fechamento comprovado.' });

export interface PrisonState { entityId: number; ufCode: number; latestCompetence: number | null; latestRef: string | null; series: PriSeries[]; coverage: PriCoverage[]; sources: Awaited<ReturnType<typeof stamps>>; formulas: { occupancy: string }; restrictions: string[] }
/** Perfil de uma UF: 4 consultas (UF; série de indicadores; cobertura por ciclo; publicações). */
export async function getPrisonState(q: Q, ufCode: number): Promise<PrisonState | null> {
  const e = await q.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [ufCode]); if (!e.rows[0]) return null; const entityId = Number(e.rows[0].entity_id);
  const [rows, cov, src] = await Promise.all([indRows(q, entityId), q.query(`SELECT * FROM civica_exec.exec_pri_cov WHERE uf = $1 ORDER BY competence`, [ufCode]), stamps(q, ufCode)]);
  const series = seriesOf(rows); const latest = series.length ? Math.max(...series.map(s => s.points.at(-1)!.competence)) : null;
  return { entityId, ufCode, latestCompetence: latest, latestRef: latest ? competenceRef(latest) : null, series, coverage: cov.rows.map(covOf), sources: src, formulas: { occupancy: PRI_OCC_FORMULA }, restrictions: PRISON_RESTRICTIONS };
}
export interface PrisonNational { entityId: number; latestRef: string | null; series: PriSeries[]; coverage: Array<{ competence: number; ref: string; unitsInFile: number; physicalCells: number; federal: number; newUnits: number; absentVsPrevious: number; ufsParticipating: number; note: string }>; sources: Awaited<ReturnType<typeof stamps>>; restrictions: string[] }
/** Brasil: série nacional e cobertura agregada. 3 consultas. */
export async function getPrisonNational(q: Q): Promise<PrisonNational | null> {
  const e = await q.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`); if (!e.rows[0]) return null; const entityId = Number(e.rows[0].entity_id);
  const [rows, cov, src] = await Promise.all([indRows(q, entityId), q.query(`SELECT competence, sum(rows_in_file)::int rows_in_file, sum(cela)::int cela, sum(federal)::int federal, sum(new_units)::int new_units, sum(absent_vs_prev)::int absent, count(*) FILTER (WHERE rows_in_file > 0)::int ufs FROM civica_exec.exec_pri_cov GROUP BY 1 ORDER BY 1`), stamps(q, null)]);
  const series = seriesOf(rows); const latest = series.length ? Math.max(...series.map(s => s.points.at(-1)!.competence)) : null;
  return { entityId, latestRef: latest ? competenceRef(latest) : null, series, coverage: cov.rows.map(x => ({ competence: Number(x.competence), ref: competenceRef(Number(x.competence)), unitsInFile: Number(x.rows_in_file), physicalCells: Number(x.cela), federal: Number(x.federal), newUnits: Number(x.new_units), absentVsPrevious: Number(x.absent), ufsParticipating: Number(x.ufs), note: 'Só respostas validadas; sem universo esperado na fonte.' })), sources: src, restrictions: PRISON_RESTRICTIONS };
}
export interface PriUnitView {
  unitId: number; name: string; ambito: 'estadual' | 'federal'; tipo: 'cela_fisica' | 'domiciliar_sem_monitoramento' | 'domiciliar_com_monitoramento'; destination: 'masculino' | 'feminino' | 'misto' | null; management: string | null;
  firstRef: string; lastRef: string; observedCycles: number; identityReviewPending: number;
  latest: { ref: string; capacity: number | null; population: number | null; occupancyPct: number | null; excess: number | null; capacityStatus: 'declared' | 'incomplete' | 'zero' | 'not_applicable_domiciliary'; populationStatus: 'declared' | 'not_reported' };
  history: Array<{ ref: string; sourceName: string; capacity: number | null; population: number | null }>;
}
export interface PrisonMunicipality { entityId: number; ibge7: number; name: string; ufCode: number; units: PriUnitView[]; aggregateSeries: PriSeries[]; latestRef: string | null; stateContext: { label: string; notice: string; ufCode: number }; sources: Awaited<ReturnType<typeof stamps>>; restrictions: string[] }
const TIPO = ['', 'cela_fisica', 'domiciliar_sem_monitoramento', 'domiciliar_com_monitoramento'] as const; const SEX = [null, 'masculino', 'feminino', 'misto'] as const; const GEST = [null, 'pública', 'cogestão', 'parceria público-privada', 'organização sem fins lucrativos'] as const;
/** Estabelecimentos de um município (código IBGE de 7 dígitos): 5 consultas (município; observações+série+publicações em paralelo; fatos por unit_id, pela chave primária). Nenhum dado da UF além de um rótulo. */
export async function getPrisonMunicipality(q: Q, ibge7: number): Promise<PrisonMunicipality | null> {
  const e = await q.query(`SELECT entity_id, name, uf_code FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [ibge7]); const m = e.rows[0]; if (!m) return null; const entityId = Number(m.entity_id);
  const capM = mid('cap.total.M'), capF = mid('cap.total.F'), popT = mid('pop.total');
  const [obs, agg, src] = await Promise.all([
    q.query(`SELECT o.unit_id, o.competence, o.source_name, o.tipo, o.ambito, o.sex_dest, o.gestao, u.canonical_name, u.first_competence, x.review FROM civica_exec.exec_pri_obs o JOIN civica_exec.exec_pri_unit u USING (unit_id) LEFT JOIN civica_exec.exec_pri_xwalk x ON x.competence = o.competence AND x.row_no = o.row_no AND x.uf = o.uf WHERE o.entity_id = $1 ORDER BY o.unit_id, o.competence`, [entityId]),
    indRows(q, entityId), stamps(q, Number(m.uf_code))]);
  const unitIds = [...new Set(obs.rows.map(r => Number(r.unit_id)))];
  const facts = unitIds.length ? await q.query(`SELECT f.unit_id, f.competence, f.measure_id, f.value FROM civica_exec.exec_pri_fact f WHERE f.unit_id = ANY($1::int[]) AND f.measure_id = ANY($2::smallint[])`, [unitIds, [capM, capF, popT]]) : { rows: [] as Array<Record<string, unknown>> };
  const fx = new Map<string, number>(); for (const r of facts.rows) fx.set(`${r.unit_id}:${r.competence}:${r.measure_id}`, Number(r.value));
  const byUnit = new Map<number, Array<Record<string, any>>>(); for (const r of obs.rows) { const a = byUnit.get(Number(r.unit_id)) ?? []; a.push(r); byUnit.set(Number(r.unit_id), a); }
  const units: PriUnitView[] = [...byUnit.entries()].map(([unitId, list]) => {
    const last = list.at(-1)!; const c = Number(last.competence); const cap = (cm: number) => fx.get(`${unitId}:${cm}:${capM}`) ?? null; const capFm = (cm: number) => fx.get(`${unitId}:${cm}:${capF}`) ?? null; const popOf = (cm: number) => fx.get(`${unitId}:${cm}:${popT}`) ?? null;
    const capInfo = (cm: number, sex: number | null): { declared: number | null; complete: boolean } => { const mm = cap(cm), ff = capFm(cm); const complete = (mm != null || sex === 2) && (ff != null || sex === 1) && (mm != null || ff != null); return { declared: mm == null && ff == null ? null : (mm ?? 0) + (ff ?? 0), complete }; };
    const capTotal = (cm: number, sex: number | null): number | null => capInfo(cm, sex).declared;
    const tipo = Number(last.tipo); const ci = capInfo(c, last.sex_dest == null ? null : Number(last.sex_dest)); const capacity = tipo === 1 ? ci.declared : null; const population = popOf(c);
    const usable = tipo === 1 && ci.complete && capacity != null && capacity > 0;
    return {
      unitId, name: String(last.source_name), ambito: (Number(last.ambito) === 2 ? 'federal' : 'estadual') as PriUnitView['ambito'], tipo: TIPO[tipo] as PriUnitView['tipo'], destination: SEX[Number(last.sex_dest) || 0] ?? null, management: GEST[Number(last.gestao) || 0] ?? null,
      firstRef: competenceRef(Number(last.first_competence)), lastRef: competenceRef(c), observedCycles: list.length, identityReviewPending: list.filter(x => Number(x.review) === 1).length,
      latest: { ref: competenceRef(c), capacity, population, occupancyPct: usable && population != null ? population / capacity! * 100 : null, excess: usable && population != null ? population - capacity! : null,
        capacityStatus: (tipo !== 1 ? 'not_applicable_domiciliary' : capacity == null ? 'incomplete' : capacity === 0 ? 'zero' : ci.complete ? 'declared' : 'incomplete') as PriUnitView['latest']['capacityStatus'], populationStatus: (population == null ? 'not_reported' : 'declared') as PriUnitView['latest']['populationStatus'] },
      history: list.map(x => { const cm = Number(x.competence); return { ref: competenceRef(cm), sourceName: String(x.source_name), capacity: Number(x.tipo) === 1 ? capTotal(cm, x.sex_dest == null ? null : Number(x.sex_dest)) : null, population: popOf(cm) }; }),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const series = seriesOf(agg); const latest = series.length ? Math.max(...series.map(s => s.points.at(-1)!.competence)) : null;
  return { entityId, ibge7, name: String(m.name), ufCode: Number(m.uf_code), units, aggregateSeries: series, latestRef: latest ? competenceRef(latest) : null, stateContext: { label: 'Contexto estadual', notice: 'A UF é citada só como referência; população e capacidade do estado não são deste município.', ufCode: Number(m.uf_code) }, sources: src, restrictions: PRISON_RESTRICTIONS };
}
void POP_GROUPS; void CAP_REGIMES;
