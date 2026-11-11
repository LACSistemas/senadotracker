import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';
import { getJudiciaryStjPrecedents } from './postgres-judiciary-stj.ts';

export type JudiciaryThemeId =
  | 'TAX_EXECUTION' | 'GENERAL_EXECUTION' | 'CRIMINAL_EXECUTION'
  | 'HEALTH' | 'SOCIAL_SECURITY' | 'CONSUMER_BANKING'
  | 'LABOR' | 'DOMESTIC_VIOLENCE' | 'CHILD_FAMILY' | 'COLLECTIVE_ACTIONS'
  | 'MAJOR_LITIGANTS' | 'STJ_PRECEDENTS' | 'CRIMINAL' | 'CONCILIATION';

export type ThematicAvailability = 'AVAILABLE' | 'PARTIAL_COVERAGE' | 'DOCUMENTATION_ONLY' | 'LEGAL_RESTRICTION' | 'NOT_REPORTED' | 'METHOD_INCOMPATIBLE';
export type JudiciaryThemeResult<T> = { availability: ThematicAvailability; data: T; provenance: { revisionId?: string | null; source?: string; asOf?: string | null; limitations?: string[] } };
export type ThemeFilters = { year?: number; branchCode?: string; tribunalId?: string; page?: number; pageSize?: number };

type ThemeMeta = { title: string; description: string; status: ThematicAvailability; officialSource: string; notes: string[] };
const THEMES: Record<JudiciaryThemeId, ThemeMeta> = {
  TAX_EXECUTION: { title: 'Execução fiscal', description: 'Casos novos, estoque, baixas e taxas oficiais da execução fiscal no universo JN.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['Não mede recuperação financeira efetiva de créditos.'] },
  GENERAL_EXECUTION: { title: 'Execução geral', description: 'Casos e indicadores oficiais da fase de execução, sem restringir a execução fiscal.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['Não deve ser apresentado como execução fiscal ou execução penal.'] },
  CRIMINAL_EXECUTION: { title: 'Execução penal', description: 'Indicadores oficiais identificados como execução penal no dicionário JN.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['A variável é de execução penal; não é um total genérico de execução.'] },
  HEALTH: { title: 'Judicialização da saúde', description: 'Publicações e estudos oficiais sobre demandas de saúde; sem fatos estruturados elegíveis nesta revisão.', status: 'LEGAL_RESTRICTION', officialSource: 'CNJ Fórum da Saúde / CNJ-PNUD', notes: ['Painéis derivados de DataJud exigem revisão de licenciamento.'] },
  SOCIAL_SECURITY: { title: 'Previdência e INSS', description: 'Painéis e publicações do CNJ sobre demandas previdenciárias e INSS.', status: 'DOCUMENTATION_ONLY', officialSource: 'CNJ Desjudicializa INSS', notes: ['Parte em litígio não equivale automaticamente a assunto previdenciário.'] },
  CONSUMER_BANKING: { title: 'Consumo e relações bancárias', description: 'Tema editorial sem indicador JN independente publicado nesta revisão.', status: 'NOT_REPORTED', officialSource: 'CNJ / relatórios temáticos', notes: ['Sem taxonomia oficial estruturada no recorte auditado.'] },
  LABOR: { title: 'Relações de trabalho', description: 'Indicadores JN podem ser consultados no ramo Trabalho; não são classificação de assunto trabalhista.', status: 'PARTIAL_COVERAGE', officialSource: 'CNJ Justiça em Números 2026', notes: ['O ramo institucional não substitui uma taxonomia de conflitos.'] },
  DOMESTIC_VIOLENCE: { title: 'Violência doméstica', description: 'Casos e decisões de violência doméstica conforme variáveis oficiais JN.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['Não representa número de vítimas nem prova de crime.'] },
  CHILD_FAMILY: { title: 'Família, infância e juventude', description: 'Fontes e painéis oficiais identificados, sem fatos estruturados elegíveis nesta revisão.', status: 'DOCUMENTATION_ONLY', officialSource: 'CNJ painéis temáticos', notes: ['Não publicar células que possam identificar menores.'] },
  COLLECTIVE_ACTIONS: { title: 'Ações coletivas', description: 'CACOL e publicações correlatas identificadas; fatos não foram copiados sem licença e universo homogêneo.', status: 'LEGAL_RESTRICTION', officialSource: 'CNJ CACOL', notes: ['Não somar processos judiciais e procedimentos administrativos.'] },
  MAJOR_LITIGANTS: { title: 'Grandes litigantes', description: 'Painéis CNJ documentados, sem republicação de top-20 derivado de DataJud nesta revisão.', status: 'LEGAL_RESTRICTION', officialSource: 'CNJ Painéis de Grandes Litigantes', notes: ['Top 20 não representa o universo completo.'] },
  STJ_PRECEDENTS: { title: 'Precedentes do STJ', description: 'Precedentes qualificados, processos relacionados e recortes de decisões publicados na P14.4.', status: 'PARTIAL_COVERAGE', officialSource: 'STJ Dados Abertos', notes: ['Classificação temática oficial é parcial; não há classificação automática por IA.'] },
  CRIMINAL: { title: 'Justiça criminal', description: 'Casos novos, pendentes, baixados e decisões criminais do universo JN.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['Não é medida de criminalidade social.'] },
  CONCILIATION: { title: 'Conciliação', description: 'Índices oficiais de conciliação por grau e fase quando publicados pelo JN.', status: 'AVAILABLE', officialSource: 'CNJ Justiça em Números 2026', notes: ['Índices não devem ser somados como contagens.'] },
};

const page = (n = 1, size = 20) => { if (!Number.isInteger(n) || n < 1 || !Number.isInteger(size) || size < 1 || size > 100) throw new Error('Paginação temática inválida'); return { n, size, offset: (n - 1) * size }; };
const themeExpr = `COALESCE(i.provenance->>'semanticTheme', i.provenance->>'theme', split_part(split_part(i.indicator_id, '_', 2), '_', 1))`;
type ThemeRevision = { revisionId: string; factRevisionId: string; activatedAt: string | null };
const activeRevision = async (pool: Pool): Promise<ThemeRevision | null> => {
  const row = (await pool.query(`SELECT revision_id,activated_at,provenance FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JN_THEMATIC_METADATA' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]
    ?? (await pool.query(`SELECT revision_id,activated_at,provenance FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JN_THEMATIC' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
  if (!row) return null;
  return { revisionId: row.revision_id, factRevisionId: row.provenance?.factRevisionId ?? row.revision_id, activatedAt: row.activated_at };
};
const activeIndicatorWhere = (themeId: JudiciaryThemeId, args: unknown[]) => { args.push(themeId); return `${themeExpr}=$${args.length} AND i.source_variable IS NOT NULL AND i.publication_status NOT LIKE 'DEPRECATED%'`; };

export async function getJudiciaryThemesCatalog(pool: Pool): Promise<JudiciaryThemeResult<unknown[]>> {
  const revision = await activeRevision(pool);
  const facts = revision ? (await pool.query(`SELECT i.indicator_id,i.public_name,i.official_name,i.unit,i.source_variable,i.statistical_universe,i.aggregation_allowed,i.comparison_eligible,i.available_years,i.publication_status,${themeExpr} AS canonical_theme FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i WHERE i.source_variable IS NOT NULL AND i.publication_status NOT LIKE 'DEPRECATED%' ORDER BY i.indicator_id`)).rows : [];
  const themes = Object.entries(THEMES).map(([id, meta]) => ({ themeId: id, ...meta, indicatorCount: facts.filter((x: any) => x.canonical_theme === id).length }));
  return { availability: revision ? 'AVAILABLE' : 'NOT_REPORTED', data: themes, provenance: { revisionId: revision?.revisionId ?? null, source: 'CNJ JN dictionary + corrected P14.7-R thematic catalog', asOf: revision?.activatedAt ?? null } };
}

export async function getJudiciaryThemeOverview(pool: Pool, themeId: JudiciaryThemeId, filters: ThemeFilters = {}): Promise<JudiciaryThemeResult<unknown>> {
  const meta = THEMES[themeId]; if (!meta) throw new Error(`Tema desconhecido: ${themeId}`);
  const revision = await activeRevision(pool); if (!revision) return { availability: meta.status === 'AVAILABLE' ? 'NOT_REPORTED' : meta.status, data: { themeId, meta, metrics: [] }, provenance: { source: meta.officialSource } };
  const args: unknown[] = [revision.factRevisionId]; const where = [`o.publication_revision_id=$1`, activeIndicatorWhere(themeId, args)];
  if (filters.year !== undefined) { args.push(filters.year); where.push(`o.reference_year=$${args.length}`); }
  if (filters.tribunalId) { args.push(filters.tribunalId); where.push(`o.canonical_tribunal_id=$${args.length}`); }
  if (filters.branchCode) { args.push(filters.branchCode); where.push(`b.code=$${args.length}`); }
  const rows = (await pool.query(`SELECT i.indicator_id,i.public_name,i.official_name,i.unit,i.aggregation_allowed,count(o.observation_id)::int observations,count(*) FILTER(WHERE o.value_numeric IS NOT NULL)::int available_values,CASE WHEN i.aggregation_allowed='SUM' THEN sum(o.value_numeric) FILTER(WHERE o.value_numeric IS NOT NULL) ELSE NULL END AS value,CASE WHEN i.aggregation_allowed='SUM' AND count(*) FILTER(WHERE o.value_numeric IS NOT NULL)>0 THEN 'AVAILABLE' ELSE 'METHOD_INCOMPATIBLE' END AS metric_availability FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i JOIN ${JUDICIARY_SCHEMA}.jud_jn_observation o ON o.indicator_id=i.indicator_id JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id LEFT JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id WHERE ${where.join(' AND ')} GROUP BY i.indicator_id,i.public_name,i.official_name,i.unit,i.aggregation_allowed ORDER BY i.indicator_id`, args)).rows;
  return { availability: rows.length ? meta.status : meta.status, data: { themeId, meta, filters, metrics: rows }, provenance: { revisionId: revision.revisionId, source: meta.officialSource, asOf: revision.activatedAt, limitations: meta.notes } };
}

export async function getJudiciaryThemeIndicators(pool: Pool, themeId: JudiciaryThemeId, filters: ThemeFilters = {}): Promise<JudiciaryThemeResult<unknown>> {
  const meta = THEMES[themeId]; if (!meta) throw new Error(`Tema desconhecido: ${themeId}`); const { n, size, offset } = page(filters.page, filters.pageSize); const args: unknown[] = []; const where = activeIndicatorWhere(themeId, args);
  const total = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i WHERE ${where}`, args)).rows[0].n);
  args.push(size, offset); const items = (await pool.query(`SELECT indicator_id,public_name,official_name,description,source_variable,source_formula,numerator,denominator,unit,statistical_universe,institutional_grain,time_grain,available_years,aggregation_allowed,comparison_eligible,source_edition,method_breaks,publication_status,missing_data_rule,methodology_reference,provenance FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i WHERE ${where} ORDER BY indicator_id LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { availability: total ? meta.status : meta.status === 'AVAILABLE' ? 'NOT_REPORTED' : meta.status, data: { themeId, meta, page: n, pageSize: size, total, items }, provenance: { source: meta.officialSource, limitations: meta.notes } };
}

async function indicatorBelongs(pool: Pool, themeId: JudiciaryThemeId, indicatorId: string) { return (await pool.query(`SELECT 1 FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i WHERE i.indicator_id=$1 AND ${themeExpr}=$2 AND i.source_variable IS NOT NULL AND i.publication_status NOT LIKE 'DEPRECATED%'`, [indicatorId, themeId])).rowCount === 1; }

export async function getJudiciaryThemeHistoricalSeries(pool: Pool, themeId: JudiciaryThemeId, indicatorId: string, tribunalId?: string): Promise<JudiciaryThemeResult<unknown>> {
  const meta = THEMES[themeId]; if (!meta) throw new Error(`Tema desconhecido: ${themeId}`); if (!await indicatorBelongs(pool, themeId, indicatorId)) throw new Error('Indicador não pertence ao tema');
  const revision = await activeRevision(pool); if (!revision) return { availability: 'NOT_REPORTED', data: { themeId, indicatorId, tribunalId: tribunalId ?? null, items: [] }, provenance: { source: meta.officialSource } };
  const args: unknown[] = [indicatorId, revision.factRevisionId]; const where = [`o.indicator_id=$1`, `o.publication_revision_id=$2`]; if (tribunalId) { args.push(tribunalId); where.push(`o.canonical_tribunal_id=$${args.length}`); }
  const rows = (await pool.query(`SELECT o.reference_year,o.value_numeric,o.unit,o.coverage_status,o.comparability,o.report_edition,o.publication_revision_id FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o WHERE ${where.join(' AND ')} ORDER BY o.reference_year`, args)).rows;
  return { availability: rows.length ? meta.status : 'NOT_REPORTED', data: { themeId, indicatorId, tribunalId: tribunalId ?? null, items: rows }, provenance: { revisionId: revision.revisionId, source: meta.officialSource, limitations: meta.notes } };
}

export async function getJudiciaryThemeByTribunal(pool: Pool, themeId: JudiciaryThemeId, tribunalId: string, year = 2025) { return getJudiciaryThemeOverview(pool, themeId, { tribunalId, year }); }

export async function getJudiciaryThemeComparators(pool: Pool, themeId: JudiciaryThemeId, indicatorId: string, year: number, tribunalIds: string[] = []): Promise<JudiciaryThemeResult<unknown>> {
  const meta = THEMES[themeId]; if (!meta) throw new Error(`Tema desconhecido: ${themeId}`); if (!await indicatorBelongs(pool, themeId, indicatorId)) throw new Error('Indicador não pertence ao tema');
  const revision = await activeRevision(pool); if (!revision) return { availability: 'NOT_REPORTED', data: { themeId, indicatorId, year, items: [] }, provenance: { source: meta.officialSource } };
  const args: unknown[] = [indicatorId, year, revision.factRevisionId]; const where = [`o.indicator_id=$1`, `o.reference_year=$2`, `o.publication_revision_id=$3`]; if (tribunalIds.length) { args.push(tribunalIds); where.push(`o.canonical_tribunal_id=ANY($${args.length}::text[])`); }
  const items = (await pool.query(`SELECT o.canonical_tribunal_id,t.sigla,t.official_name,o.value_numeric,o.unit,o.coverage_status,o.comparability FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id WHERE ${where.join(' AND ')} ORDER BY t.official_name`, args)).rows;
  return { availability: items.length ? meta.status : 'NOT_REPORTED', data: { themeId, indicatorId, year, items }, provenance: { revisionId: revision.revisionId, source: meta.officialSource, limitations: [...meta.notes, 'Comparação descritiva; sem ranking automático.'] } };
}

export async function getJudiciaryThemeSources(pool: Pool, themeId?: JudiciaryThemeId): Promise<JudiciaryThemeResult<unknown>> {
  if (themeId && !THEMES[themeId]) throw new Error(`Tema desconhecido: ${themeId}`);
  const snapshots = (await pool.query(`SELECT snapshot_id,provider,resource_name,source_url,fetched_at,source_updated_at,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot WHERE provider='CNJ' ORDER BY fetched_at DESC`)).rows;
  return { availability: 'AVAILABLE', data: { themeId: themeId ?? null, catalog: themeId ? THEMES[themeId] : THEMES, snapshots }, provenance: { source: 'civica_jud provenance catalog' } };
}

export async function getJudiciaryStjPrecedentsByTheme(pool: Pool, themeId: JudiciaryThemeId, filters: { status?: string; type?: string; year?: number; page?: number; pageSize?: number } = {}): Promise<JudiciaryThemeResult<unknown>> {
  if (themeId !== 'STJ_PRECEDENTS') return { availability: 'NOT_REPORTED', data: { themeId, items: [] }, provenance: { source: 'STJ Dados Abertos', limitations: ['A classificação temática oficial não foi publicada para este tema.'] } };
  const data = await getJudiciaryStjPrecedents(pool, filters); return { availability: data.total ? 'PARTIAL_COVERAGE' : 'NOT_REPORTED', data, provenance: { source: 'STJ Dados Abertos', limitations: ['Recorte de precedentes; não equivale a processos novos.', 'Classificação temática detalhada permanece parcial.'] } };
}

export { THEMES as JUDICIARY_THEMES };

