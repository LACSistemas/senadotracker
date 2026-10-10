import type { ExternalId, HouseCode, ProviderId, ResourceType } from './contracts.ts';

export function houseCode(value: string): HouseCode {
  const normalized = value.trim().toUpperCase();
  if (!normalized) throw new Error('house code must not be empty');
  return normalized as HouseCode;
}

export function providerId(value: string): ProviderId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error('provider id must not be empty');
  return normalized as ProviderId;
}

export function resourceType(value: string): ResourceType {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error('resource type must not be empty');
  return normalized as ResourceType;
}

export function externalId(value: string): ExternalId {
  const normalized = value.trim();
  if (!normalized) throw new Error('external id must not be empty');
  return normalized as ExternalId;
}
