import type { ProviderMetadata, SourceFrequency } from './contracts.ts';

export interface DueMetadata { readonly lastSuccessAt?: string | null; readonly sourceUpdatedAt?: string | null; readonly dataThrough?: string | null; }

function daysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, (now.getTime() - time) / 86_400_000) : null;
}

export function isDue(provider: ProviderMetadata, metadata: DueMetadata, now = new Date()): boolean {
  if (!provider.enabled || !provider.capabilities.supportsRefresh || !provider.capabilities.schedulerEligible) return false;
  const sourceFreshness = daysSince(metadata.sourceUpdatedAt, now);
  const lastSuccess = daysSince(metadata.lastSuccessAt, now);
  switch (provider.sourceUpdateFrequency) {
    case 'HOURLY': return lastSuccess === null || lastSuccess >= 1 / 24;
    case 'DAILY':
    case 'DAILY_D_MINUS_1': return lastSuccess === null || lastSuccess >= 1;
    case 'WEEKLY': return lastSuccess === null || lastSuccess >= 7;
    case 'MONTHLY': return lastSuccess === null || lastSuccess >= 28;
    // A source update is newer when its age is smaller than the last successful run.
    case 'SOURCE_DRIVEN': return sourceFreshness !== null && (lastSuccess === null || sourceFreshness < lastSuccess);
    case 'IRREGULAR':
    case 'MANUAL':
    case 'UNKNOWN':
    default: return false;
  }
}

export function frequencyCadence(frequency: SourceFrequency): string { return frequency === 'DAILY_D_MINUS_1' ? 'daily (D-1)' : frequency.toLowerCase(); }
