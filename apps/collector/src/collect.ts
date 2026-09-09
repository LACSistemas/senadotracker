import type { DatabaseSync } from 'node:sqlite';
import type { Issue, Profile, Source } from '@senadotracker/domain';
import { startRun, heartbeat, failRun, stageProfile, addIssues, validateRun, publishRun, type Reconciliation } from '@senadotracker/db';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { saveRaw } from './raw.ts';
import { parseSenateRoster, parseSenateMandates, parseSenateParties } from './parsers/senado.ts';
import { parseChamberRoster, parseChamberHistory, chamberNext } from './parsers/camara.ts';

export interface JsonClient { json(url: string): Promise<JsonResponse> }
export async function loadRoster(client: JsonClient, source: Source): Promise<{ profiles: Profile[]; rawIds: string[]; issues: Issue[] }> {
  let url: string | null = source === 'senado' ? 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json' : 'https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=1&ordem=ASC&ordenarPor=id';
  const visited = new Set<string>(); const ids = new Set<string>();
  const profiles: Profile[] = []; const rawIds: string[] = []; const issues: Issue[] = [];
  while (url) {
    // Canonical query ordering catches equivalent pagination URLs.
    const canonical = new URL(url); canonical.searchParams.sort();
    if (visited.has(canonical.href) || visited.size >= 100) throw new Error('Ciclo/limite de paginação');
    visited.add(canonical.href);
    const response = await client.json(url);
    const parsed = source === 'senado' ? parseSenateRoster(response) : parseChamberRoster(response);
    if (!parsed.profiles.length) throw new Error('Página de cadastro inesperadamente vazia');
    for (const profile of parsed.profiles) {
      if (ids.has(profile.externalId)) throw new Error('Identidade repetida entre páginas');
      ids.add(profile.externalId); profiles.push(profile);
    }
    issues.push(...parsed.issues); rawIds.push(response.rawId);
    url = source === 'camara' ? chamberNext(response) : null;
  }
  return { profiles, rawIds, issues };
}
export function compareRosters(initial: Profile[], final: Profile[]) {
  const signature = (p: Profile) => JSON.stringify([p.externalId,p.name,p.fullName,p.uf,p.party,p.photoUrl,p.officialUrl]);
  const finalById = new Map(final.map(p => [p.externalId, signature(p)]));
  return initial.filter(p => finalById.get(p.externalId) !== signature(p)).map(p => p.externalId);
}
export interface CollectOptions {
  db: DatabaseSync; source: Source; rawDirectory: string;
  progress?: (message: string) => void;
  clientFactory?: (runId: string) => JsonClient;
}
export async function collectSource(options: CollectOptions) {
  const { db, source } = options; const runId = startRun(db, source);
  const client = options.clientFactory?.(runId) ?? new OfficialHttp({ source, save: raw => saveRaw(db, runId, options.rawDirectory, raw), onAttempt: () => heartbeat(db, runId) });
  try {
    options.progress?.(`${source}: execução ${runId}, consultando cadastro atual`);
    const initial = await loadRoster(client, source);
    addIssues(db, runId, initial.issues);
    let done = 0;
    for (const profile of initial.profiles) {
      heartbeat(db, runId);
      const issues: Issue[] = [];
      if (source === 'senado') {
        const mandates = parseSenateMandates(await client.json(`https://legis.senado.leg.br/dadosabertos/senador/${profile.externalId}/mandatos.json`), profile.externalId);
        profile.mandates = mandates.mandates; profile.exercises = mandates.exercises; issues.push(...mandates.issues);
        profile.parties = parseSenateParties(await client.json(`https://legis.senado.leg.br/dadosabertos/senador/${profile.externalId}/filiacoes.json`), profile.externalId);
        const latest = [...profile.parties].sort((a,b) => b.start.localeCompare(a.start))[0];
        if (!latest || latest.end || latest.party !== profile.party) issues.push({ severity: 'warning', code: 'party_snapshot_conflict', message: 'Filiação não confirma partido observado no cadastro; histórico parcial', externalId: profile.externalId, rawId: profile.rawId });
      } else {
        const history = parseChamberHistory(await client.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${profile.externalId}/historico`), profile.externalId);
        profile.mandates = history.mandates; profile.exercises = history.exercises; profile.parties = history.parties; profile.events = history.events; issues.push(...history.issues);
        const latest = [...history.events].sort((a,b) => b.at.localeCompare(a.at))[0];
        if (!latest || latest.state !== 'Exercício' || latest.party !== profile.party) issues.push({ severity: 'warning', code: 'history_snapshot_conflict', message: 'Último evento não confirma estado/partido observado; histórico parcial', externalId: profile.externalId, rawId: profile.rawId });
      }
      profile.historyAvailability = issues.length ? 'partial' : 'available';
      stageProfile(db, runId, profile); addIssues(db, runId, issues);
      done++;
      if (done % 25 === 0 || done === initial.profiles.length) options.progress?.(`${source}: ${done}/${initial.profiles.length} históricos importados`);
    }
    options.progress?.(`${source}: repetindo cadastro oficial para reconciliação`);
    const final = await loadRoster(client, source); addIssues(db, runId, final.issues);
    const report: Reconciliation = { initialIds: initial.profiles.map(p => p.externalId), finalIds: final.profiles.map(p => p.externalId), changedIds: compareRosters(initial.profiles, final.profiles), initialRawIds: initial.rawIds, finalRawIds: final.rawIds, pagesComplete: true };
    const validation = validateRun(db, runId, report);
    if (!validation.valid) throw new Error('Lote rejeitado; consultar validation_issues');
    publishRun(db, runId);
    options.progress?.(`${source}: ${validation.count} perfis publicados no banco local; lote ${runId}`);
    return { runId, source, count: validation.count, report };
  } catch (error) {
    failRun(db, runId, error instanceof Error ? error.message : 'Falha desconhecida');
    throw error;
  }
}
