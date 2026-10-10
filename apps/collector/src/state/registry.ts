import type { CapabilityState, DiscoveryResult, Domain, HouseCode, HouseConfig, ProviderBinding, ProviderId } from './contracts.ts';
import { validateHouseConfig } from './validation.ts';

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly discover?: () => Promise<DiscoveryResult>;
}

/** Configuration-only registry. It deliberately does not instantiate SAPL or
 * any other network provider in P0. */
export class ProviderRegistry {
  private readonly configs = new Map<HouseCode, HouseConfig>();
  private readonly providers = new Map<ProviderId, ProviderDescriptor>();

  registerProvider(provider: ProviderDescriptor): void {
    if (!provider.id.trim()) throw new Error('provider id must not be empty');
    this.providers.set(provider.id, provider);
  }

  registerHouse(config: HouseConfig): void {
    validateHouseConfig(config);
    this.configs.set(config.house, config);
  }

  getHouse(house: HouseCode): HouseConfig | undefined { return this.configs.get(house); }

  resolve(house: HouseCode, domain: Domain, capability?: string): ProviderBinding[] {
    const config = this.configs.get(house);
    if (!config) return [];
    const candidates = config.bindings.filter(binding => binding.enabled && binding.domain === domain);
    const filtered = capability === undefined ? candidates : candidates.filter(binding => binding.capabilities.includes(capability));
    return [...filtered].sort((a, b) => {
      const capabilityRank = capability === undefined ? 0 : Number(!a.capabilities.includes(capability)) - Number(!b.capabilities.includes(capability));
      if (capabilityRank !== 0) return capabilityRank;
      if (a.priority !== b.priority) return b.priority - a.priority;
      const authorityRank = authorityOrder(a.authority) - authorityOrder(b.authority);
      if (authorityRank !== 0) return authorityRank;
      const provider = a.provider.localeCompare(b.provider);
      if (provider !== 0) return provider;
      return a.domain.localeCompare(b.domain);
    });
  }

  async discover(house: HouseCode, domain: Domain, capability?: string): Promise<DiscoveryResult[]> {
    const bindings = this.resolve(house, domain, capability);
    const results: DiscoveryResult[] = [];
    for (const binding of bindings) {
      const provider = this.providers.get(binding.provider);
      if (provider?.discover) results.push(await provider.discover());
    }
    return results;
  }
}

function authorityOrder(authority: ProviderBinding['authority']): number {
  return { primary: 0, secondary: 1, enrichment: 2, fallback: 3 }[authority];
}

export function capabilityState(result: DiscoveryResult, capability: string): CapabilityState {
  return result.capabilities[capability] ?? 'unknown';
}
