import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import type { ProviderRegistry } from '../../registry.ts';

export const alemalegisMaHouseConfig: HouseConfig = {
  house: houseCode('MA'),
  name: 'Assembleia Legislativa do Maranhão',
  bindings: [
    { provider: providerId('alemalegis'), domain: 'identity', capabilities: ['name'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
    { provider: providerId('alemalegis'), domain: 'legislative', capabilities: ['proposals', 'authorship', 'movements'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  ],
};

export function registerAlemalegisMa(registry: ProviderRegistry): void { registry.registerHouse(alemalegisMaHouseConfig); }
