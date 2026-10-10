export type NationalQueryable = { query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }> };

export type NationalLegislator = {
  canonicalLegislatorId: string; personId: string; legislativeLevel: string; chamberType: string;
  houseId: string; houseCode: string; houseName: string; houseUf: string | null; constituencyUf: string | null; uf: string | null; name: string;
  party: string | null; rawParty: string | null; canonicalPartyCode: string | null; canonicalPartyName: string | null;
  partyNormalizationStatus: string; mandateStart: string | null; mandateEnd: string | null; isCurrent: boolean;
  sourceSystem: string; sourceEntityId: string; profileRoute: string; coverage: Record<string, unknown>;
};

export type NationalLegislatorFilters = {
  level?: string; house?: string; uf?: string; party?: string; search?: string; current?: boolean;
  domain?: string; availableOnly?: boolean; page?: number; pageSize?: number;
};

const legislatorSelect = `
  l.canonical_legislator_id AS "canonicalLegislatorId",
  l.person_id AS "personId",
  l.legislative_level AS "legislativeLevel",
  l.chamber_type AS "chamberType",
  l.house_id AS "houseId",
  l.house_code AS "houseCode",
  l.house_name AS "houseName",
  l.house_uf AS "houseUf",
  l.constituency_uf AS "constituencyUf",
  l.uf AS "uf",
  l.name AS "name",
  l.party AS "party",
  l.raw_party AS "rawParty",
  l.canonical_party_code AS "canonicalPartyCode",
  l.canonical_party_name AS "canonicalPartyName",
  l.party_normalization_status AS "partyNormalizationStatus",
  l.mandate_start AS "mandateStart",
  l.mandate_end AS "mandateEnd",
  l.is_current AS "isCurrent",
  l.source_system AS "sourceSystem",
  l.source_entity_id AS "sourceEntityId",
  l.profile_route AS "profileRoute",
  l.coverage AS "coverage"`;

const pageBounds = (filters: NationalLegislatorFilters) => {
  const page = filters.page ?? 1, pageSize = filters.pageSize ?? 50;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw new Error('invalid national pagination');
  return { page, pageSize, offset: (page - 1) * pageSize };
};

function whereFor(filters: NationalLegislatorFilters, values: unknown[]) {
  const where = ['1=1'];
  if (filters.level) { where.push(`l.legislative_level=$${values.length + 1}`); values.push(filters.level); }
  if (filters.house) { where.push(`l.house_id=$${values.length + 1}`); values.push(filters.house); }
  if (filters.uf) { where.push(`l.constituency_uf=$${values.length + 1}`); values.push(filters.uf.toUpperCase()); }
  if (filters.party) { where.push(`l.canonical_party_code=$${values.length + 1}`); values.push(filters.party); }
  if (filters.search) { where.push(`l.name ILIKE $${values.length + 1}`); values.push(`%${filters.search}%`); }
  if (filters.current !== undefined) { where.push(`l.is_current=$${values.length + 1}`); values.push(filters.current); }
  if (filters.domain && filters.availableOnly !== false) {
    where.push(`EXISTS (SELECT 1 FROM civica_national.domain_capabilities c WHERE c.house_id=l.house_id AND c.domain=$${values.length + 1} AND c.status IN ('AVAILABLE','OPERATIONAL'))`);
    values.push(filters.domain);
  }
  return where.join(' AND ');
}

export async function getNationalLegislators(pool: NationalQueryable, filters: NationalLegislatorFilters = {}) {
  const { page, pageSize, offset } = pageBounds(filters), values: unknown[] = [], where = whereFor(filters, values);
  const view = 'civica_national.current_legislators_analytics';
  const total = Number((await pool.query<{ total: string }>(`SELECT count(*)::bigint AS total FROM ${view} l WHERE l.is_current=true AND ${where}`, values)).rows[0]?.total ?? 0);
  const rows = await pool.query<NationalLegislator>(`SELECT ${legislatorSelect} FROM ${view} l WHERE l.is_current=true AND ${where} ORDER BY l.house_id,l.name,l.canonical_legislator_id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
  return { total, page, pageSize, items: rows.rows };
}

export async function getNationalLegislatorById(pool: NationalQueryable, canonicalLegislatorId: string) {
  const result = await pool.query<NationalLegislator>(`SELECT ${legislatorSelect} FROM civica_national.current_legislators_analytics l WHERE l.canonical_legislator_id=$1 AND l.is_current=true LIMIT 1`, [canonicalLegislatorId]);
  return result.rows[0] ?? null;
}

export async function getNationalHouseCapabilities(pool: NationalQueryable, houseId?: string) {
  if (houseId) return (await pool.query('SELECT * FROM civica_national.domain_capabilities WHERE house_id=$1 ORDER BY domain', [houseId])).rows;
  return (await pool.query('SELECT * FROM civica_national.domain_capabilities ORDER BY house_id,domain')).rows;
}

export async function getNationalDomainCoverage(pool: NationalQueryable, domain?: string) {
  const values: unknown[] = [], where = domain ? 'WHERE domain=$1' : '';
  if (domain) values.push(domain);
  return (await pool.query(`SELECT * FROM civica_national.domain_capabilities ${where} ORDER BY house_id`, values)).rows;
}

export async function getNationalCoverageSummary(pool: NationalQueryable) {
  return (await pool.query(`SELECT domain,status,count(*)::int AS houses FROM civica_national.domain_capabilities GROUP BY domain,status ORDER BY domain,status`)).rows;
}
