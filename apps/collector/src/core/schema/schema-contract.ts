export type SchemaDriftStatus = 'PASS' | 'COMPATIBLE_CHANGE' | 'PROVIDER_VERSION_REQUIRED' | 'INVALID_SOURCE';
export interface SchemaContract { readonly expectedVersion: string; readonly observedVersion: string; readonly expectedFields: readonly string[]; readonly observedFields: readonly string[]; readonly unknownDrift: 'FAIL_CLOSED'; }
export interface SchemaValidationResult { readonly status: SchemaDriftStatus; readonly contract: SchemaContract; readonly errors: readonly string[]; }
export function evaluateSchema(contract: SchemaContract): SchemaValidationResult {
  const expected = new Set(contract.expectedFields); const observed = new Set(contract.observedFields);
  const missing = [...expected].filter(field => !observed.has(field));
  const extra = [...observed].filter(field => !expected.has(field));
  if (missing.length) return { status: 'INVALID_SOURCE', contract, errors: [`missing:${missing.join(',')}`] };
  if (contract.observedVersion !== contract.expectedVersion) return { status: 'PROVIDER_VERSION_REQUIRED', contract, errors: [`version:${contract.observedVersion}`] };
  return { status: extra.length ? 'COMPATIBLE_CHANGE' : 'PASS', contract, errors: extra.length ? [`extra:${extra.join(',')}`] : [] };
}
