import type { ExternalIdentityKey, NormalizedMovement, NormalizedPartyMembership, NormalizedPerson, NormalizedProposal, NormalizedProposalAuthor, Provenance } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export const ES_PROVIDER = providerId('ales_legislative');
const ES = houseCode('ES');
export interface AlesPersonRecord { id: string; displayName: string; fullName: string; party: string | null; profileId?: string; legislativeStart?: string; legislativeEnd?: string }
export interface AlesProposalRecord { id: string; type?: string; number?: string; year?: number; title?: string; presentedAt?: string; status?: string; author?: string; resultingNorm?: string; movements: Array<{ key: string; occurredAt?: string; status?: string; body?: string }> }
export const personKey = (id: string): ExternalIdentityKey => ({ house: ES, provider: ES_PROVIDER, resource: resourceType('parliamentarian'), externalId: externalId(id) });
export const proposalKey = (id: string): ExternalIdentityKey => ({ house: ES, provider: ES_PROVIDER, resource: resourceType('proposal'), externalId: externalId(id) });
export function mapPerson(record: AlesPersonRecord, provenance: Provenance): NormalizedPerson { return { key: personKey(record.id), name: record.fullName || record.displayName, status: 'available', provenance: { ...provenance, displayName: record.displayName, profileId: record.profileId, legislativeStart: record.legislativeStart, legislativeEnd: record.legislativeEnd } as Provenance }; }
export function mapParty(record: AlesPersonRecord, provenance: Provenance): NormalizedPartyMembership { return { person: personKey(record.id), ...(record.party ? { rawPartyLabel: record.party, canonicalParty: record.party, alias: record.party } : {}), provenance }; }
export function mapProposal(record: AlesProposalRecord, provenance: Provenance): NormalizedProposal { return { key: proposalKey(record.id), ...(record.title ? { title: record.title } : {}), ...(record.type ? { type: record.type } : {}), ...(record.number ? { number: record.number } : {}), ...(record.year !== undefined ? { year: record.year } : {}), ...(record.presentedAt ? { presentedAt: record.presentedAt } : {}), ...(record.status ? { status: record.status } : {}), provenance: { ...provenance, resultingNorm: record.resultingNorm } as Provenance }; }
export function mapMovement(record: AlesProposalRecord['movements'][number], proposal: ExternalIdentityKey, provenance: Provenance): NormalizedMovement { return { proposal, movementKey: record.key, ...(record.occurredAt ? { occurredAt: record.occurredAt } : {}), ...(record.status ? { status: record.status } : {}), ...(record.body ? { body: record.body } : {}), provenance }; }
export function mapAuthor(raw: string, proposal: ExternalIdentityKey, provenance: Provenance): NormalizedProposalAuthor { return { proposal, actorType: 'parliamentarian', authorRaw: raw, role: 'author', provenance }; }
export function provenanceFromEnvelope(value: { rawId: string; endpoint: string; fetchedAt: string; sha256: string }): Provenance { return { rawId: value.rawId, endpoint: value.endpoint, fetchedAt: value.fetchedAt, sha256: value.sha256 }; }

export function parseParliamentarians(html: string): AlesPersonRecord[] {
  const out: AlesPersonRecord[] = [];
  const re = /href=['"](?:\.\/)?parlamentar\.aspx\?id=(\d+)['"][\s\S]*?title=['"]([^'"]+)['"][\s\S]*?<small>\(([^)]+)\)<\/small>/gi;
  for (const m of html.matchAll(re)) { const name = clean(m[2]); const party = clean(m[3]) || null; if (name) out.push({ id: m[1]!, displayName: name, fullName: name, party, profileId: m[1]!, legislativeStart: '2023-02-01', legislativeEnd: '2027-01-31' }); }
  return unique(out, x => x.id);
}

export function parseProposalIds(html: string): string[] {
  const ids = [...html.matchAll(/(?:processo\.aspx\?id=|idProcesso["'=:\s]+)(\d+)/gi)].map(m => m[1]!);
  return [...new Set(ids)].filter(Boolean);
}

export function parseProposalDetail(id: string, html: string): AlesProposalRecord {
  const text = plain(html); const heading = text.match(/((?:Projeto de Lei Complementar|Projeto de Lei|Projeto de Resolu[cç][aã]o|Requerimento|Indica[cç][aã]o|Mo[cç][aã]o|Emenda|Veto)[^|]{0,180}?\s+(?:n[ºo°]|N[ºO°])?\s*(\d+)\s*\/\s*(\d{4}))/i);
  const type = heading?.[1]?.replace(/\s+(?:n[ºo°]|N[ºO°])?\s*\d+\s*\/\s*\d{4}.*/i, '').trim(); const number = heading?.[2]; const year = heading?.[3] ? Number(heading[3]) : undefined;
  const title = matchField(text, /Ementa:\s*(.+?)(?=\s+(?:Data de|Protocolo|Autor|Situa[cç][aã]o):|$)/i); const date = text.match(/(?:Data de (?:Apresenta[cç][aã]o|Protocolo)|Apresenta[cç][aã]o):\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1];
  const status = matchField(text, /Situa[cç][aã]o:\s*([^|]+?)(?=\s+(?:Origem|Autor|Ementa):|$)/i); const author = matchField(text, /Autor(?:es)?\s*:\s*([^|]+?)(?=\s+(?:Ementa|Situa[cç][aã]o|Origem):|$)/i); const resultingNorm = matchField(text, /(?:Norma resultante|Resultado):\s*([^|]+?)(?=\s+(?:Documentos|Processos|Hist[oó]rico):|$)/i);
  const movements: AlesProposalRecord['movements'] = []; const marker = text.match(/Hist[oó]rico de tramita[cç][aã]o([\s\S]*)/i)?.[1] ?? ''; for (const m of marker.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+([^|]+?)(?=\s+\d{2}\/\d{2}\/\d{4}|$)/g)) movements.push({ key: `${id}:${m[1]}:${m[2]!.trim()}`, occurredAt: toIso(m[1]!), status: m[2]!.trim() });
  return { id, ...(type ? { type } : {}), ...(number ? { number } : {}), ...(year !== undefined ? { year } : {}), ...(title ? { title } : {}), ...(date ? { presentedAt: toIso(date) } : {}), ...(status ? { status } : {}), ...(author ? { author } : {}), ...(resultingNorm ? { resultingNorm } : {}), movements };
}
function matchField(text: string, re: RegExp): string | undefined { return text.match(re)?.[1]?.replace(/\s+/g, ' ').trim() || undefined; }
function plain(html: string): string { return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function decodeHtml(value: string): string { return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))); }
function clean(value?: string): string { return decodeHtml(value ?? '').replace(/\s+/g, ' ').trim(); }
function toIso(value: string): string { const [day, month, year] = value.split('/').map(Number); return new Date(Date.UTC(year!, month! - 1, day!)).toISOString(); }
function unique<T>(values: T[], key: (value: T) => string): T[] { return [...new Map(values.map(value => [key(value), value])).values()]; }

