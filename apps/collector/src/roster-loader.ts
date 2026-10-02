import type { Issue, Profile, Source } from '@senadotracker/domain';
import type { JsonResponse } from './http.ts';
import { parseSenateRoster } from './parsers/senado.ts';
import { parseChamberRoster, chamberNext } from './parsers/camara.ts';

export async function loadRosterPostgres(client: JsonClient, source: Source): Promise<{ profiles: Profile[]; rawIds: string[]; issues: Issue[] }> {
  let url: string | null = source === 'senado' ? 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json' : 'https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=1&ordem=ASC&ordenarPor=id';
  const visited = new Set<string>(); const ids = new Set<string>(); const profiles: Profile[] = []; const rawIds: string[] = []; const issues: Issue[] = [];
  while (url) { const canonical = new URL(url); canonical.searchParams.sort(); if (visited.has(canonical.href) || visited.size >= 100) throw new Error('Ciclo/limite de paginação'); visited.add(canonical.href); const response: JsonResponse = await client.json(url); const parsed = source === 'senado' ? parseSenateRoster(response) : parseChamberRoster(response); if (!parsed.profiles.length) throw new Error('Página de cadastro inesperadamente vazia'); for (const profile of parsed.profiles) { if (ids.has(profile.externalId)) throw new Error('Identidade repetida entre páginas'); ids.add(profile.externalId); profiles.push(profile); } issues.push(...parsed.issues); rawIds.push(response.rawId); url = source === 'camara' ? chamberNext(response) : null; }
  return { profiles, rawIds, issues };
}
export interface JsonClient { json(url: string): Promise<JsonResponse> }
