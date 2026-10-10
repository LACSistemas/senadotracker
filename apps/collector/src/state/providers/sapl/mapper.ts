import type { ExternalIdentityKey, NormalizedDeliberation, NormalizedMandate, NormalizedMovement, NormalizedPartyMembership, NormalizedPerson, NormalizedProposal, NormalizedProposalAuthor, Provenance, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

const RO = houseCode('RO'); const SAPL = providerId('sapl');

export class SaplMapper {
  private readonly house: import('../../contracts.ts').HouseCode;
  private readonly provider: import('../../contracts.ts').ProviderId;
  constructor(options: { house?: string; provider?: string } = {}) { this.house = houseCode(options.house ?? 'RO'); this.provider = providerId(options.provider ?? 'sapl'); }
  person(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedPerson {
    const id = stringId(record, ['id', 'pk']); const name = stringValue(record, ['nome', 'nome_parlamentar', 'nome_completo', 'nome_eleitoral']) ?? `Parlamentar ${id}`;
    return { key: this.key('parlamentar', id), name, ...(stringValue(record, ['nome_parlamentar']) ? { status: 'available' as const } : { status: 'available' as const }), provenance: provenance(envelope) };
  }

  mandate(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedMandate {
    const id = stringId(record, ['id', 'pk']); const personId = stringId(record, ['parlamentar', 'parlamentar_id', 'person']);
    return { person: this.key('parlamentar', personId), mandateKey: `mandato:${id}`, ...(dateValue(record, ['data_inicio_mandato', 'data_inicio', 'inicio']) ? { start: dateValue(record, ['data_inicio_mandato', 'data_inicio', 'inicio'])! } : {}), ...(dateValue(record, ['data_fim_mandato', 'data_fim', 'fim']) ? { end: dateValue(record, ['data_fim_mandato', 'data_fim', 'fim'])! } : {}), provenance: provenance(envelope) };
  }

  partyMembership(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedPartyMembership {
    const personId = stringId(record, ['parlamentar', 'parlamentar_id', 'person']); const party = stringValue(record, ['partido_nome', 'partido', 'sigla_partido', 'nome_partido']); const partyId = optionalStringId(record, ['partido', 'partido_id']);
    return { person: this.key('parlamentar', personId), ...(partyId ? { providerPartyId: partyId } : {}), ...(party ? { rawPartyLabel: party } : {}), ...(dateValue(record, ['data_filiacao', 'inicio']) ? { start: dateValue(record, ['data_filiacao', 'inicio'])! } : {}), ...(dateValue(record, ['data_desfiliacao', 'fim']) ? { end: dateValue(record, ['data_desfiliacao', 'fim'])! } : {}), provenance: provenance(envelope) };
  }

  proposal(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedProposal {
    const id = stringId(record, ['id', 'pk']); const type = nestedLabel(record, ['tipo', 'tipo_materia', 'tipo_proposicao']); const title = stringValue(record, ['ementa', 'assunto', 'titulo', 'descricao']); const presented = dateValue(record, ['data_apresentacao', 'data_apresentacao_iso']);
    return { key: this.key('materia', id), ...(type ? { type } : {}), ...(stringValue(record, ['numero']) ? { number: stringValue(record, ['numero'])! } : {}), ...(numberValue(record, ['ano']) !== undefined ? { year: numberValue(record, ['ano'])! } : {}), ...(title ? { title } : {}), ...(presented ? { presentedAt: presented } : {}), ...(stringValue(record, ['status', 'situacao']) ? { status: stringValue(record, ['status', 'situacao'])! } : typeof record.em_tramitacao === 'boolean' ? { status: record.em_tramitacao ? 'em_tramitacao' : 'encerrada' } : {}), provenance: provenance(envelope) };
  }

  author(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedProposalAuthor {
    const proposalId = stringId(record, ['materia', 'materia_id', 'proposal']); const rawAuthor = record.autor && typeof record.autor === 'object' ? (record.autor as Record<string, unknown>) : undefined; const personId = optionalStringId(record, ['autor', 'autor_id']) ?? (rawAuthor ? optionalStringId(rawAuthor, ['id', 'pk']) : undefined); const authorRaw = rawAuthor ? stringValue(rawAuthor, ['nome', 'nome_parlamentar']) : stringValue(record, ['autor_nome', 'autor_raw']);
    return { proposal: this.key('materia', proposalId), actorType: personId ? 'parliamentarian' : 'other', ...(personId ? { person: this.key('parlamentar', personId) } : {}), ...(authorRaw ? { authorRaw } : {}), role: record.primeiro_autor === true ? 'author' : 'coauthor', ...(numberValue(record, ['ordem', 'order']) !== undefined ? { order: numberValue(record, ['ordem', 'order'])! } : {}), provenance: provenance(envelope) };
  }

  movement(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedMovement {
    const proposalId = stringId(record, ['materia', 'materia_id', 'proposal']); const occurredAt = dateValue(record, ['data_tramitacao', 'data', 'ocorrido_em']); const body = nestedLabel(record, ['unidade_tramitacao_local', 'unidade', 'orgao']); const status = nestedLabel(record, ['status', 'situacao']);
    return { proposal: this.key('materia', proposalId), movementKey: `tramitacao:${stringId(record, ['id', 'pk'])}`, ...(occurredAt ? { occurredAt } : {}), ...(body ? { body } : {}), ...(status ? { status } : {}), provenance: provenance(envelope) };
  }

  deliberation(record: Record<string, unknown>, envelope: RawEnvelope): NormalizedDeliberation {
    return { key: this.key('deliberacao', stringId(record, ['id', 'pk'])), ...(optionalStringId(record, ['sessao_plenaria', 'sessao']) ? { session: this.key('sessao', optionalStringId(record, ['sessao_plenaria', 'sessao'])!) } : {}), ...(optionalStringId(record, ['materia', 'materia_id']) ? { proposal: this.key('materia', optionalStringId(record, ['materia', 'materia_id'])!) } : {}), ...(dateValue(record, ['data_hora', 'data']) ? { occurredAt: dateValue(record, ['data_hora', 'data'])! } : {}), ...(nestedLabel(record, ['tipo', 'tipo_votacao']) ? { type: nestedLabel(record, ['tipo', 'tipo_votacao'])! } : {}), provenance: provenance(envelope) };
  }

  private key(resource: string, id: string): ExternalIdentityKey { return { house: this.house, provider: this.provider, resource: resourceType(resource), externalId: externalId(id) }; }
}

function key(resource: string, id: string): ExternalIdentityKey { return { house: RO, provider: SAPL, resource: resourceType(resource), externalId: externalId(id) }; }
function provenance(envelope: RawEnvelope): Provenance { return { rawId: envelope.rawId, endpoint: envelope.endpoint, fetchedAt: envelope.fetchedAt, ...(envelope.observedAt ? { observedAt: envelope.observedAt } : {}), sha256: envelope.sha256 }; }
function value(record: Record<string, unknown>, names: string[]): unknown { for (const name of names) if (record[name] !== undefined && record[name] !== null && record[name] !== '') return record[name]; return undefined; }
function stringValue(record: Record<string, unknown>, names: string[]): string | undefined { const found = value(record, names); return typeof found === 'string' || typeof found === 'number' ? String(found) : undefined; }
function stringId(record: Record<string, unknown>, names: string[]): string { const found = stringValue(record, names); if (!found) throw new Error(`SAPL record missing required id: ${names.join(',')}`); return found; }
function optionalStringId(record: Record<string, unknown>, names: string[]): string | undefined { const found = value(record, names); if (typeof found === 'object' && found) return stringValue(found as Record<string, unknown>, ['id', 'pk']); return found === undefined ? undefined : String(found); }
function numberValue(record: Record<string, unknown>, names: string[]): number | undefined { const found = value(record, names); const parsed = typeof found === 'number' ? found : typeof found === 'string' && found.trim() ? Number(found) : NaN; return Number.isFinite(parsed) ? parsed : undefined; }
function dateValue(record: Record<string, unknown>, names: string[]): string | undefined { const found = stringValue(record, names); return found && !Number.isNaN(Date.parse(found)) ? found : undefined; }
function nestedLabel(record: Record<string, unknown>, names: string[]): string | undefined { const found = value(record, names); if (typeof found === 'object' && found) return stringValue(found as Record<string, unknown>, ['nome', 'descricao', 'label', 'sigla', 'name']); return typeof found === 'string' ? found : found === undefined ? undefined : String(found); }
