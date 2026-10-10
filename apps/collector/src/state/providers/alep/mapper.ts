import type { NormalizedMovement, NormalizedProposal, NormalizedProposalAuthor, Provenance, ExternalIdentityKey } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export class AlepMapper {
  proposal(record: Record<string, unknown>, provenance: Provenance): NormalizedProposal {
    const code = requiredId(record.codigo); const key = this.key('proposicao', code);
    const title = stringValue(record.ementa); const type = stringValue(record.siglaTipoProposicao) ?? stringValue(record.tipoProposicao); const number = numberString(record.numero); const year = numberValue(record.ano); const presentedAt = dateValue(record.dataEntrada) ?? dateValue(record.dataRecebimento); const status = stringValue(record.status);
    return { key, ...(title ? { title } : {}), ...(type ? { type } : {}), ...(number ? { number } : {}), ...(year !== undefined ? { year } : {}), ...(presentedAt ? { presentedAt } : {}), ...(status ? { status } : {}), provenance };
  }
  author(record: Record<string, unknown>, proposal: ExternalIdentityKey, provenance: Provenance): NormalizedProposalAuthor {
    const raw = stringValue(record.autor); return { proposal, actorType: 'parliamentarian', ...(raw ? { authorRaw: raw } : {}), role: 'author', provenance };
  }
  movement(record: Record<string, unknown>, proposal: ExternalIdentityKey, provenance: Provenance): NormalizedMovement {
    const code = requiredId(record.codigo); const date = dateValue(record.data) ?? dateValue(record.dataLancamento); const body = [stringValue(record.local), stringValue(record.observacao)].filter(Boolean).join(' — ') || undefined;
    const status = stringValue(record.status);
    return { proposal, movementKey: code, ...(date ? { occurredAt: date } : {}), ...(body ? { body } : {}), ...(status ? { status } : {}), provenance };
  }
  key(resource: string, value: string): ExternalIdentityKey { return { house: houseCode('PR'), provider: providerId('alep_api'), resource: resourceType(resource), externalId: externalId(value) }; }
}

export function provenanceFromEnvelope(envelope: { rawId: string; endpoint: string; fetchedAt: string; sha256: string }): Provenance { return { rawId: envelope.rawId, endpoint: envelope.endpoint, fetchedAt: envelope.fetchedAt, sha256: envelope.sha256 }; }
function requiredId(value: unknown): string { const id = String(value ?? '').trim(); if (!/^\d+$/.test(id)) throw new Error('ALEP proposal identity is missing'); return id; }
function stringValue(value: unknown): string | undefined { const text = typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim(); return text || undefined; }
function numberValue(value: unknown): number | undefined { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function numberString(value: unknown): string | undefined { const n = numberValue(value); return n === undefined ? undefined : String(n); }
function dateValue(value: unknown): string | undefined { if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) return undefined; return new Date(value).toISOString(); }
