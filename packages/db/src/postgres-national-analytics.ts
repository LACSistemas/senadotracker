export type AnalyticsQueryable = { query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }> };

export type MetricCatalogRow = {
  metricId: string; label: string; description: string; domain: string; grain: string; unit: string;
  direction: string; periodSemantics: string; numerator: string | null; denominator: string | null;
  requiredCapabilities: string[]; comparabilityClass: string; supportedLevels: string[];
  supportedHouses: string[]; coverageRule: string; rankingAllowed: boolean; aggregationAllowed: boolean;
  nullSemantics: string; methodologyNote: string;
};

export type AnalyticsFilters = {
  level?: string; house?: string; uf?: string; party?: string; year?: number;
  periodStart?: string; periodEnd?: string; domain?: string; metricId?: string;
  page?: number; pageSize?: number; minSample?: number; coverageThreshold?: number;
};

export type RankingRow = {
  metricId: string; rank: number; entityId: string; entityName: string; houseId: string;
  level: string; houseUf: string | null; constituencyUf: string | null; uf: string | null; party: string | null;
  rawParty: string | null; canonicalPartyCode: string | null; canonicalPartyName: string | null; partyNormalizationStatus: string;
  value: string | null;
  numerator: string | null; denominator: string | null; periodStart: string | null;
  periodEnd: string | null; dataThrough: string | null; coverageStatus: string;
  comparabilityClass: string; methodology: string; sampleSize: number | null;
};

export type MetricCoverageRow = {
  metricId: string; houseId: string | null; level: string | null; status: string;
  numerator: string | null; denominator: string | null; value: string | null;
  dataThrough: string | null; snapshotAt: string; coverageThreshold: string;
  included: boolean; details: Record<string, unknown>;
};

const CATALOG_COLUMNS = `metric_id AS "metricId", label, description, domain, grain, unit, direction,
  period_semantics AS "periodSemantics", numerator, denominator, required_capabilities AS "requiredCapabilities",
  comparability_class AS "comparabilityClass", supported_levels AS "supportedLevels", supported_houses AS "supportedHouses",
  coverage_rule AS "coverageRule", ranking_allowed AS "rankingAllowed", aggregation_allowed AS "aggregationAllowed",
  null_semantics AS "nullSemantics", methodology_note AS "methodologyNote"`;

export async function getNationalMetricCatalog(pool: AnalyticsQueryable): Promise<MetricCatalogRow[]> {
  return (await pool.query<MetricCatalogRow>(`SELECT ${CATALOG_COLUMNS} FROM civica_national.metric_catalog ORDER BY metric_id`)).rows;
}

export async function getNationalMetricCoverage(pool: AnalyticsQueryable, metricId?: string, filters: AnalyticsFilters = {}): Promise<MetricCoverageRow[]> {
  const values: unknown[] = []; const where: string[] = ['1=1'];
  if (metricId) { values.push(metricId); where.push(`metric_id=$${values.length}`); }
  if (filters.house) { values.push(filters.house); where.push(`house_id=$${values.length}`); }
  if (filters.level) { values.push(filters.level); where.push(`level=$${values.length}`); }
  return (await pool.query<MetricCoverageRow>(`SELECT metric_id AS "metricId", house_id AS "houseId", level, status, numerator, denominator, value, data_through AS "dataThrough", snapshot_at AS "snapshotAt", coverage_threshold AS "coverageThreshold", included, details FROM civica_national.metric_coverage WHERE ${where.join(' AND ')} ORDER BY metric_id,house_id NULLS FIRST`, values)).rows;
}

export async function getNationalOverview(pool: AnalyticsQueryable, filters: AnalyticsFilters = {}) {
  const values: unknown[] = []; const where = ['is_current=true'];
  if (filters.level) { values.push(filters.level); where.push(`legislative_level=$${values.length}`); }
  if (filters.house) { values.push(filters.house); where.push(`house_id=$${values.length}`); }
  if (filters.uf) { values.push(filters.uf.toUpperCase()); where.push(`constituency_uf=$${values.length}`); }
  if (filters.party) { values.push(filters.party); where.push(`canonical_party_code=$${values.length}`); }
  const view='civica_national.current_legislators_analytics';
  const base = `FROM ${view} WHERE ${where.join(' AND ')}`;
  const [total, byLevel, byHouse, byUf, byParty] = await Promise.all([
    pool.query(`SELECT count(*)::bigint AS count ${base}`, values),
    pool.query(`SELECT legislative_level AS level,count(*)::bigint AS count ${base} GROUP BY legislative_level ORDER BY legislative_level`, values),
    pool.query(`SELECT house_id AS "houseId",max(house_name) AS "houseName",max(house_uf) AS "houseUf",NULL::text AS "constituencyUf",legislative_level AS level,count(*)::bigint AS count ${base} GROUP BY house_id,legislative_level ORDER BY house_id`, values),
    pool.query(`SELECT constituency_uf AS uf,count(*)::bigint AS count FROM ${view} WHERE ${where.filter(x=>x!=='is_current=true').concat(['is_current=true','constituency_uf IS NOT NULL']).join(' AND ')} GROUP BY constituency_uf ORDER BY constituency_uf`, values),
    pool.query(`SELECT canonical_party_code AS "canonicalPartyCode",max(canonical_party_name) AS "canonicalPartyName",count(*)::bigint AS count ${base} AND canonical_party_code IS NOT NULL GROUP BY canonical_party_code ORDER BY canonical_party_code`, values),
  ]);
  return { total: Number(total.rows[0]?.count ?? 0), byLevel: byLevel.rows, byHouse: byHouse.rows, byUf: byUf.rows, byParty: byParty.rows, period: { referenceYear: 2026, snapshotAt: new Date().toISOString() } };
}

function pagination(filters: AnalyticsFilters, values: unknown[]) {
  const page = filters.page ?? 1, pageSize = filters.pageSize ?? 100;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('invalid analytics pagination');
  values.push(pageSize, (page - 1) * pageSize); return { page, pageSize, limit: `$${values.length - 1}`, offset: `$${values.length}` };
}

function entityFilter(filters: AnalyticsFilters, alias = 'x', values: unknown[]) {
  const where = ['1=1'];
  if (filters.level) { values.push(filters.level); where.push(`${alias}.level=$${values.length}`); }
  if (filters.house) { values.push(filters.house); where.push(`${alias}.house_id=$${values.length}`); }
  if (filters.uf) { values.push(filters.uf.toUpperCase()); where.push(`${alias}.constituency_uf=$${values.length}`); }
  if (filters.party) { values.push(filters.party); where.push(`${alias}.canonical_party_code=$${values.length}`); }
  return where;
}

const metricSql = (metricId: string, values: unknown[]) => {
  if (metricId === 'CURRENT_LEGISLATORS' || metricId === 'HOUSE_SIZE') return `SELECT l.canonical_legislator_id entity_id,l.name entity_name,l.house_id,l.legislative_level level,l.house_uf,l.constituency_uf,l.constituency_uf uf,l.canonical_party_code party,l.raw_party,l.canonical_party_code,l.canonical_party_name,l.party_normalization_status,1::numeric value,1::bigint numerator,1::bigint denominator FROM civica_national.current_legislators_analytics l WHERE l.is_current=true`;
  if (metricId === 'AUTHORED_PROPOSITIONS') return `WITH authored AS (
    SELECT l.canonical_legislator_id entity_id,l.name entity_name,l.house_id,l.legislative_level level,l.house_uf,l.constituency_uf,l.constituency_uf uf,l.canonical_party_code party,l.raw_party,l.canonical_party_code,l.canonical_party_name,l.party_normalization_status,count(DISTINCT pa.proposal_external_id)::numeric value,count(DISTINCT pa.proposal_external_id)::bigint numerator,NULL::bigint denominator
    FROM civica_state.proposal_authors pa JOIN civica_national.domain_capabilities c ON c.house_id=pa.house AND c.domain='LEGISLATIVE' AND c.active_revision=pa.revision_id AND c.status='OPERATIONAL'
    JOIN civica_national.current_legislators_analytics l ON l.house_id=pa.house AND l.source_entity_id=pa.person_external_id AND l.is_current=true WHERE pa.actor_type_canonical IN ('INDIVIDUAL_DEPUTY','PERSON') OR pa.actor_type IN ('INDIVIDUAL_DEPUTY','person') GROUP BY l.canonical_legislator_id,l.name,l.house_id,l.legislative_level,l.house_uf,l.constituency_uf,l.canonical_party_code,l.raw_party,l.canonical_party_name,l.party_normalization_status
    UNION ALL
    SELECT l.canonical_legislator_id entity_id,l.name entity_name,l.house_id,l.legislative_level level,l.house_uf,l.constituency_uf,l.constituency_uf uf,l.canonical_party_code party,l.raw_party,l.canonical_party_code,l.canonical_party_name,l.party_normalization_status,count(DISTINCT pa.proposal_id)::numeric,count(DISTINCT pa.proposal_id)::bigint,NULL::bigint
    FROM civica.proposal_authors pa JOIN civica.active_publications ap ON ap.batch_id=pa.batch_id
    JOIN civica_national.current_legislators_analytics l ON l.house_id=CASE WHEN ap.source='camara' THEN 'CAMARA' WHEN ap.source='senado' THEN 'SENADO' END AND l.source_entity_id=pa.person_external_id AND l.is_current=true
    GROUP BY l.canonical_legislator_id,l.name,l.house_id,l.legislative_level,l.house_uf,l.constituency_uf,l.canonical_party_code,l.raw_party,l.canonical_party_name,l.party_normalization_status) SELECT * FROM authored`;
  if (metricId === 'RAPPORTEURSHIPS') return `SELECT l.canonical_legislator_id entity_id,l.name entity_name,l.house_id,l.legislative_level level,l.house_uf,l.constituency_uf,l.constituency_uf uf,l.canonical_party_code party,l.raw_party,l.canonical_party_code,l.canonical_party_name,l.party_normalization_status,count(DISTINCT r.proposal_external_id)::numeric value,count(DISTINCT r.proposal_external_id)::bigint numerator,NULL::bigint denominator FROM civica_state.state_rapporteurships r JOIN civica_national.domain_capabilities c ON c.house_id=r.house AND c.domain='RAPPORTEURSHIP' AND c.active_revision=r.revision_id AND c.status='OPERATIONAL' JOIN civica_national.current_legislators_analytics l ON l.house_id=r.house AND l.source_entity_id=COALESCE(r.person_external_id,r.source_person_id) AND l.is_current=true GROUP BY l.canonical_legislator_id,l.name,l.house_id,l.legislative_level,l.house_uf,l.constituency_uf,l.canonical_party_code,l.raw_party,l.canonical_party_name,l.party_normalization_status`;
  if (metricId === 'PERSONNEL_HEADCOUNT_WITHIN_HOUSE') return `SELECT l.canonical_legislator_id entity_id,l.name entity_name,l.house_id,l.legislative_level level,l.house_uf,l.constituency_uf,l.constituency_uf uf,l.canonical_party_code party,l.raw_party,l.canonical_party_code,l.canonical_party_name,l.party_normalization_status,count(DISTINCT s.staff_key)::numeric value,count(DISTINCT s.staff_key)::bigint numerator,NULL::bigint denominator FROM civica_state.state_office_staff_snapshots s JOIN civica_national.domain_capabilities c ON c.house_id=s.house AND c.domain='PERSONNEL' AND c.status='OPERATIONAL' JOIN civica_national.current_legislators_analytics l ON l.house_id=s.house AND l.source_entity_id=s.person_external_id AND l.is_current=true WHERE s.is_active=true AND s.is_parliamentary_office_staff IN ('true','TRUE','YES','Y') GROUP BY l.canonical_legislator_id,l.name,l.house_id,l.legislative_level,l.house_uf,l.constituency_uf,l.canonical_party_code,l.raw_party,l.canonical_party_name,l.party_normalization_status`;
  return null;
};

export async function getNationalRanking(pool: AnalyticsQueryable, metricId: string, filters: AnalyticsFilters = {}) {
  const catalog = (await pool.query<{comparabilityClass:string;rankingAllowed:boolean;methodologyNote:string}>(`SELECT comparability_class AS "comparabilityClass",ranking_allowed AS "rankingAllowed",methodology_note AS "methodologyNote" FROM civica_national.metric_catalog WHERE metric_id=$1`, [metricId])).rows[0];
  if (!catalog) throw new Error(`unknown metric ${metricId}`);
  if (!catalog.rankingAllowed) return { metricId, rows: [], page: filters.page ?? 1, pageSize: filters.pageSize ?? 100, rejected: 'RANKING_NOT_ALLOWED', comparabilityClass: catalog.comparabilityClass };
  if (catalog.comparabilityClass === 'WITHIN_HOUSE_ONLY' && !filters.house) return { metricId, rows: [], page: filters.page ?? 1, pageSize: filters.pageSize ?? 100, rejected: 'HOUSE_FILTER_REQUIRED_FOR_WITHIN_HOUSE_METRIC', comparabilityClass: catalog.comparabilityClass };
  const values: unknown[] = []; const sql = metricSql(metricId, values);
  if (!sql) return { metricId, rows: [], page: filters.page ?? 1, pageSize: filters.pageSize ?? 100, rejected: 'NOT_AVAILABLE_AS_NATIONAL_METRIC', comparabilityClass: catalog.comparabilityClass };
  const where = entityFilter(filters, 'x', values); const p = pagination(filters, values);
  const countResult = await pool.query<{total:string}>(`WITH x AS (${sql}) SELECT count(*)::bigint AS total FROM x WHERE ${where.join(' AND ')}`, values.slice(0, -2));
  const total = Number(countResult.rows[0]?.total ?? 0);
  const meta = values.length + 1;
  const rows = await pool.query<RankingRow>(`WITH x AS (${sql}), filtered AS (SELECT x.*, row_number() OVER (ORDER BY x.value DESC NULLS LAST,x.house_id,x.entity_name,x.entity_id) AS rank FROM x WHERE ${where.join(' AND ')}) SELECT $${meta}::text AS "metricId",rank,x.entity_id AS "entityId",x.entity_name AS "entityName",x.house_id AS "houseId",x.level,x.house_uf AS "houseUf",x.constituency_uf AS "constituencyUf",x.uf,x.party,x.raw_party AS "rawParty",x.canonical_party_code AS "canonicalPartyCode",x.canonical_party_name AS "canonicalPartyName",x.party_normalization_status AS "partyNormalizationStatus",x.value,x.numerator,x.denominator,NULL::text AS "periodStart",NULL::text AS "periodEnd",NULL::text AS "dataThrough",COALESCE(c.status,'UNKNOWN') AS "coverageStatus",$${meta+1}::text AS "comparabilityClass",$${meta+2}::text AS methodology,NULL::int AS "sampleSize" FROM filtered x LEFT JOIN civica_national.metric_coverage c ON c.metric_id=$${meta+3} AND c.house_id=x.house_id ORDER BY rank LIMIT ${p.limit} OFFSET ${p.offset}`, [...values,metricId,catalog.comparabilityClass,catalog.methodologyNote,metricId]);
  return { metricId, rows: rows.rows, page: p.page, pageSize: p.pageSize, comparabilityClass: catalog.comparabilityClass, disclosure: { total, eligible: total, included: rows.rows.length, excluded: Math.max(0,total-rows.rows.length), period: { periodStart: filters.periodStart ?? null, periodEnd: filters.periodEnd ?? null, referenceYear: filters.year ?? 2026 }, methodology: catalog.methodologyNote } };
}

export async function getHouseRanking(pool: AnalyticsQueryable, houseId: string, metricId: string, filters: AnalyticsFilters = {}) { return getNationalRanking(pool, metricId, { ...filters, house: houseId }); }

export async function getNationalPartyAggregates(pool: AnalyticsQueryable, metricId: string, filters: AnalyticsFilters = {}) {
  const cat = (await pool.query<{comparabilityClass:string}>(`SELECT comparability_class AS "comparabilityClass" FROM civica_national.metric_catalog WHERE metric_id=$1`,[metricId])).rows[0];
  if (cat?.comparabilityClass === 'WITHIN_HOUSE_ONLY' && !filters.house) return { metricId, comparabilityClass: cat.comparabilityClass, rows: [], rejected: 'HOUSE_FILTER_REQUIRED_FOR_WITHIN_HOUSE_METRIC' };
  const ranking = await getNationalRanking(pool, metricId, { ...filters, page: 1, pageSize: 500 });
  const rows = ranking.rows as RankingRow[]; const groups = new Map<string, { canonicalPartyCode: string; canonicalPartyName: string | null; value: number; numerator: number; denominator: number | null; entities: number }>();
  for (const r of rows) { if (!r.canonicalPartyCode) continue; const g=groups.get(r.canonicalPartyCode)??{canonicalPartyCode:r.canonicalPartyCode,canonicalPartyName:r.canonicalPartyName??null,value:0,numerator:0,denominator:null,entities:0}; g.value+=Number(r.value??0);g.numerator+=Number(r.numerator??0);g.entities++;groups.set(r.canonicalPartyCode,g); }
  const values: unknown[]=[]; const where=['is_current=true']; if(filters.house){values.push(filters.house);where.push(`house_id=$${values.length}`)} if(filters.level){values.push(filters.level);where.push(`legislative_level=$${values.length}`)} if(filters.uf){values.push(filters.uf.toUpperCase());where.push(`constituency_uf=$${values.length}`)} const disclosure=(await pool.query<any>(`SELECT count(*)::int total,count(*) FILTER (WHERE canonical_party_code IS NOT NULL)::int normalized,count(*) FILTER (WHERE canonical_party_code IS NULL)::int unresolved,coalesce(array_agg(DISTINCT raw_party) FILTER (WHERE canonical_party_code IS NULL AND raw_party IS NOT NULL),'{}') unresolved_raw FROM civica_national.current_legislators_analytics WHERE ${where.join(' AND ')}`,values)).rows[0];
  return { metricId, comparabilityClass: ranking.comparabilityClass, rows:[...groups.values()].sort((a,b)=>b.value-a.value||a.canonicalPartyCode.localeCompare(b.canonicalPartyCode)), disclosure:{totalEntities:Number(disclosure.total),normalizedEntities:Number(disclosure.normalized),unresolvedEntities:Number(disclosure.unresolved),coveragePercent:disclosure.total?Number(disclosure.normalized)/Number(disclosure.total)*100:null,unresolvedRawValues:disclosure.unresolved_raw??[]} };
}

export async function getNationalUfAggregates(pool: AnalyticsQueryable, metricId: string, filters: AnalyticsFilters = {}) {
  const cat = (await pool.query<{comparabilityClass:string}>(`SELECT comparability_class AS "comparabilityClass" FROM civica_national.metric_catalog WHERE metric_id=$1`,[metricId])).rows[0];
  if (cat?.comparabilityClass === 'WITHIN_HOUSE_ONLY' && !filters.house) return { metricId, comparabilityClass: cat.comparabilityClass, rows: [], rejected: 'HOUSE_FILTER_REQUIRED_FOR_WITHIN_HOUSE_METRIC' };
  const ranking = await getNationalRanking(pool, metricId, { ...filters, page: 1, pageSize: 500 }); const rows=ranking.rows as RankingRow[]; const groups=new Map<string,{uf:string;value:number;numerator:number;denominator:number|null;entities:number}>();
  for(const r of rows){if(!r.constituencyUf)continue;const g=groups.get(r.constituencyUf)??{uf:r.constituencyUf,value:0,numerator:0,denominator:null,entities:0};g.value+=Number(r.value??0);g.numerator+=Number(r.numerator??0);g.entities++;groups.set(r.constituencyUf,g)}
  return { metricId, comparabilityClass: ranking.comparabilityClass, rows:[...groups.values()].sort((a,b)=>b.value-a.value||a.uf.localeCompare(b.uf)), disclosure:{totalEntities:rows.length,normalizedEntities:rows.filter(r=>r.constituencyUf).length,unresolvedEntities:rows.filter(r=>!r.constituencyUf).length,coveragePercent:rows.length?rows.filter(r=>r.constituencyUf).length/rows.length*100:null,unresolvedRawValues:[]} };
}

export async function getNationalBudgetAggregates(pool: AnalyticsQueryable, stage: string, filters: AnalyticsFilters = {}) {
  const fields: Record<string,string>={INDICATED:'amount_indicated_cents',APPROVED:'amount_approved_cents',CURRENT:'amount_current_cents',COMMITTED:'amount_committed_cents',LIQUIDATED:'amount_liquidated_cents',PAID:'amount_paid_cents',USED:'amount_used_cents'}; const field=fields[stage.toUpperCase()]; if(!field) throw new Error(`unknown budget stage ${stage}`);
  const values: unknown[]=[];const where=['1=1']; if(filters.house){values.push(filters.house);where.push(`a.house=$${values.length}`)} if(filters.year){values.push(filters.year);where.push(`a.fiscal_year=$${values.length}`)}
  const rows=await pool.query(`SELECT a.house AS "houseId",a.fiscal_year AS "year",count(*)::bigint AS "amendmentCount",sum(a.${field})::numeric/100 AS amount, min(r.data_through)::text AS "dataThrough", c.status AS "coverageStatus" FROM civica_state_budget.amendments a JOIN civica_state_budget.active_publications ap ON ap.house=a.house AND ap.fiscal_year=a.fiscal_year AND ap.domain='state_budget_amendments' AND ap.revision_id=a.revision_id LEFT JOIN civica_state_budget.revisions r ON r.revision_id=a.revision_id LEFT JOIN civica_national.domain_capabilities c ON c.house_id=a.house AND c.domain='BUDGET_AMENDMENTS' WHERE ${where.join(' AND ')} GROUP BY a.house,a.fiscal_year,c.status ORDER BY a.house`, values);
  return { stage:stage.toUpperCase(), rows:rows.rows, semantics:'stage-specific sums; NULL source values remain NULL and are excluded from SUM', crossHouseRanking:false };
}

export type StateLegislatureOverview = {
  total: number;
  houses: Array<{ houseId: string; houseName: string; houseUf: string | null; count: number }>;
  parties: Array<{ canonicalPartyCode: string; canonicalPartyName: string | null; count: number; houses: number }>;
  unresolvedPartyCount: number;
  coverage: Array<{ domain: string; available: number; partial: number; unavailable: number; notApplicable: number }>;
  coverageByHouse: Array<{ houseId: string; domain: string; status: string }>;
  snapshotAt: string;
};

/** Set-based read contract for the editorial subnational landing. */
export async function getStateLegislatureOverview(pool: AnalyticsQueryable): Promise<StateLegislatureOverview> {
  const stateWhere = "is_current=true AND legislative_level IN ('STATE_DEPUTY','DISTRICT_DEPUTY')";
  const [total, houses, parties, unresolved, capabilities] = await Promise.all([
    pool.query<{ count: string }>(`SELECT count(*)::bigint AS count FROM civica_national.current_legislators_analytics WHERE ${stateWhere}`),
    pool.query(`SELECT house_id AS "houseId",max(house_name) AS "houseName",max(house_uf) AS "houseUf",count(*)::bigint AS count FROM civica_national.current_legislators_analytics WHERE ${stateWhere} GROUP BY house_id ORDER BY count DESC,house_id`),
    pool.query(`SELECT canonical_party_code AS "canonicalPartyCode",max(canonical_party_name) AS "canonicalPartyName",count(*)::bigint AS count,count(DISTINCT house_id)::int AS houses FROM civica_national.current_legislators_analytics WHERE ${stateWhere} AND canonical_party_code IS NOT NULL GROUP BY canonical_party_code ORDER BY count DESC,canonical_party_code`),
    pool.query<{ count: string }>(`SELECT count(*)::bigint AS count FROM civica_national.current_legislators_analytics WHERE ${stateWhere} AND canonical_party_code IS NULL`),
    pool.query(`SELECT house_id AS "houseId",domain,status FROM civica_national.domain_capabilities WHERE house_id NOT IN ('CAMARA','SENADO') ORDER BY house_id,domain`),
  ]);
  const grouped = new Map<string, { domain: string; available: number; partial: number; unavailable: number; notApplicable: number }>();
  for (const row of capabilities.rows as Array<{ domain: string; status: string }>) {
    const item = grouped.get(row.domain) ?? { domain: row.domain, available: 0, partial: 0, unavailable: 0, notApplicable: 0 };
    if (row.status === 'OPERATIONAL' || row.status === 'AVAILABLE') item.available += 1;
    else if (row.status === 'PARTIAL') item.partial += 1;
    else if (row.status === 'NOT_APPLICABLE') item.notApplicable += 1;
    else item.unavailable += 1;
    grouped.set(row.domain, item);
  }
  return {
    total: Number(total.rows[0]?.count ?? 0),
    houses: houses.rows.map((row: any) => ({ houseId: String(row.houseId), houseName: String(row.houseName), houseUf: row.houseUf == null ? null : String(row.houseUf), count: Number(row.count) })),
    parties: parties.rows.map((row: any) => ({ canonicalPartyCode: String(row.canonicalPartyCode), canonicalPartyName: row.canonicalPartyName == null ? null : String(row.canonicalPartyName), count: Number(row.count), houses: Number(row.houses) })),
    unresolvedPartyCount: Number(unresolved.rows[0]?.count ?? 0),
    coverage: [...grouped.values()].sort((a, b) => a.domain.localeCompare(b.domain)),
    coverageByHouse: capabilities.rows.map((row: any) => ({ houseId: String(row.houseId), domain: String(row.domain), status: String(row.status) })),
    snapshotAt: new Date().toISOString(),
  };
}
