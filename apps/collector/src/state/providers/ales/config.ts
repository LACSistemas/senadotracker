import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import type { ProviderRegistry } from '../../registry.ts';

export const alesEsHouseConfig: HouseConfig = { house: houseCode('ES'), name: 'Assembleia Legislativa do Espírito Santo', bindings: [
  { provider: providerId('ales_legislative'), domain: 'identity', capabilities: ['name', 'party'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  { provider: providerId('ales_legislative'), domain: 'legislative', capabilities: ['proposals', 'movements', 'authorship'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
] };
export function registerAlesEs(registry: ProviderRegistry): void { registry.registerHouse(alesEsHouseConfig); }



