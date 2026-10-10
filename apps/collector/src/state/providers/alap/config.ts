import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import type { ProviderRegistry } from '../../registry.ts';

export const alapApHouseConfig: HouseConfig = { house: houseCode('AP'), name: 'Assembleia Legislativa do Amapá', bindings: [
  { provider: providerId('alap_legislative'), domain: 'identity', capabilities: ['name', 'party'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  { provider: providerId('alap_legislative'), domain: 'legislative', capabilities: ['proposals', 'movements', 'authorship'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
] };
export function registerAlapAp(registry: ProviderRegistry): void { registry.registerHouse(alapApHouseConfig); }
