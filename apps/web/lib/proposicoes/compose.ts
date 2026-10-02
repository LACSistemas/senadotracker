export { MPV_CASE } from './compose-types';
export type { OperationalBundle } from './compose-types';
/** Deprecated compatibility symbol. Runtime web reads use data-postgres facade. */
export function composeOperationalBundle(..._args: unknown[]): never {
  throw new Error('composeOperationalBundle is not part of the PostgreSQL web runtime');
}
