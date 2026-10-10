import type { CollectorManifest } from '../collector-provider.ts';
export type CapabilityStatus = 'AVAILABLE' | 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED' | 'MIGRATION_PENDING';
export interface CapabilityRegistration { readonly manifest: CollectorManifest; readonly status: CapabilityStatus; readonly notes?: string; }
export class HouseCapabilityRegistry { private entries = new Map<string, CapabilityRegistration>(); register(entry: CapabilityRegistration): void { this.entries.set(`${entry.manifest.house}:${entry.manifest.domain}`, entry); } discover(): CapabilityRegistration[] { return [...this.entries.values()]; } }
