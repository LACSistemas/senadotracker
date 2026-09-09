import { externalId, type Issue } from '@senadotracker/domain';
export type Obj = Record<string, unknown>;
export function object(value: unknown, path: string): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Objeto esperado: ${path}`);
  return value as Obj;
}
export function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Array esperado: ${path}`);
  return value;
}
export function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Texto obrigatório: ${path}`);
  return value;
}
export function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, 'campo opcional');
}
export function id(value: unknown): string { return externalId(value); }
export function unknownFields(record: Obj, keys: string[], issues: Issue[], rawId: string, externalId: string | null): void {
  for (const key of Object.keys(record)) if (!keys.includes(key)) issues.push({ severity: 'warning', code: 'unknown_field', message: `Campo não mapeado: ${key}`, rawId, externalId });
}
export function urlField(value: unknown, hosts: string[], nullable = false): string | null {
  if (nullable && (value === undefined || value === null || value === '')) return null;
  const result = text(value, 'URL'); const url = new URL(result);
  if (!['https:','http:'].includes(url.protocol) || !hosts.includes(url.hostname) || url.username || url.password) throw new Error('URL de perfil/foto não oficial');
  return result;
}
