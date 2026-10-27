import type { Pool } from 'pg';
import { EDU_CATEGORY, EDU_CONFIDENCE_LABEL } from './edu-contract-build.ts';
import { EDU_CONTRACT_RESTRICTIONS, EDU_CONTRACT_SOURCES, getEduContractsTerritory, type EduContractAggregate, type EduTerritoryResult } from './educacao-contratos-read.ts';
import { getEducationSchool, getEducationMunicipalitySchools, getEducationStateSchools } from './educacao-read.ts';
import { getEducationSchoolOffer, getEducationMunicipalityOffer, getEducationNationalOffer } from './educacao-oferta-read.ts';
import { getEducationSchoolInfra, getEducationMunicipalityInfra, getEducationNationalInfra, type EducationInfra } from './educacao-infra-read.ts';
import { getEducationSchoolIndicators, getEducationTerritoryIndicators, getEducationTeachers } from './educacao-ind-read.ts';
import { getFlowSchool, getFlowTerritory, getIdebSchool, getIdebTerritory, getInseSchool, getInseTerritory, getSaebTerritory, getTransitionTerritory } from './educacao-learn-read.ts';
import { educationAnalyticsFreshness } from './educacao-analytics-materialize.ts';

type Q = Pick<Pool, 'query'>;
export type EducationCoverageStatus = 'AVAILABLE' | 'PARTIAL' | 'NOT_COLLECTED' | 'NOT_PUBLISHED_BY_SOURCE' | 'NOT_APPLICABLE' | 'SUPPRESSED' | 'NEEDS_VALIDATION' | 'SOURCE_UNAVAILABLE';
export type EducationPublicationStatus = 'INTERNAL_READY' | 'PUBLIC_DISPLAY_WITH_CONDITIONS' | 'NEEDS_LEGAL_VALIDATION' | 'NOT_PUBLICABLE';
export interface EducationCoverage {
  family: string; status: EducationCoverageStatus; through: string | null; evidence: string; publication: EducationPublicationStatus;
}
const cov = (family: string, status: EducationCoverageStatus, through: string | null, evidence: string, publication: EducationPublicationStatus = 'NEEDS_LEGAL_VALIDATION'): EducationCoverage => ({ family, status, through, evidence, publication });

interface Entity { entityId: number; kind: 1 | 3 | 4; name: string; ufCode: number | null; ibge7: string | null }
async function entityOf(q: Q, o: { ufCode?: number; ibge7?: string } = {}): Promise<Entity | null> {
  const args: unknown[] = []; let where = 'kind=1';
  if (o.ibge7 != null) { if (!/^\d{7}$/.test(o.ibge7)) return null; where = 'kind=4 AND ibge7=$1::int'; args.push(o.ibge7); }
  else if (o.ufCode != null) { where = 'kind=3 AND uf_code=$1'; args.push(o.ufCode); }
  const x = (await q.query(`SELECT entity_id,kind,name,uf_code,ibge7::text FROM civica_exec.exec_entity WHERE ${where}`, args)).rows[0];
  return x ? { entityId: Number(x.entity_id), kind: Number(x.kind) as Entity['kind'], name: String(x.name), ufCode: x.uf_code == null ? null : Number(x.uf_code), ibge7: x.ibge7 == null ? null : String(x.ibge7) } : null;
}
const aggregate = (rows: Array<Record<string, unknown>>): EduContractAggregate => ({
  contracts: rows.reduce((s, x) => s + Number(x.contracts), 0), withValue: rows.reduce((s, x) => s + Number(x.with_value), 0),
  withoutValue: rows.reduce((s, x) => s + Number(x.contracts) - Number(x.with_value), 0), outliers: rows.reduce((s, x) => s + Number(x.outliers), 0),
  contractedValue: Math.round(rows.reduce((s, x) => s + Number(x.contracted_value), 0)) / 100,
});

/** Usa o rollup somente em Brasil/UF; município continua na leitura indexada da P10.7. */
export async function getEducationContractSummary(q: Q, o: { ufCode?: number; ibge7?: string; year?: number } = {}): Promise<(EduTerritoryResult & { materialization: Awaited<ReturnType<typeof educationAnalyticsFreshness>> }) | null> {
  if (o.ibge7 != null) {
    const base = await getEduContractsTerritory(q, o); return base ? { ...base, materialization: null } : null;
  }
  const e = await entityOf(q, o); if (!e) return null;
  const rows = (await q.query(`SELECT year,category,confidence,contracts,with_value,outliers,contracted_value FROM civica_exec.exec_edu_contract_rollup
    WHERE scope=$1 AND scope_key=$2 AND ($3::smallint IS NULL OR year=$3) ORDER BY year,category,confidence`, [o.ufCode == null ? 1 : 3, o.ufCode ?? 0, o.year ?? null])).rows as Array<Record<string, unknown>>;
  if (!rows.length) return null;
  const totals = rows.filter(x => Number(x.category) === 0); const firm = totals.filter(x => Number(x.confidence) <= 2); const possible = totals.filter(x => Number(x.confidence) === 3);
  const years = [...new Set(firm.map(x => Number(x.year)))];
  return {
    scope: { kind: o.ufCode == null ? 'brasil' : 'uf', entityId: e.entityId, name: e.name }, total: { highAndConfirmed: aggregate(firm), possible: aggregate(possible) },
    byYear: years.map(year => ({ year, ...aggregate(firm.filter(x => Number(x.year) === year)) })),
    byCategory: rows.filter(x => Number(x.category) > 0).map(x => ({ year: Number(x.year), category: Number(x.category), categoryLabel: EDU_CATEGORY[Number(x.category)] ?? String(x.category), confidence: Number(x.confidence), confidenceLabel: EDU_CONFIDENCE_LABEL[Number(x.confidence)] ?? String(x.confidence), ...aggregate([x]) })),
    restrictions: EDU_CONTRACT_RESTRICTIONS, sources: EDU_CONTRACT_SOURCES, materialization: await educationAnalyticsFreshness(q),
  };
}

export interface EducationFinanceProfile {
  year: number;
  siconfiFunction12: Array<{ stage: string; entities: number; amount: number | null }>;
  siope: Array<{ component: number; code: string; stage: string; entities: number; amount: number | null }>;
  rule: 'SOURCES_AND_FINANCIAL_STAGES_MUST_NOT_BE_ADDED';
}
async function financeProfile(q: Q, e: Entity, year: number): Promise<EducationFinanceProfile> {
  if (year === 2025 && e.kind !== 4) {
    const scope = e.kind === 1 ? 1 : 3; const key = e.kind === 1 ? 'BRASIL' : String(e.ufCode).padStart(2, '0');
    const siconfi = (await q.query(`SELECT stage,entities,amount_cents amount FROM civica_exec.exec_edu_finance_rollup WHERE scope=$1 AND scope_key=$2 AND source='SICONFI' AND year=$3 ORDER BY stage`, [scope, key, year])).rows;
    const siope = (await q.query(`SELECT component,code,stage,entities,amount_cents amount FROM civica_exec.exec_edu_finance_rollup WHERE scope=$1 AND scope_key=$2 AND source='SIOPE' AND year=$3 ORDER BY component,code,stage`, [scope, key, year])).rows;
    return { year, siconfiFunction12: siconfi.map(x => ({ stage: String(x.stage), entities: Number(x.entities), amount: x.amount == null ? null : Number(x.amount) / 100 })), siope: siope.map(x => ({ component: Number(x.component), code: String(x.code), stage: String(x.stage), entities: Number(x.entities), amount: x.amount == null ? null : Number(x.amount) / 100 })), rule: 'SOURCES_AND_FINANCIAL_STAGES_MUST_NOT_BE_ADDED' };
  }
  const scope = e.kind === 1 ? 'TRUE' : e.kind === 3 ? 'x.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4 AND uf_code=$2)' : 'x.entity_id=$2';
  const args = e.kind === 1 ? [year] : [year, e.kind === 3 ? e.ufCode : e.entityId];
  const siconfi = (await q.query(`WITH x AS (SELECT f.entity_id,k.code stage,max(f.valor)::bigint amount FROM civica_exec.exec_fin_fact f
      JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30 AND c.code='12'
      JOIN civica_exec.exec_ref_code k ON k.ref_id=f.coluna_id AND k.domain=31 WHERE f.exercicio=$1 GROUP BY f.entity_id,k.code)
    SELECT stage,count(*)::int entities,sum(amount)::bigint amount FROM x WHERE ${scope} GROUP BY stage ORDER BY stage`, args)).rows;
  const siope = (await q.query(`WITH x AS (SELECT entity_id,componente,codigo,estagio,max(valor_cents)::bigint amount FROM civica_exec.exec_edu_siope_fact WHERE exercicio=$1 GROUP BY entity_id,componente,codigo,estagio)
      SELECT componente,codigo,estagio,count(*)::int entities,sum(amount)::bigint amount FROM x WHERE ${scope} GROUP BY componente,codigo,estagio ORDER BY componente,codigo,estagio`, args)).rows;
  return { year, siconfiFunction12: siconfi.map(x => ({ stage: String(x.stage), entities: Number(x.entities), amount: x.amount == null ? null : Number(x.amount) / 100 })), siope: siope.map(x => ({ component: Number(x.componente), code: String(x.codigo), stage: String(x.estagio), entities: Number(x.entities), amount: x.amount == null ? null : Number(x.amount) / 100 })), rule: 'SOURCES_AND_FINANCIAL_STAGES_MUST_NOT_BE_ADDED' };
}

export interface EducationProgramProfile { year: number; rows: Array<{ program: string; stage: string; facts: number; beneficiaries: number; amount: number }>; coverage: EducationCoverage }
async function programProfile(q: Q, e: Entity, year: number): Promise<EducationProgramProfile> {
  if (e.kind === 4) {
    const linked = (await q.query(`SELECT program_code,financial_stage,sum(rows)::int facts,sum(beneficiaries)::int beneficiaries,sum(amount_cents)::bigint amount
      FROM civica_exec.exec_edu_program_rollup WHERE scope=4 AND scope_key=$1 AND year=$2 GROUP BY program_code,financial_stage ORDER BY program_code,financial_stage`, [e.ibge7, year])).rows;
    return { year, rows: linked.map(x => ({ program: String(x.program_code), stage: String(x.financial_stage), facts: Number(x.facts), beneficiaries: Number(x.beneficiaries), amount: Number(x.amount) / 100 })), coverage: cov('programas_transferencias', linked.length ? 'PARTIAL' : 'NOT_COLLECTED', '2025', linked.length ? 'Portal vinculado por correspondência determinística auditada; 30 códigos permanecem sem vínculo' : 'Sem repasse municipal vinculado; ausência não significa zero') };
  }
  const scope = e.kind === 1 ? 1 : 3; const key = e.kind === 1 ? 'BRASIL' : String(e.ufCode).padStart(2, '0');
  const rows = (await q.query(`SELECT program_code,financial_stage,sum(rows)::int facts,sum(beneficiaries)::int beneficiaries,sum(amount_cents)::bigint amount
    FROM civica_exec.exec_edu_program_rollup WHERE scope=$1 AND scope_key=$2 AND year=$3 GROUP BY program_code,financial_stage ORDER BY program_code,financial_stage`, [scope, key, year])).rows;
  return { year, rows: rows.map(x => ({ program: String(x.program_code), stage: String(x.financial_stage), facts: Number(x.facts), beneficiaries: Number(x.beneficiaries), amount: Number(x.amount) / 100 })), coverage: cov('programas_transferencias', rows.length ? 'PARTIAL' : 'NOT_COLLECTED', '2025', 'Portal da Transparência: somente 2025; PDDE escolar: piloto de 10 escolas') };
}

export interface EducationWorksProfile { scope: 'BRASIL' | 'UF' | 'MUNICIPIO'; status: EducationCoverageStatus; observedWorks: number | null; observedCommittedAmount: number | null; coveredUfs: number[]; note: string }
async function worksProfile(q: Q, e: Entity): Promise<EducationWorksProfile> {
  const covered = (await q.query(`SELECT array_agg(DISTINCT uf ORDER BY uf) ufs FROM civica_exec.exec_edu_ctr_cov WHERE kind=4 AND rows_out>0`)).rows[0]?.ufs as number[] | null;
  const ufs = (covered ?? []).map(Number);
  if (e.kind === 4) return { scope: 'MUNICIPIO', status: 'NOT_APPLICABLE', observedWorks: null, observedCommittedAmount: null, coveredUfs: ufs, note: 'Obrasgov coletado não contém município/INEP; não atribuir obra à escola ou município.' };
  if (e.kind === 1) return { scope: 'BRASIL', status: 'PARTIAL', observedWorks: null, observedCommittedAmount: null, coveredUfs: ufs, note: 'Somente 9 UFs coletadas; o observado não é total nacional.' };
  const row = (await q.query(`SELECT count(*)::int n,sum(committed)::bigint committed FROM civica_exec.exec_edu_work WHERE uf=$1`, [e.ufCode])).rows[0];
  const available = ufs.includes(e.ufCode!);
  return { scope: 'UF', status: available ? 'AVAILABLE' : 'NOT_COLLECTED', observedWorks: available ? Number(row.n ?? 0) : null, observedCommittedAmount: available && row.committed != null ? Number(row.committed) / 100 : null, coveredUfs: ufs, note: 'Localização é a UF da obra; empenho não é pagamento; não há município ou escola.' };
}

export const EDUCATION_PRIVACY = {
  default: 'NEEDS_LEGAL_VALIDATION' as const,
  school: 'NEEDS_LEGAL_VALIDATION' as const,
  suppressedCells: 'NOT_PUBLICABLE' as const,
  aggregateContracts: 'PUBLIC_DISPLAY_WITH_CONDITIONS' as const,
  rule: 'P10.8 prepares internal contracts and does not authorize public publication.' as const,
};

export async function getEducationSchoolProfile(q: Q, inep: number) {
  const school = await getEducationSchool(q, inep); if (!school?.latest) return null;
  const year = school.latest.year;
  const [offer, infrastructure, indicators, ideb, flow, inse, pdde] = await Promise.all([
    getEducationSchoolOffer(q, inep), getEducationSchoolInfra(q, inep), getEducationSchoolIndicators(q, inep, { year }), getIdebSchool(q, inep), getFlowSchool(q, inep), getInseSchool(q, inep),
    q.query(`SELECT year,financial_stage,sum(amount_cents)::bigint amount,count(*)::int facts FROM civica_exec.exec_edu_program_fact WHERE school_inep=$1 GROUP BY year,financial_stage ORDER BY year,financial_stage`, [inep]),
  ]);
  const coverage: EducationCoverage[] = [
    cov('identidade_oferta', 'AVAILABLE', String(year), 'Censo Escolar por código INEP'), cov('infraestrutura', infrastructure?.years.length ? 'AVAILABLE' : 'NOT_COLLECTED', infrastructure?.latestYear ? String(infrastructure.latestYear) : null, 'Censo Escolar'),
    cov('docentes', indicators ? 'AVAILABLE' : 'NOT_PUBLISHED_BY_SOURCE', String(year), 'somente indicadores oficiais no nível escola'), cov('ideb', ideb?.rows.length ? 'AVAILABLE' : 'NOT_PUBLISHED_BY_SOURCE', ideb?.editions.at(-1)?.toString() ?? null, 'ausência não significa zero'),
    cov('saeb', 'NOT_PUBLISHED_BY_SOURCE', null, 'não existe Saeb escolar independente nas fontes coletadas'), cov('pdde_escola', pdde.rowCount ? 'PARTIAL' : 'NOT_COLLECTED', pdde.rows.at(-1)?.year?.toString() ?? null, 'somente vínculo oficial; coorte piloto de 10 escolas'),
    cov('pnae_pnate_escola', 'NOT_APPLICABLE', null, 'fonte coletada não permite atribuição à escola'), cov('contratos_obras_escola', 'NOT_APPLICABLE', null, 'sem chave INEP oficial'),
  ];
  return { scope: { kind: 'escola' as const, inep, name: school.latest.name, municipality: school.latest.municipality }, year, identity: school, offer, infrastructure, indicators, learning: { ideb, saeb: null, flow, inse }, resources: { pdde: pdde.rows.map(x => ({ year: Number(x.year), stage: String(x.financial_stage), amount: Number(x.amount) / 100, facts: Number(x.facts) })), pnae: null, pnate: null, contracts: null, works: null }, coverage, privacy: EDUCATION_PRIVACY };
}

interface TerritoryOptions { year?: number; includeSeries?: boolean }
async function schoolSummary(q: Q, e: Entity, year: number) {
  if (e.kind === 1) {
    const x = (await q.query(`SELECT sum(valid)::int registered,sum(active)::int active,sum(with_mat)::int with_enrollment,sum(univ)::int sinopse_universe FROM civica_exec.exec_edu_cov WHERE year=$1`, [year])).rows[0]!;
    return { year, registered: Number(x.registered), active: Number(x.active), withEnrollment: Number(x.with_enrollment), sinopseUniverse: Number(x.sinopse_universe) };
  }
  const x = e.kind === 3 ? await getEducationStateSchools(q, e.ufCode!, { year, listSchools: false }) : await getEducationMunicipalitySchools(q, e.ibge7!, { year, pageSize: 1 });
  return x ? { year, ...x.counts } : null;
}
async function territoryProfile(q: Q, key: { ufCode?: number; ibge7?: string }, o: TerritoryOptions = {}) {
  const e = await entityOf(q, key); if (!e) return null; const year = o.year ?? 2025; const series = o.includeSeries ?? false;
  const learnKey = e.kind === 1 ? {} : e.kind === 3 ? { ufCode: e.ufCode! } : { ibge7: e.ibge7! };
  const [schools, offer, infrastructure, indicators, teachers, ideb, saeb, flow, transition, inse, finance, programs, contracts, works] = await Promise.all([
    schoolSummary(q, e, year), e.kind === 4 ? getEducationMunicipalityOffer(q, e.ibge7!, { year, series }) : getEducationNationalOffer(q, e.kind === 3 ? { year, ufCode: e.ufCode! } : { year }),
    e.kind === 4 ? getEducationMunicipalityInfra(q, e.ibge7!, { year, series }) : getEducationNationalInfra(q, e.kind === 3 ? { year, ufCode: e.ufCode!, series } : { year, series }),
    getEducationTerritoryIndicators(q, { ...learnKey, year, series }), getEducationTeachers(q, { ...learnKey, year }), getIdebTerritory(q, learnKey), getSaebTerritory(q, learnKey), getFlowTerritory(q, { ...learnKey, year }), getTransitionTerritory(q, learnKey), getInseTerritory(q, learnKey),
    financeProfile(q, e, year), programProfile(q, e, year), getEducationContractSummary(q, { ...key, year }), worksProfile(q, e),
  ]);
  const coverage: EducationCoverage[] = [
    cov('escolas_oferta', schools && offer ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE', String(year), 'Censo Escolar nacional 2007-2025'), cov('infraestrutura', infrastructure ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE', String(year), 'variáveis respeitam vigência e não informado'),
    cov('docentes', teachers ? 'AVAILABLE' : 'NOT_PUBLISHED_BY_SOURCE', String(year), 'docentes distintos oficiais; nunca soma de escolas'), cov('aprendizagem_fluxo', ideb || saeb || flow ? 'AVAILABLE' : 'NOT_PUBLISHED_BY_SOURCE', String(year), 'agregados oficiais, supressões preservadas'),
    cov('financiamento', finance.siconfiFunction12.length || finance.siope.length ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE', String(year), 'Siconfi e SIOPE separados'), programs.coverage,
    cov('contratacoes', contracts ? 'PARTIAL' : 'NOT_COLLECTED', String(year), 'adoção gradual do PNCP; POSSIBLE separado'), cov('obras', works.status, '2026', works.note),
  ];
  const oneEdition = <T extends { editions: number[]; rows: Array<{ year: number }> }>(x: T | null): T | null => {
    if (!x || series) return x; const selected = x.editions.filter(y => y <= year).at(-1); return selected == null ? { ...x, editions: [], rows: [] } : { ...x, editions: [selected], rows: x.rows.filter(r => r.year === selected) };
  };
  const learning = { ideb: oneEdition(ideb), saeb: oneEdition(saeb), flow: flow && !series ? { ...flow, series: [] } : flow, transition: transition && !series ? { ...transition, series: [] } : transition, inse: oneEdition(inse) };
  const teacherSnapshot = teachers && !series ? { ...teachers, series: [] } : teachers;
  return { scope: { kind: e.kind === 1 ? 'brasil' as const : e.kind === 3 ? 'uf' as const : 'municipio' as const, entityId: e.entityId, name: e.name, ufCode: e.ufCode, ibge7: e.ibge7 }, year, schools, offer, infrastructure, indicators, teachers: teacherSnapshot, learning, finance, programs, procurement: { contracts, works }, coverage, privacy: EDUCATION_PRIVACY };
}

export const getEducationMunicipalityProfile = (q: Q, ibge7: string, o: TerritoryOptions = {}) => territoryProfile(q, { ibge7 }, o);
export const getEducationStateProfile = (q: Q, ufCode: number, o: TerritoryOptions = {}) => territoryProfile(q, { ufCode }, o);
export const getEducationNationalProfile = (q: Q, o: TerritoryOptions = {}) => territoryProfile(q, {}, o);

export interface EducationBenchmarkDimension { indicator: string; year: number; unit: string; network: number | null; stage: number | null; financialStage: string | null; universe: string }
export const sameEducationBenchmarkDimension = (a: EducationBenchmarkDimension, b: EducationBenchmarkDimension): boolean => a.indicator === b.indicator && a.year === b.year && a.unit === b.unit && a.network === b.network && a.stage === b.stage && a.financialStage === b.financialStage && a.universe === b.universe;

export async function getEducationMunicipalityBenchmarks(q: Q, ibge7: string, o: { year?: number; stage?: number; network?: number } = {}) {
  const e = await entityOf(q, { ibge7 }); if (!e) return null; const year = o.year ?? 2025; const stage = o.stage ?? 1; const network = o.network ?? 3;
  const peers = (await q.query(`WITH offer AS (
      SELECT y.entity_id,sum(o.mat_bas)::bigint enrollments,count(*)::int schools FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING (inep,year) WHERE y.year=$2 GROUP BY y.entity_id
    ), target AS (SELECT * FROM offer WHERE entity_id=$1)
    SELECT e.ibge7::text,e.name,e.uf,o.enrollments,o.schools,abs(ln(greatest(o.enrollments,1)::numeric)-ln(greatest(t.enrollments,1)::numeric)) distance
    FROM offer o JOIN target t ON true JOIN civica_exec.exec_entity e ON e.entity_id=o.entity_id
    WHERE e.kind=4 AND e.uf_code=$3 AND o.entity_id<>$1 AND o.enrollments BETWEEN greatest(1,t.enrollments/2) AND t.enrollments*2
    ORDER BY distance,e.ibge7 LIMIT 20`, [e.entityId, year, e.ufCode])).rows;
  const key = { ibge7 }; const ufKey = { ufCode: e.ufCode! };
  const [mOffer, uOffer, bOffer, mInfra, uInfra, bInfra, mIdeb, uIdeb, bIdeb] = await Promise.all([
    getEducationMunicipalityOffer(q, ibge7, { year, series: false }), getEducationNationalOffer(q, { year, ufCode: e.ufCode! }), getEducationNationalOffer(q, { year }),
    getEducationMunicipalityInfra(q, ibge7, { year, series: false }), getEducationNationalInfra(q, { year, ufCode: e.ufCode!, series: false }), getEducationNationalInfra(q, { year, series: false }),
    getIdebTerritory(q, { ...key, stage, dep: network }), getIdebTerritory(q, { ...ufKey, stage, dep: network }), getIdebTerritory(q, { stage, dep: network }),
  ]);
  const infra = (x: EducationInfra | null, code: string) => x?.itens.find(i => i.code === code)?.pct ?? null;
  const ideb = (x: Awaited<ReturnType<typeof getIdebTerritory>>) => x?.rows.find(r => r.year === year)?.values.ideb ?? null;
  const dimensions: Record<string, EducationBenchmarkDimension> = {
    enrollments: { indicator: 'edu.enrollment.total', year, unit: 'matrículas', network: null, stage: null, financialStage: null, universe: 'escolas localizadas no território' },
    internet: { indicator: 'edu.infra.internet', year, unit: '%', network: null, stage: null, financialStage: null, universe: 'escolas com resposta válida' },
    ideb: { indicator: 'edu.learning.ideb', year, unit: 'índice', network, stage, financialStage: null, universe: 'resultado oficial publicado' },
  };
  return { scope: { ibge7, entityId: e.entityId, name: e.name, ufCode: e.ufCode }, year, peerMethod: { basis: 'same UF and enrollment between 0.5x and 2x target; ordered by absolute log-distance', descriptiveOnly: true, minimumNotGuaranteed: true }, peers: peers.map(x => ({ ibge7: String(x.ibge7), name: String(x.name), uf: String(x.uf), enrollments: Number(x.enrollments), schools: Number(x.schools), distance: Number(x.distance) })), comparisons: [
    { dimension: dimensions.enrollments!, municipality: mOffer?.totals.matriculas ?? null, state: uOffer?.totals.matriculas ?? null, brazil: bOffer?.totals.matriculas ?? null },
    { dimension: dimensions.internet!, municipality: infra(mInfra, 'internet'), state: infra(uInfra, 'internet'), brazil: infra(bInfra, 'internet') },
    { dimension: dimensions.ideb!, municipality: ideb(mIdeb), state: ideb(uIdeb), brazil: ideb(bIdeb) },
  ], restrictions: ['Não é ranking nem índice único.', 'Comparações exigem exatamente a mesma dimensão; NULL e supressão não viram zero.', 'Proximidade territorial, sozinha, não define similaridade.'] };
}

export const safeEducationRatio = (numerator: number | null, denominator: number | null): number | null => numerator == null || denominator == null || denominator <= 0 ? null : Math.round(numerator / denominator * 100) / 100;
export async function getEducationAnalyticalRelations(q: Q, ibge7: string, year = 2025) {
  const p = await getEducationMunicipalityProfile(q, ibge7, { year, includeSeries: false }); if (!p) return null;
  const enrollments = p.offer?.totals.matriculas ?? null; const internet = p.infrastructure?.itens.find(x => x.code === 'internet')?.pct ?? null;
  const ideb = p.learning.ideb?.rows.find(x => x.year === year && x.stage === 1 && x.dep === 3)?.values.ideb ?? null;
  const paid = p.finance.siconfiFunction12.find(x => x.stage === 'PAG')?.amount ?? null;
  const transferred = p.programs.rows.filter(x => x.stage === 'TRANSFERRED').reduce((s, x) => s + x.amount, 0) || null;
  const contracted = p.procurement.contracts?.total.highAndConfirmed.contractedValue ?? null;
  return { scope: p.scope, year, interpretation: 'DESCRIPTIVE_ASSOCIATION_ONLY' as const, relations: [
    { id: 'enrollment_infrastructure', left: { indicator: 'edu.enrollment.total', value: enrollments }, right: { indicator: 'edu.infra.internet', value: internet }, derived: null, caveat: 'Contexto lado a lado; não estima efeito causal.' },
    { id: 'infrastructure_learning', left: { indicator: 'edu.infra.internet', value: internet }, right: { indicator: 'edu.learning.ideb', value: ideb }, derived: null, caveat: 'Mesmo exercício quando disponível; participação/supressão do Ideb preservada.' },
    { id: 'finance_per_enrollment', left: { indicator: 'edu.finance.siconfi_pag', value: paid }, right: { indicator: 'edu.enrollment.total', value: enrollments }, derived: safeEducationRatio(paid, enrollments), caveat: 'R$/matrícula, não custo por aluno; matrícula não é aluno único.' },
    { id: 'transfers_per_enrollment', left: { indicator: 'edu.program.transferred', value: transferred }, right: { indicator: 'edu.enrollment.total', value: enrollments }, derived: year === 2025 ? safeEducationRatio(transferred, enrollments) : null, caveat: 'Somente 2025 e mesmo estágio; não atribuir às escolas.' },
    { id: 'contracts_per_enrollment', left: { indicator: 'edu.contract.value', value: contracted }, right: { indicator: 'edu.enrollment.total', value: enrollments }, derived: safeEducationRatio(contracted, enrollments), caveat: 'Valor contratado, não pago; órgão contratante, não local da obra.' },
  ] };
}
