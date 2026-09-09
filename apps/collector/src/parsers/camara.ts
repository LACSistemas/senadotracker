import { createHash } from 'node:crypto';
import { civilDateTime, type Roster, type Profile, type Issue, type HistoryEvent, type Mandate, type Exercise, type PartyMembership } from '@senadotracker/domain';
import type { JsonResponse } from '../http.ts';
import { officialUrl } from '../http.ts';
import { array, object, text, optionalText, id, unknownFields, urlField } from './common.ts';

export function chamberNext(response: JsonResponse): string | null {
  const value = object(response.data, 'root');
  const links = array(value.links, 'links').map(link => object(link, 'link'));
  const next = links.filter(link => link.rel === 'next');
  if (next.length > 1) throw new Error('Múltiplos links next');
  if (!next.length) return null;
  const url = officialUrl(text(next[0]!.href, 'next.href'), 'camara');
  if (new URL(url).pathname !== new URL(response.url).pathname) throw new Error('Paginação mudou de recurso');
  return url;
}
function partyId(value: unknown): string | null {
  const url = optionalText(value); if (!url) return null;
  const checked = new URL(officialUrl(url, 'camara'));
  if (!/^\/api\/v2\/partidos\/\d+$/.test(checked.pathname)) throw new Error('URI de partido inválida');
  return id(checked.pathname.split('/').at(-1));
}
export function parseChamberRoster(response: JsonResponse): Roster {
  const rows = array(object(response.data, 'root').dados, 'dados'); const issues: Issue[] = [];
  const profiles = rows.map(entry => {
    const p = object(entry, 'deputado'); const externalId = id(p.id);
    const uri = officialUrl(text(p.uri, 'uri'), 'camara');
    if (new URL(uri).pathname !== `/api/v2/deputados/${externalId}`) throw new Error('ID da Câmara diverge da URI');
    unknownFields(p, ['id','uri','nome','siglaPartido','uriPartido','siglaUf','idLegislatura','urlFoto','email'], issues, response.rawId, externalId);
    const profile: Profile = { source: 'camara', externalId, name: text(p.nome, 'nome'), fullName: null, uf: text(p.siglaUf, 'UF'), party: text(p.siglaPartido, 'partido'), photoUrl: urlField(p.urlFoto, ['www.camara.leg.br'], true), officialUrl: `https://www.camara.leg.br/deputados/${externalId}`, observedAt: response.fetchedAt, rawId: response.rawId, historyAvailability: 'unavailable', mandates: [], exercises: [], parties: [], events: [] };
    id(p.idLegislatura); partyId(p.uriPartido);
    return profile;
  });
  return { profiles, issues };
}
export function parseChamberHistory(response: JsonResponse, expectedId: string) {
  if (chamberNext(response)) throw new Error('Histórico passou a paginar; contrato precisa ser revisto');
  const issues: Issue[] = [];
  const events: HistoryEvent[] = array(object(response.data, 'root').dados, 'dados').map(entry => {
    const e = object(entry, 'evento');
    if (id(e.id) !== expectedId) throw new Error('Histórico pertence a outra pessoa');
    unknownFields(e, ['id','uri','nome','nomeEleitoral','siglaPartido','uriPartido','siglaUf','idLegislatura','email','urlFoto','dataHora','situacao','condicaoEleitoral','descricaoStatus'], issues, response.rawId, expectedId);
    const normalized = { legislature: id(e.idLegislatura), at: civilDateTime(e.dataHora), state: optionalText(e.situacao), role: optionalText(e.condicaoEleitoral), party: optionalText(e.siglaPartido), partyId: partyId(e.uriPartido), description: optionalText(e.descricaoStatus) };
    return { ...normalized, key: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'), rawId: response.rawId };
  });
  const warn = (code: string, message: string) => issues.push({ severity: 'warning', code, message, externalId: expectedId, rawId: response.rawId });
  if (new Set(events.map(e => e.key)).size !== events.length) throw new Error('Eventos históricos duplicados');
  const mandates: Mandate[] = []; const exercises: Exercise[] = []; const parties: PartyMembership[] = [];
  const sameParty = (membership: PartyMembership | null, event: HistoryEvent): boolean => membership !== null && membership.party === event.party && membership.partyId === event.partyId;
  const rawRows = array(object(response.data, 'root').dados, 'dados');
  for (const legislature of new Set(events.map(e => e.legislature))) {
    const group = events.filter(e => e.legislature === legislature).sort((a, b) => a.at.localeCompare(b.at));
    const key = `legislatura:${legislature}`;
    const rawFirst = object(rawRows.find(row => id(object(row, 'row').idLegislatura) === legislature), 'row');
    mandates.push({ key, officialId: null, legislature, uf: text(rawFirst.siglaUf, 'UF histórica'), role: group.at(-1)!.role, titularId: null, start: null, end: null, rawId: response.rawId });
    let open: Exercise | null = null;
    let affiliation: PartyMembership | null = null;
    let ended = false;
    let ambiguousAt: string | null = null;
    const duplicateTimes = new Set(group.filter((e, i) => i > 0 && e.at === group[i - 1]!.at).map(e => e.at));
    for (const event of group) {
      if (duplicateTimes.has(event.at)) {
        if (open) { open.end = event.at; open.endReason = 'next_event'; open = null; }
        if (affiliation) { affiliation.end = event.at; affiliation.endReason = 'next_event'; affiliation = null; }
        if (ambiguousAt !== event.at) warn('ambiguous_event_time', 'Eventos no mesmo instante; estado derivado interrompido');
        ambiguousAt = event.at; continue;
      }
      if (event.state === 'Exercício') ended = false;
      if (!ended && !sameParty(affiliation, event)) {
        if (affiliation) { affiliation.end = event.at; affiliation.endReason = 'next_event'; }
        affiliation = event.party ? { key: `${key}:${event.key}:party`, mandateKey: key, party: event.party, partyId: event.partyId, start: event.at, end: null, endReason: 'not_reported', precision: 'local_datetime', basis: 'derived', rawId: response.rawId } : null;
        if (affiliation) parties.push(affiliation);
      }
      if (event.state === 'Exercício') {
        if (!open) { open = { key: `${key}:${event.key}`, mandateKey: key, start: event.at, end: null, endReason: 'not_reported', precision: 'local_datetime', basis: 'derived', state: 'Exercício', cause: null, rawId: response.rawId }; exercises.push(open); }
      } else {
        if (open) { open.end = event.at; open.endReason = 'next_event'; open.cause = event.state; open = null; }
        const knownInactive = ['Licença','FIM_MANDATO','CONVOCADO','SUPLENCIA','VACANCIA','SUSPENSO','Afastado'];
        const knownSnapshot = event.state === null && event.description?.startsWith('Nome no início da legislatura');
        if ((!event.state && !knownSnapshot) || (event.state !== null && !knownInactive.includes(event.state))) warn('unknown_history_state', `Estado não mapeado: ${event.state ?? 'nulo'}`);
        if (event.state === 'FIM_MANDATO') {
          ended = true;
          if (affiliation) { affiliation.end = event.at; affiliation.endReason = 'next_event'; affiliation = null; }
        }
      }
    }
    // Events, including null states after FIM_MANDATO, remain intact; no fabricated mandate dates.
  }
  return { mandates, exercises, parties, events, issues };
}
