import type { Pool, PoolClient } from 'pg';

/**
 * Grafo pai → filhos das proposições da Câmara, derivado de `principal_id` (uriPropPrincipal oficial).
 *
 * `principal_id` significa "esta proposição está oficialmente ligada a esta principal da tramitação". Não afirma que a
 * emenda altera o texto desta matéria: em apensações a principal é a matéria condutora, e ESB/SBR/SBE-A atuam sobre um
 * substitutivo ou emenda intermediário. Por isso o contrato preserva pai imediato, matéria raiz e profundidade.
 */
type Queryable = Pick<Pool | PoolClient, 'query'>;
type Source = 'camara' | 'senado';

export const AMENDMENT_GROUP = 'emendas_substitutivos';
export const ROOT_GROUP = 'proposicoes_legislativas_principais';
export const MAX_ANCESTRY_DEPTH = 10;
export const AMENDMENTS_PAGE_SIZE = 25;
const NESTED_LIMIT = 40;

/** DDL idempotente: matérias históricas de suporte (fora do universo 2026), fila de resolução e índice pai → filhos. */
export const PROPOSITION_GRAPH_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS civica_poc.proposal_support (
    source text NOT NULL, external_id text NOT NULL, type text NOT NULL, number bigint, year integer,
    functional_group text NOT NULL, label text NOT NULL, summary text, presented_at timestamptz, status text,
    principal_id text, previous_id text, next_id text, catalog_role text NOT NULL DEFAULT 'relationship_support',
    discovered_by text, depth integer NOT NULL DEFAULT 1, raw_id text, official_url text, resolved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source, external_id))`,
  `CREATE TABLE IF NOT EXISTS civica_poc.proposal_support_themes (
    source text NOT NULL, proposal_id text NOT NULL, code text NOT NULL, label text NOT NULL, relevance text, raw_id text,
    PRIMARY KEY (source, proposal_id, code))`,
  `CREATE TABLE IF NOT EXISTS civica_poc.principal_resolution_queue (
    source text NOT NULL, parent_id text NOT NULL, state text NOT NULL DEFAULT 'pending', depth integer NOT NULL DEFAULT 1,
    priority integer NOT NULL DEFAULT 1, attempts integer NOT NULL DEFAULT 0, last_error text, first_child_id text,
    child_count integer NOT NULL DEFAULT 0, discovered_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz, PRIMARY KEY (source, parent_id),
    CONSTRAINT principal_queue_state CHECK (state IN ('pending','resolved','failed','not_found')))`,
  `CREATE INDEX IF NOT EXISTS principal_queue_pending_idx ON civica_poc.principal_resolution_queue (source, state, priority, depth, attempts)`,
  `CREATE INDEX IF NOT EXISTS proposal_support_principal_idx ON civica_poc.proposal_support (source, principal_id)`,
  `CREATE INDEX IF NOT EXISTS proposals_principal_idx ON civica_poc.proposals (source, batch_id, principal_id, functional_group)`,
];

export async function ensurePropositionGraphSchema(db: Queryable) {
  const done = (await db.query(`SELECT (to_regclass('civica_poc.proposals_principal_idx') IS NOT NULL AND to_regclass('civica_poc.principal_queue_pending_idx') IS NOT NULL AND to_regclass('civica_poc.proposal_support_principal_idx') IS NOT NULL) ok`)).rows[0]?.ok;
  if (done) return;
  for (const sql of PROPOSITION_GRAPH_SCHEMA_SQL) await db.query(sql);
}

const fold = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Remove repetições do mesmo parlamentar dentro de uma proposição, sem perder coautores legítimos (nomes distintos). */
export function dedupeAuthors<T extends { name?: string | null; party?: string | null; uf?: string | null; externalId?: string | null }>(rows: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = fold(row.name) || `id:${row.externalId ?? ''}`;
    const current = byKey.get(key);
    const score = (item: T) => (item.party ? 2 : 0) + (item.uf ? 1 : 0) + (item.externalId ? 1 : 0);
    if (!current || score(row) > score(current)) byKey.set(key, current ? { ...current, ...row } : row);
  }
  return [...byKey.values()];
}

export interface RelationNode {
  id: string; source: Source; type: string | null; number: string | null; year: number | null; identifierYear?: number | null; presentedYear?: number | null; label: string | null; summary: string | null;
  presentedAt: string | null; status: string | null; functionalGroup: string | null; principalId: string | null;
  role: 'catalog' | 'relationship_support' | 'unresolved'; hasPage: boolean; themes: string[]; href: string | null;
}
export interface RelationGraph {
  /** Pai imediato primeiro; a matéria raiz (grupo "principais") é o último elemento quando a cadeia chega a ela. */
  ancestors: RelationNode[]; parent: RelationNode | null; root: RelationNode | null; depth: number; reachesRoot: boolean; cycle: boolean; truncated: boolean;
}
export interface AmendmentAuthor { name: string; party: string | null; uf: string | null; externalId: string | null }
export interface AmendmentItem {
  id: string; externalKey: string; label: string; type: string; number: string | null; /** @deprecated use identifierYear */ year: number | null; identifierYear: number | null; presentedYear: number | null; summary: string | null; presentedAt: string | null; status: string | null;
  authors: AmendmentAuthor[]; immediateParentId: string; rootProposalId: string | null; relationDepth: number; href: string; officialUrl: string;
  relation: { origin: 'official_uri'; kind: 'principal'; evidence: ApensacaoEvidence | null }; children: AmendmentItem[]; childrenTotal: number;
}
export interface ApensacaoEvidence { status: 'confirmada' | 'nao_comprovada'; citedLabel: string; citedId: string | null }
export interface AmendmentGraph {
  total: number; bySigla: { type: string; count: number }[]; typeFilter: string | null; page: number; pageSize: number; pageCount: number; items: AmendmentItem[];
  nestedTotal: number; withChildren: number; limitedBy: 'page';
}
export interface AmendmentQuery { type?: string | null | undefined; page?: number | undefined; pageSize?: number | undefined }

const hrefFor = (source: Source, id: string) => `/legislativo/proposicoes/${source}/${encodeURIComponent(id)}`;
const officialUrlFor = (id: string) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value == null ? null : String(value);

async function activeBatch(db: Queryable, source: Source): Promise<string | null> {
  return (await db.query('SELECT batch_id FROM civica_poc.active_publications WHERE source=$1', [source])).rows[0]?.batch_id ?? null;
}

function nodeFrom(row: any, role: RelationNode['role'], themes: string[]): RelationNode {
  const number = row.number == null ? null : String(row.number);
  return {
    id: String(row.external_id), source: 'camara', type: row.type ?? null, number, year: row.year == null ? null : Number(row.year), identifierYear: row.year == null ? null : Number(row.year), presentedYear: row.presented_year == null ? null : Number(row.presented_year),
    label: row.label ?? ([row.type, number].filter(Boolean).join(' ') + (row.year ? `/${row.year}` : '') || null), summary: row.summary ?? null,
    presentedAt: iso(row.presented_at), status: row.status ?? null, functionalGroup: row.functional_group ?? null, principalId: row.principal_id ?? null,
    role, hasPage: role !== 'unresolved', themes, href: role === 'unresolved' ? null : hrefFor('camara', String(row.external_id)),
  };
}

/** Resolve um conjunto de ids para nós, preferindo o catálogo ativo, depois a matéria histórica de suporte, depois o contexto antigo. */
async function lookupNodes(db: Queryable, source: Source, batch: string | null, ids: string[]): Promise<Map<string, RelationNode>> {
  const found = new Map<string, RelationNode>();
  if (!ids.length) return found;
  const [catalog, support, themes, context] = await Promise.all([
    batch ? db.query('SELECT external_id,type,number,year,presented_year,functional_group,label,summary,presented_at,status,principal_id FROM civica_poc.proposals WHERE source=$1 AND batch_id=$2 AND external_id=ANY($3)', [source, batch, ids]) : Promise.resolve({ rows: [] as any[] }),
    db.query('SELECT external_id,type,number,year,presented_year,functional_group,label,summary,presented_at,status,principal_id FROM civica_poc.proposal_support WHERE source=$1 AND external_id=ANY($2)', [source, ids]),
    Promise.all([
      batch ? db.query('SELECT proposal_id,label FROM civica_poc.proposal_themes WHERE source=$1 AND batch_id=$2 AND proposal_id=ANY($3) ORDER BY label', [source, batch, ids]) : Promise.resolve({ rows: [] as any[] }),
      db.query('SELECT proposal_id,label FROM civica_poc.proposal_support_themes WHERE source=$1 AND proposal_id=ANY($2) ORDER BY label', [source, ids]),
    ]),
    db.query('SELECT DISTINCT ON (parent_external_id) parent_external_id AS external_id,parent_type AS type,parent_number AS number,parent_year AS year,parent_label AS label,parent_summary AS summary FROM civica_poc.proposal_parent_context WHERE parent_source=$1 AND parent_external_id=ANY($2) ORDER BY parent_external_id', [source, ids]),
  ]);
  const themeMap = new Map<string, string[]>();
  for (const row of [...themes[0].rows, ...themes[1].rows]) { const list = themeMap.get(row.proposal_id) ?? []; if (!list.includes(row.label)) list.push(row.label); themeMap.set(row.proposal_id, list); }
  for (const row of context.rows) found.set(String(row.external_id), nodeFrom({ ...row, functional_group: null, principal_id: null, status: null, presented_at: null }, 'unresolved', []));
  for (const row of support.rows) found.set(String(row.external_id), nodeFrom(row, 'relationship_support', themeMap.get(row.external_id) ?? []));
  for (const row of catalog.rows) found.set(String(row.external_id), nodeFrom(row, 'catalog', themeMap.get(row.external_id) ?? []));
  for (const id of ids) if (!found.has(id)) found.set(id, { id, source, type: null, number: null, year: null, label: null, summary: null, presentedAt: null, status: null, functionalGroup: null, principalId: null, role: 'unresolved', hasPage: false, themes: [], href: null });
  return found;
}

/** Caminha por `principal_id` até a matéria raiz, com proteção contra ciclos e limite de profundidade. */
export async function loadRelationGraph(db: Queryable, source: Source, principalId: string | null | undefined, selfId: string): Promise<RelationGraph> {
  const empty: RelationGraph = { ancestors: [], parent: null, root: null, depth: 0, reachesRoot: false, cycle: false, truncated: false };
  if (source !== 'camara' || !principalId || principalId === selfId) return empty;
  const batch = await activeBatch(db, source);
  const visited = new Set<string>([selfId]);
  const ancestors: RelationNode[] = [];
  let cursor: string | null = principalId; let cycle = false, truncated = false;
  while (cursor) {
    if (visited.has(cursor)) { cycle = true; break; }
    if (ancestors.length >= MAX_ANCESTRY_DEPTH) { truncated = true; break; }
    visited.add(cursor);
    const node: RelationNode = (await lookupNodes(db, source, batch, [cursor])).get(cursor)!;
    ancestors.push(node);
    if (node.functionalGroup === ROOT_GROUP || node.role === 'unresolved') break;
    cursor = node.principalId;
  }
  const root = ancestors.find(node => node.functionalGroup === ROOT_GROUP) ?? null;
  return { ancestors, parent: ancestors[0] ?? null, root, depth: ancestors.length, reachesRoot: Boolean(root), cycle, truncated };
}

const CITATION = /\b(PL|PLP|PEC|MPV|PDL|PLV|PRC|PLN|PDC|PFC|PDS)\s*n?[º°o.]?\s*(\d{1,5})\s*(?:\/|,?\s*de\s+)\s*(\d{4})\b/i;

/** Compara a matéria citada na ementa com o pai oficial. Só marca "confirmada" quando a matéria citada existe na base e aponta para esse pai. */
async function apensacaoEvidence(db: Queryable, source: Source, batch: string | null, items: { id: string; summary: string | null }[], parent: RelationNode | null) {
  const out = new Map<string, ApensacaoEvidence>();
  if (!parent || parent.functionalGroup !== ROOT_GROUP) return out;
  const cited = new Map<string, { type: string; number: number; year: number; ids: string[] }>();
  for (const item of items) {
    const match = item.summary ? CITATION.exec(item.summary) : null; if (!match) continue;
    const type = match[1]!.toUpperCase(), number = Number(match[2]), year = Number(match[3]);
    if (parent.type === type && Number(parent.number) === number && parent.year === year) continue;
    const key = `${type}|${number}|${year}`; const entry = cited.get(key) ?? { type, number, year, ids: [] }; entry.ids.push(item.id); cited.set(key, entry);
  }
  if (!cited.size) return out;
  const keys = [...cited.values()];
  const rows = (await db.query(
    `SELECT t.type,t.number,t.year,coalesce(c.external_id,s.external_id) external_id,coalesce(c.principal_id,s.principal_id) principal_id
     FROM unnest($1::text[],$2::bigint[],$3::int[]) AS t(type,number,year)
     LEFT JOIN civica_poc.proposals c ON c.source=$4 AND c.batch_id=$5 AND c.type=t.type AND c.number=t.number AND c.year=t.year
     LEFT JOIN civica_poc.proposal_support s ON s.source=$4 AND s.type=t.type AND s.number=t.number AND s.year=t.year`,
    [keys.map(k => k.type), keys.map(k => k.number), keys.map(k => k.year), source, batch])).rows;
  for (const entry of keys) {
    const row = rows.find(r => r.type === entry.type && Number(r.number) === entry.number && Number(r.year) === entry.year);
    const confirmed = Boolean(row?.external_id && row.principal_id === parent.id);
    for (const id of entry.ids) out.set(id, { status: confirmed ? 'confirmada' : 'nao_comprovada', citedLabel: `${entry.type} ${entry.number}/${entry.year}`, citedId: row?.external_id ?? null });
  }
  return out;
}

const childSelect = `c.external_id,c.type,c.number,c.year,c.presented_year,c.label,c.summary,c.presented_at,c.status,c.principal_id,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('name',a.name,'party',a.party,'uf',a.uf,'externalId',a.person_external_id) ORDER BY a.author_key)
            FROM civica_poc.proposal_authors a WHERE a.source=c.source AND a.batch_id=c.batch_id AND a.proposal_id=c.external_id),'[]'::jsonb) authors`;

function itemFrom(row: any, depth: number, rootId: string | null, evidence: ApensacaoEvidence | null): AmendmentItem {
  const authors = dedupeAuthors<AmendmentAuthor>((row.authors ?? []).map((a: any) => ({ name: String(a.name ?? ''), party: a.party || null, uf: a.uf || null, externalId: a.externalId || null })).filter((a: AmendmentAuthor) => a.name));
  const id = String(row.external_id);
  return {
    id, externalKey: `camara:${id}`, label: String(row.label), type: String(row.type), number: row.number == null ? null : String(row.number), year: row.year == null ? null : Number(row.year), identifierYear: row.year == null ? null : Number(row.year), presentedYear: row.presented_year == null ? null : Number(row.presented_year),
    summary: row.summary ?? null, presentedAt: iso(row.presented_at), status: row.status ?? null, authors, immediateParentId: String(row.principal_id), rootProposalId: rootId,
    relationDepth: depth, href: hrefFor('camara', id), officialUrl: officialUrlFor(id), relation: { origin: 'official_uri', kind: 'principal', evidence }, children: [], childrenTotal: 0,
  };
}

/** Filhos diretos (emendas/substitutivos) de uma matéria, paginados e com um nível de aninhamento (ex.: SBT → ESB). */
export async function loadAmendmentGraph(db: Queryable, source: Source, parentId: string, rootId: string | null, parent: RelationNode | null, query: AmendmentQuery = {}): Promise<AmendmentGraph | null> {
  if (source !== 'camara') return null;
  const batch = await activeBatch(db, source); if (!batch) return null;
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? AMENDMENTS_PAGE_SIZE));
  const summary = (await db.query(`SELECT type,count(*)::int n FROM civica_poc.proposals WHERE source=$1 AND batch_id=$2 AND principal_id=$3 AND functional_group=$4 GROUP BY type ORDER BY n DESC,type`, [source, batch, parentId, AMENDMENT_GROUP])).rows;
  const total = summary.reduce((sum, row) => sum + Number(row.n), 0); if (!total) return null;
  const bySigla = summary.map(row => ({ type: String(row.type), count: Number(row.n) }));
  const typeFilter = query.type && bySigla.some(s => s.type === query.type) ? query.type : null;
  const filteredTotal = typeFilter ? bySigla.find(s => s.type === typeFilter)!.count : total;
  const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize)), page = Math.min(pageCount, Math.max(1, Math.floor(query.page ?? 1)));
  const rows = (await db.query(
    `SELECT ${childSelect} FROM civica_poc.proposals c WHERE c.source=$1 AND c.batch_id=$2 AND c.principal_id=$3 AND c.functional_group=$4 AND ($5::text IS NULL OR c.type=$5)
     ORDER BY c.type,c.year,c.number,c.external_id LIMIT $6 OFFSET $7`, [source, batch, parentId, AMENDMENT_GROUP, typeFilter, pageSize, (page - 1) * pageSize])).rows;
  const ids = rows.map(r => String(r.external_id));
  const [nestedRows, evidence] = await Promise.all([
    ids.length ? db.query(`SELECT ${childSelect} FROM civica_poc.proposals c WHERE c.source=$1 AND c.batch_id=$2 AND c.principal_id=ANY($3) AND c.functional_group=$4 ORDER BY c.principal_id,c.type,c.year,c.number,c.external_id`, [source, batch, ids, AMENDMENT_GROUP]) : Promise.resolve({ rows: [] as any[] }),
    apensacaoEvidence(db, source, batch, rows.map(r => ({ id: String(r.external_id), summary: r.summary })), parent),
  ]);
  const items = rows.map(row => itemFrom(row, 1, rootId, evidence.get(String(row.external_id)) ?? null));
  const byId = new Map(items.map(item => [item.id, item]));
  let nestedTotal = 0;
  for (const row of nestedRows.rows) {
    const holder = byId.get(String(row.principal_id)); if (!holder) continue;
    holder.childrenTotal++; nestedTotal++;
    if (holder.children.length < NESTED_LIMIT) holder.children.push(itemFrom(row, 2, rootId, null));
  }
  return { total, bySigla, typeFilter, page, pageSize, pageCount, items, nestedTotal, withChildren: items.filter(item => item.childrenTotal).length, limitedBy: 'page' };
}

/** Página de uma matéria histórica de suporte (fora do lote ativo), no mesmo formato do detalhe do catálogo. */
export async function loadSupportDetail(db: Queryable, source: Source, id: string) {
  if (source !== 'camara') return null;
  const row = (await db.query('SELECT s.*,ro.url origin_url,ro.fetched_at origin_fetched_at,ro.sha256 origin_sha256 FROM civica_poc.proposal_support s LEFT JOIN civica.raw_objects ro ON ro.id=s.raw_id WHERE s.source=$1 AND s.external_id=$2', [source, id])).rows[0];
  if (!row) return null;
  const themes = (await db.query('SELECT code,label,relevance,raw_id FROM civica_poc.proposal_support_themes WHERE source=$1 AND proposal_id=$2 ORDER BY label', [source, id])).rows;
  const presented = iso(row.presented_at) ?? '';
  return {
    proposal: { source, externalId: id, type: row.type, functionalGroup: row.functional_group, number: row.number == null ? null : String(row.number), year: row.year == null ? null : Number(row.year), identifierYear: row.year == null ? null : Number(row.year), presentedYear: row.presented_year == null ? null : Number(row.presented_year), label: row.label, summary: row.summary, presentedAt: presented, status: row.status, officialUrl: row.official_url ?? officialUrlFor(id), rawId: row.raw_id, principalProposalId: row.principal_id ?? null, previousProposalId: row.previous_id ?? null, nextProposalId: row.next_id ?? null, relationshipEvidence: row.principal_id ? 'official_uri' : null, catalogRole: 'relationship_support', discoveredByProposalId: row.discovered_by ?? null },
    authors: [], themes: themes.map(t => ({ source, externalKey: `theme:${id}:${t.code}`, kind: 'theme', proposalId: id, label: t.label, value: t.relevance, officialUrl: officialUrlFor(id), rawId: t.raw_id })),
    movements: [], relationships: [], principal: null, documents: [], amendments: [], deadlines: [], bodies: [], voteEffects: [], resultingNorms: [], details: [], deliberations: [],
    coverage: { availability: 'partial', source, period: { from: presented, to: presented, grain: 'snapshot' }, batchId: null, note: 'Matéria histórica de suporte: identificação, ementa, situação e temas oficiais, resolvidos por ser principal de proposições de 2026. Tramitação própria não coletada.', sampleSize: 1 },
    origin: { url: row.origin_url ?? '', fetchedAt: iso(row.origin_fetched_at) ?? '', sha256: row.origin_sha256 ?? '', publishedAt: iso(row.resolved_at) ?? '', batchId: 'relationship_support' },
  };
}

function principalCompat(node: RelationNode | null) {
  return node ? { id: node.id, label: node.label, type: node.type, number: node.number, year: node.year, summary: node.summary, status: node.status, role: node.role, hasPage: node.hasPage, href: node.href, themes: node.themes, movements: [] } : null;
}

/**
 * Complementa o detalhe base com o grafo da Câmara. Devolve `null` quando a matéria não existe nem como catálogo nem como suporte.
 * O caminho legado (átomos `amendment`) permanece para o Senado.
 */
export async function withRelationGraph(db: Queryable, source: Source, id: string, base: any | null, query: AmendmentQuery = {}) {
  const detail = base ?? await loadSupportDetail(db, source, id);
  if (!detail || source !== 'camara') return detail;
  const principalId: string | null = detail.proposal.principalProposalId ?? null;
  const graph = await loadRelationGraph(db, source, principalId, id);
  const self: RelationNode = { id, source, type: detail.proposal.type, number: detail.proposal.number, year: detail.proposal.year, label: detail.proposal.label, summary: detail.proposal.summary, presentedAt: detail.proposal.presentedAt, status: detail.proposal.status, functionalGroup: detail.proposal.functionalGroup, principalId, role: detail.proposal.catalogRole === 'relationship_support' ? 'relationship_support' : 'catalog', hasPage: true, themes: [], href: hrefFor(source, id) };
  const rootId = self.functionalGroup === ROOT_GROUP ? id : graph.root?.id ?? null;
  const children = await loadAmendmentGraph(db, source, id, rootId, self, query);
  const authors = dedupeAuthors<any>(detail.authors ?? []);
  return {
    ...detail, authors, principal: principalCompat(graph.parent),
    relation: { self: { id, depth: graph.depth, rootProposalId: rootId, immediateParentId: graph.parent?.id ?? null }, parent: graph.parent, ancestors: graph.ancestors, root: graph.root, depth: graph.depth, reachesRoot: graph.reachesRoot, cycle: graph.cycle, truncated: graph.truncated },
    amendments: children?.items ?? [], amendmentGraph: children,
  };
}
