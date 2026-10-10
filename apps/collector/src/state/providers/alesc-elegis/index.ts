import { createHash } from 'node:crypto';
import type { ExternalIdentityKey, NormalizedEntity, NormalizedMovement, NormalizedProposal, NormalizedProposalAuthor, Provenance, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export const ALESC_PROVIDER = providerId('alesc_elegis');
export const ALESC_BASE_URL = 'https://portalelegis.alesc.sc.gov.br';
export interface AlescRun { readonly entities: readonly NormalizedEntity[]; readonly raw: readonly RawEnvelope[]; readonly metrics: Record<string, number>; }

export async function runAlescElegis(options: { readonly limit?: number; readonly fetchImpl?: typeof fetch } = {}): Promise<AlescRun> {
  const fetchImpl = options.fetchImpl ?? fetch; const limit = Math.min(Math.max(options.limit ?? 10, 1), 10); const raw: RawEnvelope[] = []; const pages: any[][] = [];
  for (const page of [1, 2]) { const endpoint = `${ALESC_BASE_URL}/proposicoes/processo-legislativo?ano=2026&inicio=2026-01-01&fim=2026-12-31&page=${page}`; const response = await request(fetchImpl, endpoint, raw); pages.push(parseCatalog(response.body)); }
  const cards = [...pages[0]!, ...pages[1]!].slice(0, limit); const entities: NormalizedEntity[] = [];
  for (const card of cards) { const endpoint = `${ALESC_BASE_URL}${card.path}/tramitacoes`; const response = await request(fetchImpl, endpoint, raw); const parsed = parseDetail(response.body, card, response.envelope); entities.push(parsed.proposal, ...parsed.authors, ...parsed.movements); }
  return { entities, raw, metrics: { catalogRows: pages.reduce((n, page) => n + page.length, 0), pages: 2, proposals: entities.filter(entity => (entity as any).key?.resource === 'proposal').length, authorsObserved: entities.filter(entity => (entity as any).role).length, movements: entities.filter(entity => (entity as any).movementKey).length } };
}

export function parseCatalog(html: string): any[] {
  const rows: any[] = [];
  for (const match of html.matchAll(/<h4[^>]*class="card-title"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const path = decode(match[1]!); const block = html.slice(match.index ?? 0, Math.min(html.length, (match.index ?? 0) + 5000)); const label = clean(match[2]!) ?? '';
    const title = clean(first(block, /<p[^>]*class="mb-1 fst-italic[^>]*>([\s\S]*?)<\/p>/i)); const entry = clean(first(block, /<div[^>]*>Entrada<\/div>\s*<div[^>]*>([^<]+)<\/div>/i)); const author = clean(first(block, /<div[^>]*>Autoria<\/div>[\s\S]*?<li>([^<]+)<\/li>/i)); const numberMatch = label.match(/^([^/]+)\/(\d+)\/(\d{4})$/);
    rows.push({ path, label, title, entry, author, type: numberMatch?.[1], number: numberMatch?.[2], year: numberMatch ? Number(numberMatch[3]) : 2026 });
  }
  return rows;
}

export function parseDetail(html: string, card: any, raw: RawEnvelope): { proposal: NormalizedProposal; authors: NormalizedProposalAuthor[]; movements: NormalizedMovement[] } {
  const key = identity('proposal', card.path.split('/').filter(Boolean).pop()); const title = clean(first(html, /<p[^>]*style="[^"]*line-clamp[^>]*>([\s\S]*?)<\/p>/i)) ?? card.title; const fields = (name: string) => clean(first(html, new RegExp(`<th>\\s*${name}\\s*<\\/th>\\s*<td>([\s\S]*?)<\\/td>`, 'i')));
  const authorValues = [...html.matchAll(/<th>\s*Autoria\s*<\/th>[\s\S]*?<li>([^<]+)<\/li>/gi)].map(match => clean(match[1]!)).filter(Boolean) as string[];
  const authors = [...new Set(authorValues.length ? authorValues : [card.author].filter(Boolean))].map((author, index) => ({ proposal: key, actorType: 'other' as const, authorRaw: author, role: 'author', order: index + 1, provenance: provenance(raw) }));
  const movements: NormalizedMovement[] = [];
  for (const blockMatch of html.matchAll(/<(?:li|div)[^>]*class="[^"]*timeline-item[^"]*"[^>]*>([\s\S]*?)(?=<(?:li|div)[^>]*class="[^"]*timeline-item|<\/ul>|<\/section>)/gi)) {
    const block = blockMatch[1]!; const status = clean(first(block, /<p[^>]*fw-bold[^>]*>([\s\S]*?)<\/p>/i)); const date = parseDate(clean(first(block, /<small[^>]*>([^<]+)<\/small>/i))); const route = [...block.matchAll(/<small[^>]*>([^<]+)<\/small>/gi)].map(match => clean(match[1]!)).filter(Boolean) as string[]; const origin = route[1]; const destination = route[2]; const movementKey = createHash('sha256').update([key.externalId, date ?? '', status ?? '', origin ?? '', destination ?? ''].join('|')).digest('hex'); const movement: any = { proposal: key, movementKey, body: [origin, destination].filter(Boolean).join(' -> '), provenance: provenance(raw) }; if (date) movement.occurredAt = date; if (status) movement.status = status; movements.push(movement);
  }
  const proposal: any = { key, provenance: provenance(raw) }; if (title) proposal.title = title; if (card.type) proposal.type = card.type; if (card.number) proposal.number = card.number; if (card.year) proposal.year = card.year; const presented = parseDate(card.entry); if (presented) proposal.presentedAt = presented; const status = fields('Regime de tramitacao') ?? fields('Regime de tramitação'); if (status) proposal.status = status; return { proposal, authors, movements };
}

function identity(resource: string, value: unknown): ExternalIdentityKey { return { house: houseCode('SC'), provider: ALESC_PROVIDER, resource: resourceType(resource), externalId: externalId(String(value)) }; }
function provenance(raw: RawEnvelope): Provenance { return { rawId: raw.rawId, endpoint: raw.endpoint, fetchedAt: raw.fetchedAt, sha256: raw.sha256 }; }
async function request(fetchImpl: typeof fetch, endpoint: string, raw: RawEnvelope[]): Promise<{ body: string; envelope: RawEnvelope }> { const response = await fetchImpl(endpoint, { headers: { accept: 'text/html' } }); const body = await response.text(); if (!response.ok) throw new Error(`ALESC ${response.status}: ${endpoint}`); const sha256 = createHash('sha256').update(body).digest('hex'); const envelope: RawEnvelope = { house: houseCode('SC'), provider: ALESC_PROVIDER, resource: resourceType(endpoint.includes('/tramitacoes') ? 'proposal-movements' : 'proposal-catalog'), endpoint, params: {}, fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type') ?? 'text/html', sha256, rawId: `raw:sha256:${sha256}`, body }; raw.push(envelope); return { body, envelope }; }
function first(value: string, expression: RegExp): string | undefined { return value.match(expression)?.[1]; }
function clean(value: string | undefined): string | undefined { if (!value) return undefined; return decode(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || undefined; }
function decode(value: string): string { return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' '); }
function parseDate(value: string | undefined): string | undefined { const match = value?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return match ? `${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z` : undefined; }
