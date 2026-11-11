import { loadStates } from '../exec-territory.ts';
import { memo } from '../security/load.ts';
import { buildInfrastructurePageData } from './load.ts';
import type { FederalScope, InfrastructurePageData } from './types.ts';

/** Infraestrutura, nível Brasil (P14.14): mesmo `buildInfrastructurePageData` das páginas de UF/município,
 * chamado direto com `{level:'BRASIL'}` — as funções de leitura (`getInfrastructureIndicators` etc.) já
 * agregam nativamente nesse nível (confirmado em uso real por `/executivo`), então nenhuma soma é refeita
 * aqui no cliente. */
async function loadInfrastructureFederal(): Promise<InfrastructurePageData> {
  const states = await loadStates();
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  const scope: FederalScope = { kind: 'brasil', entityId: 76, ufCode: 0, uf: 'BR', name: 'Brasil', stateName: 'Brasil', population: { value: totalPop, year: popYear } };
  return buildInfrastructurePageData({ level: 'BRASIL' }, scope);
}

export const loadInfrastructureFederalPageCached = (): Promise<InfrastructurePageData> => memo('infrastructure:federal', loadInfrastructureFederal, 60_000);
