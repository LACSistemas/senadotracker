import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';

/**
 * Crime organizado, narcotráfico e atuação do Estado (P9.7): camada de LEITURA sobre indicadores já publicados (VDE/Sinesp da P9.1, ISP-RJ/SSP-RS/SSP-SP da P9.6).
 * Nenhum indicador novo foi criado: o registro abaixo aponta ids EXISTENTES por código de família estável (texto), nunca por posição. Os ids de P9.1 e P9.6 não são renumerados.
 *
 * O que as medidas SÃO: atividade policial/registro oficial. O que NÃO são: prova de organização criminosa, de facção, de controle territorial, nem culpa.
 * Somas: só dentro do MESMO indicador e de partições mutuamente exclusivas (UF → Brasil). Nunca entre fontes, abrangências (Estadual × PF/PRF), unidades ou famílias.
 */
type Q = Pick<Pool, 'query'>;
export type OcMeasure = 'ocorrencias' | 'registros_caso' | 'registros_bo' | 'peso_informado' | 'armas' | 'mandados' | 'autores' | 'casos';
export interface OcIndicator {
  indicatorId: number; source: 'VDE' | 'ISP-RJ' | 'SSP-RS' | 'SSP-SP'; /** UF da fonte estadual; null para o VDE (27 UFs) */ ufCode: number | null;
  abrangencia: 'Estadual' | 'PF' | 'PF/PRF' | 'Estadual (fonte única)'; measure: OcMeasure; unit: string; level: 'uf' | 'municipio'; note?: string;
}
export interface OcFamily { code: string; label: string; semantics: string; indicators: OcIndicator[] }
const VDE_UNIT_WEIGHT = 'peso informado (unidade do arquivo; compatível com kg em conferência por imprensa, não declarada pela fonte)';
export const OC_FAMILIES: OcFamily[] = [
  { code: 'OC.DRUG.TRAFFICKING_RECORDS', label: 'Registros de tráfico de drogas', semantics: 'Registros policiais com título de tráfico: refletem atividade policial. Não provam organização criminosa.', indicators: [
    { indicatorId: 3116, source: 'VDE', ufCode: null, abrangencia: 'Estadual', measure: 'ocorrencias', unit: 'ocorrências', level: 'uf' },
    { indicatorId: 3117, source: 'VDE', ufCode: null, abrangencia: 'PF/PRF', measure: 'ocorrencias', unit: 'ocorrências', level: 'uf', note: 'Pode se sobrepor ao registro estadual do mesmo fato.' },
    { indicatorId: 8042, source: 'ISP-RJ', ufCode: 33, abrangencia: 'Estadual (fonte única)', measure: 'registros_caso', unit: 'casos (registros)', level: 'municipio' },
    { indicatorId: 8315, source: 'SSP-RS', ufCode: 43, abrangencia: 'Estadual (fonte única)', measure: 'ocorrencias', unit: 'ocorrências', level: 'municipio' },
    { indicatorId: 8720, source: 'SSP-SP', ufCode: 35, abrangencia: 'Estadual (fonte única)', measure: 'registros_bo', unit: 'B.O.', level: 'municipio' },
  ] },
  { code: 'OC.DRUG.POSSESSION_RECORDS', label: 'Registros de posse/porte de drogas', semantics: 'Uso/porte: universo distinto do tráfico; nunca somar com tráfico.', indicators: [
    { indicatorId: 8041, source: 'ISP-RJ', ufCode: 33, abrangencia: 'Estadual (fonte única)', measure: 'registros_caso', unit: 'casos (registros)', level: 'municipio' },
    { indicatorId: 8314, source: 'SSP-RS', ufCode: 43, abrangencia: 'Estadual (fonte única)', measure: 'ocorrencias', unit: 'ocorrências', level: 'municipio' },
    { indicatorId: 8721, source: 'SSP-SP', ufCode: 35, abrangencia: 'Estadual (fonte única)', measure: 'registros_bo', unit: 'B.O.', level: 'municipio' },
  ] },
  { code: 'OC.DRUG.SEIZURE_EVENTS', label: 'Registros de apreensão de drogas (contagem de eventos)', semantics: 'Número de registros de apreensão, NÃO a quantidade apreendida.', indicators: [
    { indicatorId: 8040, source: 'ISP-RJ', ufCode: 33, abrangencia: 'Estadual (fonte única)', measure: 'registros_caso', unit: 'casos (registros)', level: 'municipio', note: 'Aglutina os títulos de uso/porte, tráfico e apreensão sem autor: não somar com posse/tráfico do RJ.' },
    { indicatorId: 8722, source: 'SSP-SP', ufCode: 35, abrangencia: 'Estadual (fonte única)', measure: 'registros_bo', unit: 'B.O.', level: 'municipio' },
  ] },
  { code: 'OC.DRUG.SEIZED_MASS_COCAINE', label: 'Cocaína apreendida (peso informado)', semantics: 'Massa apreendida informada ao Sinesp. Estadual e PF/PRF podem se sobrepor: nunca somar as duas séries.', indicators: [
    { indicatorId: 3124, source: 'VDE', ufCode: null, abrangencia: 'Estadual', measure: 'peso_informado', unit: VDE_UNIT_WEIGHT, level: 'uf' },
    { indicatorId: 3125, source: 'VDE', ufCode: null, abrangencia: 'PF/PRF', measure: 'peso_informado', unit: VDE_UNIT_WEIGHT, level: 'uf' },
  ] },
  { code: 'OC.DRUG.SEIZED_MASS_MARIJUANA', label: 'Maconha apreendida (peso informado)', semantics: 'Massa apreendida informada ao Sinesp. Estadual e PF/PRF podem se sobrepor: nunca somar as duas séries.', indicators: [
    { indicatorId: 3126, source: 'VDE', ufCode: null, abrangencia: 'Estadual', measure: 'peso_informado', unit: VDE_UNIT_WEIGHT, level: 'uf' },
    { indicatorId: 3127, source: 'VDE', ufCode: null, abrangencia: 'PF/PRF', measure: 'peso_informado', unit: VDE_UNIT_WEIGHT, level: 'uf' },
  ] },
  { code: 'OC.WEAPON.FIREARMS_SEIZED', label: 'Armas de fogo apreendidas', semantics: 'Armas apreendidas (soma de todos os tipos informados). Não inclui recolhimento administrativo, entrega voluntária, posse ou porte.', indicators: [
    { indicatorId: 3122, source: 'VDE', ufCode: null, abrangencia: 'Estadual', measure: 'armas', unit: 'armas', level: 'uf' },
    { indicatorId: 3123, source: 'VDE', ufCode: null, abrangencia: 'PF/PRF', measure: 'armas', unit: 'armas', level: 'uf', note: 'Pode se sobrepor ao registro estadual.' },
  ] },
  { code: 'OC.WEAPON.OFFENSE_RECORDS', label: 'Registros de delitos com armas', semantics: 'Ocorrências/B.O. de delitos relacionados a armas (porte ilegal e afins): não é arma apreendida.', indicators: [
    { indicatorId: 8313, source: 'SSP-RS', ufCode: 43, abrangencia: 'Estadual (fonte única)', measure: 'ocorrencias', unit: 'ocorrências', level: 'municipio', note: 'Delitos relacionados a armas e munições.' },
    { indicatorId: 8723, source: 'SSP-SP', ufCode: 35, abrangencia: 'Estadual (fonte única)', measure: 'registros_bo', unit: 'B.O.', level: 'municipio', note: 'Porte de arma.' },
  ] },
  { code: 'OC.ENFORCEMENT.ARREST_WARRANTS_SERVED', label: 'Mandados de prisão cumpridos', semantics: 'Ato processual cumprido: não comprova culpa nem vínculo com organização criminosa.', indicators: [
    { indicatorId: 3112, source: 'VDE', ufCode: null, abrangencia: 'Estadual', measure: 'mandados', unit: 'mandados cumpridos', level: 'municipio' },
    { indicatorId: 3113, source: 'VDE', ufCode: null, abrangencia: 'PF/PRF', measure: 'mandados', unit: 'mandados cumpridos', level: 'municipio', note: 'Pode se sobrepor ao registro estadual.' },
    { indicatorId: 8047, source: 'ISP-RJ', ufCode: 33, abrangencia: 'Estadual (fonte única)', measure: 'autores', unit: 'autores', level: 'municipio', note: 'Cumprimento de mandado de prisão (ISP-RJ); medida distinta da do VDE.' },
  ] },
  { code: 'OC.ENFORCEMENT.FLAGRANT_ARRESTS', label: 'Autos de prisão em flagrante', semantics: 'Prisão em flagrante registrada: não é condenação nem prova de organização criminosa.', indicators: [
    { indicatorId: 8045, source: 'ISP-RJ', ufCode: 33, abrangencia: 'Estadual (fonte única)', measure: 'autores', unit: 'autores', level: 'municipio' },
  ] },
];
export const OC_BY_INDICATOR = new Map(OC_FAMILIES.flatMap(f => f.indicators.map(i => [i.indicatorId, { family: f, ind: i }] as const)));
export const OC_RESTRICTIONS = [
  'Atividade policial registrada ≠ organização criminosa: nenhuma destas medidas prova facção, controle territorial, rota ou estrutura de comando.',
  'Apreensão ≠ prisão ≠ operação ≠ investigação ≠ condenação: cada medida tem unidade e universo próprios e nunca se soma às demais.',
  'Estadual e PF/PRF (VDE) podem registrar o mesmo fato: as séries são mostradas separadas, nunca somadas.',
  'Massa apreendida (peso informado) não é número de apreensões. O VDE não declara a unidade do peso; não há conversão.',
  'Entre fontes estaduais (RJ, RS, SP) não há equivalência oficial comprovada: não comparar nem somar.',
  'Ausência de linha é ausência, nunca zero; zero do VDE pode ser zero reportado ou ausência de relato.',
  'Município com registro é local do registro, não território de organização criminosa. Atividade federal não é atribuída ao município sede de unidade policial.',
];
export const OC_NOT_AVAILABLE = [
  'Operações policiais: sem série nacional oficial estruturada e com unidade de evento comprovada (apenas PF/DAMAZ-2024 e notícias): não publicadas.',
  'Lavagem de dinheiro e comunicações financeiras (COAF): só totais nacionais em relatório anual; sem recorte territorial utilizável: não publicadas.',
  'Organizações criminosas por território: não existe fonte oficial pública estruturada; nenhum mapa, nem inferência.',
];
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

export interface OcPoint { period: string; value: number | null; preliminary: boolean }
export interface OcSeries { family: string; indicatorId: number; source: OcIndicator['source']; abrangencia: OcIndicator['abrangencia']; measure: OcMeasure; unit: string; level: OcIndicator['level']; note: string | null; points: OcPoint[]; first: string | null; last: string | null }
export interface OcPayload { scope: 'brasil' | 'uf' | 'municipio'; entityId: number | null; families: Array<{ code: string; label: string; semantics: string; series: OcSeries[] }>; restrictions: string[]; notAvailable: string[] }
const shell = (scope: OcPayload['scope'], entityId: number | null, series: OcSeries[]): OcPayload => ({
  scope, entityId, restrictions: OC_RESTRICTIONS, notAvailable: OC_NOT_AVAILABLE,
  families: OC_FAMILIES.map(f => ({ code: f.code, label: f.label, semantics: f.semantics, series: series.filter(s => s.family === f.code) })).filter(f => f.series.length),
});
const seriesFrom = (rows: Array<{ indicator_id: number; p: unknown; value: number | null; flags: number }>, wanted: Set<number>): OcSeries[] => {
  const by = new Map<number, OcSeries>();
  for (const r of rows) {
    const reg = OC_BY_INDICATOR.get(Number(r.indicator_id)); if (!reg || !wanted.has(reg.ind.indicatorId)) continue;
    let s = by.get(reg.ind.indicatorId); if (!s) { s = { family: reg.family.code, indicatorId: reg.ind.indicatorId, source: reg.ind.source, abrangencia: reg.ind.abrangencia, measure: reg.ind.measure, unit: reg.ind.unit, level: reg.ind.level, note: reg.ind.note ?? null, points: [], first: null, last: null }; by.set(reg.ind.indicatorId, s); }
    const p = iso(r.p).slice(0, 7); s.points.push({ period: p, value: r.value == null ? null : Number(r.value), preliminary: (Number(r.flags) & FLAG.preliminary) !== 0 }); s.first ??= p; s.last = p;
  }
  return [...by.values()];
};
const idsFor = (ufCode: number | null, level: 'uf' | 'municipio'): Set<number> => new Set([...OC_BY_INDICATOR.values()].filter(x => (x.ind.ufCode === null || x.ind.ufCode === ufCode) && (level === 'uf' || x.ind.level === 'municipio')).map(x => x.ind.indicatorId));
async function entitySeries(q: Q, entityId: number, ids: Set<number>): Promise<OcSeries[]> {
  if (!ids.size) return [];
  const r = await q.query(`SELECT indicator_id, period_start AS p, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [entityId, [...ids]]);
  return seriesFrom(r.rows, ids);
}
/** UF: séries mensais do VDE (Estadual e PF/PRF, separadas) e da fonte estadual da UF, quando publicada. */
export const getOrganizedCrimeState = async (q: Q, ufCode: number): Promise<OcPayload> => shell('uf', ufCode, await entitySeries(q, ufCode, idsFor(ufCode, 'uf')));
/** Município (ibge7): só indicadores com município na fonte (mandados do VDE e fontes estaduais municipalizadas). Sem fonte → payload vazio (ausência, não zero). */
export const getOrganizedCrimeMunicipality = async (q: Q, ibge7: number): Promise<OcPayload> => shell('municipio', ibge7, await entitySeries(q, ibge7, idsFor(Math.floor(ibge7 / 100000), 'municipio')));
export interface OcNationalYear { year: number; value: number; ufsWithData: number; complete: boolean }
export interface OcNationalSeries extends Omit<OcSeries, 'points' | 'first' | 'last'> { years: OcNationalYear[]; aggregation: string }
/**
 * Brasil: só para indicadores do VDE (27 UFs, mesma fonte e mesma abrangência). Σ das UFs de um MESMO indicador por ano civil; `complete` = 27 UFs × 12 meses com valor.
 * Estadual e PF/PRF nunca se somam; fontes estaduais municipalizadas (RJ, RS, SP) não têm total nacional.
 */
export async function getOrganizedCrimeNational(q: Q): Promise<{ scope: 'brasil'; series: OcNationalSeries[]; families: Array<{ code: string; label: string; semantics: string }>; restrictions: string[]; notAvailable: string[]; stateSourcesOnly: Array<{ family: string; indicatorId: number; source: string; ufCode: number | null }> }> {
  const vde = [...OC_BY_INDICATOR.values()].filter(x => x.ind.source === 'VDE'); const ids = vde.map(x => x.ind.indicatorId);
  const r = await q.query(`SELECT v.indicator_id, extract(year FROM v.period_start)::int AS y, sum(v.value) AS total, count(DISTINCT e.entity_id)::int AS ufs, count(*)::int AS cells
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 3 AND v.indicator_id = ANY($1::smallint[]) AND v.value IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2`, [ids]);
  const series: OcNationalSeries[] = vde.map(x => ({
    family: x.family.code, indicatorId: x.ind.indicatorId, source: x.ind.source, abrangencia: x.ind.abrangencia, measure: x.ind.measure, unit: x.ind.unit, level: x.ind.level, note: x.ind.note ?? null,
    aggregation: 'Σ das UFs do mesmo indicador (partições exclusivas); não soma Estadual com PF/PRF',
    years: r.rows.filter(y => Number(y.indicator_id) === x.ind.indicatorId).map(y => ({ year: Number(y.y), value: Number(y.total), ufsWithData: Number(y.ufs), complete: Number(y.ufs) === 27 && Number(y.cells) === 27 * 12 })),
  }));
  return { scope: 'brasil', series, families: OC_FAMILIES.map(f => ({ code: f.code, label: f.label, semantics: f.semantics })), restrictions: OC_RESTRICTIONS, notAvailable: OC_NOT_AVAILABLE,
    stateSourcesOnly: [...OC_BY_INDICATOR.values()].filter(x => x.ind.source !== 'VDE').map(x => ({ family: x.family.code, indicatorId: x.ind.indicatorId, source: x.ind.source, ufCode: x.ind.ufCode })) };
}
