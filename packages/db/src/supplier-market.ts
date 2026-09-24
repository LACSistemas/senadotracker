import type { DatabaseSync } from 'node:sqlite';
import { searchText } from '@senadotracker/domain';

export type SupplierActivity = 'all' | 'institutional' | 'parliamentary' | 'both';
export type SupplierHouse = 'all' | 'CAMARA' | 'SENADO';
export type SupplierExplorerSort = 'name' | 'parliamentary_value' | 'institutional_paid' | 'reach';

export interface SupplierExplorerQuery {
  search?: string;
  activity?: SupplierActivity;
  house?: SupplierHouse;
  year?: number;
  page?: number;
  pageSize?: number;
  sort?: SupplierExplorerSort;
  direction?: 'asc' | 'desc';
}

export interface SupplierExplorerItem {
  id: string;
  name: string;
  publicDocument: string | null;
  aliases: string[];
  activity: Exclude<SupplierActivity, 'all'>;
  houses: SupplierHouse[];
  parliamentary: { netCents: number; records: number; parliamentarians: number; ufs: number; parties: number } | null;
  institutional: { paidCents: number; contracts: number; commitments: number } | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

export function publishedSupplierGlobalDetail(db: DatabaseSync, supplierId: string, year?: number) {
  const supplier = db.prepare('SELECT id,canonical_name,entity_kind,identity_status,created_at,updated_at FROM suppliers WHERE id=?').get(supplierId) as Record<string, unknown> | undefined;
  if (!supplier) return null;
  const identifiers = db.prepare("SELECT identifier_type,normalized_value,is_masked,validation_status,source FROM supplier_identifiers WHERE supplier_id=? AND identifier_type='cnpj' ORDER BY validation_status,is_masked").all(supplierId).map(row => ({ type: String((row as Record<string,unknown>).identifier_type), value: String((row as Record<string,unknown>).normalized_value), masked: Boolean((row as Record<string,unknown>).is_masked), validation: String((row as Record<string,unknown>).validation_status), source: String((row as Record<string,unknown>).source) }));
  const names = db.prepare('SELECT name,is_canonical,source,first_seen_at,last_seen_at FROM supplier_names WHERE supplier_id=? ORDER BY is_canonical DESC,name').all(supplierId).map(row => row as Record<string, unknown>);
  const roles = db.prepare('SELECT role,institution,first_seen_at,last_seen_at,source FROM supplier_roles WHERE supplier_id=? ORDER BY institution,role').all(supplierId).map(row => row as Record<string, unknown>);
  const params: Array<string|number> = [supplierId];
  let yearClause = '';
  if (year !== undefined) { yearClause = ' AND year=?'; params.push(year); }
  const revision = db.prepare('SELECT revision_id,published_at FROM active_supplier_aggregate_revision ar JOIN supplier_aggregate_revisions r ON r.id=ar.revision_id WHERE singleton=1').get() as Record<string, unknown> | undefined;
  const revisionId = revision?.revision_id ? String(revision.revision_id) : '';
  const parliamentary = db.prepare(`SELECT year,institution,net_value_scaled,records,parliamentarians,ufs,parties,first_observed_at,last_observed_at FROM supplier_parliamentary_yearly WHERE revision_id=? AND supplier_id=?${yearClause} ORDER BY year DESC,institution`).all(revisionId, ...params).map(row => row as Record<string, unknown>);
  const institutional = db.prepare(`SELECT year,institution,committed_scaled,liquidated_scaled,paid_scaled,contracts,commitments,period_semantics FROM supplier_institutional_yearly WHERE revision_id=? AND supplier_id=?${yearClause} ORDER BY year DESC,institution`).all(revisionId, ...params).map(row => row as Record<string, unknown>);
  return { supplier: { id: String(supplier.id), name: supplier.canonical_name ? String(supplier.canonical_name) : null, entityKind: String(supplier.entity_kind), identityStatus: String(supplier.identity_status), createdAt: String(supplier.created_at), updatedAt: String(supplier.updated_at) }, identifiers, names, roles, parliamentary, institutional, revision: revision ? { id: String(revision.revision_id), publishedAt: String(revision.published_at) } : null };
}

const sortExpressions: Record<SupplierExplorerSort, string> = {
  name: 'search_text(name)',
  parliamentary_value: 'parliamentary_value',
  institutional_paid: 'institutional_paid',
  reach: 'parliamentarians',
};

export function publishedSupplierExplorer(db: DatabaseSync, query: SupplierExplorerQuery = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const year = query.year ?? new Date().getUTCFullYear();
  const activity = query.activity ?? 'all';
  const house = query.house ?? 'all';
  const sort = query.sort ?? 'parliamentary_value';
  const direction = query.direction ?? 'desc';
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Paginação de fornecedores inválida');
  if (!Number.isSafeInteger(year) || year < 2001 || year > 2100) throw new Error('Ano de fornecedores inválido');
  if (!['all', 'institutional', 'parliamentary', 'both'].includes(activity)) throw new Error('Tipo de atividade inválido');
  if (!['all', 'CAMARA', 'SENADO'].includes(house)) throw new Error('Casa inválida');
  if (!(sort in sortExpressions) || !['asc', 'desc'].includes(direction)) throw new Error('Ordenação de fornecedores inválida');

  const normalizedSearch = searchText(query.search?.trim() ?? '');
  const table = house === 'all' ? 'supplier_global_yearly' : 'supplier_global_house_yearly';
  const houseWhere = house === 'all' ? '' : ' AND g.institution=?';
  const searchJoin = normalizedSearch ? ` JOIN (SELECT supplier_id FROM supplier_names WHERE search_name GLOB ?||'*' UNION SELECT supplier_id FROM supplier_identifiers WHERE identifier_type='cnpj' AND validation_status='valid' AND is_masked=0 AND normalized_value GLOB ?||'*') matched ON matched.supplier_id=s.id` : '';
  const activityExpression = `CASE WHEN g.parliamentary_net_scaled IS NOT NULL AND g.institutional_paid_scaled IS NOT NULL THEN 'both' WHEN g.institutional_paid_scaled IS NOT NULL THEN 'institutional' ELSE 'parliamentary' END`;
  const activityWhere = activity === 'all' ? '' : ` AND ${activityExpression}=?`;
  const base = `FROM ${table} g JOIN active_supplier_aggregate_revision ar ON ar.revision_id=g.revision_id AND ar.singleton=1 JOIN suppliers s ON s.id=g.supplier_id${searchJoin} WHERE g.year=?${houseWhere}${activityWhere}`;
  const baseParams: Array<string | number> = normalizedSearch ? [normalizedSearch, normalizedSearch.replace(/\D/g,'') || '__no_document__'] : [];
  baseParams.push(year);if(house!=='all')baseParams.push(house);
  if (activity !== 'all') baseParams.push(activity);
  const total = Number((db.prepare(`SELECT count(*) total ${base}`).get(...baseParams) as Record<string, unknown> | undefined)?.total ?? 0);
  const sql = `SELECT s.id,s.canonical_name name,g.parliamentary_net_scaled parliamentary_value,g.parliamentary_records records,g.parliamentarians,g.ufs,g.parties,g.institutional_paid_scaled institutional_paid,g.institutional_contracts contracts,g.institutional_commitments commitments,g.first_observed_at first_at,g.last_observed_at last_at,${activityExpression} activity,(SELECT published_at FROM supplier_aggregate_revisions WHERE id=ar.revision_id) revision_published_at ${base} ORDER BY ${sortExpressions[sort]} ${direction.toUpperCase()} NULLS LAST,name COLLATE NOCASE,s.id LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...baseParams, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  const ids = rows.map(row => String(row.id));
  const aliasesBySupplier = new Map<string, string[]>(), documentsBySupplier = new Map<string, string>(), housesBySupplier = new Map<string, SupplierHouse[]>();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    for (const row of db.prepare(`SELECT supplier_id,name FROM supplier_names WHERE supplier_id IN (${placeholders}) ORDER BY supplier_id,is_canonical DESC,last_seen_at DESC,name`).all(...ids) as Record<string, unknown>[]) {
      const id = String(row.supplier_id), values = aliasesBySupplier.get(id) ?? [];
      const name = String(row.name);
      if (!values.includes(name)) values.push(name);
      aliasesBySupplier.set(id, values);
    }
    for (const row of db.prepare(`SELECT supplier_id,normalized_value FROM supplier_identifiers WHERE supplier_id IN (${placeholders}) AND identifier_type='cnpj' AND validation_status='valid' AND is_masked=0`).all(...ids) as Record<string, unknown>[]) documentsBySupplier.set(String(row.supplier_id), String(row.normalized_value));
    for (const row of db.prepare(`SELECT supplier_id,institution FROM supplier_roles WHERE supplier_id IN (${placeholders}) GROUP BY supplier_id,institution ORDER BY supplier_id,institution`).all(...ids) as Record<string, unknown>[]) {
      const id=String(row.supplier_id), values=housesBySupplier.get(id)??[];
      values.push(String(row.institution) as SupplierHouse);housesBySupplier.set(id,values);
    }
  }
  const items: SupplierExplorerItem[] = rows.map(row => ({
    id: String(row.id),
    name: String(row.name ?? 'Fornecedor sem nome publicado'),
    publicDocument: documentsBySupplier.get(String(row.id)) ?? null,
    aliases: aliasesBySupplier.get(String(row.id)) ?? [],
    activity: String(row.activity) as SupplierExplorerItem['activity'],
    houses: housesBySupplier.get(String(row.id)) ?? [],
    parliamentary: row.parliamentary_value === null ? null : { netCents: Number(row.parliamentary_value), records: Number(row.records), parliamentarians: Number(row.parliamentarians), ufs: Number(row.ufs), parties: Number(row.parties) },
    institutional: row.institutional_paid === null ? null : { paidCents: Number(row.institutional_paid), contracts: Number(row.contracts), commitments: Number(row.commitments) },
    firstObservedAt: row.first_at ? String(row.first_at) : null,
    lastObservedAt: row.last_at ? String(row.last_at) : null,
  }));
  return { year, page, pageSize, total, revisionPublishedAt: rows[0]?.revision_published_at ? String(rows[0].revision_published_at) : null, items };
}

export function publishedSupplierNetwork(db: DatabaseSync, supplierId:string, options:{year?:number;house?:SupplierHouse;limit?:number;parliamentarian?:{source:string;externalId:string}}={}) {
  const year=options.year??new Date().getUTCFullYear(), house=options.house??'all', limit=Math.min(100,Math.max(1,options.limit??25));
  const houseWhere=house==='all'?'':' AND e.source=?', params:Array<string|number>=house==='all'?[year,supplierId]:[year,house.toLowerCase(),supplierId];
  const supplier=db.prepare('SELECT id,canonical_name FROM suppliers WHERE id=?').get(supplierId) as Record<string,unknown>|undefined;
  if(!supplier)return null;
  const rows=db.prepare(`SELECT e.source,e.external_id,coalesce(p.name,e.external_id) name,p.uf,p.party,sum(e.net_cents-e.refund_cents) value,count(*) records FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id JOIN expense_supplier_links l ON l.batch_id=e.batch_id AND l.record_key=e.record_key AND l.match_status='confirmed' LEFT JOIN profiles p ON p.source=e.source AND p.external_id=e.external_id WHERE e.year=?${houseWhere} AND l.supplier_id=? GROUP BY e.source,e.external_id,p.name,p.uf,p.party ORDER BY value DESC,e.external_id LIMIT ?`).all(...params,limit) as Record<string,unknown>[];
  const total=rows.reduce((sum,row)=>sum+Number(row.value??0),0);
  const supplierRows=options.parliamentarian?db.prepare(`SELECT l.supplier_id,s.canonical_name name,sum(e.net_cents-e.refund_cents) value,count(*) records FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id JOIN expense_supplier_links l ON l.batch_id=e.batch_id AND l.record_key=e.record_key AND l.match_status='confirmed' JOIN suppliers s ON s.id=l.supplier_id WHERE e.year=?${houseWhere} AND e.source=? AND e.external_id=? GROUP BY l.supplier_id,s.canonical_name ORDER BY value DESC LIMIT ?`).all(year,...(house==='all'?[]:[house.toLowerCase()]),options.parliamentarian.source,options.parliamentarian.externalId,limit) as Record<string,unknown>[]:[];
  return {supplier:{id:String(supplier.id),name:String(supplier.canonical_name??'Fornecedor sem nome')},year,house,totalCents:total,parliamentarians:rows.map(row=>({source:String(row.source),externalId:String(row.external_id),name:String(row.name),uf:row.uf?String(row.uf):null,party:row.party?String(row.party):null,valueCents:Number(row.value??0),records:Number(row.records??0)})),suppliers:supplierRows.map(row=>({id:String(row.supplier_id),name:String(row.name),valueCents:Number(row.value??0),records:Number(row.records??0)}))};
}

export function publishedParliamentarianSupplierNetwork(db: DatabaseSync, source:string, externalId:string, options:{year?:number;limit?:number}={}) {
  const year=options.year??new Date().getUTCFullYear(), limit=Math.min(100,Math.max(1,options.limit??25));
  const rows=db.prepare(`SELECT l.supplier_id,s.canonical_name name,sum(e.net_cents-e.refund_cents) value,count(*) records FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id JOIN expense_supplier_links l ON l.batch_id=e.batch_id AND l.record_key=e.record_key AND l.match_status='confirmed' JOIN suppliers s ON s.id=l.supplier_id WHERE e.year=? AND e.source=? AND e.external_id=? GROUP BY l.supplier_id,s.canonical_name ORDER BY value DESC LIMIT ?`).all(year,source,externalId,limit) as Record<string,unknown>[];
  return {year,source,externalId,suppliers:rows.map(row=>({id:String(row.supplier_id),name:String(row.name),valueCents:Number(row.value??0),records:Number(row.records??0)}))};
}
