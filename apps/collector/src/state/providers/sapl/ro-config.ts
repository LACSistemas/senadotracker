import type { HouseConfig } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';

export const roSaplConfig: HouseConfig = {
  house: houseCode('RO'),
  name: 'Assembleia Legislativa de Rondônia',
  bindings: [
    { provider: providerId('sapl'), domain: 'identity', capabilities: ['people', 'mandates', 'party_membership'], priority: 0, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
    { provider: providerId('sapl'), domain: 'legislative', capabilities: ['proposals', 'authorship', 'movements'], priority: 0, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
    { provider: providerId('sapl'), domain: 'participation', capabilities: ['sessions', 'votes', 'attendance'], priority: 0, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
  ],
};

export const roSaplEndpoints = {
  schema: '/api/schema/',
  parliamentary: '/api/parlamentares/parlamentar/',
  mandates: '/api/parlamentares/mandato/',
  memberships: '/api/parlamentares/filiacao/',
  proposals: '/api/materia/materialegislativa/',
  authorship: '/api/materia/autoria/',
  movements: '/api/materia/tramitacao/',
};
