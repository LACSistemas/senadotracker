/**
 * Catálogo editorial de Infraestrutura — confirmado contra `civica_exec.exec_ind_def`/`exec_infra_editorial_catalog`
 * reais (108 indicadores, domínios 5/6/13). Nenhum código abaixo foi inventado; todos vieram de consulta direta.
 */

/** Prioridade de KPIs do hero por variedade de dimensão (seção 8 do brief): percorrida pegando o primeiro indicador
 * `AVAILABLE` de cada linha até 8 — nunca os "8 IDs fixos", porque a disponibilidade varia por território. */
export const HERO_KPI_PRIORITY: Array<{ code: string; label: string }> = [
  { code: 'IAG0001', label: 'Abastecimento de água' },
  { code: 'IES0001', label: 'Esgotamento sanitário' },
  { code: 'INF-ENTORNO-HOUSEHOLD-PAVEMENT', label: 'Pavimentação no entorno' },
  { code: 'INF-ENTORNO-HOUSEHOLD-LIGHTING', label: 'Iluminação pública no entorno' },
  { code: 'INF-INTERNET-DOMICILIOS', label: 'Internet domiciliar' },
  { code: 'ENERGY-MMGD-INSTALLED-KW', label: 'Potência de geração distribuída (MMGD)' },
  { code: 'IND-MOB-PEMOB-SERVICOS-MUNICIPAIS', label: 'Transporte sob gestão municipal' },
  { code: 'INF-DAMS-SNISB-TOTAL', label: 'Barragens cadastradas (SNISB)' },
] as const;

export const MODULE_FAMILIES = {
  water: ['SINISA'],
  urban: ['ENTORNO_IBGE'],
  housing: ['FAVELAS', 'FJP', 'INTERNET_DOMICILIAR'],
  energy: ['MMGD', 'ANEEL_INDGER', 'ANP'],
  mobility: ['PEMOB', 'MUNIC_TRANSPORTE', 'LOGISTICA'],
  waterSecurity: ['SNISB', 'ANM', 'ATLAS_AGUAS'],
} as const;

/** Famílias cujo `period`/`referenceYear` é uma competência técnica codificada pelo pipeline de origem, não uma data
 * de coleta ou pesquisa encerrada (G0.4) — PEMOB não é caso isolado, o padrão se repete nestas famílias. */
export const CODED_PERIOD_FAMILIES = new Set(['PEMOB', 'SNISB', 'ANM', 'ATLAS_AGUAS', 'MMGD', 'ANP', 'LOGISTICA']);

export type EntornoUnit = 'FACE' | 'HOUSEHOLD' | 'RESIDENT';
const ENTORNO_THEME_LABEL: Record<string, string> = {
  BIKE_SIGN: 'Sinalização para bicicleta', BUS_STOP: 'Ponto de ônibus ou van', CIRCULATION_BUS_TRUCK: 'Circulação de caminhão/ônibus',
  CURB_RAMP: 'Rampa para cadeirante', DRAINAGE: 'Bueiro ou boca de lobo', LIGHTING: 'Iluminação pública', PAVEMENT: 'Via pavimentada',
  SIDEWALK: 'Calçada ou passeio', SIDEWALK_OBSTACLE: 'Obstáculo na calçada', TREE_PRESENCE: 'Arborização (uma ou mais árvores)',
};
export const ENTORNO_UNIT_LABEL: Record<EntornoUnit, string> = { FACE: 'Faces de quadra', HOUSEHOLD: 'Domicílios', RESIDENT: 'Moradores' };
export const ENTORNO_UNIT_EXPLAIN: Record<EntornoUnit, string> = {
  FACE: 'percentual das faces de quadra do território com a característica observada pelo recenseador',
  HOUSEHOLD: 'percentual de domicílios particulares permanentes cujo entorno tem a característica',
  RESIDENT: 'percentual de moradores cujo entorno tem a característica',
};

/** `INF-ENTORNO-{FACE|HOUSEHOLD|RESIDENT}-{TEMA}` → unidade estatística + tema em linguagem leiga. As três unidades
 * nunca podem ser misturadas no mesmo gráfico (seção 10 do brief): são denominadores diferentes. */
export function parseEntornoCode(code: string): { unit: EntornoUnit; theme: string; themeLabel: string } | null {
  const m = /^INF-ENTORNO-(FACE|HOUSEHOLD|RESIDENT)-(.+)$/.exec(code);
  if (!m) return null;
  const unit = m[1] as EntornoUnit; const theme = m[2]!;
  return { unit, theme, themeLabel: ENTORNO_THEME_LABEL[theme] ?? theme };
}

/** Catálogo de situação/categoria de obras (Obrasgov), confirmado contra `civica_exec.exec_work_c_text`
 * (kind=1 → situação, kind=3 → espécie/categoria). Valores estáveis, usados nos filtros da listagem de obras. */
export const WORK_SITUATION_OPTIONS = [
  { code: 1, label: 'Cadastrada' }, { code: 2, label: 'Concluída' }, { code: 3, label: 'Em execução' },
  { code: 4, label: 'Inacabada' }, { code: 5, label: 'Cancelada' }, { code: 6, label: 'Paralisada' },
] as const;
/** Rótulos pt-BR dos 11 estados de `Availability` do contrato — usados no explorador e nas fichas de indicador. */
export const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'publicado', PARTIAL_COVERAGE: 'publicado com cobertura parcial', NOT_REPORTED: 'a fonte não publicou',
  SOURCE_BLOCKED: 'fonte bloqueada nesta base', NOT_COLLECTED: 'não coletado', NOT_APPLICABLE: 'não aplicável a este território',
  NOT_PUBLISHED: 'ainda não publicado', OUTSIDE_REFERENCE_GEOGRAPHY: 'fora da geografia de referência', UNDER_REVIEW: 'em revisão',
  STALE: 'desatualizado', UNVERIFIED_RELATION: 'relação não verificada',
};

export const WORK_CATEGORY_OPTIONS = [
  { code: 12, label: 'Construção' }, { code: 13, label: 'Reforma' }, { code: 14, label: 'Ampliação' },
  { code: 15, label: 'Fabricação' }, { code: 16, label: 'Recuperação' }, { code: 17, label: 'Máquinas e Equipamentos' },
] as const;
