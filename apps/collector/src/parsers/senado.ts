import { civilDate, type Profile, type Roster, type Issue, type Mandate, type Exercise, type PartyMembership } from '@senadotracker/domain';
import type { JsonResponse } from '../http.ts';
import { object, array, text, optionalText, id, unknownFields, urlField } from './common.ts';

function root(response: JsonResponse, name: string, version: string) {
  const value = object(object(response.data, 'root')[name], name);
  const metadata = object(value.Metadados, 'Metadados');
  if (metadata.VersaoServico !== version) throw new Error(`Versão do serviço ${name} não suportada`);
  return value;
}
export function parseSenateRoster(response: JsonResponse): Roster {
  const value = root(response, 'ListaParlamentarEmExercicio', '4');
  const issues: Issue[] = [];
  const entries = array(object(value.Parlamentares, 'Parlamentares').Parlamentar, 'Parlamentar');
  const profiles = entries.map(entry => {
    const row = object(entry, 'Parlamentar'); const p = object(row.IdentificacaoParlamentar, 'IdentificacaoParlamentar');
    const externalId = id(p.CodigoParlamentar);
    unknownFields(p, ['CodigoParlamentar','CodigoPublicoNaLegAtual','NomeParlamentar','NomeCompletoParlamentar','SexoParlamentar','FormaTratamento','UrlFotoParlamentar','UrlPaginaParlamentar','UrlPaginaParticular','EmailParlamentar','Telefones','SiglaPartidoParlamentar','UfParlamentar','Bloco','MembroMesa','MembroLideranca'], issues, response.rawId, externalId);
    const profile: Profile = {
      source: 'senado', externalId, name: text(p.NomeParlamentar, 'nome'), fullName: optionalText(p.NomeCompletoParlamentar),
      uf: text(p.UfParlamentar, 'UF'), party: text(p.SiglaPartidoParlamentar, 'partido'),
      photoUrl: urlField(p.UrlFotoParlamentar, ['www.senado.leg.br','www25.senado.leg.br'], true),
      officialUrl: urlField(p.UrlPaginaParlamentar, ['www25.senado.leg.br','www.senado.leg.br'])!,
      observedAt: response.fetchedAt, rawId: response.rawId, historyAvailability: 'unavailable', mandates: [], exercises: [], parties: [], events: [],
    };
    if (!new URL(profile.officialUrl).pathname.endsWith(`/${externalId}`)) throw new Error('ID diverge da página oficial do Senado');
    return profile;
  });
  if (new Set(profiles.map(p => p.externalId)).size !== profiles.length) throw new Error('IDs duplicados na lista do Senado');
  return { profiles, issues };
}
export function parseSenateMandates(response: JsonResponse, expectedId: string): { mandates: Mandate[]; exercises: Exercise[]; issues: Issue[] } {
  const value = root(response, 'MandatoParlamentar', '5');
  const p = object(value.Parlamentar, 'Parlamentar');
  if (id(p.Codigo) !== expectedId) throw new Error('Mandatos pertencem a outra pessoa');
  const issues: Issue[] = []; const exercises: Exercise[] = [];
  const mandates = array(object(p.Mandatos, 'Mandatos').Mandato, 'Mandato').flatMap(entry => {
    const m = object(entry, 'Mandato');
    // A fonte já retornou uma entrada estrutural sem CodigoMandato, participação,
    // exercícios ou partidos. Ela não identifica um mandato e não pode ser
    // publicada como tal; manter o diagnóstico ligado à resposta bruta.
    if (m.CodigoMandato === undefined || m.CodigoMandato === null || m.CodigoMandato === '') {
      issues.push({ severity: 'warning', code: 'unidentified_mandate_entry', message: 'Entrada de mandato sem identificador oficial foi preservada apenas no objeto bruto', rawId: response.rawId, externalId: expectedId });
      return [];
    }
    const key = id(m.CodigoMandato);
    unknownFields(m, ['CodigoMandato','UfParlamentar','PrimeiraLegislaturaDoMandato','SegundaLegislaturaDoMandato','DescricaoParticipacao','Titular','Suplentes','Exercicios','Partidos'], issues, response.rawId, expectedId);
    const first = object(m.PrimeiraLegislaturaDoMandato, 'PrimeiraLegislaturaDoMandato');
    const second = m.SegundaLegislaturaDoMandato ? object(m.SegundaLegislaturaDoMandato, 'SegundaLegislaturaDoMandato') : first;
    const mandate: Mandate = { key, officialId: key, legislature: id(first.NumeroLegislatura), uf: text(m.UfParlamentar, 'UF'), role: optionalText(m.DescricaoParticipacao), titularId: m.Titular ? id(object(m.Titular, 'Titular').CodigoParlamentar) : null, start: civilDate(first.DataInicio), end: civilDate(second.DataFim), rawId: response.rawId };
    if (m.Exercicios) for (const entry of array(object(m.Exercicios, 'Exercicios').Exercicio, 'Exercicio')) {
      const e = object(entry, 'Exercicio'); const end = e.DataFim ? civilDate(e.DataFim) : null;
      exercises.push({ key: id(e.CodigoExercicio), mandateKey: key, start: civilDate(e.DataInicio), end, endReason: end ? 'reported' : 'not_reported', precision: 'date', basis: 'official', state: 'Exercício', cause: optionalText(e.DescricaoCausaAfastamento), rawId: response.rawId });
    }
    return [mandate];
  });
  return { mandates, exercises, issues };
}
export function parseSenateParties(response: JsonResponse, expectedId: string): PartyMembership[] {
  const p = object(root(response, 'FiliacaoParlamentar', '5').Parlamentar, 'Parlamentar');
  if (id(p.Codigo) !== expectedId) throw new Error('Filiações pertencem a outra pessoa');
  if (!p.Filiacoes) return [];
  return array(object(p.Filiacoes, 'Filiacoes').Filiacao, 'Filiacao').map(entry => {
    const f = object(entry, 'Filiacao'); const party = object(f.Partido, 'Partido');
    const partyId = id(party.CodigoPartido); const start = civilDate(f.DataFiliacao); const end = f.DataDesfiliacao ? civilDate(f.DataDesfiliacao) : null;
    return { key: `${partyId}:${start}`, partyId, party: text(party.SiglaPartido, 'SiglaPartido'), mandateKey: null, start, end, endReason: end ? 'reported' : 'not_reported', precision: 'date', basis: 'official', rawId: response.rawId };
  });
}
