export const UF_NAMES: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins' };
export const int = new Intl.NumberFormat('pt-BR');
export const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
export const decimal1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export type SearchParams = Record<string, string | string[] | undefined>;
export function parseUf(params: SearchParams): string | null {
  const raw = params.uf;
  return typeof raw === 'string' && /^[A-Z]{2}$/.test(raw) ? raw : null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
}

const DEVICE_LABELS: Record<string, string> = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet' };
export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}
