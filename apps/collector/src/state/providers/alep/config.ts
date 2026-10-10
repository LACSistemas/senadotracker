import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import type { ProviderRegistry } from '../../registry.ts';

export const alepPrHouseConfig: HouseConfig = {
  house: houseCode('PR'),
  name: 'Assembleia Legislativa do Paraná',
  bindings: [{ provider: providerId('alep_api'), domain: 'legislative', capabilities: ['proposals', 'authorship', 'movements'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true }],
};

export function registerAlepPr(registry: ProviderRegistry): void { registry.registerHouse(alepPrHouseConfig); }
