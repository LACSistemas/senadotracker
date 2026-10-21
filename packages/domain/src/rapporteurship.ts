export type RapporteurDateBasis = 'designation' | 'latest_status' | 'membership_start' | 'unknown';

export function effectiveMatterYear(year: number | null | undefined, presentedAt: string | null | undefined): number | null {
  if (Number.isInteger(year)) return Number(year);
  const match = String(presentedAt ?? '').match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

export function rapporteurDateBasis(source: string, kind: string, basis?: RapporteurDateBasis, start?: string | null): RapporteurDateBasis {
  if (basis) return basis;
  if (kind === 'rapporteurship' && source === 'camara') return 'latest_status';
  if (kind === 'rapporteurship' && start) return 'designation';
  return 'unknown';
}

export function rapporteurDateLabel(source: string, kind: string, basis: RapporteurDateBasis, start: string | null, statusDate: string | null, end: string | null, format: (value: string | null) => string): string {
  if (kind === 'rapporteurship' && source === 'camara' && basis === 'latest_status') return `Situação registrada em ${format(statusDate ?? start)}`;
  return `${kind === 'rapporteurship' ? 'Designação' : 'Início'} em ${format(start)}${end ? ` a ${format(end)}` : ''}`;
}
