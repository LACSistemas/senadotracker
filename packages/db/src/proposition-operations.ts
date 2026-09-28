/**
 * Visão operacional das proposições: composição funcional, rio de tramitação, tempo sem movimentação,
 * DNA da atividade, ritmo, calendário, eventos recentes e frases editoriais determinísticas.
 *
 * Regras de honestidade (valem para todas as funções deste arquivo):
 *  - Nada é inventado. Toda função devolve `coverage` (e `updatedThrough` quando há datas). Ausência de
 *    dado vira `null`/`available:false`, nunca zero cosmético.
 *  - O texto é descritivo. Nada aqui ranqueia parlamentares, partidos ou Casas por "produtividade".
 *  - Estágios e desfechos vêm SÓ de evidência estruturada (relatoria, órgão, pauta, deliberação, norma
 *    resultante) e de um conjunto fechado de situações oficiais de encerramento (CLOSING_LABELS). Não há
 *    inferência textual livre.
 *  - O tempo é contado até o último registro publicado (`updatedThrough`), não até "hoje": se a coleta
 *    atrasa, a faixa "menos de 7 dias" não fica artificialmente vazia.
 *
 * Este arquivo mora ao lado de proposition-analytics.ts (que segue em estilo compacto) para que a camada nova
 * seja legível e testável.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { DataCoverage } from '@senadotracker/domain';

export type PropositionHouse = 'camara' | 'senado';
type Row = Record<string, unknown>;

export const PRINCIPAL_GROUP = 'proposicoes_legislativas_principais';
/** Ordem taxonômica fixa dos grupos. É a ordem dos vetores `counts` devolvidos por este módulo. */
export const PROPOSITION_GROUP_ORDER = [
  'proposicoes_legislativas_principais',
  'requerimentos',
  'emendas_substitutivos',
  'pareceres_relatorios',
  'instrumentos_votacao_tramitacao',
  'indicacoes_sugestoes',
  'oficios_documentos',
  'mensagens_comunicacoes_institucionais',
  'recursos_representacoes_peticoes',
  'atos_documentos_especiais',
] as const;
const groupIndex = new Map<string, number>(PROPOSITION_GROUP_ORDER.map((group, index) => [group, index]));
const fallbackGroupIndex = groupIndex.get('atos_documentos_especiais')!;
const emptyCounts = () => PROPOSITION_GROUP_ORDER.map(() => 0);

const HOUSES: readonly PropositionHouse[] = ['camara', 'senado'];
const DAY_MS = 86_400_000;
const EFFECTIVE_YEAR = "COALESCE(json_extract(p.payload,'$.year'),CAST(substr(json_extract(p.payload,'$.presentedAt'),1,4) AS INTEGER))";
/** Tipos de evento com data e vínculo a uma proposição. `theme`, `relationship`, `document` etc. não são movimentação. */
const EVENT_KINDS = ['movement', 'situation', 'agenda_item', 'vote_effect', 'resulting_norm', 'body'] as const;
const NORM_PATTERN = /transform\w*\s+em\s+norma|promulg|sancion/;
/**
 * Situações oficiais que encerram a tramitação de uma matéria (rótulos publicados, comparados por igualdade
 * depois de remover acentos e ponto final). É uma lista fechada de propósito: "retirada de pauta" NÃO encerra.
 */
const CLOSING_LABELS = new Set([
  'transformada em norma juridica', 'transformada em norma juridica com veto parcial', 'tramitacao encerrada', 'retirada pelo autor',
  'prejudicada', 'arquivada', 'rejeitada', 'transformada em projeto de resolucao do senado', 'transformada em projeto de lei do senado',
  'transformada em projeto de lei complementar do senado', 'transformado em indicacao do senado federal', 'a materia vai ao arquivo',
  'arquivamento', 'transformacao em norma juridica', 'transformado em norma juridica com veto parcial', 'prejudicado',
  'prejudicialidade (plenario)', 'retirada pelo autor(a) (plenario)', 'retirada pelo(a) autor(a)', 'deferido o requerimento de retirada pelo(a) autor(a)',
]);

const marks = (count: number) => Array.from({ length: count }, () => '?').join(',');
const todayIso = () => new Date().toISOString().slice(0, 10);
const dayOf = (value: unknown): string | null => String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const daysBetween = (from: string, to: string) => Math.floor((utc(to) - utc(from)) / DAY_MS);
const addDays = (day: string, amount: number) => new Date(utc(day) + amount * DAY_MS).toISOString().slice(0, 10);
const share = (numerator: number, denominator: number) => (denominator ? numerator / denominator : 0);
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const partialScope = (scope: string) => scope.startsWith('amostra-') || scope.startsWith('current-roster-person-activity');
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const coverage = (source: DataCoverage['source'], availability: DataCoverage['availability'], sampleSize: number | null, note: string, period: { from: string | null; to: string | null; grain: DataCoverage['period']['grain'] }, batchId: string | null): DataCoverage =>
  ({ availability, source, period, batchId, note, sampleSize });

interface ActiveBatch { batchId: string; scope: string; publishedAt: string }
function activeBatches(db: DatabaseSync, source: PropositionHouse): ActiveBatch[] {
  return (db.prepare(`SELECT a.batch_id batchId,a.scope,b.published_at publishedAt FROM active_activity_publications a JOIN activity_batches b ON b.id=a.batch_id WHERE a.source=? ORDER BY b.published_at DESC`).all(source) as Row[])
    .map(row => ({ batchId: String(row.batchId), scope: String(row.scope), publishedAt: String(row.publishedAt) }));
}
const batchIdsOf = (batches: ActiveBatch[]) => batches.map(batch => batch.batchId);
const legislativeBatchIds = (db: DatabaseSync, source: PropositionHouse) =>
  (db.prepare('SELECT batch_id FROM active_legislative_publications WHERE source=?').all(source) as Row[]).map(row => String(row.batch_id));

// ─── Universo de proposições, eventos e autorias (carregados uma vez por chamada de alto nível) ─────────

export interface UniverseItem { id: string; group: string; type: string; label: string | null; presentedAt: string | null; year: number | null }
export function loadUniverse(db: DatabaseSync, source: PropositionHouse): Map<string, UniverseItem> {
  const batches = activeBatches(db, source), universe = new Map<string, UniverseItem>();
  if (!batches.length) return universe;
  const rows = db.prepare(`SELECT p.external_id id,p.grupo_atribuido g,json_extract(p.payload,'$.type') t,json_extract(p.payload,'$.label') label,json_extract(p.payload,'$.presentedAt') presented,${EFFECTIVE_YEAR} y FROM proposals p WHERE p.batch_id IN (${marks(batches.length)})`).all(...batchIdsOf(batches)) as Row[];
  for (const row of rows) universe.set(String(row.id), { id: String(row.id), group: String(row.g), type: String(row.t ?? ''), label: row.label ? String(row.label) : null, presentedAt: dayOf(row.presented), year: row.y === null || row.y === undefined ? null : Number(row.y) });
  return universe;
}

export interface EventRecord { proposalId: string; kind: string; day: string; label: string; /** rótulo sem acentos, em minúsculas */ folded: string }
export function loadEvents(db: DatabaseSync, source: PropositionHouse): EventRecord[] {
  const rows = db.prepare(`SELECT c.external_key key,c.proposal_id pid,c.kind,c.occurred_at at,json_extract(c.payload,'$.label') label FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.proposal_id IS NOT NULL AND c.occurred_at IS NOT NULL AND c.kind IN (${marks(EVENT_KINDS.length)})`).all(source, ...EVENT_KINDS) as Row[];
  const seen = new Set<string>(), out: EventRecord[] = [];
  for (const row of rows) {
    const key = String(row.key), day = dayOf(row.at);
    if (!day || seen.has(key)) continue; // o mesmo registro pode existir em mais de um escopo ativo
    seen.add(key);
    const label = String(row.label ?? '');
    out.push({ proposalId: String(row.pid), kind: String(row.kind), day, label, folded: fold(label).trim().replace(/\.$/, '') });
  }
  return out;
}
const isNormEvent = (event: EventRecord) => event.kind === 'resulting_norm' || ((event.kind === 'movement' || event.kind === 'situation') && NORM_PATTERN.test(event.folded));
const isClosingEvent = (event: EventRecord) => event.kind === 'resulting_norm' || ((event.kind === 'movement' || event.kind === 'situation') && CLOSING_LABELS.has(event.folded));

/** Último dia com movimentação publicada (até `asOf`). É a âncora do "há quanto tempo" e da janela de eventos recentes. */
export function latestEventDay(db: DatabaseSync, source: PropositionHouse, asOf = todayIso()): string | null {
  const row = db.prepare(`SELECT max(substr(c.occurred_at,1,10)) day FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.proposal_id IS NOT NULL AND c.occurred_at IS NOT NULL AND substr(c.occurred_at,1,10)<=? AND c.kind IN (${marks(EVENT_KINDS.length)})`).get(source, asOf, ...EVENT_KINDS) as Row | undefined;
  return row?.day ? String(row.day) : null;
}

interface DeliberationRecord { proposalId: string; day: string; approved: boolean | null; label: string | null; result: string | null }
function loadDeliberations(db: DatabaseSync, source: PropositionHouse): DeliberationRecord[] {
  const ids = legislativeBatchIds(db, source);
  if (!ids.length) return [];
  // A Câmara só vincula votação a matéria com objeto efetivo comprovado; o Senado usa o identificador oficial.
  const field = source === 'camara' ? 'actualVotedProposalId' : 'proposalId';
  return (db.prepare(`SELECT d.date,json_extract(d.payload,'$.${field}') pid,json_extract(d.payload,'$.approved') approved,json_extract(d.payload,'$.proposalLabel') label,json_extract(d.payload,'$.result') result FROM deliberations d WHERE d.batch_id IN (${marks(ids.length)})`).all(...ids) as Row[])
    .flatMap(row => { const day = dayOf(row.date); return row.pid && day ? [{ proposalId: String(row.pid), day, approved: row.approved === null || row.approved === undefined ? null : Number(row.approved) === 1, label: row.label ? String(row.label) : null, result: row.result ? String(row.result) : null }] : []; });
}

export interface AuthorLink { proposalId: string; person: string | null; party: string | null; name: string; uf: string | null; primary: boolean | null }
export function loadAuthorLinks(db: DatabaseSync, source: PropositionHouse): AuthorLink[] {
  const batches = activeBatches(db, source);
  if (!batches.length) return [];
  return (db.prepare(`SELECT x.proposal_id pid,x.person_external_id person,json_extract(x.payload,'$.party') party,json_extract(x.payload,'$.name') name,json_extract(x.payload,'$.uf') uf,json_extract(x.payload,'$.primary') pr FROM proposal_authors x WHERE x.batch_id IN (${marks(batches.length)})`).all(...batchIdsOf(batches)) as Row[])
    .map(row => ({ proposalId: String(row.pid), person: row.person ? String(row.person) : null, party: row.party ? String(row.party) : null, name: String(row.name ?? ''), uf: row.uf ? String(row.uf) : null, primary: row.pr === null || row.pr === undefined ? null : Number(row.pr) === 1 }));
}

// ─── Evidência por matéria (base do rio de tramitação, da inatividade e do estágio atual) ──────────────

export type StageKey = 'presented' | 'rite' | 'instruction' | 'agenda' | 'deliberation' | 'post' | 'outcome';
export interface Evidence {
  instruction: Set<string>; agenda: Set<string>; deliberated: Set<string>; approved: Set<string>; outcome: Set<string>;
  /** Matérias cuja última movimentação publicada é um encerramento oficial. */
  closed: Set<string>;
  lastEvent: Map<string, string>; updatedThrough: string | null; rapporteurRows: number;
}
function emptyEvidence(): Evidence {
  return { instruction: new Set(), agenda: new Set(), deliberated: new Set(), approved: new Set(), outcome: new Set(), closed: new Set(), lastEvent: new Map(), updatedThrough: null, rapporteurRows: 0 };
}
export function collectEvidence(db: DatabaseSync, source: PropositionHouse, asOf: string, events = loadEvents(db, source)): Evidence {
  const evidence = emptyEvidence(), lastClosing = new Map<string, string>(), lastOpen = new Map<string, string>();
  const touch = (id: string, day: string, closing: boolean) => {
    if (day > asOf) return; // pauta futura não é fato observado
    if ((evidence.lastEvent.get(id) ?? '') < day) evidence.lastEvent.set(id, day);
    if ((evidence.updatedThrough ?? '') < day) evidence.updatedThrough = day;
    const bucket = closing ? lastClosing : lastOpen;
    if ((bucket.get(id) ?? '') < day) bucket.set(id, day);
  };
  const batches = activeBatches(db, source);
  if (batches.length) {
    for (const row of db.prepare(`SELECT json_extract(x.payload,'$.proposalId') pid,json_extract(x.payload,'$.start') start FROM legislative_appointments x WHERE x.batch_id IN (${marks(batches.length)}) AND json_extract(x.payload,'$.kind')='rapporteurship' AND json_extract(x.payload,'$.proposalId') IS NOT NULL`).all(...batchIdsOf(batches)) as Row[]) {
      const id = String(row.pid), day = dayOf(row.start);
      evidence.instruction.add(id); evidence.rapporteurRows++;
      if (day) touch(id, day, false);
    }
  }
  for (const event of events) {
    if (event.day > asOf) continue;
    if (event.kind === 'body') evidence.instruction.add(event.proposalId);
    else if (event.kind === 'agenda_item') evidence.agenda.add(event.proposalId);
    else if (event.kind === 'vote_effect') evidence.deliberated.add(event.proposalId);
    if (isNormEvent(event)) evidence.outcome.add(event.proposalId);
    touch(event.proposalId, event.day, isClosingEvent(event));
  }
  for (const deliberation of loadDeliberations(db, source)) {
    if (deliberation.day > asOf) continue;
    evidence.deliberated.add(deliberation.proposalId);
    if (deliberation.approved) evidence.approved.add(deliberation.proposalId);
    touch(deliberation.proposalId, deliberation.day, false);
  }
  // Encerrada = o encerramento oficial não foi seguido por nenhuma outra movimentação (um desarquivamento reabre).
  for (const [id, day] of lastClosing) if (day >= (lastOpen.get(id) ?? '')) evidence.closed.add(id);
  return evidence;
}
/** Estágio mais avançado com evidência estruturada. `rite` nunca é atribuído: o regime de tramitação não é publicado. */
function currentStage(id: string, evidence: Evidence): StageKey {
  if (evidence.outcome.has(id)) return 'outcome';
  if (evidence.approved.has(id)) return 'post';
  if (evidence.deliberated.has(id)) return 'deliberation';
  if (evidence.agenda.has(id)) return 'agenda';
  if (evidence.instruction.has(id)) return 'instruction';
  return 'presented';
}

// ─── §3.1 Composição funcional ("O Congresso está fazendo o quê?") ─────────────────────────────────────

export interface FunctionalGroupCount { group: string; count: number; share: number; topTypes: Array<{ type: string; count: number; share: number }> }
export interface HouseFunctionalView { source: PropositionHouse; scope: string; batchId: string; publishedAt: string; year: number; total: number; partial: boolean; groups: FunctionalGroupCount[]; coverage: DataCoverage }
export interface FunctionalOverview {
  year: number;
  years: Array<{ year: number; camara: number; senado: number }>;
  houses: { camara: HouseFunctionalView | null; senado: HouseFunctionalView | null };
  /** Congresso só agrega quando os dois universos são comparáveis; caso contrário as Casas aparecem lado a lado. */
  congress: { comparable: boolean; reason: string; total: number | null; groups: FunctionalGroupCount[] | null };
  updatedThrough: string | null;
}

function foldGroups(rows: Array<{ group: string; type: string; count: number }>): FunctionalGroupCount[] {
  const byGroup = new Map<string, Map<string, number>>();
  for (const row of rows) { const types = byGroup.get(row.group) ?? new Map<string, number>(); types.set(row.type, (types.get(row.type) ?? 0) + row.count); byGroup.set(row.group, types); }
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return [...byGroup].map(([group, types]) => {
    const count = [...types.values()].reduce((sum, value) => sum + value, 0);
    return { group, count, share: share(count, total), topTypes: [...types].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([type, value]) => ({ type, count: value, share: share(value, count) })) };
  }).sort((a, b) => b.count - a.count || (groupIndex.get(a.group) ?? 99) - (groupIndex.get(b.group) ?? 99));
}

function houseFunctionalView(db: DatabaseSync, source: PropositionHouse, year: number): HouseFunctionalView | null {
  const batches = activeBatches(db, source);
  if (!batches.length) return null;
  const rows = (db.prepare(`SELECT p.grupo_atribuido g,json_extract(p.payload,'$.type') t,count(*) n FROM proposals p WHERE p.batch_id IN (${marks(batches.length)}) AND ${EFFECTIVE_YEAR}=? GROUP BY g,t`).all(...batchIdsOf(batches), year) as Row[])
    .map(row => ({ group: String(row.g), type: String(row.t ?? 'sigla não publicada'), count: Number(row.n) }));
  const total = rows.reduce((sum, row) => sum + row.count, 0), lead = batches[0]!, partial = batches.some(batch => partialScope(batch.scope));
  const note = total
    ? partial ? `Recorte publicado (${batches.map(batch => batch.scope).join(', ')}): cobre as matérias dos parlamentares do cadastro atual, não o catálogo integral da Casa.` : `Todas as proposições publicadas com ano ${year}.`
    : `Nenhuma proposição com ano ${year} foi publicada para esta Casa.`;
  return { source, scope: batches.map(batch => batch.scope).join(', '), batchId: batchIdsOf(batches).join(','), publishedAt: lead.publishedAt, year, total, partial, groups: foldGroups(rows), coverage: coverage(source, total ? (partial ? 'partial' : 'available') : 'unavailable', total, note, { from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' }, batchIdsOf(batches).join(',')) };
}

export function proposalFunctionalOverview(db: DatabaseSync, query: { year?: number } = {}): FunctionalOverview {
  const perYear = new Map<number, { year: number; camara: number; senado: number }>();
  for (const source of HOUSES) {
    const batches = activeBatches(db, source);
    if (!batches.length) continue;
    for (const row of db.prepare(`SELECT ${EFFECTIVE_YEAR} y,count(*) n FROM proposals p WHERE p.batch_id IN (${marks(batches.length)}) AND ${EFFECTIVE_YEAR} IS NOT NULL GROUP BY y`).all(...batchIdsOf(batches)) as Row[]) {
      const year = Number(row.y), entry = perYear.get(year) ?? { year, camara: 0, senado: 0 };
      entry[source] = Number(row.n); perYear.set(year, entry);
    }
  }
  const years = [...perYear.values()].sort((a, b) => b.year - a.year);
  const year = query.year !== undefined && perYear.has(query.year) ? query.year : years[0]?.year ?? new Date().getFullYear();
  const houses = { camara: houseFunctionalView(db, 'camara', year), senado: houseFunctionalView(db, 'senado', year) };
  const both = Boolean(houses.camara && houses.senado && houses.camara.total > 0 && houses.senado.total > 0);
  const comparable = both && !houses.camara!.partial && !houses.senado!.partial;
  const reason = comparable ? 'Os dois universos cobrem o catálogo integral do ano.'
    : !both ? 'Só uma das Casas tem proposições publicadas para o ano escolhido.'
      : `Os universos têm escopos diferentes (${houses.camara!.partial ? 'a Câmara' : 'o Senado'} publica um recorte), então as Casas aparecem lado a lado e não somadas.`;
  const merged = comparable ? foldGroups([...houses.camara!.groups, ...houses.senado!.groups].flatMap(group => group.topTypes.length ? group.topTypes.map(type => ({ group: group.group, type: type.type, count: type.count })) : [{ group: group.group, type: 'sigla não publicada', count: group.count }])) : null;
  const updated = HOUSES.flatMap(source => houses[source] ? [houses[source]!.publishedAt.slice(0, 10)] : []).sort().at(-1) ?? null;
  return { year, years, houses, congress: { comparable, reason, total: comparable ? houses.camara!.total + houses.senado!.total : null, groups: merged }, updatedThrough: updated };
}

// ─── §3.2 Onde estão as matérias principais? ───────────────────────────────────────────────────────────

export interface StageFlowStage { key: StageKey; label: string; count: number | null; share: number | null; available: boolean; note: string }
export interface StageFlow { source: PropositionHouse; year: number; universe: number; stages: StageFlowStage[]; coverage: DataCoverage; updatedThrough: string | null }
const STAGE_LABEL: Record<StageKey, string> = { presented: 'Apresentação', rite: 'Rito', instruction: 'Instrução', agenda: 'Pauta', deliberation: 'Deliberação', post: 'Pós-deliberação', outcome: 'Desfecho' };
interface Shared { asOf?: string; universe?: Map<string, UniverseItem>; events?: EventRecord[]; evidence?: Evidence }

/**
 * Cada etapa conta as matérias principais apresentadas no ano que têm REGISTRO estruturado daquela etapa.
 * As etapas não formam um funil: uma matéria pode ter pauta publicada sem relatoria publicada.
 */
export function principalStageFlow(db: DatabaseSync, source: PropositionHouse, year: number, options: Shared = {}): StageFlow {
  const asOf = options.asOf ?? todayIso(), universe = options.universe ?? loadUniverse(db, source);
  const ids = [...universe.values()].filter(item => item.group === PRINCIPAL_GROUP && item.year === year).map(item => item.id);
  const evidence = options.evidence ?? collectEvidence(db, source, asOf, options.events);
  const inYear = (set: Set<string>) => ids.filter(id => set.has(id)).length;
  const universeSize = ids.length;
  const stage = (key: StageKey, count: number | null, note: string): StageFlowStage => ({ key, label: STAGE_LABEL[key], count, share: count === null || !universeSize ? null : count / universeSize, available: count !== null, note });
  const hasAgenda = evidence.agenda.size > 0, hasDeliberations = evidence.deliberated.size > 0;
  const stages: StageFlowStage[] = universeSize ? [
    stage('presented', universeSize, `Matérias principais apresentadas em ${year}.`),
    stage('rite', null, 'O regime de tramitação (ordinário, urgência, prioridade) não é publicado como dado estruturado neste lote.'),
    stage('instruction', evidence.rapporteurRows || evidence.instruction.size ? inYear(evidence.instruction) : null, source === 'camara' ? 'Relatoria designada ou órgão registrado. Só há relatorias de deputados do cadastro atual, então a contagem é parcial.' : 'Relatoria designada ou órgão registrado.'),
    stage('agenda', hasAgenda ? inYear(evidence.agenda) : null, 'Matérias com item de pauta publicado.'),
    stage('deliberation', hasDeliberations ? inYear(evidence.deliberated) : null, 'Matérias com deliberação ou efeito de votação registrado.'),
    stage('post', hasDeliberations ? inYear(evidence.approved) : null, 'Matérias com deliberação aprovada registrada.'),
    stage('outcome', inYear(evidence.outcome), 'Matérias com norma resultante ou situação oficial "transformada em norma jurídica".'),
  ] : [];
  const note = universeSize ? 'As etapas contam registros estruturados publicados; uma matéria pode ter uma etapa registrada sem outra. Não é um funil nem prova o estado atual.' : `Nenhuma matéria principal publicada com ano ${year}.`;
  return { source, year, universe: universeSize, stages, updatedThrough: evidence.updatedThrough, coverage: coverage(source, universeSize ? 'partial' : 'unavailable', universeSize, note, { from: `${year}-01-01`, to: evidence.updatedThrough, grain: 'year' }, null) };
}

export interface StalenessBucket { key: string; label: string; min: number; max: number | null; count: number; share: number }
export interface StalenessPoint { id: string; label: string; days: number; stage: StageKey }
export interface PrincipalStaleness {
  source: PropositionHouse; year: number | null; /** dia de referência: último registro publicado */ asOf: string | null;
  universe: number; withHistory: number; withoutHistory: number; closed: number;
  buckets: StalenessBucket[]; points: StalenessPoint[]; recentShare: number | null; updatedThrough: string | null; coverage: DataCoverage;
}
const BUCKETS: Array<{ key: string; label: string; min: number; max: number | null }> = [
  { key: 'd0', label: 'Menos de 7 dias', min: 0, max: 6 },
  { key: 'd7', label: '7 a 29 dias', min: 7, max: 29 },
  { key: 'd30', label: '30 a 89 dias', min: 30, max: 89 },
  { key: 'd90', label: '90 a 179 dias', min: 90, max: 179 },
  { key: 'd180', label: '180 dias ou mais', min: 180, max: null },
];

/**
 * Dias desde o último evento observado de cada matéria principal (do `year`, quando informado). "Sem movimentação
 * observada" descreve o que a base publicou; não afirma abandono. Matérias encerradas por situação oficial ou
 * norma resultante ficam fora e são contadas à parte.
 */
export function principalStaleness(db: DatabaseSync, source: PropositionHouse, options: Shared & { year?: number } = {}): PrincipalStaleness {
  const today = todayIso(), universe = options.universe ?? loadUniverse(db, source);
  const principals = [...universe.values()].filter(item => item.group === PRINCIPAL_GROUP && (options.year === undefined || item.year === options.year));
  const evidence = options.evidence ?? collectEvidence(db, source, today, options.events);
  const reference = options.asOf ?? evidence.updatedThrough;
  const points: StalenessPoint[] = [], counts = BUCKETS.map(() => 0);
  let withHistory = 0, closed = 0;
  if (reference) for (const item of principals) {
    const last = evidence.lastEvent.get(item.id);
    if (!last) continue;
    withHistory++;
    if (evidence.closed.has(item.id)) { closed++; continue; }
    const days = Math.max(0, daysBetween(last, reference)), bucket = BUCKETS.findIndex(entry => days >= entry.min && (entry.max === null || days <= entry.max));
    counts[bucket]!++;
    points.push({ id: item.id, label: item.label ?? item.id, days, stage: currentStage(item.id, evidence) });
  }
  const observed = points.length;
  const withoutHistory = principals.length - withHistory;
  const availability: DataCoverage['availability'] = withHistory ? 'partial' : 'unavailable';
  const note = withHistory
    ? `${withHistory} de ${principals.length} matérias principais têm evento datado publicado; as demais ficam sem histórico e não entram nos grupos de tempo. Matérias encerradas (${closed}) ficam fora. Tempo contado até ${reference}, o último registro publicado.`
    : 'Nenhuma matéria principal tem evento datado publicado.';
  return {
    source, year: options.year ?? null, asOf: reference ?? null, universe: principals.length, withHistory, withoutHistory, closed,
    buckets: BUCKETS.map((entry, index) => ({ ...entry, count: counts[index]!, share: share(counts[index]!, observed) })),
    points: points.sort((a, b) => a.days - b.days || a.id.localeCompare(b.id)), recentShare: observed ? (counts[0]! + counts[1]!) / observed : null,
    updatedThrough: evidence.updatedThrough, coverage: coverage(source, availability, withHistory, note, { from: null, to: evidence.updatedThrough, grain: 'unknown' }, null),
  };
}

// ─── §3.3 DNA da atividade (distribuição, não ranking) ─────────────────────────────────────────────────

export interface DnaRow {
  key: string; name: string; source: PropositionHouse; party: string | null; uf: string | null;
  /** Proposições distintas das quais há ao menos um autor do partido/parlamentar. */
  distinctProposals: number;
  /** Autorias individuais (uma proposição com vários autores do mesmo partido gera vários vínculos). */
  links: number;
  /** Proposições em que aparece como autor principal; null quando a Casa não publica essa marca. */
  primaryAuthored: number | null;
  /** Proposições em que aparece só como coautor; null quando a marca de autor principal não é publicada. */
  coauthored: number | null;
  /** Contagem por grupo funcional, na ordem de PROPOSITION_GROUP_ORDER. */
  counts: number[];
}
export interface ActivityDna {
  dimension: 'party' | 'member'; year: number; rows: DnaRow[];
  /** Mediana da participação de cada grupo entre os parlamentares incluídos, por Casa. */
  medians: Record<PropositionHouse, { members: number; shares: number[] } | null>;
  primaryPublished: Record<PropositionHouse, boolean>;
  excludedMembers: Record<PropositionHouse, number>;
  minProposals: number; coverage: DataCoverage;
}

export function activityDnaByAuthor(db: DatabaseSync, query: { dimension: 'party' | 'member'; year: number; minProposals?: number; universe?: Partial<Record<PropositionHouse, Map<string, UniverseItem>>>; authors?: Partial<Record<PropositionHouse, AuthorLink[]>> }): ActivityDna {
  const minProposals = query.minProposals ?? 5, rows: DnaRow[] = [];
  const primaryPublished = { camara: false, senado: false }, excluded = { camara: 0, senado: 0 };
  const memberShares: Record<PropositionHouse, number[][]> = { camara: [], senado: [] };
  let total = 0;
  for (const source of HOUSES) {
    const universe = query.universe?.[source] ?? loadUniverse(db, source), links = query.authors?.[source] ?? loadAuthorLinks(db, source);
    primaryPublished[source] = links.some(link => link.primary === true);
    const byKey = new Map<string, { row: DnaRow; proposals: Map<string, boolean> }>();
    for (const link of links) {
      const item = universe.get(link.proposalId);
      const key = query.dimension === 'party' ? link.party : link.person;
      if (!item || item.year !== query.year || !link.party || !key) continue;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { row: { key: `${source}:${key}`, name: query.dimension === 'party' ? link.party : link.name, source, party: query.dimension === 'party' ? null : link.party, uf: query.dimension === 'party' ? null : link.uf, distinctProposals: 0, links: 0, primaryAuthored: primaryPublished[source] ? 0 : null, coauthored: primaryPublished[source] ? 0 : null, counts: emptyCounts() }, proposals: new Map() };
        byKey.set(key, entry);
      }
      entry.row.links++;
      if (query.dimension === 'member') { entry.row.party = link.party; entry.row.uf = link.uf ?? entry.row.uf; }
      const seenBefore = entry.proposals.has(link.proposalId);
      entry.proposals.set(link.proposalId, Boolean(entry.proposals.get(link.proposalId)) || link.primary === true);
      if (!seenBefore) { const index = groupIndex.get(item.group) ?? fallbackGroupIndex; entry.row.counts[index] = (entry.row.counts[index] ?? 0) + 1; }
    }
    for (const { row, proposals } of byKey.values()) {
      row.distinctProposals = proposals.size;
      if (row.primaryAuthored !== null) { row.primaryAuthored = [...proposals.values()].filter(Boolean).length; row.coauthored = row.distinctProposals - row.primaryAuthored; }
      if (query.dimension === 'member' && row.distinctProposals < minProposals) { excluded[source]++; continue; }
      memberShares[source].push(row.counts.map(count => share(count, row.distinctProposals)));
      rows.push(row); total += row.distinctProposals;
    }
  }
  const medianShares = (source: PropositionHouse) => memberShares[source].length ? { members: memberShares[source].length, shares: PROPOSITION_GROUP_ORDER.map((_, index) => median(memberShares[source].map(values => values[index] ?? 0)) ?? 0) } : null;
  rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.source.localeCompare(b.source));
  const note = rows.length
    ? `Distribuição da atividade de ${query.dimension === 'party' ? 'partidos' : 'parlamentares'} entre os grupos funcionais em ${query.year}. Descritivo: não mede produtividade nem qualidade.${query.dimension === 'member' ? ` Parlamentares com menos de ${minProposals} proposições distintas ficam fora.` : ''}`
    : `Nenhuma autoria com partido publicada para ${query.year}.`;
  return { dimension: query.dimension, year: query.year, rows, medians: { camara: medianShares('camara'), senado: medianShares('senado') }, primaryPublished, excludedMembers: excluded, minProposals, coverage: coverage('multiple', rows.length ? 'partial' : 'unavailable', total, note, { from: `${query.year}-01-01`, to: `${query.year}-12-31`, grain: 'year' }, null) };
}

// ─── §3.4 Ritmo do Legislativo ─────────────────────────────────────────────────────────────────────────

export interface RhythmMonth { month: string; total: number; counts: number[] }
export interface HouseRhythm { source: PropositionHouse; months: RhythmMonth[]; total: number; unmatched: number; updatedThrough: string | null; coverage: DataCoverage }
export interface ActivityRhythm { mode: 'presented' | 'events'; year: number; houses: Record<PropositionHouse, HouseRhythm> }

export function activityRhythm(db: DatabaseSync, query: { mode: 'presented' | 'events'; year: number; universe?: Partial<Record<PropositionHouse, Map<string, UniverseItem>>>; events?: Partial<Record<PropositionHouse, EventRecord[]>> }): ActivityRhythm {
  const houses = {} as Record<PropositionHouse, HouseRhythm>;
  for (const source of HOUSES) {
    const universe = query.universe?.[source] ?? loadUniverse(db, source), byMonth = new Map<string, number[]>();
    let unmatched = 0, last: string | null = null;
    const add = (day: string, group: string) => {
      if (!day.startsWith(`${query.year}-`)) return;
      const month = day.slice(0, 7), counts = byMonth.get(month) ?? emptyCounts();
      counts[groupIndex.get(group) ?? fallbackGroupIndex]!++;
      byMonth.set(month, counts);
      if ((last ?? '') < day) last = day;
    };
    if (query.mode === 'presented') { for (const item of universe.values()) if (item.presentedAt) add(item.presentedAt, item.group); }
    else for (const event of query.events?.[source] ?? loadEvents(db, source)) { const item = universe.get(event.proposalId); if (item) add(event.day, item.group); else if (event.day.startsWith(`${query.year}-`)) unmatched++; }
    const months = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, counts]) => ({ month, counts, total: counts.reduce((sum, value) => sum + value, 0) }));
    const total = months.reduce((sum, month) => sum + month.total, 0);
    const note = total
      ? query.mode === 'presented' ? 'Proposições por mês de apresentação, por grupo funcional.' : `Registros de tramitação por mês de ocorrência, atribuídos ao grupo da proposição.${unmatched ? ` ${unmatched} registros de proposições fora do lote ativo não entram.` : ''} Meses sem cobertura de eventos aparecem como lacuna.`
      : `Sem ${query.mode === 'presented' ? 'proposições' : 'eventos de tramitação'} datados em ${query.year}.`;
    houses[source] = { source, months, total, unmatched, updatedThrough: last, coverage: coverage(source, total ? 'partial' : 'unavailable', total, note, { from: `${query.year}-01-01`, to: last, grain: 'month' }, null) };
  }
  return { mode: query.mode, year: query.year, houses };
}

export interface CalendarDay { date: string; count: number; byKind: Record<string, number>; examples: Array<{ proposalId: string; label: string; kind: string }> }
export interface ActivityCalendar { source: PropositionHouse; year: number; days: CalendarDay[]; max: number; coverageFrom: string | null; coverageTo: string | null; coverage: DataCoverage }

/** Contagem diária de registros de tramitação. Dias fora da janela [coverageFrom, coverageTo] são "sem cobertura", não zero. */
export function activityCalendar(db: DatabaseSync, source: PropositionHouse, year: number, options: { universe?: Map<string, UniverseItem>; events?: EventRecord[] } = {}): ActivityCalendar {
  const universe = options.universe ?? loadUniverse(db, source), days = new Map<string, CalendarDay>();
  const yearEvents = (options.events ?? loadEvents(db, source)).filter(event => event.day.startsWith(`${year}-`) && universe.has(event.proposalId));
  for (const event of yearEvents) {
    const entry = days.get(event.day) ?? { date: event.day, count: 0, byKind: {}, examples: [] };
    entry.count++; entry.byKind[event.kind] = (entry.byKind[event.kind] ?? 0) + 1;
    const item = universe.get(event.proposalId)!;
    if (entry.examples.length < 5 && !entry.examples.some(example => example.proposalId === event.proposalId)) entry.examples.push({ proposalId: event.proposalId, label: item.label ?? event.proposalId, kind: event.kind });
    days.set(event.day, entry);
  }
  const list = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), from = list[0]?.date ?? null, to = list.at(-1)?.date ?? null;
  const note = list.length ? `Registros de tramitação por dia entre ${from} e ${to}. Dias fora dessa janela não têm cobertura publicada.` : `Sem eventos de tramitação datados em ${year}.`;
  return { source, year, days: list, max: Math.max(0, ...list.map(day => day.count)), coverageFrom: from, coverageTo: to, coverage: coverage(source, list.length ? 'partial' : 'unavailable', yearEvents.length, note, { from, to, grain: 'unknown' }, null) };
}

// ─── §3.5 O que acabou de mudar? ───────────────────────────────────────────────────────────────────────

export type RecentEventType = 'new_principal' | 'stage_change' | 'text_change' | 'decision' | 'new_norm' | 'institutional';
export const RECENT_EVENT_TYPES: readonly RecentEventType[] = ['new_principal', 'stage_change', 'text_change', 'decision', 'new_norm', 'institutional'];
export interface RecentEventItem { source: PropositionHouse; proposalId: string; label: string; summary: string | null; date: string; detail: string | null }
export interface RecentEvents { source: PropositionHouse; days: number; windowFrom: string | null; windowTo: string | null; updatedThrough: string | null; types: Array<{ type: RecentEventType; total: number; items: RecentEventItem[] }>; coverage: DataCoverage }
const ITEMS_PER_TYPE = 6;

/**
 * Eventos tipados dos últimos `days` dias. A janela termina no último registro publicado DESTES tipos (não em
 * "hoje"), para que uma coleta atrasada não esvazie a seção.
 */
export function recentLegislativeEvents(db: DatabaseSync, source: PropositionHouse, days = 7, options: Shared = {}): RecentEvents {
  const asOf = options.asOf ?? todayIso(), universe = options.universe ?? loadUniverse(db, source), events = options.events ?? loadEvents(db, source);
  interface Candidate { type: RecentEventType; proposalId: string; date: string; detail: string | null; fallbackLabel: string | null }
  const candidates: Candidate[] = [];
  for (const item of universe.values()) {
    if (!item.presentedAt || item.presentedAt > asOf) continue;
    if (item.group === PRINCIPAL_GROUP) candidates.push({ type: 'new_principal', proposalId: item.id, date: item.presentedAt, detail: null, fallbackLabel: null });
    else if (/^SBT/.test(item.type.toUpperCase())) candidates.push({ type: 'text_change', proposalId: item.id, date: item.presentedAt, detail: 'Substitutivo apresentado', fallbackLabel: null });
    else if (item.group === 'mensagens_comunicacoes_institucionais') candidates.push({ type: 'institutional', proposalId: item.id, date: item.presentedAt, detail: 'Comunicação institucional', fallbackLabel: null });
  }
  for (const event of events) {
    if (event.day > asOf) continue;
    const principal = universe.get(event.proposalId)?.group === PRINCIPAL_GROUP;
    if (event.kind === 'resulting_norm' || (principal && isNormEvent(event))) candidates.push({ type: 'new_norm', proposalId: event.proposalId, date: event.day, detail: event.label || null, fallbackLabel: null });
    else if (principal && (event.kind === 'situation' || event.kind === 'agenda_item')) candidates.push({ type: 'stage_change', proposalId: event.proposalId, date: event.day, detail: event.label || (event.kind === 'agenda_item' ? 'Item de pauta' : null), fallbackLabel: null });
    else if (event.kind === 'vote_effect') candidates.push({ type: 'decision', proposalId: event.proposalId, date: event.day, detail: event.label || null, fallbackLabel: null });
  }
  for (const deliberation of loadDeliberations(db, source)) if (deliberation.day <= asOf) candidates.push({ type: 'decision', proposalId: deliberation.proposalId, date: deliberation.day, detail: deliberation.result ?? (deliberation.approved === null ? null : deliberation.approved ? 'Aprovada' : 'Não aprovada'), fallbackLabel: deliberation.label });
  const to = candidates.reduce<string | null>((latest, candidate) => (latest === null || candidate.date > latest ? candidate.date : latest), null), from = to ? addDays(to, -(days - 1)) : null;
  const bucket = new Map<RecentEventType, RecentEventItem[]>(RECENT_EVENT_TYPES.map(type => [type, []]));
  for (const candidate of candidates) {
    if (!from || candidate.date < from) continue;
    const list = bucket.get(candidate.type)!, existing = list.find(item => item.proposalId === candidate.proposalId); // uma matéria conta uma vez por tipo
    if (existing) { if (candidate.date > existing.date) { existing.date = candidate.date; existing.detail = candidate.detail; } continue; }
    list.push({ source, proposalId: candidate.proposalId, label: universe.get(candidate.proposalId)?.label ?? candidate.fallbackLabel ?? candidate.proposalId, summary: null, date: candidate.date, detail: candidate.detail });
  }
  const types = RECENT_EVENT_TYPES.map(type => {
    const list = [...bucket.get(type)!].sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label, 'pt-BR'));
    return { type, total: list.length, items: list.slice(0, ITEMS_PER_TYPE) };
  });
  const wanted = [...new Set(types.flatMap(entry => entry.items.map(item => item.proposalId)))];
  if (wanted.length) {
    const batches = activeBatches(db, source), summaries = new Map<string, string | null>();
    for (const row of db.prepare(`SELECT p.external_id id,json_extract(p.payload,'$.summary') summary FROM proposals p WHERE p.batch_id IN (${marks(batches.length)}) AND p.external_id IN (${marks(wanted.length)})`).all(...batchIdsOf(batches), ...wanted) as Row[]) summaries.set(String(row.id), row.summary ? String(row.summary) : null);
    for (const entry of types) for (const item of entry.items) item.summary = summaries.get(item.proposalId) ?? null;
  }
  const total = types.reduce((sum, entry) => sum + entry.total, 0);
  const note = to ? `Janela de ${days} dias terminando no último registro publicado desses tipos (${to}); não é a data de hoje.` : 'Sem registros datados publicados.';
  return { source, days, windowFrom: from, windowTo: to, updatedThrough: to, types, coverage: coverage(source, total ? 'partial' : 'unavailable', total, note, { from, to, grain: 'unknown' }, null) };
}

// ─── Estado observado de uma proposição (chip do detalhe) ──────────────────────────────────────────────

export interface ObservedState { source: PropositionHouse; id: string; principal: boolean; stage: StageKey | null; lastEventDay: string | null; daysSinceLastEvent: number | null; eventCount: number; closed: boolean; asOf: string }
/** Mesmo dado da §3.2 para uma única proposição. Os dias são contados até o último registro publicado da Casa. */
export function proposalObservedState(db: DatabaseSync, source: PropositionHouse, id: string, options: { asOf?: string } = {}): ObservedState {
  const today = todayIso(), reference = options.asOf ?? latestEventDay(db, source, today) ?? today;
  const batches = activeBatches(db, source), group = batches.length ? (db.prepare(`SELECT p.grupo_atribuido g FROM proposals p WHERE p.batch_id IN (${marks(batches.length)}) AND p.external_id=? LIMIT 1`).get(...batchIdsOf(batches), id) as Row | undefined)?.g : undefined;
  const events = new Map<string, EventRecord>();
  for (const row of db.prepare(`SELECT c.external_key key,c.kind,c.occurred_at at,json_extract(c.payload,'$.label') label FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.proposal_id=? AND c.occurred_at IS NOT NULL AND c.kind IN (${marks(EVENT_KINDS.length)})`).all(source, id, ...EVENT_KINDS) as Row[]) {
    const day = dayOf(row.at), label = String(row.label ?? '');
    if (day && day <= today) events.set(String(row.key), { proposalId: id, kind: String(row.kind), day, label, folded: fold(label).trim().replace(/\.$/, '') });
  }
  const evidence = emptyEvidence(), days: string[] = [], lastClosing: string[] = [], lastOpen: string[] = [];
  for (const event of events.values()) {
    if (event.kind === 'body') evidence.instruction.add(id); else if (event.kind === 'agenda_item') evidence.agenda.add(id); else if (event.kind === 'vote_effect') evidence.deliberated.add(id);
    if (isNormEvent(event)) evidence.outcome.add(id);
    days.push(event.day); (isClosingEvent(event) ? lastClosing : lastOpen).push(event.day);
  }
  if (batches.length) for (const row of db.prepare(`SELECT json_extract(x.payload,'$.start') start FROM legislative_appointments x WHERE x.batch_id IN (${marks(batches.length)}) AND json_extract(x.payload,'$.kind')='rapporteurship' AND json_extract(x.payload,'$.proposalId')=?`).all(...batchIdsOf(batches), id) as Row[]) {
    evidence.instruction.add(id); const day = dayOf(row.start); if (day && day <= today) { days.push(day); lastOpen.push(day); }
  }
  for (const deliberation of loadDeliberations(db, source)) if (deliberation.proposalId === id && deliberation.day <= today) { evidence.deliberated.add(id); if (deliberation.approved) evidence.approved.add(id); days.push(deliberation.day); lastOpen.push(deliberation.day); }
  const last = [...days].sort().at(-1) ?? null, principal = group === PRINCIPAL_GROUP;
  const closing = lastClosing.sort().at(-1), open = lastOpen.sort().at(-1) ?? '';
  return { source, id, principal, stage: principal ? currentStage(id, evidence) : null, lastEventDay: last, daysSinceLastEvent: last ? Math.max(0, daysBetween(last, reference)) : null, eventCount: days.length, closed: Boolean(closing && closing >= open), asOf: reference };
}

// ─── §6 Frases editoriais determinísticas ──────────────────────────────────────────────────────────────

export interface EditorialFact {
  id: 'thesis' | 'group_share' | 'recent_movement' | 'history_coverage' | 'theme';
  scope: 'camara' | 'senado' | 'congresso';
  /** A frase é `before` + `emphasis` (em destaque, opcional) + `after`. Sempre derivada de números publicados. */
  before: string; emphasis: string | null; after: string;
  numerator: number | null; denominator: number | null; note: string;
}
export interface EditorialFactsInput {
  overview: FunctionalOverview;
  staleness?: Partial<Record<PropositionHouse, PrincipalStaleness>>;
  themes?: { theme: string; themedProposals: number; groups: Array<{ group: string; count: number; share: number }> } | null;
  groupLabels: Record<string, string>;
}
const pct = (value: number) => `${Math.round(value * 1000) / 10}`.replace('.', ',') + '%';
const num = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const houseWord = (source: PropositionHouse) => (source === 'camara' ? 'na Câmara' : 'no Senado');

export function buildEditorialFacts(input: EditorialFactsInput): EditorialFact[] {
  const { overview, staleness, themes, groupLabels } = input, facts: EditorialFact[] = [], year = overview.year;
  const principalShare = (view: HouseFunctionalView) => view.groups.find(group => group.group === PRINCIPAL_GROUP)?.share ?? 0;
  for (const source of HOUSES) {
    const view = overview.houses[source];
    if (!view || !view.total) continue;
    const principal = view.groups.find(group => group.group === PRINCIPAL_GROUP), principalPct = principalShare(view);
    facts.push(principalPct < 0.5
      ? { id: 'thesis', scope: source, before: `Em ${year}, a maior parte da atividade registrada ${houseWord(source)} `, emphasis: 'não foi a apresentação de novas leis', after: '.', numerator: view.total - (principal?.count ?? 0), denominator: view.total, note: `${pct(1 - principalPct)} das ${num(view.total)} proposições publicadas não são proposições legislativas principais.` }
      : { id: 'thesis', scope: source, before: `Em ${year}, ${pct(principalPct)} da atividade registrada ${houseWord(source)} foi `, emphasis: 'a apresentação de proposições legislativas principais', after: '.', numerator: principal?.count ?? 0, denominator: view.total, note: `${num(principal?.count ?? 0)} de ${num(view.total)} proposições publicadas.` });
    const top = view.groups.filter(group => group.group !== PRINCIPAL_GROUP)[0];
    if (top) facts.push({ id: 'group_share', scope: source, before: '', emphasis: `${groupLabels[top.group] ?? top.group} representam ${pct(top.share)}`, after: ` da atividade registrada ${houseWord(source)} em ${year}.`, numerator: top.count, denominator: view.total, note: `${num(top.count)} de ${num(view.total)} proposições publicadas.` });
    const stale = staleness?.[source];
    if (stale?.withHistory) {
      const observed = stale.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
      if (stale.recentShare !== null) facts.push({ id: 'recent_movement', scope: source, before: `Entre as ${num(observed)} matérias principais com histórico observado ${houseWord(source)}, `, emphasis: `${pct(stale.recentShare)} tiveram movimentação`, after: ' nos últimos 30 dias.', numerator: stale.buckets[0]!.count + stale.buckets[1]!.count, denominator: observed, note: `Base: matérias principais de ${year} com evento datado publicado, sem as encerradas. Dados até ${stale.asOf ?? 'data não publicada'}.` });
      facts.push({ id: 'history_coverage', scope: source, before: '', emphasis: `${num(stale.withHistory)} de ${num(stale.universe)} matérias principais`, after: ` ${houseWord(source)} têm histórico de eventos datado publicado (${pct(share(stale.withHistory, stale.universe))}).`, numerator: stale.withHistory, denominator: stale.universe, note: 'A cobertura de eventos limita o que as seções de tramitação conseguem mostrar.' });
    }
  }
  if (overview.congress.comparable && overview.houses.camara && overview.houses.senado) {
    const principal = (overview.congress.groups ?? []).find(group => group.group === PRINCIPAL_GROUP), principalPct = principal?.share ?? 0;
    facts.push({ id: 'thesis', scope: 'congresso', before: principalPct < 0.5 ? `Em ${year}, a maior parte da atividade registrada no Congresso ` : `Em ${year}, ${pct(principalPct)} da atividade registrada no Congresso foi `, emphasis: principalPct < 0.5 ? 'não foi a apresentação de novas leis' : 'a apresentação de proposições legislativas principais', after: '.', numerator: principal?.count ?? 0, denominator: overview.congress.total, note: overview.congress.reason });
  } else {
    const camara = overview.houses.camara, senado = overview.houses.senado, both = Boolean(camara?.total && senado?.total);
    const thesis = (before: string, emphasis: string, after = '.'): EditorialFact => ({ id: 'thesis', scope: 'congresso', before, emphasis, after, numerator: null, denominator: null, note: overview.congress.reason });
    if (both) {
      const low = principalShare(camara!) < 0.5 && principalShare(senado!) < 0.5, gap = Math.abs(principalShare(camara!) - principalShare(senado!));
      facts.push(low ? thesis(`Em ${year}, na Câmara e no Senado, a maior parte da atividade registrada `, 'não foi a apresentação de novas leis')
        : gap >= 0.1 ? thesis(`Em ${year}, `, 'a composição da atividade registrada difere entre a Câmara e o Senado') : thesis(`Em ${year}, `, 'a composição da atividade registrada é parecida na Câmara e no Senado'));
    } else if (camara?.total || senado?.total) {
      const only = camara?.total ? 'a Câmara' : 'o Senado';
      facts.push(thesis(`Em ${year}, `, `só ${only} tem proposições publicadas`, ', então não há comparação entre as Casas.'));
    } else facts.push(thesis('', `Ainda não há proposições publicadas para ${year}`));
  }
  if (themes && themes.themedProposals > 0 && themes.groups.length) {
    const ordered = [...themes.groups].sort((a, b) => b.count - a.count), top = ordered[0]!, second = ordered[1];
    facts.push({ id: 'theme', scope: 'camara', before: `Entre as proposições com tema ${themes.theme} na Câmara, `, emphasis: `${pct(top.share)} são ${(groupLabels[top.group] ?? top.group).toLocaleLowerCase('pt-BR')}`, after: second ? ` e ${pct(second.share)} são ${(groupLabels[second.group] ?? second.group).toLocaleLowerCase('pt-BR')}.` : '.', numerator: top.count, denominator: themes.themedProposals, note: 'Só entram proposições com tema oficial publicado; a classificação não cobre todo o acervo.' });
  }
  return facts;
}

/**
 * Atalho que calcula os agregados necessários e devolve as frases editoriais. A página usa `buildEditorialFacts`
 * com agregados que já calculou, para não repetir consultas.
 */
export function editorialFacts(db: DatabaseSync, query: { year?: number; groupLabels: Record<string, string> }): EditorialFact[] {
  const overview = proposalFunctionalOverview(db, query.year === undefined ? {} : { year: query.year });
  const staleness: Partial<Record<PropositionHouse, PrincipalStaleness>> = {};
  for (const source of HOUSES) staleness[source] = principalStaleness(db, source, { year: overview.year });
  return buildEditorialFacts({ overview, staleness, themes: null, groupLabels: query.groupLabels });
}
