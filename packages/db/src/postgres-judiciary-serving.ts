import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';
import { getJudiciaryStjOverview, getJudiciaryStjPrecedentDetail, getJudiciaryStjPrecedents } from './postgres-judiciary-stj.ts';
import { getJudiciaryStfOverview, getJudiciaryStfTemaDetail, getJudiciaryStfTemas, getJudiciaryStfPayrollOverview, getJudiciaryStfPayrollRoster, getJudiciaryStfPayrollDetail } from './postgres-judiciary-stf.ts';
import { getJudiciaryStfJurisprudenciaOverview, getJudiciaryStfCasosPorRelator, getJudiciaryStfJurisprudenciaExplorer, getJudiciaryStfJurisprudenciaDoc, type JurisprudenciaFilters } from './postgres-judiciary-stf-jurisprudencia.ts';
import { getJudiciaryFinancialCoverage, getJudiciaryFinancialOverview, getJudiciaryFinancialMethodology } from './postgres-judiciary-financial.ts';
import { getJudiciaryPersonnelOverview, getJudiciaryPersonnelByCareer, getJudiciarySupplierPayments } from './postgres-judiciary-personnel.ts';
import { getJudiciaryIndicatorPeerAverage } from './postgres-judiciary-statistics.ts';
import { STF_MINISTRO_FOTOS } from './judiciary-stf-ministro-fotos.ts';

export type AvailabilityState = 'AVAILABLE' | 'NOT_APPLICABLE' | 'NOT_REPORTED' | 'NOT_PUBLISHED' | 'PARTIAL_COVERAGE' | 'METHOD_INCOMPATIBLE' | 'SOURCE_UNAVAILABLE' | 'LEGAL_RESTRICTION' | 'STALE' | 'UNVERIFIED_RELATION';
export type ServingResult<T> = { availability: AvailabilityState; data: T; provenance: { revisionId?: string | null; source?: string; asOf?: string | null; limitations?: string[] } };
export type TribunalDirectoryFilters = { search?: string; branchCode?: string; uf?: string; page?: number; pageSize?: number; year?: number; sort?: 'nome' | 'casos_novos' | 'congestionamento' };

const activeRevision = async (pool: Pool, scope: string) => (await pool.query(`SELECT revision_id,created_at,activated_at FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope=$1 AND is_active=true ORDER BY created_at DESC LIMIT 1`, [scope])).rows[0] ?? null;
const pageArgs = (page=1,pageSize=20) => { if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100) throw new Error('Paginação inválida'); return { page, pageSize, offset:(page-1)*pageSize }; };

export async function getJudiciaryNationalOverview(pool: Pool, year = 2025): Promise<ServingResult<{ year:number; metrics:unknown[]; branches:unknown[] }>> {
  const rev=await activeRevision(pool,'JN_STATISTICS');
  if(!rev) return { availability:'SOURCE_UNAVAILABLE',data:{year,metrics:[],branches:[]},provenance:{source:'CNJ Justiça em Números'}};
  const metrics=(await pool.query(`SELECT i.indicator_id,i.public_name,i.official_name,i.unit,i.aggregation_allowed,i.comparison_eligible,
    CASE WHEN i.aggregation_allowed='SUM' THEN sum(o.value_numeric) FILTER (WHERE o.value_numeric IS NOT NULL) ELSE NULL END AS value,
    count(o.observation_id)::int AS observations,count(*) FILTER (WHERE o.value_numeric IS NOT NULL)::int AS available_values,
    count(DISTINCT o.canonical_tribunal_id)::int AS institutions,
    CASE WHEN i.aggregation_allowed='SUM' AND count(*) FILTER (WHERE o.value_numeric IS NOT NULL)>0 THEN 'AVAILABLE' ELSE 'METHOD_INCOMPATIBLE' END AS availability
    FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i LEFT JOIN ${JUDICIARY_SCHEMA}.jud_jn_observation o ON o.indicator_id=i.indicator_id AND o.reference_year=$1 AND o.canonical_tribunal_id NOT IN (SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE institutional_level='CONTROL')
    GROUP BY i.indicator_id,i.public_name,i.official_name,i.unit,i.aggregation_allowed,i.comparison_eligible ORDER BY i.indicator_id`,[year])).rows;
  const branches=(await pool.query(`WITH metric_values AS (
    SELECT b.code,b.name,count(DISTINCT t.tribunal_id)::int AS institutions,i.indicator_id,i.public_name,i.unit,i.aggregation_allowed,
      CASE WHEN i.aggregation_allowed='SUM' THEN sum(o.value_numeric) FILTER(WHERE o.value_numeric IS NOT NULL) ELSE NULL END AS value
    FROM ${JUDICIARY_SCHEMA}.jud_branch b JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.branch_id=b.branch_id
    LEFT JOIN ${JUDICIARY_SCHEMA}.jud_jn_observation o ON o.canonical_tribunal_id=t.tribunal_id AND o.reference_year=$1
    LEFT JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id
    GROUP BY b.code,b.name,i.indicator_id,i.public_name,i.unit,i.aggregation_allowed
  ) SELECT code,name,max(institutions)::int AS institutions,
    jsonb_agg(jsonb_build_object('indicatorId',indicator_id,'title',public_name,'unit',unit,'value',value,'availability',CASE WHEN aggregation_allowed='SUM' THEN 'AVAILABLE' ELSE 'METHOD_INCOMPATIBLE' END) ORDER BY indicator_id) FILTER(WHERE indicator_id IS NOT NULL) AS metrics
    FROM metric_values GROUP BY code,name ORDER BY code`,[year])).rows;
  return {availability:'AVAILABLE',data:{year,metrics,branches},provenance:{revisionId:rev.revision_id,source:'CNJ Justiça em Números',asOf:rev.activated_at}};
}

export async function getJudiciaryBranches(pool: Pool, year=2025) { const overview=await getJudiciaryNationalOverview(pool,year); return { ...overview, data: overview.data.branches }; }

/** P14.8 — série nacional multi-ano para indicadores SUM (ex. casos novos/baixados/pendentes por ano, ou
 * um indicador temático somado por ano); nenhuma função de P14.7 devolve isso (só ano único ou por
 * tribunal). Mesmas tabelas, só agrupado por ano em vez de filtrado por ano — não é novo coletor nem nova
 * tabela. Indicadores com aggregation_allowed != 'SUM' nunca aparecem aqui (ficariam incorretos somados):
 * o chamador deve pedir só IDs SUM. Filtra pela(s) revisão(ões) ATIVA(S) de JN_STATISTICS e JN_THEMATIC —
 * sem isso, um indicador com mais de uma revisão publicada ao longo do tempo somaria linhas de revisões
 * diferentes (achado real: o schema permite várias revisões por indicador/tribunal/ano, uma por scope). */
export async function getJudiciaryNationalSeries(pool: Pool, indicatorIds: string[]): Promise<ServingResult<{ indicatorIds: string[]; items: unknown[] }>> {
  if (!indicatorIds.length || indicatorIds.length > 20) throw new Error('Lista de indicadores inválida');
  const [statsRev, themeRev] = await Promise.all([activeRevision(pool, 'JN_STATISTICS'), activeRevision(pool, 'JN_THEMATIC')]);
  const revisionIds = [statsRev?.revision_id, themeRev?.revision_id].filter((x): x is string => !!x);
  if (!revisionIds.length) return { availability: 'SOURCE_UNAVAILABLE', data: { indicatorIds, items: [] }, provenance: { source: 'CNJ Justiça em Números' } };
  const rows = (await pool.query(`SELECT i.indicator_id,i.public_name,i.unit,i.aggregation_allowed,o.reference_year,
      sum(o.value_numeric) FILTER (WHERE o.value_numeric IS NOT NULL) AS value,
      count(*) FILTER (WHERE o.value_numeric IS NOT NULL)::int AS available_values,
      count(DISTINCT o.canonical_tribunal_id)::int AS institutions
    FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i JOIN ${JUDICIARY_SCHEMA}.jud_jn_observation o ON o.indicator_id=i.indicator_id
      AND o.publication_revision_id=ANY($2::text[])
      AND o.canonical_tribunal_id NOT IN (SELECT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE institutional_level='CONTROL')
    WHERE i.indicator_id=ANY($1::text[]) AND i.aggregation_allowed='SUM'
    GROUP BY i.indicator_id,i.public_name,i.unit,i.aggregation_allowed,o.reference_year ORDER BY i.indicator_id,o.reference_year`, [indicatorIds, revisionIds])).rows;
  return { availability: rows.length ? 'AVAILABLE' : 'NOT_REPORTED', data: { indicatorIds, items: rows }, provenance: { revisionId: statsRev?.revision_id ?? themeRev?.revision_id, source: 'CNJ Justiça em Números', asOf: statsRev?.activated_at ?? themeRev?.activated_at, limitations: ['Só indicadores SUM; taxas e índices não entram nesta série.'] } };
}

export async function getJudiciaryTribunalDirectory(pool: Pool, filters:TribunalDirectoryFilters={}) {
  const {page,pageSize,offset}=pageArgs(filters.page,filters.pageSize); const year=filters.year??2025; const args:unknown[]=[]; const where:string[]=[];
  if(filters.search){args.push(`%${filters.search.trim().toLowerCase()}%`);where.push(`(lower(t.sigla) like $${args.length} OR lower(t.official_name) like $${args.length})`)}
  if(filters.branchCode){args.push(filters.branchCode);where.push(`b.code=$${args.length}`)}
  if(filters.uf){args.push(filters.uf.toUpperCase());where.push(`(t.seat_uf=$${args.length} OR EXISTS (SELECT 1 FROM ${JUDICIARY_SCHEMA}.jud_unit ux WHERE ux.tribunal_id=t.tribunal_id AND ux.physical_uf=$${args.length}))`)}
  const clause=where.length?`WHERE ${where.join(' AND ')}`:''; const count=Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id ${clause}`,args)).rows[0].n);
  args.push(year); const yearIdx=args.length;
  const orderBy = filters.sort==='casos_novos' ? 'casos_novos DESC NULLS LAST,t.official_name' : filters.sort==='congestionamento' ? 'taxa_congestionamento DESC NULLS LAST,t.official_name' : 't.official_name,t.sigla';
  const listArgs=[...args,pageSize,offset]; const items=(await pool.query(`SELECT t.tribunal_id,t.sigla,t.official_name,t.institutional_level,t.seat_uf,b.code branch_code,b.name branch_name,
    EXISTS(SELECT 1 FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o WHERE o.canonical_tribunal_id=t.tribunal_id) AS has_jn,
    EXISTS(SELECT 1 FROM ${JUDICIARY_SCHEMA}.jud_fin_fact f WHERE f.tribunal_id=t.tribunal_id) AS has_finance,
    EXISTS(SELECT 1 FROM ${JUDICIARY_SCHEMA}.jud_unit u WHERE u.tribunal_id=t.tribunal_id) AS has_units,
    (SELECT sum(o.value_numeric) FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o WHERE o.canonical_tribunal_id=t.tribunal_id AND o.indicator_id IN ('JN_CASES_NEW_G1','JN_CASES_NEW_G2') AND o.reference_year=$${yearIdx} AND o.value_numeric IS NOT NULL) AS casos_novos,
    (SELECT o.value_numeric FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o WHERE o.canonical_tribunal_id=t.tribunal_id AND o.indicator_id='JN_CONGESTION_RATE' AND o.reference_year=$${yearIdx} LIMIT 1) AS taxa_congestionamento,
    t.source_url FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id ${clause} ORDER BY ${orderBy} LIMIT $${listArgs.length-1} OFFSET $${listArgs.length}`,listArgs)).rows;
  return {availability:'AVAILABLE' as const,page,pageSize,total:count,year,items,provenance:{source:'civica_jud institutional catalog · CNJ Justiça em Números'}};
}

export async function getJudiciaryTribunalSeries(pool:Pool, tribunalId:string, indicatorId:string) {
  const rows=(await pool.query(`SELECT o.reference_year,o.value_numeric,o.numerator,o.denominator,o.unit,o.coverage_status,o.comparability,o.report_edition,o.publication_revision_id,i.public_name,i.official_name FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id WHERE o.canonical_tribunal_id=$1 AND o.indicator_id=$2 ORDER BY o.reference_year`,[tribunalId,indicatorId])).rows;
  return {availability:rows.length?'AVAILABLE':'NOT_REPORTED',data:{tribunalId,indicatorId,items:rows},provenance:{source:'CNJ Justiça em Números',limitations:rows.length?[]:['Não há observações publicadas para o tribunal/indicador']}};
}

export async function getJudiciaryComparison(pool:Pool, indicatorId:string, tribunalIds:string[], year:number) {
  if(!tribunalIds.length||tribunalIds.length>50) throw new Error('Lista de tribunais inválida');
  const meta=(await pool.query(`SELECT indicator_id,public_name,official_name,unit,aggregation_allowed,comparison_eligible FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator WHERE indicator_id=$1`,[indicatorId])).rows[0];
  if(!meta) return {availability:'NOT_REPORTED' as const,data:{indicatorId,year,items:[]},provenance:{source:'CNJ Justiça em Números'}};
  if(!meta.comparison_eligible) return {availability:'METHOD_INCOMPATIBLE' as const,data:{indicatorId,year,items:[]},provenance:{source:'CNJ Justiça em Números',limitations:['Indicador marcado como não comparável']}};
  const items=(await pool.query(`SELECT o.canonical_tribunal_id,t.sigla,t.official_name,o.reference_year,o.value_numeric,o.numerator,o.denominator,o.unit,o.coverage_status,o.comparability FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id WHERE o.indicator_id=$1 AND o.reference_year=$2 AND o.canonical_tribunal_id=ANY($3::text[]) ORDER BY t.official_name`,[indicatorId,year,tribunalIds])).rows;
  return {availability:items.length?'AVAILABLE':'NOT_REPORTED',data:{indicator:meta,year,items},provenance:{source:'CNJ Justiça em Números',limitations:['Sem ranking ou nota sintética']}};
}

/** Distribuição real de um indicador de taxa/média entre tribunais (ex.: congestionamento, tempo médio) —
    para indicadores marcados `comparison_eligible` mas sem agregação nacional por SUM (NONE_RATE_OFFICIAL,
    MEAN_ONLY): não existe "a taxa nacional", mas existe a variação real entre instituições, honesta de
    mostrar como distribuição (min/mediana/max + pontos), nunca como média simples. Só leitura. */
export async function getJudiciaryIndicatorDistribution(pool:Pool, indicatorId:string, year=2025) {
  const meta=(await pool.query(`SELECT indicator_id,public_name,official_name,unit,comparison_eligible FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator WHERE indicator_id=$1`,[indicatorId])).rows[0];
  if(!meta||!meta.comparison_eligible) return {availability:'METHOD_INCOMPATIBLE' as const,data:{indicator:meta??null,year,points:[]},provenance:{source:'CNJ Justiça em Números'}};
  const rows=(await pool.query(`SELECT o.canonical_tribunal_id tribunal_id,t.sigla,t.official_name,b.code branch_code,b.name branch_name,o.value_numeric value FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id WHERE o.indicator_id=$1 AND o.reference_year=$2 AND o.value_numeric IS NOT NULL AND t.institutional_level<>'CONTROL' ORDER BY o.value_numeric`,[indicatorId,year])).rows;
  return {availability:rows.length?'AVAILABLE' as const:'NOT_REPORTED' as const,data:{indicator:meta,year,points:rows},provenance:{source:'CNJ Justiça em Números',limitations:['Distribuição entre tribunais, não uma taxa nacional única — universos e acervos diferem entre instituições']}};
}

export async function getJudiciaryTribunalProfile(pool:Pool, tribunalId:string, year=2025) {
  const tribunal=(await pool.query(`SELECT t.*,b.code branch_code,b.name branch_name FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id WHERE t.tribunal_id=$1`,[tribunalId])).rows[0];
  if(!tribunal) return {availability:'NOT_REPORTED' as const,data:null,provenance:{source:'civica_jud'}};
  // `year` aqui é o ano-base da Justiça em Números (stats), um conceito diferente do período real do dado
  // financeiro fino (jud_fin_fact) — nunca filtrar o financeiro por esse mesmo ano: um tribunal com dado
  // financeiro mais recente que `year` (ex. TJAM em 09/2026 com year=2025, ou STJ com dado real de 2026)
  // ficaria com `financial.facts` vazio, mesmo tendo dado publicado — achado real rodando o 2º tribunal com
  // jud_fin_fact de um ano diferente de 2025 (STJ também já tinha esse problema, sem ninguém notar). A tela
  // já calcula "período mais recente" a partir dos próprios `facts`, então nunca precisou desse filtro.
  const [stats,units,financial]=await Promise.all([pool.query(`SELECT o.*,i.public_name,i.official_name,i.aggregation_allowed,i.comparison_eligible FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id WHERE o.canonical_tribunal_id=$1 AND o.reference_year=$2 ORDER BY i.indicator_id`,[tribunalId,year]),pool.query(`SELECT unit_id,official_name,unit_type,physical_municipality_source_code,physical_uf,active,match_status FROM ${JUDICIARY_SCHEMA}.jud_unit WHERE tribunal_id=$1 ORDER BY official_name`,[tribunalId]),getJudiciaryFinancialOverview(pool,tribunalId)]);
  // Comparador leve "vs. média de outros tribunais do mesmo ramo" — só pros indicadores onde essa leitura faz
  // sentido de cara na página de perfil (o comparador completo, com qualquer indicador e qualquer seleção de
  // tribunais, continua em `/judiciario/comparar`). Pedir a média mesmo pra um indicador que este tribunal não
  // tenha (ex. Cp/100k num tribunal não-estadual) é inofensivo — só volta `tribunalCount:0`.
  const PEER_INDICATORS=['JN_EXPENSE_TOTAL','JN_EXPENSE_PER_CAPITA','JN_REVENUE_TOTAL','JN_MAGISTRATES_PER_100K','JN_STAFF_PER_100K','JN_CASES_PENDING_PER_100K'];
  const peerAveragesList=await Promise.all(PEER_INDICATORS.map(async id=>[id,await getJudiciaryIndicatorPeerAverage(pool,id,year,tribunal.branch_code,tribunalId)] as const));
  const peerAverages=Object.fromEntries(peerAveragesList);
  return {availability:'AVAILABLE' as const,data:{tribunal,year,statistics:stats.rows,units:units.rows,financial,peerAverages},provenance:{source:'civica_jud',limitations:units.rows.some((u:any)=>u.physical_uf)?[]:['Territorialidade física parcial']}};
}

export async function getJudiciaryStjJurisprudenceOverview(pool:Pool) { const base=await getJudiciaryStjOverview(pool); return {availability:base.revision?'PARTIAL_COVERAGE':'SOURCE_UNAVAILABLE',data:{...base,coverage:'PARTIAL',distinctProcessCount:base.revision?(await pool.query(`SELECT count(DISTINCT process_label)::int n FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent_process WHERE publication_revision_id=$1`,[base.revision])).rows[0].n:0},provenance:{source:'STJ Dados Abertos',limitations:['Espelhos e decisões são recortes parciais; relatores são nomes nominais']}}; }
export async function getJudiciaryStjPrecedentExplorer(pool:Pool, filters:{status?:string;type?:string;year?:number;page?:number;pageSize?:number}={}) { const data=await getJudiciaryStjPrecedents(pool,filters); return {availability:data.total?'PARTIAL_COVERAGE':'SOURCE_UNAVAILABLE',data,provenance:{source:'STJ Dados Abertos',limitations:['PaginaÃ§Ã£o server-side','Cobertura parcial']}}; }
export async function getJudiciaryStjPrecedentProfile(pool:Pool, precedentId:string) { const data=await getJudiciaryStjPrecedentDetail(pool,precedentId); return {availability:data?'PARTIAL_COVERAGE':'NOT_REPORTED',data,provenance:{source:'STJ Dados Abertos',limitations:['Relator nominal não é identidade pessoal nacional']}}; }

export async function getJudiciaryStfJurisprudenceOverview(pool:Pool) { const base=await getJudiciaryStfOverview(pool); return {availability:base.revision?'PARTIAL_COVERAGE':'SOURCE_UNAVAILABLE',data:base,provenance:{source:'STF — exportação pública de Repercussão Geral',limitations:['Só Repercussão Geral; súmulas vinculantes e outras jurisprudências do STF não foram coletadas nesta fase','Relator é nome nominal, não identidade pessoal nacional']}}; }
export async function getJudiciaryStfTemaExplorer(pool:Pool, filters:{situation?:string;hasRepercussion?:boolean;page?:number;pageSize?:number}={}) { const data=await getJudiciaryStfTemas(pool,filters); return {availability:data.total?'AVAILABLE':'SOURCE_UNAVAILABLE',data,provenance:{source:'STF — exportação pública de Repercussão Geral',limitations:['Paginação server-side']}}; }
export async function getJudiciaryStfTemaProfile(pool:Pool, temaNumber:string) { const data=await getJudiciaryStfTemaDetail(pool,temaNumber); return {availability:data?'AVAILABLE':'NOT_REPORTED',data,provenance:{source:'STF — exportação pública de Repercussão Geral',limitations:['Relator nominal não é identidade pessoal nacional']}}; }

const GENERAL_JURISPRUDENCE_LIMITATIONS = ['Recorte deliberado para caber no orçamento de banco: metadados + ementa completa (acórdãos) ou um resumo truncado do início do texto (decisões monocráticas) — o texto integral de cada decisão está só no arquivo de origem, nunca no banco; o link para a fonte oficial do STF sempre acompanha','Relator é nome nominal, não identidade pessoal nacional','Busca textual é sobre a ementa (acórdãos) ou o resumo (decisões monocráticas), não sobre o inteiro teor'];
export async function getJudiciaryStfGeneralJurisprudenceOverview(pool:Pool) { const data=await getJudiciaryStfJurisprudenciaOverview(pool); return {availability:data.revision?'AVAILABLE':'SOURCE_UNAVAILABLE',data,provenance:{source:'STF — jurisprudencia.stf.jus.br (busca pública de jurisprudência)',limitations:GENERAL_JURISPRUDENCE_LIMITATIONS}}; }
export async function getJudiciaryStfGeneralJurisprudenceRanking(pool:Pool, base:'acordao'|'decisao'='acordao') { const data=await getJudiciaryStfCasosPorRelator(pool,base); return {availability:data.items.length?'AVAILABLE':'SOURCE_UNAVAILABLE',data,provenance:{source:'STF — jurisprudencia.stf.jus.br (busca pública de jurisprudência)',limitations:GENERAL_JURISPRUDENCE_LIMITATIONS}}; }
export async function getJudiciaryStfGeneralJurisprudenceExplorer(pool:Pool, filters:JurisprudenciaFilters={}) { const data=await getJudiciaryStfJurisprudenciaExplorer(pool,filters); return {availability:data.total?'AVAILABLE':(data.revision?'NOT_REPORTED':'SOURCE_UNAVAILABLE'),data,provenance:{source:'STF — jurisprudencia.stf.jus.br (busca pública de jurisprudência)',limitations:GENERAL_JURISPRUDENCE_LIMITATIONS}}; }
export async function getJudiciaryStfGeneralJurisprudenceProfile(pool:Pool, docId:string, base:'acordao'|'decisao'='acordao') { const data=await getJudiciaryStfJurisprudenciaDoc(pool,docId,base); return {availability:data?'AVAILABLE':'NOT_REPORTED',data,provenance:{source:'STF — jurisprudencia.stf.jus.br (busca pública de jurisprudência)',limitations:GENERAL_JURISPRUDENCE_LIMITATIONS}}; }

const PAYROLL_LIMITATIONS =['Divulgação voluntária do próprio STF (Portal da Transparência de pessoal), não um dado nacional do CNJ','Escopo restrito a Ministros (ativos e aposentados) e ao cargo comissionado Assessor de Ministro — não ao quadro de pessoal inteiro','Remuneração líquida reflete descontos individuais (IR, previdência, pensão); diferenças entre pessoas não indicam tratamento desigual'];
const withFoto = <T extends { matricula: string }>(row: T) => ({ ...row, ...STF_MINISTRO_FOTOS[row.matricula] });
export async function getJudiciaryStfPayrollSummary(pool:Pool) { const data=await getJudiciaryStfPayrollOverview(pool); return {availability:data.revision?'AVAILABLE':'SOURCE_UNAVAILABLE',data,provenance:{source:'STF — Portal da Transparência (egesp-portal.stf.jus.br)',limitations:PAYROLL_LIMITATIONS}}; }
export async function getJudiciaryStfPayrollExplorer(pool:Pool, filters:{role?:'MINISTRO'|'ASSESSOR_MINISTRO'}={}) { const data=await getJudiciaryStfPayrollRoster(pool,filters); return {availability:data.items.length?'AVAILABLE':'SOURCE_UNAVAILABLE',data:{...data,items:data.items.map(withFoto)},provenance:{source:'STF — Portal da Transparência (egesp-portal.stf.jus.br)',limitations:PAYROLL_LIMITATIONS}}; }
export async function getJudiciaryStfPayrollProfile(pool:Pool, matricula:string) { const data=await getJudiciaryStfPayrollDetail(pool,matricula); return {availability:data?'AVAILABLE':'NOT_REPORTED',data:data?withFoto(data):data,provenance:{source:'STF — Portal da Transparência (egesp-portal.stf.jus.br)',limitations:PAYROLL_LIMITATIONS}}; }

const FINANCIAL_COVERAGE_PROVIDERS = new Set(['STJ', 'TJES', 'TJCE', 'TJSC', 'TJBA', 'TJGO', 'TJRJ', 'TJAM', 'TJRR', 'TJPA', 'TJPE', 'TJPI', 'TJRS', 'TJMG', 'TJSP', 'TJSE', 'TJAC', 'TJMT', 'TJDFT', 'TJAL', 'TJMA', 'TJMS', 'CNJ', 'PNCP']);
export async function getJudiciaryFinancialProfile(pool:Pool, tribunalId:string) { const [overview,coverage,methodology]=await Promise.all([getJudiciaryFinancialOverview(pool,tribunalId),getJudiciaryFinancialCoverage(pool),getJudiciaryFinancialMethodology(pool)]); const hasData=overview.facts.length>0||overview.payroll.length>0; return {availability:hasData?'AVAILABLE':(overview.revision?'NOT_PUBLISHED':'SOURCE_UNAVAILABLE'),data:{overview,coverage:coverage.filter((x:any)=>FINANCIAL_COVERAGE_PROVIDERS.has(x.source_provider)),methodology},provenance:{source:'civica_jud financial layer',limitations:['Estágios financeiros não são somados entre si',...(hasData?[]:['Não há fatos financeiros publicados para este tribunal'])]}}; }

/** Quadro de pessoal e pagamentos a fornecedores (P14.16) — generalizado por tribunal, não restrito a um
 * só tribunal como `isStj`/`isStf` fazem para jurisprudência: qualquer tribunal com fato publicado aparece. */
export async function getJudiciaryPersonnelProfile(pool: Pool, tribunalId: string) {
  const [overview, suppliers] = await Promise.all([getJudiciaryPersonnelOverview(pool, tribunalId), getJudiciarySupplierPayments(pool, tribunalId)]);
  const annexes = [...new Set(overview.byAnnexStatus.map((r: any) => r.source_annex))];
  const byCareer = Object.fromEntries(await Promise.all(annexes.map(async (a) => [a, await getJudiciaryPersonnelByCareer(pool, tribunalId, a as string)])));
  const hasData = overview.byAnnexStatus.length > 0 || suppliers.topSuppliers.length > 0;
  return { availability: hasData ? 'AVAILABLE' : (overview.revision ? 'NOT_PUBLISHED' : 'SOURCE_UNAVAILABLE'), data: { overview, byCareer, suppliers }, provenance: { source: 'civica_jud personnel layer', limitations: ['Quadro de pessoal, nunca remuneração individual.', 'Pagamento a fornecedor é o valor do documento no mês, não o valor total do contrato.'] } };
}
export async function getJudiciaryFinancialHistory(pool:Pool, tribunalId:string, indicatorId:string) { const [overview,methodology]=await Promise.all([getJudiciaryFinancialOverview(pool,tribunalId),getJudiciaryFinancialMethodology(pool)]); const data=overview.payroll.filter((x:any)=>indicatorId==='PAYROLL' || indicatorId===x.account); return {availability:data.length?'AVAILABLE':'NOT_REPORTED',data:{indicatorId,items:data},provenance:{source:'STJ/CNJ',limitations:['Folha agregada; sem indivíduos']}}; }

export async function getJudiciaryTerritorialInstitutions(pool:Pool, territory:{uf?:string;ibgeCode?:string}) {
  if(territory.ibgeCode){const units=(await pool.query(`SELECT u.unit_id,u.official_name,u.tribunal_id,u.unit_type,u.physical_municipality_source_code,u.physical_uf,u.match_status FROM ${JUDICIARY_SCHEMA}.jud_unit u WHERE u.physical_municipality_source_code=$1 AND u.physical_entity_id IS NOT NULL ORDER BY u.official_name`,[territory.ibgeCode])).rows; return {availability:units.length?'AVAILABLE':'UNVERIFIED_RELATION',data:{units},provenance:{source:'civica_jud physical unit catalog',limitations:units.length?[]:['Não há relação IBGE municipal comprovada']}}; }
  if(territory.uf){const items=(await pool.query(`SELECT DISTINCT t.tribunal_id,t.sigla,t.official_name,b.code branch_code FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id LEFT JOIN ${JUDICIARY_SCHEMA}.jud_unit u ON u.tribunal_id=t.tribunal_id WHERE t.seat_uf=$1 OR u.physical_uf=$1 ORDER BY t.official_name`,[territory.uf.toUpperCase()])).rows; return {availability:items.length?'AVAILABLE':'NOT_REPORTED',data:{tribunals:items},provenance:{source:'civica_jud institutional/physical catalog',limitations:['Localização física não equivale a jurisdição']}}; }
  return {availability:'NOT_REPORTED' as const,data:{tribunals:[],units:[]},provenance:{source:'civica_jud',limitations:['Território não informado']}};
}

export async function getJudiciarySourceMethodology(pool:Pool, sourceId?:string) { const args:string[]=[]; const where:string[]=[]; if(sourceId){args.push(sourceId);where.push(`(provider=$1 OR scope=$1 OR indicator_id=$1)`)} const [snapshots,revisions,indicators]=await Promise.all([pool.query(`SELECT snapshot_id,provider,resource_name,source_url,fetched_at,source_updated_at,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details FROM ${JUDICIARY_SCHEMA}.jud_source_snapshot ${where.length?'WHERE provider=$1':''} ORDER BY fetched_at DESC`,sourceId?[sourceId]:[]),pool.query(`SELECT revision_id,scope,semantic_hash,row_count,state,is_active,last_known_good,created_at,activated_at,provenance FROM ${JUDICIARY_SCHEMA}.jud_publication_revision ORDER BY created_at DESC`),pool.query(`SELECT indicator_id,public_name,official_name,description,unit,source_variable,source_formula,numerator,denominator,statistical_universe,institutional_grain,time_grain,available_years,aggregation_allowed,comparison_eligible,source_edition,method_breaks,publication_status,missing_data_rule,methodology_reference,provenance FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator ORDER BY indicator_id`)]); return {availability:'AVAILABLE' as const,data:{snapshots:snapshots.rows,revisions:revisions.rows,indicators:indicators.rows},provenance:{source:'civica_jud provenance catalogs'}}; }
