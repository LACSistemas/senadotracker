import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import type { ProviderRegistry } from '../../registry.ts';

export const saplMultiHouseConfigs: readonly HouseConfig[] = ['AC','AL','AM','MT','PI','RR','TO','PB'].map(house => ({ house: houseCode(house), name: `Assembleia Legislativa de ${house}`, bindings: [
  { provider: providerId('sapl'), domain: 'identity', capabilities: ['people','mandates','party_membership'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  { provider: providerId('sapl'), domain: 'legislative', capabilities: ['proposals','authorship','movements'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  { provider: providerId('sapl'), domain: 'participation', capabilities: ['sessions','votes','attendance'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
] }));
export function registerSaplMulti(registry: ProviderRegistry): void { for (const config of saplMultiHouseConfigs) registry.registerHouse(config); }
export const saplMultiBases: Readonly<Record<string,string>> = { AC:'https://sapl.al.ac.leg.br', AL:'https://sapl.al.al.leg.br', AM:'https://sapl.al.am.leg.br', MT:'https://sapl.al.mt.leg.br', PI:'https://sapl.al.pi.leg.br', RR:'https://sapl.al.rr.leg.br', TO:'https://sapl.al.to.leg.br', PB:'https://sapl.al.pb.leg.br' };
