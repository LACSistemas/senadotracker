/**
 * Taxonomia única de papel de autoria/relação (`authorRole`).
 *
 * `proposal_authors` guarda apenas "quem aparece ligado" à entidade; o significado depende do TIPO da entidade, do tipo do autor
 * (`tipoAutor` na Câmara, `siglaTipo` no Senado), do indicador de proponente e da Casa. Nenhuma página deve decidir isso com
 * `if (sigla === 'PRL')`: use `classifyAuthorship` e os conjuntos de ranking abaixo.
 */
export type House = 'camara' | 'senado';
export type AuthorActorKind = 'parliamentarian' | 'committee' | 'institution' | 'unknown';
export type AuthorshipRole =
  | 'legislative_authorship'  // A1: PL, PLP, PEC, PDL, PRC, MPV… apresentados pelo parlamentar
  | 'request_authorship'      // A2: requerimentos, indicações, sugestões, pedidos
  | 'amendment_authorship'    // A3: emendas apresentadas por parlamentar
  | 'coauthor_support'        // B: assinatura de apoio (não proponente)
  | 'committee_author'        // C: comissão ou órgão colegiado/da Casa como autor
  | 'rapporteurship'          // D: relatoria/parecer (e peças do relator: substitutivo, emenda de relator)
  | 'institutional_author'    // E: Executivo, Judiciário, Casa, sociedade civil, partido, liderança
  | 'procedural_act'          // F: ato procedimental (destaque, votação nominal, voto em separado)
  | 'ambiguous';              // F: sem papel claro (ofício de parlamentar, tipos raros)
export type AuthorshipClass = 'A1' | 'A2' | 'A3' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface AuthorshipInput {
  house: House;
  /** Sigla da entidade (PL, PRL, REQ…). */
  type: string;
  /** Categoria do autor; obtenha com `actorKindFromCamaraTipoAutor` / `actorKindFromSenadoSiglaTipo`. */
  actor: AuthorActorKind;
  /** `proponente` da Câmara (true = proponente, false = apoio). Padrão: proponente. */
  proponent?: boolean | string | number | null;
}
export interface AuthorshipClassification { role: AuthorshipRole; code: AuthorshipClass; reason: string }

const set = (...values: string[]) => new Set(values);
const LEGISLATIVE = { camara: set('PL', 'PLP', 'PEC', 'PDL', 'PRC', 'PLN', 'MPV', 'PLV', 'PFC'), senado: set('PL', 'PLS', 'PLC', 'PLP', 'PEC', 'PDL', 'PDS', 'PRS', 'PLN', 'MPV', 'PLV', 'PFS') };
const REQUEST = { camara: set('REQ', 'RIC', 'INC', 'SUG', 'REC', 'REP', 'PET', 'RCP', 'SIT'), senado: set('REQ', 'RQS', 'RQN', 'RQI', 'RQE', 'RQJ', 'RQR', 'SUG', 'PET', 'INS') };
const AMENDMENT = { camara: set('EMC', 'EMP', 'ESB', 'EMA', 'ERD', 'SSP', 'EMS'), senado: set('EMD') };
/** Peças em que o "autor" é quem relata/emite o parecer ou apresenta como relator. */
const RAPPORTEUR = { camara: set('PRL', 'PRLP', 'PRLE', 'PES', 'PPP', 'PEP', 'PPR', 'CVO', 'REL', 'RLP', 'RDF', 'SBT', 'SBR', 'EMR', 'PAR', 'PARF', 'REL-A'), senado: set() };
const PROCEDURAL = { camara: set('RPD', 'DTQ', 'VTS', 'RPDR'), senado: set() };

const fold = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/** `tipoAutor` do arquivo `proposicoesAutores` da Câmara. */
export function actorKindFromCamaraTipoAutor(tipoAutor: string | null | undefined): AuthorActorKind {
  const value = fold(tipoAutor);
  if (!value) return 'unknown';
  if (/^(DEPUTADO|SENADOR)/.test(value)) return 'parliamentarian';
  if (/COMISS|GRUPO DE TRABALHO|PERMANENTE DO SENADO|ORGAO DA CAMARA/.test(value)) return 'committee';
  return 'institution';
}

/** `siglaTipo` da autoria do Senado (`/processo/{id}` → `autoriaIniciativa`). */
export function actorKindFromSenadoSiglaTipo(siglaTipo: string | null | undefined): AuthorActorKind {
  const value = fold(siglaTipo);
  if (!value) return 'unknown';
  if (/^(SENADOR|DEPUTADO)/.test(value)) return 'parliamentarian';
  if (/COMISS|COLEGIADO|MESA/.test(value)) return 'committee';
  return 'institution';
}

const isProponent = (value: AuthorshipInput['proponent']) => value === undefined || value === null ? true : value === true || value === 1 || String(value) === '1' || String(value).toLowerCase() === 'true';

export function classifyAuthorship(input: AuthorshipInput): AuthorshipClassification {
  const type = fold(input.type), house = input.house;
  const result = (role: AuthorshipRole, code: AuthorshipClass, reason: string): AuthorshipClassification => ({ role, code, reason });
  if (input.actor === 'parliamentarian' && !isProponent(input.proponent)) return result('coauthor_support', 'B', 'parlamentar que apoia (não é proponente)');
  if (input.actor === 'committee') return result('committee_author', 'C', 'comissão ou órgão colegiado/da Casa como autor');
  if (input.actor !== 'parliamentarian') return result(input.actor === 'unknown' ? 'ambiguous' : 'institutional_author', input.actor === 'unknown' ? 'F' : 'E', input.actor === 'unknown' ? 'autor sem tipo informado' : 'autor institucional (não parlamentar nem comissão)');
  if (LEGISLATIVE[house].has(type)) return result('legislative_authorship', 'A1', 'proposição legislativa apresentada pelo parlamentar');
  if (REQUEST[house].has(type)) return result('request_authorship', 'A2', 'requerimento, indicação ou pedido apresentado pelo parlamentar');
  if (AMENDMENT[house].has(type)) return result('amendment_authorship', 'A3', 'emenda apresentada pelo parlamentar');
  if (RAPPORTEUR[house].has(type)) return result('rapporteurship', 'D', 'relatoria/parecer ou peça do relator');
  if (PROCEDURAL[house].has(type)) return result('procedural_act', 'F', 'ato procedimental (destaque, votação nominal, voto em separado)');
  return result('ambiguous', 'F', `tipo ${type} sem papel de autoria definido`);
}

/** Rankings semanticamente seguros: cada papel alimenta um único ranking; nunca somar entre eles. */
export const AUTHORSHIP_RANKINGS = {
  legislative: ['legislative_authorship'],
  requests: ['request_authorship'],
  amendments: ['amendment_authorship'],
  rapporteurship: ['rapporteurship'],
  procedural: ['procedural_act'],
} as const satisfies Record<string, readonly AuthorshipRole[]>;
export type AuthorshipRanking = keyof typeof AUTHORSHIP_RANKINGS;
/** Papéis que nunca entram em ranking de parlamentares: apoio, órgãos, institucional e ambíguos. */
export const NON_RANKABLE_ROLES: readonly AuthorshipRole[] = ['coauthor_support', 'committee_author', 'institutional_author', 'ambiguous'];
export const rankingOf = (role: AuthorshipRole): AuthorshipRanking | null => (Object.entries(AUTHORSHIP_RANKINGS).find(([, roles]) => (roles as readonly string[]).includes(role))?.[0] as AuthorshipRanking | undefined) ?? null;
