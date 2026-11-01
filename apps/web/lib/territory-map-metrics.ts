import type { MapMetric } from '@/components/territory/territory-ui';
import type { MapRampName } from '@/lib/scale';

/** Registro único de métricas do mapa estadual/Atlas Vivo — compartilhado entre `/estados/[uf]` e
 * `/estados/[uf]/atlas` para as duas páginas nunca divergirem sobre o que `?mapa=` significa.
 * Cada `code` é um indicador JÁ publicado em `civica_exec.exec_ind_def` (mesma `getMapValues` que o
 * produto usa desde P14) — nenhuma coleta nem indicador novo foi criado para o mapa (P3). */
export interface MapMetricDef extends MapMetric { code: string | null; short: string; ramp: MapRampName; domain: string }

export const MAP_METRICS: Record<string, MapMetricDef> = {
  populacao: { key: 'populacao', short: 'População', code: null, label: 'população', unit: 'hab.', digits: 0, ramp: 'teal', domain: 'Território' },
  leitos: { key: 'leitos', short: 'Leitos por mil hab.', code: 'IND-SAU-05', label: 'leitos hospitalares por 1.000 habitantes', unit: 'leitos/1.000 hab.', digits: 2, ramp: 'blue', domain: 'Saúde' },
  mortalidade: { key: 'mortalidade', short: 'Mortalidade infantil', code: 'IND-SAU-08', label: 'mortalidade infantil', unit: 'óbitos/1.000 nascidos', digits: 1, ramp: 'amber', domain: 'Saúde' },
  homicidios: { key: 'homicidios', short: 'Homicídios (taxa)', code: 'IND-SEG-VDE-HOMICIDIO-DOLOSO-TAXA', label: 'taxa de homicídio doloso', unit: 'por 100 mil hab.', digits: 1, ramp: 'rose', domain: 'Segurança' },
  renda: { key: 'renda', short: 'Renda domiciliar (mediana)', code: 'WB-INC-RDPC-MEDIAN', label: 'renda domiciliar per capita mediana', unit: 'R$/mês', digits: 0, ramp: 'violet', domain: 'Bem-estar' },
  saneamento: { key: 'saneamento', short: 'Esgotamento sanitário', code: 'WB-HOUSING-SEWER', label: 'domicílios com esgotamento sanitário adequado', unit: '%', digits: 1, ramp: 'cyan', domain: 'Infraestrutura' },
};

export const DEFAULT_MAP_METRIC = 'populacao';
export function mapMetricFor(key: string | undefined): MapMetricDef { return MAP_METRICS[key ?? DEFAULT_MAP_METRIC] ?? MAP_METRICS[DEFAULT_MAP_METRIC]!; }

/** Monta os dois mapas que `MunicipalMap`/`AtlasVivo`/`MapTable` consomem a partir da mesma consulta já
 * existente (`loadMapValues`/população). `smallN`(1)/`suppressed`(8)/`noDenominator`(64) nunca colorem o
 * mapa — mesma régua que o produto já aplicava antes de P3, agora compartilhada em vez de duplicada por
 * página. `flags` é devolvido à parte (mesmo para valores excluídos) para a legenda/tooltip poderem
 * explicar a ausência em vez de só mostrar "sem dado". */
const HIDE_FLAGS = 1 | 8 | 64;
/** `year`: ano do `period_start` já devolvido por `getMapValues` (nenhuma consulta nova — só passou a ser
 * lido). Representativo, não por município: todas as linhas de um mesmo indicador/UF compartilham a
 * mesma competência neste schema ("latest"), daí usar a primeira linha com valor elegível. `null` para
 * população (sem `metric.code`, sem `period_start` nesta função) — quem consome decide o rótulo nesse caso. */
export function buildMapValueMaps(metric: MapMetricDef, munis: Array<{ entityId: number; population: number | null }>, raw: Array<{ entityId: number; value: number | null; flags: number; periodStart?: string }>) {
  const values = new Map<number, number>(); const flags = new Map<number, number>();
  let year: string | null = null;
  if (metric.code) {
    for (const r of raw) {
      if (r.value === null) continue;
      flags.set(r.entityId, r.flags);
      if (!(r.flags & HIDE_FLAGS)) { values.set(r.entityId, r.value); if (!year && r.periodStart) year = r.periodStart.slice(0, 4); }
    }
  } else {
    for (const m of munis) if (m.population !== null) values.set(m.entityId, m.population);
  }
  return { values, flags, year };
}
