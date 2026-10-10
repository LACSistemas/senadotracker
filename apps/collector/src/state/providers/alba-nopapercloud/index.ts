import { createHash } from 'node:crypto';
import type { ExternalIdentityKey, NormalizedMovement, NormalizedPerson, NormalizedProposal, NormalizedProposalAuthor, NormalizedPartyMembership, Provenance, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export const ALBA_BASE_URL = 'https://albalegis.nopapercloud.com.br/spl/';
export const ALBA_PROVIDER = providerId('alba_nopapercloud');

export interface AlbaRaw { readonly envelope: RawEnvelope; readonly body: string; }
export interface AlbaProposalRecord { readonly proposal: NormalizedProposal; readonly authors: readonly NormalizedProposalAuthor[]; readonly movements: readonly NormalizedMovement[]; readonly raw: AlbaRaw; readonly label: string; }
export interface AlbaRun { readonly proposals: readonly AlbaProposalRecord[]; readonly persons: readonly NormalizedPerson[]; readonly partyObservations: readonly NormalizedPartyMembership[]; readonly raw: readonly AlbaRaw[]; readonly metrics: { requests: number; failures: number }; }

export async function runAlbaNopapercloud(options: { readonly limit?: number; readonly authorId?: string; readonly authorIds?: readonly string[]; readonly year?: number; readonly fetchImpl?: typeof fetch }): Promise<AlbaRun> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10); const fetchImpl = options.fetchImpl ?? fetch; const raw: AlbaRaw[] = []; let failures = 0;
  const authorIds = options.authorIds ?? [options.authorId ?? '4288', '4418', '4779']; const links: RegExpMatchArray[] = [];
  for (const authorId of authorIds) { const listUrl = new URL('consulta-producao.aspx', ALBA_BASE_URL); listUrl.searchParams.set('autor', authorId); listUrl.searchParams.set('ano', String(options.year ?? 2026)); const list = await getHtml(listUrl.href, fetchImpl, raw); links.push(...[...list.body.matchAll(/href=["'](?:\.\/)?processo\.aspx\?id=(\d+)(?:&[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)]); if (new Set(links.map(value => value[1])).size >= limit) break; }
  const unique = [...new Map(links.map(match => [match[1], { id: match[1]!, label: clean(match[2]!) }])).values()].slice(0, limit); const records: AlbaProposalRecord[] = [];
  for (const item of unique) { try { const url = new URL(`processo.aspx?id=${item.id}`, ALBA_BASE_URL); const detail = await getHtml(url.href, fetchImpl, raw); records.push(parseProcess(detail, item.label)); } catch { failures++; } }
  const identity = await getHtml(new URL('parlamentares.aspx', ALBA_BASE_URL).href, fetchImpl, raw); const people: NormalizedPerson[] = []; const partyObservations: NormalizedPartyMembership[] = [];
  for (const match of identity.body.matchAll(/<div[^>]*class=["'][^"']*kt-widget--user-profile-4[^"']*["'][\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi)) {
    const card = match[0]; const person = card.match(/parlamentar\.aspx\?id=(\d+)[^>]*>[\s\S]*?title=["']([^"']+)["']/i); const author = card.match(/consulta-producao\.aspx\?autor=(\d+)/i); const party = card.match(/<small>\s*\(([^)]+)\)\s*<\/small>/i); if (!person) continue;
    const provenance = provenanceFor(raw.find(value => value.envelope.endpoint.includes('parlamentares.aspx'))!.envelope); const key = identityKey('person', person[1]!); people.push({ key, name: clean(person[2]!), provenance, status: 'available' }); if (party) partyObservations.push({ person: key, rawPartyLabel: clean(party[1]!), provenance });
    if (people.length >= 10) break;
    void author;
  }
  return { proposals: records, persons: uniqueEntities(people, value => value.key.externalId), partyObservations: uniqueEntities(partyObservations, value => `${value.person.externalId}|${value.rawPartyLabel}`), raw, metrics: { requests: raw.length, failures } };
}

export function parseProcess(raw: AlbaRaw, label = ''): AlbaProposalRecord {
  const id = raw.envelope.externalId?.toString() ?? raw.envelope.endpoint.match(/[?&]id=(\d+)/i)?.[1]; if (!id) throw new Error('ALBA process ID missing');
  const numberLabel = field(raw.body, 'ContentPlaceHolder1_sp_numero_processo'); const presented = field(raw.body, 'ContentPlaceHolder1_sp_data_apresentacao'); const title = field(raw.body, 'ContentPlaceHolder1_p_ementa'); const status = field(raw.body, 'ContentPlaceHolder1_p_situacao'); const authorHtml = raw.body.match(/id=["']ContentPlaceHolder1_p_autoria["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''; const authorRaw = clean(authorHtml.replace(/<[^>]+>/g, ' '));
  const [number, yearText] = (numberLabel ?? '').split('/'); const provenance = provenanceFor(raw.envelope); const key = identityKey('proposal', id); const presentedAt = presented ? parseBaDate(presented) : undefined; const proposal: NormalizedProposal = { key, ...(title ? { title } : {}), ...(number ? { number } : {}), ...(yearText && /^\d{4}$/.test(yearText) ? { year: Number(yearText) } : {}), ...(presentedAt ? { presentedAt } : {}), ...(status ? { status } : {}), provenance };
  const authors = authorRaw ? authorRaw.split(';').map((value, index) => ({ proposal: key, actorType: 'parliamentarian' as const, authorRaw: clean(value), role: 'author', order: index + 1, provenance })) : [];
  const rows = raw.body.match(/<tr[\s\S]*?<\/tr>/gi)?.filter(value => /ContentPlaceHolder1_tb_tramitacao|tramit/i.test(value)) ?? []; const movements = rows.map((row, index) => { const date = row.match(/\b(\d{2}\/\d{2}\/\d{4})\b/); const occurredAt = date ? parseBaDate(date[1]!) : undefined; return ({ proposal: key, movementKey: `${id}:${index + 1}:${createHash('sha1').update(clean(row)).digest('hex').slice(0, 12)}`, body: clean(row.replace(/<[^>]+>/g, ' ')), ...(occurredAt ? { occurredAt } : {}), provenance }); });
  return { proposal, authors, movements, raw, label: label || `${numberLabel ?? id}` };
}

async function getHtml(url: string, fetchImpl: typeof fetch, raw: AlbaRaw[]): Promise<AlbaRaw> { const response = await fetchImpl(url, { headers: { accept: 'text/html', 'user-agent': 'civica-p11-1/1.0' }, redirect: 'follow' }); const body = await response.text(); const sha256 = createHash('sha256').update(body).digest('hex'); const envelope: RawEnvelope = { house: houseCode('BA'), provider: ALBA_PROVIDER, resource: resourceType(url.includes('processo.aspx') ? 'proposal' : url.includes('parlamentares.aspx') ? 'person-list' : 'proposal-list'), endpoint: url, params: Object.fromEntries(new URL(url).searchParams.entries()), ...(url.match(/[?&]id=(\d+)/i) ? { externalId: externalId(url.match(/[?&]id=(\d+)/i)![1]!) } : {}), fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type') ?? 'text/html', sha256, rawId: `raw:sha256:${sha256}`, body }; if (!response.ok) throw new Error(`ALBA HTTP ${response.status}`); raw.push({ envelope, body }); return { envelope, body }; }
function identityKey(resource: string, id: string): ExternalIdentityKey { return { house: houseCode('BA'), provider: ALBA_PROVIDER, resource: resourceType(resource), externalId: externalId(id) }; }
function provenance(envelope: RawEnvelope): Provenance { return { rawId: envelope.rawId, endpoint: envelope.endpoint, fetchedAt: envelope.fetchedAt, sha256: envelope.sha256 }; }
function provenanceFor(envelope: RawEnvelope): Provenance { return provenance(envelope); }
function field(html: string, id: string): string | undefined { const match = html.match(new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i')); const value = match ? clean(match[1]!) : ''; return value || undefined; }
function clean(value: string): string { return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim(); }
function parseBaDate(value: string): string | undefined { const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/); if (!match) return undefined; return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0))).toISOString(); }
function uniqueEntities<T>(values: readonly T[], key: (value: T) => string): T[] { return [...new Map(values.map(value => [key(value), value])).values()]; }
