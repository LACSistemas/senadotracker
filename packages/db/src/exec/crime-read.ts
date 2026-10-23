import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';
import { CRIME_DEF_BY_ID, CRIME_SOURCES, crimeIdsOf, type CrimeDef } from './crime-defs.ts';

/**
 * Contratos de leitura da criminalidade estadual municipalizada (P9.6) para a futura página de Segurança. Somente SELECT; cada função faz UMA consulta por (entidade × indicadores da fonte da UF):
 * nada é somado entre fontes, entre naturezas ou entre composto e componentes, e ausência de linha nunca vira zero.
 */
type Q = Pick<Pool, 'query'>;
export type CrimeStatus = 'reported' | 'suppressed' | 'zero_declared_ambiguous';
export interface CrimePoint { month: string; value: number | null; status: CrimeStatus; preliminary: boolean }
export interface CrimeSeries {
  indicatorId: number; code: string; label: string; unit: CrimeDef['unit']; group: CrimeDef['group']; canonical: string | null; composite: string[] | null; comparability: CrimeDef['comparability']; sensitive: boolean;
  note: string; points: CrimePoint[]; first: string | null; last: string | null;
}
export interface StateCrimePayload { entityId: number; source: { key: string; name: string } | null; series: CrimeSeries[]; restrictions: string[]; coverage: { months: number; first: string | null; last: string | null } }
export const CRIME_RESTRICTIONS = [
  'Registro policial divulgado pela secretaria estadual: não é condenação, não é óbito do SIM e não equivale ao VDE do Sinesp.',
  'Vítimas, ocorrências/casos, autores e adolescentes são unidades diferentes e nunca se somam; indicador composto não se soma a seus componentes.',
  'Estados não são comparáveis sem equivalência oficial comprovada: rótulo parecido não basta (campo comparability).',
  'Município-mês sem linha é ausência, nunca zero. Só fontes com grade completa (zero declarado) trazem zero; células sensíveis pequenas aparecem suprimidas.',
  'Mês corrente ou último mês publicado é preliminar. Delegacia, área policial ou Região Administrativa não são municípios.',
];
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
function statusOf(value: number | null, flags: number): CrimeStatus { if (value == null && (flags & FLAG.suppressed)) return 'suppressed'; if (flags & FLAG.zeroAmbiguous) return 'zero_declared_ambiguous'; return 'reported'; }
async function load(q: Q, entityId: number, sourceUf: number): Promise<StateCrimePayload> {
  const src = CRIME_SOURCES.find(s => s.ufCode === sourceUf) ?? null; const ids = src ? crimeIdsOf(src.slot) : [];
  const byId = new Map<number, CrimeSeries>();
  if (ids.length) {
    const r = await q.query(`SELECT indicator_id, period_start, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [entityId, ids]);
    for (const x of r.rows) {
      const d = CRIME_DEF_BY_ID.get(Number(x.indicator_id)); if (!d) continue; const flags = Number(x.flags);
      let s = byId.get(d.id); if (!s) { s = { indicatorId: d.id, code: d.code, label: d.label, unit: d.unit, group: d.group, canonical: d.canonical, composite: d.composite, comparability: d.comparability, sensitive: d.sensitive, note: d.note, points: [], first: null, last: null }; byId.set(d.id, s); }
      const value = x.value == null ? null : Number(x.value); const month = iso(x.period_start).slice(0, 7);
      s.points.push({ month, value, status: statusOf(value, flags), preliminary: (flags & FLAG.preliminary) !== 0 }); s.first ??= month; s.last = month;
    }
  }
  const series = [...byId.values()]; const all = series.flatMap(s => s.points.map(p => p.month)).sort();
  return { entityId, source: src ? { key: src.key, name: src.name } : null, series, restrictions: CRIME_RESTRICTIONS, coverage: { months: new Set(all).size, first: all[0] ?? null, last: all.at(-1) ?? null } };
}
/** Totais da UF (entidade = código IBGE de 2 dígitos). UF sem fonte implementada devolve série vazia e `source: null`. */
export const getStateCrimeState = (q: Q, ufCode: number): Promise<StateCrimePayload> => load(q, ufCode, ufCode);
/** Município (ibge7): a fonte é a da UF do município. Município sem linha na fonte devolve série vazia (ausência, não zero). */
export const getStateCrimeMunicipality = (q: Q, ibge7: number): Promise<StateCrimePayload> => load(q, ibge7, Math.floor(ibge7 / 100000));
