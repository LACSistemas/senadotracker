import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { buildRosterIndex, crossHouseCandidates, foldName, resolveAuthorCode, searchText, recordKey, type AuthorCodeResolution, type BudgetHouse, type Exercise, type HistoryEvent, type Mandate, type Profile, type RosterRecord } from '@senadotracker/domain';
import { ensureBudgetSchema } from '@senadotracker/db';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { chamberNext, parseChamberHistory } from './parsers/camara.ts';
import { parseSenateMandates, parseSenateParties } from './parsers/senado.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';

/**
 * Identidade histórica do autor da emenda: rosters oficiais (Câmara e Senado, legislaturas 55–57) → pessoa × mandato → crosswalk SIOP.
 * Não usa `proposal_authors`. Não funde pessoas por nome: Câmara↔Senado fica como `identity_links.status='candidate'`.
 * O lote histórico (`pg:roster-historical:*`) NUNCA entra em `active_publications`: as telas atuais continuam vendo só o roster ativo.
 */
export const HISTORICAL_LEGISLATURES = [55, 56, 57];
export const historicalBatchId = (house: BudgetHouse) => `pg:roster-historical:${house}:${HISTORICAL_LEGISLATURES[0]}-${HISTORICAL_LEGISLATURES.at(-1)}`;

export interface HistoricalPerson { house: BudgetHouse; externalId: string; profile: Profile; names: string[]; civilName: string | null; /** histórico reaproveitado da última coleta boa porque a API devolveu vazio */ stale?: boolean }
type Json = Record<string, any>;
const asArray = (v: unknown): any[] => v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

export interface RosterFetchDeps { camara: OfficialHttp; senado: OfficialHttp; legislaturas?: number[]; progress?: (message: string) => void; previousProfiles?: Map<string, Profile> }

/**
 * Períodos de exercício da Câmara a partir dos eventos do histórico: abre em `Exercício`, fecha no primeiro evento seguinte de outra
 * situação (licença, afastamento, fim de mandato…). Eventos no mesmo instante com a mesma situação não interrompem o exercício
 * (ex.: posse de suplente + efetivação), ao contrário do parser genérico, que abandona o estado nesses casos e criaria falsas lacunas.
 */
export function deriveChamberExercises(events: ReadonlyArray<Pick<HistoryEvent, 'legislature' | 'at' | 'state'>>, rawId: string, externalId: string): Exercise[] {
  const out: Exercise[] = [];
  for (const legislature of new Set(events.map(e => e.legislature))) {
    const group = events.filter(e => e.legislature === legislature && e.state).map((e, order) => ({ ...e, order })).sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order);
    let open: string | null = null;
    const push = (start: string, end: string | null) => out.push({ key: `${externalId}:${legislature}:${start}`, mandateKey: `legislatura:${legislature}`, start, end, endReason: end ? 'reported' : 'not_reported', precision: 'date', basis: 'derived', state: 'Exercício', cause: null, rawId } as Exercise);
    for (const e of group) {
      if (e.state === 'Exercício') { if (open === null) open = e.at.slice(0, 10); }
      else if (open !== null) { push(open, e.at.slice(0, 10)); open = null; }
    }
    if (open !== null) push(open, null);
  }
  return out;
}

export async function fetchHistoricalRoster(deps: RosterFetchDeps): Promise<HistoricalPerson[]> {
  const legislaturas = deps.legislaturas ?? HISTORICAL_LEGISLATURES; const people: HistoricalPerson[] = [];
  // ---- Câmara
  const listed = new Map<string, string>();
  for (const leg of legislaturas) {
    let url: string | null = `https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${leg}&itens=100&ordem=ASC&ordenarPor=id`;
    while (url) {
      const page: JsonResponse = await deps.camara.json(url);
      for (const row of asArray((page.data as Json).dados)) if (!listed.has(String(row.id))) listed.set(String(row.id), String(row.nome));
      url = chamberNext(page);
    }
    deps.progress?.(`camara legislatura ${leg}: ${listed.size} deputados acumulados`);
  }
  let done = 0;
  const historyUrl = (id: string) => `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/historico`;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const build = async (id: string, listName: string, history: JsonResponse): Promise<HistoricalPerson> => {
    const detail = await deps.camara.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`);
    const parsed = parseChamberHistory(history, id);
    const d = ((detail.data as Json).dados ?? {}) as Json; const last = (d.ultimoStatus ?? {}) as Json;
    const rows = asArray((history.data as Json).dados);
    const names = [...new Set([listName, d.nomeCivil, last.nome, last.nomeEleitoral, ...rows.flatMap(r => [r.nome, r.nomeEleitoral])].filter(Boolean).map(String))];
    return { house: 'camara', externalId: id, civilName: d.nomeCivil ? String(d.nomeCivil) : null, names, profile: {
      source: 'camara', externalId: id, name: String(last.nome ?? listName), fullName: d.nomeCivil ? String(d.nomeCivil) : null, uf: String(last.siglaUf ?? rows[0]?.siglaUf ?? ''), party: String(last.siglaPartido ?? ''), photoUrl: null,
      officialUrl: `https://www.camara.leg.br/deputados/${id}`, observedAt: history.fetchedAt, rawId: history.rawId, historyAvailability: parsed.events.length ? 'available' : 'unavailable',
      mandates: parsed.mandates, exercises: deriveChamberExercises(parsed.events, history.rawId, id), parties: parsed.parties, events: parsed.events } };
  };
  const hasRows = (history: JsonResponse) => asArray((history.data as Json).dados).length > 0;
  const position = new Map<string, number>(); const empties: string[] = [];
  for (const [id, listName] of listed) {
    let history = await deps.camara.json(historyUrl(id));
    // a API da Câmara devolve `dados: []` de forma intermitente: insistir antes de declarar o histórico indisponível
    for (let attempt = 1; attempt <= 3 && !hasRows(history); attempt++) { await sleep(1500 * attempt); history = await deps.camara.json(historyUrl(id)); }
    const person = await build(id, listName, history);
    if (!hasRows(history)) empties.push(id);
    position.set(id, people.push(person) - 1);
    if (++done % 200 === 0) deps.progress?.(`camara: ${done}/${listed.size}`);
  }
  // varredura final dos vazios: a intermitência costuma passar com o tempo
  for (let round = 1; round <= 3 && empties.length; round++) {
    deps.progress?.(`camara: ${empties.length} históricos vazios; nova tentativa em ${20 * round}s`); await sleep(20_000 * round);
    for (const id of [...empties]) {
      const history = await deps.camara.json(historyUrl(id)); if (!hasRows(history)) continue;
      people[position.get(id)!] = await build(id, listed.get(id)!, history); empties.splice(empties.indexOf(id), 1);
    }
  }
  // último recurso: dados da última coleta boa (marcados stale); sem eles, o histórico fica declarado indisponível
  for (const id of empties) {
    const prev = deps.previousProfiles?.get(`camara:${id}`); const cur = people[position.get(id)!]!;
    if (prev && prev.events.length) { people[position.get(id)!] = { ...cur, profile: { ...cur.profile, mandates: prev.mandates, exercises: prev.exercises, parties: prev.parties, events: prev.events, historyAvailability: 'available' }, stale: true }; }
  }
  // ---- Senado
  const senators = new Map<string, { name: string; full: string | null; uf: string | null }>();
  for (const leg of legislaturas) {
    const list = await deps.senado.json(`https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/${leg}.json`);
    for (const p of asArray(((list.data as Json).ListaParlamentarLegislatura?.Parlamentares ?? {}).Parlamentar)) {
      const ident = p.IdentificacaoParlamentar as Json; const id = String(ident.CodigoParlamentar);
      if (!senators.has(id)) senators.set(id, { name: String(ident.NomeParlamentar), full: ident.NomeCompletoParlamentar ? String(ident.NomeCompletoParlamentar) : null, uf: asArray(p.Mandatos?.Mandato)[0]?.UfParlamentar ?? null });
    }
    deps.progress?.(`senado legislatura ${leg}: ${senators.size} senadores acumulados`);
  }
  done = 0;
  for (const [id, s] of senators) {
    const mandatesResponse = await deps.senado.json(`https://legis.senado.leg.br/dadosabertos/senador/${id}/mandatos.json`);
    const parsed = parseSenateMandates(mandatesResponse, id);
    let parties: Profile['parties'] = [];
    try { parties = parseSenateParties(await deps.senado.json(`https://legis.senado.leg.br/dadosabertos/senador/${id}/filiacoes.json`), id); } catch { deps.progress?.(`senado ${id}: filiações indisponíveis`); }
    const last = parsed.mandates.at(-1);
    people.push({ house: 'senado', externalId: id, civilName: s.full, names: [...new Set([s.name, s.full, String(((mandatesResponse.data as Json).MandatoParlamentar?.Parlamentar ?? {}).Nome ?? '')].filter(Boolean) as string[])], profile: {
      source: 'senado', externalId: id, name: s.name, fullName: s.full, uf: last?.uf ?? s.uf ?? '', party: parties.at(-1)?.party ?? '', photoUrl: null,
      officialUrl: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`, observedAt: mandatesResponse.fetchedAt, rawId: mandatesResponse.rawId, historyAvailability: 'available',
      mandates: parsed.mandates, exercises: parsed.exercises, parties, events: [] } });
    if (++done % 100 === 0) deps.progress?.(`senado: ${done}/${senators.size}`);
  }
  return people;
}

// ---------------------------------------------------------------------------------------------- roster em memória
export function rosterRecordOf(person: HistoricalPerson, personKey: string): RosterRecord {
  const uf = new Set<string>([person.profile.uf, ...person.profile.mandates.map(m => m.uf)].filter(u => /^[A-Z]{2}$/.test(u)));
  return { house: person.house, externalId: person.externalId, personKey, names: person.names, ufs: [...uf],
    exercises: person.profile.exercises.map(e => ({ start: e.start.slice(0, 10), end: e.end ? e.end.slice(0, 10) : null, role: null })) };
}
/** Chave de "mesma pessoa" para o resolvedor: nome civil completo exato; sem nome civil, a própria identidade oficial. */
export function personKeyOf(person: HistoricalPerson): string { const civil = foldName(person.civilName); return civil.split(' ').length >= 2 ? `civil:${civil}` : `${person.house}:${person.externalId}`; }

export interface CodeInput { authorCode: string; names: string[]; years: number[]; ufs: string[] }
export async function loadCodeInputs(db: Pick<PoolClient, 'query'>): Promise<CodeInput[]> {
  const rows = (await db.query(`SELECT p.author_code, array_agg(DISTINCT p.author_name_in_plan) FILTER (WHERE p.author_name_in_plan IS NOT NULL) names, array_agg(DISTINCT p.amendment_year) years,
      (SELECT array_agg(DISTINCT a.portal_uf) FROM civica_budget.budget_amendments a WHERE a.author_code=p.author_code AND a.portal_uf ~ '^[A-Z]{2}$') ufs
    FROM civica_budget.special_action_plans p GROUP BY p.author_code ORDER BY p.author_code`)).rows;
  return rows.map(r => ({ authorCode: r.author_code, names: r.names ?? [], years: (r.years as number[]).map(Number), ufs: r.ufs ?? [] }));
}

export interface IdentityPlan {
  resolutions: Array<{ input: CodeInput; resolution: AuthorCodeResolution }>;
  persistKeys: Set<string>; crossHouse: ReturnType<typeof crossHouseCandidates>; summary: Record<string, number>;
  /** registros sem histórico utilizável: ausência de exercício NÃO é evidência, e linhas existentes não são rebaixadas por eles */
  unavailable: Set<string>; stale: string[];
}
export function planIdentity(inputs: CodeInput[], people: HistoricalPerson[]): IdentityPlan {
  const records = people.map(p => rosterRecordOf(p, personKeyOf(p))); const index = buildRosterIndex(records, inputs.flatMap(i => i.names));
  const resolutions = inputs.map(input => ({ input, resolution: resolveAuthorCode({ code: input.authorCode, names: input.names, ufs: input.ufs, years: input.years }, index) }));
  const persistKeys = new Set<string>();
  for (const { resolution } of resolutions) if (resolution.cls === 'EXACT' || resolution.cls === 'HIGH') for (const v of Object.values(resolution.byYear)) if (v) persistKeys.add(v.recordKey);
  const crossHouse = crossHouseCandidates(people.map(p => ({ house: p.house, externalId: p.externalId, civilName: p.civilName ?? '' })))
    .filter(pair => persistKeys.has(`camara:${pair.camara.externalId}`) || persistKeys.has(`senado:${pair.senado.externalId}`));
  for (const pair of crossHouse) { persistKeys.add(`camara:${pair.camara.externalId}`); persistKeys.add(`senado:${pair.senado.externalId}`); }
  const summary: Record<string, number> = {}; for (const { resolution } of resolutions) summary[resolution.cls] = (summary[resolution.cls] ?? 0) + 1;
  return { resolutions, persistKeys, crossHouse, summary, unavailable: new Set(people.filter(p => p.profile.historyAvailability === 'unavailable' && p.house === 'camara').map(recordKey)), stale: people.filter(p => p.stale).map(recordKey) };
}

// ---------------------------------------------------------------------------------------------- persistência
async function ensureHistoricalBatch(client: PoolClient, house: BudgetHouse) {
  const id = historicalBatchId(house), now = new Date().toISOString();
  await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,finished_at,status,parser_version,roster_complete) VALUES($1,$2,$3,$3,'published','pix-historical-roster-v1',1) ON CONFLICT(id) DO UPDATE SET finished_at=EXCLUDED.finished_at`, [id, house, now]);
  await client.query(`INSERT INTO civica.publication_batches(id,source,published_at) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`, [id, house, now]);
  return id;
}

export interface PersistRosterResult { people: number; created: number; reused: number; personIdByRecord: Map<string, string> }
/** Idempotente: reutiliza `civica.people` existente por (fonte, id oficial); só cria o que não existe. Não toca no lote ativo. */
export async function persistHistoricalRoster(client: PoolClient, people: HistoricalPerson[], keys: Set<string>): Promise<PersistRosterResult> {
  const batches = { camara: await ensureHistoricalBatch(client, 'camara'), senado: await ensureHistoricalBatch(client, 'senado') };
  const personIdByRecord = new Map<string, string>(); let created = 0, reused = 0; const now = new Date().toISOString();
  for (const person of people) {
    const key = recordKey(person); if (!keys.has(key)) continue;
    const existing = (await client.query(`SELECT person_id FROM civica.external_identifiers WHERE source=$1 AND external_id=$2`, [person.house, person.externalId])).rows[0]?.person_id as string | undefined;
    const personId = existing ?? randomUUID();
    if (!existing) {
      await client.query(`INSERT INTO civica.people(id,created_at) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [personId, now]);
      await client.query(`INSERT INTO civica.external_identifiers(source,external_id,person_id) VALUES($1,$2,$3) ON CONFLICT(source,external_id) DO NOTHING`, [person.house, person.externalId, personId]); created++;
    } else reused++;
    personIdByRecord.set(key, personId);
    const batch = batches[person.house], p = person.profile;
    await client.query(`INSERT INTO civica.profiles(batch_id,person_id,external_id,name,search_name,uf,party,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(batch_id,person_id) DO UPDATE SET external_id=EXCLUDED.external_id,name=EXCLUDED.name,search_name=EXCLUDED.search_name,uf=EXCLUDED.uf,party=EXCLUDED.party,raw_id=EXCLUDED.raw_id,payload=EXCLUDED.payload`, [batch, personId, p.externalId, p.name, searchText(p.name), p.uf, p.party, p.rawId, JSON.stringify(p)]);
    for (const m of p.mandates) await client.query(`INSERT INTO civica.mandates(batch_id,person_id,key,raw_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=EXCLUDED.payload,raw_id=EXCLUDED.raw_id`, [batch, personId, m.key, m.rawId, JSON.stringify(m)]);
    for (const e of p.exercises) await client.query(`INSERT INTO civica.exercise_periods(batch_id,person_id,key,mandate_key,start,"end",raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=EXCLUDED.payload,start=EXCLUDED.start,"end"=EXCLUDED."end",mandate_key=EXCLUDED.mandate_key,raw_id=EXCLUDED.raw_id`, [batch, personId, e.key, e.mandateKey, e.start, e.end, e.rawId, JSON.stringify(e)]);
    // o lote histórico é a fonte única destas linhas: o que a derivação atual não gera mais sai (filhos antes dos mandatos)
    await client.query(`DELETE FROM civica.exercise_periods WHERE batch_id=$1 AND person_id=$2 AND NOT (key = ANY($3::text[]))`, [batch, personId, p.exercises.map(e => e.key)]);
    for (const m of p.parties) await client.query(`INSERT INTO civica.party_memberships(batch_id,person_id,key,start,"end",raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=EXCLUDED.payload,start=EXCLUDED.start,"end"=EXCLUDED."end",raw_id=EXCLUDED.raw_id`, [batch, personId, m.key, m.start, m.end, m.rawId, JSON.stringify(m)]);
    await client.query(`DELETE FROM civica.party_memberships WHERE batch_id=$1 AND person_id=$2 AND NOT (key = ANY($3::text[]))`, [batch, personId, p.parties.map(x => x.key)]);
    await client.query(`DELETE FROM civica.mandates WHERE batch_id=$1 AND person_id=$2 AND NOT (key = ANY($3::text[]))`, [batch, personId, p.mandates.map(x => x.key)]);
  }
  return { people: personIdByRecord.size, created, reused, personIdByRecord };
}

/** `identity_links` candidatos Câmara↔Senado por nome civil exato. NUNCA confirma e nunca rebaixa um status já revisado. */
export async function persistIdentityCandidates(client: PoolClient, pairs: IdentityPlan['crossHouse'], people: HistoricalPerson[], personIdByRecord: Map<string, string>) {
  const by = new Map(people.map(p => [recordKey(p), p])); let written = 0;
  for (const pair of pairs) {
    const a = personIdByRecord.get(`camara:${pair.camara.externalId}`), b = personIdByRecord.get(`senado:${pair.senado.externalId}`); if (!a || !b || a === b) continue;
    const pc = by.get(`camara:${pair.camara.externalId}`)!.profile, ps = by.get(`senado:${pair.senado.externalId}`)!.profile;
    const evidence = { method: 'civil_name_exact', civilName: pair.civilName, source: 'rosters oficiais Câmara/Senado, legislaturas 55–57', camara: { externalId: pc.externalId, civilName: pc.fullName, uf: pc.uf, mandates: pc.mandates.map(m => ({ key: m.key, legislature: m.legislature, start: m.start, end: m.end, role: m.role })), exercises: pc.exercises.map(e => ({ start: e.start, end: e.end })) },
      senado: { externalId: ps.externalId, civilName: ps.fullName, uf: ps.uf, mandates: ps.mandates.map(m => ({ key: m.key, legislature: m.legislature, start: m.start, end: m.end, role: m.role })), exercises: ps.exercises.map(e => ({ start: e.start, end: e.end })) }, note: 'candidato; unir pessoas exige revisão' };
    await client.query(`INSERT INTO civica.identity_links(id,person_a,person_b,status,evidence) VALUES($1,$2,$3,'candidate',$4) ON CONFLICT(id) DO UPDATE SET evidence=EXCLUDED.evidence`, [`pix-identity:camara:${pair.camara.externalId}:senado:${pair.senado.externalId}`, a, b, JSON.stringify(evidence)]); written++;
  }
  return written;
}

function supportingMandate(person: HistoricalPerson | undefined, year: number): Mandate | null {
  if (!person) return null; const from = `${year - 1}-08-01`, to = `${year}-12-31`;
  return person.profile.mandates.find(m => (m.start ?? '0000') <= to && (m.end ?? '9999') >= from) ?? null;
}

/** Grava o crosswalk. EXACT → reviewed=true (regra determinística); HIGH → false; demais → sem pessoa. Preserva revisão humana. */
export async function persistCrosswalk(client: PoolClient, plan: IdentityPlan, people: HistoricalPerson[], personIdByRecord: Map<string, string>) {
  const by = new Map(people.map(p => [recordKey(p), p])); const out = { exact: 0, high: 0, unresolved: 0 };
  for (const { input, resolution } of plan.resolutions) {
    const years = [...input.years].sort((a, b) => a - b); const first = resolution.byYear[years[0]!] ?? Object.values(resolution.byYear).find(Boolean) ?? null;
    const positive = (resolution.cls === 'EXACT' || resolution.cls === 'HIGH') && first;
    const personId = positive ? personIdByRecord.get(first.recordKey) ?? null : null;
    const person = positive ? by.get(first.recordKey) : undefined;
    const mandate = positive ? supportingMandate(person, years[0]!) : null;
    const evidence = { reason: resolution.reason, class: resolution.cls, names: input.names, ufs: input.ufs, years, recordByYear: Object.fromEntries(Object.entries(resolution.byYear).map(([y, v]) => [y, v?.recordKey ?? null])), fallbackYears: resolution.fallbackYears, candidates: resolution.candidates, roster: 'camara+senado legislaturas 55-57', rule: 'nome exato + exercício datado na janela de autoria (ago–dez de Y−1) ou no ano da emenda' };
    const confidence = positive && personId ? resolution.cls : resolution.cls === 'EXACT' || resolution.cls === 'HIGH' ? 'UNMATCHED' : resolution.cls;
    // histórico indisponível não é prova de ausência: não rebaixa uma linha positiva já gravada
    if (confidence !== 'EXACT' && confidence !== 'HIGH' && resolution.candidates.some(c => plan.unavailable.has(c))) {
      const existing = (await client.query(`SELECT person_id FROM civica_budget.author_code_crosswalk WHERE author_code=$1 AND person_id IS NOT NULL LIMIT 1`, [input.authorCode])).rows[0];
      if (existing) { out.unresolved++; continue; }
    }
    const autoReviewed = confidence === 'EXACT';
    await client.query(`INSERT INTO civica_budget.author_code_crosswalk(author_code,valid_from,valid_to,person_id,house,mandate_key,method,confidence,evidence_source,reviewed,reviewed_at,review_source)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'rule')
      ON CONFLICT(author_code,valid_from) DO UPDATE SET valid_to=EXCLUDED.valid_to, evidence_source=EXCLUDED.evidence_source, updated_at=now(),
        person_id = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.person_id ELSE EXCLUDED.person_id END,
        house = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.house ELSE EXCLUDED.house END,
        mandate_key = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.mandate_key ELSE EXCLUDED.mandate_key END,
        method = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.method ELSE EXCLUDED.method END,
        confidence = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.confidence ELSE EXCLUDED.confidence END,
        reviewed = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.reviewed ELSE EXCLUDED.reviewed END,
        reviewed_at = CASE WHEN author_code_crosswalk.review_source='human' THEN author_code_crosswalk.reviewed_at WHEN EXCLUDED.reviewed THEN coalesce(author_code_crosswalk.reviewed_at, now()) ELSE NULL END`,
      [input.authorCode, `${years[0]}-01-01`, `${years.at(-1)}-12-31`, personId, personId ? (first!.house) : null, mandate?.key ?? null, personId ? resolution.method : null, confidence, JSON.stringify(evidence), autoReviewed, autoReviewed ? new Date().toISOString() : null]);
    if (confidence === 'EXACT') out.exact++; else if (confidence === 'HIGH') out.high++; else out.unresolved++;
  }
  return out;
}

export interface IdentityRunResult { summary: Record<string, number>; unavailableHistories: string[]; staleHistories: string[]; roster: { camara: number; senado: number }; persisted: PersistRosterResult; identityCandidates: number; crosswalk: { exact: number; high: number; unresolved: number } }
export async function loadPreviousProfiles(db: Pick<PoolClient, 'query'>): Promise<Map<string, Profile>> {
  const rows = (await db.query(`SELECT external_id, payload FROM civica.profiles WHERE batch_id = $1`, [historicalBatchId('camara')])).rows;
  return new Map(rows.map(r => [`camara:${r.external_id}`, r.payload as Profile]));
}

export async function runPixIdentity(store: PostgresCollectorStore, deps: Omit<RosterFetchDeps, 'camara' | 'senado'> & { camara: OfficialHttp; senado: OfficialHttp }): Promise<IdentityRunResult> {
  await ensureBudgetSchema(store.pool);
  const inputs = await loadCodeInputs(store.pool);
  if (!inputs.length) throw new Error('Nenhum plano carregado: rode a coleta do Transferegov antes da identidade');
  const people = await fetchHistoricalRoster({ ...deps, previousProfiles: await loadPreviousProfiles(store.pool) });
  const plan = planIdentity(inputs, people);
  const result = await store.transaction(async client => {
    const persisted = await persistHistoricalRoster(client, people, plan.persistKeys);
    const identityCandidates = await persistIdentityCandidates(client, plan.crossHouse, people, persisted.personIdByRecord);
    const crosswalk = await persistCrosswalk(client, plan, people, persisted.personIdByRecord);
    return { persisted, identityCandidates, crosswalk };
  });
  return { summary: plan.summary, unavailableHistories: [...plan.unavailable], staleHistories: plan.stale, roster: { camara: people.filter(p => p.house === 'camara').length, senado: people.filter(p => p.house === 'senado').length }, ...result };
}
