import assert from 'node:assert/strict';
import test from 'node:test';
import { financeLabelSemantics, readStateHouseStory, refreshStateHouseStory, STATE_STORY_VERSION } from '@senadotracker/db';
import { createFinanceResolver, normalizeActorName, normalizeActorNameNoTitle, officialBridgeFromRosterPayload } from '../../packages/db/src/state-finance-identity.ts';
const V = `v${STATE_STORY_VERSION}|`;

// Verificado na base em 2026-10-09: o campo `category` de despesas significa coisas diferentes em cada Casa.
test('financeLabelSemantics: categoria real, favorecido e rótulo inutilizável', () => {
  assert.equal(financeLabelSemantics('SP', ['A - COMBUSTÍVEIS E LUBRIFICANTES', 'P - DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR'], 17), 'category');
  assert.equal(financeLabelSemantics('SC', ['DIÁRIAS', 'VEÍCULOS', 'PASSAGENS'], 12), 'category');
  assert.equal(financeLabelSemantics('MG', ['Raja Rent A Car S/A', 'Pontual Loc Car Ltda.'], 300), 'supplier', 'MG publica o favorecido no campo de categoria');
  assert.equal(financeLabelSemantics('PE', ['5', '4', '2', '3'], 6), 'unusable', 'PE publica códigos numéricos');
  assert.equal(financeLabelSemantics('RS', ['R$ 29.281,31 3- Disponibilidade do Mês', 'Indenização por Uso de Veículo'], 2333), 'unusable', 'RS mistura saldos de extrato com rubricas');
  assert.equal(financeLabelSemantics('XX', [], 0), 'unusable');
});

class FakePool {
  calls: string[] = [];
  constructor(private readonly handler: (sql: string, params: unknown[]) => { rows: unknown[]; rowCount?: number }) {}
  async query(sql: string, params: unknown[] = []) { this.calls.push(sql); const result = this.handler(sql, params); return { rowCount: result.rows.length, ...result }; }
}

test('readStateHouseStory: sem tabela de agregados devolve vazio (nada quebra a página)', async () => {
  const pool = new FakePool(() => { throw Object.assign(new Error('relation does not exist'), { code: '42P01' }); });
  const story = await readStateHouseStory(pool as never, 'MG');
  assert.deepEqual({ fresh: story.fresh, seats: story.seats, proposals: story.proposals, finance: story.finance }, { fresh: false, seats: null, proposals: null, finance: null });
});

test('readStateHouseStory: agregado só é "fresco" se a chave de revisões ativas bate', async () => {
  const built = new Date('2026-10-09T12:00:00Z');
  const make = (key: string) => new FakePool(sql => sql.includes('house_story')
    ? { rows: [{ section: 'seats', source_key: `${V}identity=a|legislative=b`, built_at: built, payload: { total: 3, parties: [], unresolved: 0 } }] }
    : { rows: [{ domain: 'identity', revision_id: key.split('|')[1]!.split('=')[1] }, { domain: 'legislative', revision_id: key.split('|')[2]!.split('=')[1] }] });
  assert.equal((await readStateHouseStory(make(`${V}identity=a|legislative=b`) as never, 'MG')).fresh, true);
  const stale = await readStateHouseStory(make(`${V}identity=a|legislative=NOVA`) as never, 'MG');
  assert.equal(stale.fresh, false);
  assert.equal(stale.seats?.total, 3, 'dados antigos continuam disponíveis, só sinalizados como pendentes');
  assert.equal(stale.builtAt, built.toISOString());
});

test('refreshStateHouseStory: não escreve fora do schema de agregados', async () => {
  const writes: string[] = [];
  const pool = new FakePool((sql) => {
    if (/^\s*(INSERT|DELETE|CREATE|ALTER|DROP|UPDATE)/i.test(sql)) writes.push(sql);
    return { rows: [] };
  });
  await refreshStateHouseStory(pool as never, 'XX', { year: 2026, today: new Date('2026-10-09T00:00:00Z') });
  assert.ok(writes.length > 0);
  assert.ok(writes.every(sql => /civica_state_story/.test(sql)), `escrita fora do schema de agregados: ${writes.find(sql => !/civica_state_story/.test(sql))}`);
});

test('readStateHouseGlances: junta seções por Casa e tolera schema ausente', async () => {
  const { readStateHouseGlances } = await import('@senadotracker/db');
  const missing = new FakePool(() => { throw Object.assign(new Error('missing'), { code: '42P01' }); });
  assert.deepEqual(await readStateHouseGlances(missing as never), []);
  const pool = new FakePool(() => ({ rows: [
    { house: 'MG', section: 'seats', payload: { total: 77, parties: [], unresolved: 0 } }, { house: 'MG', section: 'proposals', payload: { total: 7262, year: 2026 } }, { house: 'MG', section: 'finance', payload: {} },
    { house: 'RJ', section: 'seats', payload: { total: 70, parties: [], unresolved: 0 } },
  ] }));
  const glances = await readStateHouseGlances(pool as never);
  assert.deepEqual(glances.map(item => [item.house, item.proposalsTotal, item.hasFinance]), [['MG', 7262, true], ['RJ', null, false]]);
});

// Gancho pós-publicação do control-plane: recalcula agregados sem nunca comprometer o resultado da coleta.
const fixtureProvider = (domain: string) => ({
  providerId: 'fixture-provider', house: 'MG', domain, enabled: true, operationalStatus: 'OPERATIONAL', implementationState: 'PRODUCTION_CAPABLE', sourceAuthority: 'fixture', collectionModel: 'SNAPSHOT', sourceUpdateFrequency: 'DAILY',
  capabilities: { supportsCollect: true, supportsRefresh: true, supportsBackfill: true, supportsReplay: true, supportsCheckpoint: false, supportsIncremental: false, supportsFullBackfill: true, schedulerEligible: true, lastKnownGoodSupported: true },
  rateLimitProfile: { maxRequestsPerMinute: 60, maxConcurrency: 1, cooldownMs: 0 }, retryPolicy: { retryableErrors: [], maxRetries: 0, backoffMs: 0 }, defaultTimeoutMs: 1000, entrypoint: 'fixture', activePublicationSchema: 'civica_state.active_publications', lastSuccessAt: null, lastFailureAt: null, sourceUpdatedAt: null,
}) as never;
const adapterWith = (revisionActivated: boolean, status: 'SUCCESS' | 'NO_CHANGE' = 'SUCCESS') => [{ providerId: 'fixture-provider', operations: { refresh: async () => ({ status, sourceRequests: 1, rawCaptured: 1, candidateCreated: 1, revisionCreated: revisionActivated, revisionActivated, duplicateInsertions: 0 }) } }] as never;

test('control-plane: afterPublication roda só quando uma revisão foi ativada e nunca em dry-run', async () => {
  const { CollectorOrchestrator } = await import('../../apps/collector/src/core/control-plane/index.ts');
  const calls: string[] = [];
  const make = (activated: boolean, status: 'SUCCESS' | 'NO_CHANGE' = 'SUCCESS') => new CollectorOrchestrator({ database: 'db', registry: [fixtureProvider('FINANCE')], query: async () => ({ rows: [{ current_database: 'db' }] }), adapters: adapterWith(activated, status), afterPublication: async ({ house, domain }) => { calls.push(`${house}:${domain}`); } });
  await make(true).dispatch({ command: 'refresh', house: 'MG', domain: 'FINANCE' });
  assert.deepEqual(calls, ['MG:FINANCE']);
  await make(false).dispatch({ command: 'refresh', house: 'MG', domain: 'FINANCE' });
  await make(true, 'NO_CHANGE').dispatch({ command: 'refresh', house: 'MG', domain: 'FINANCE' });
  await make(true).dispatch({ command: 'refresh', house: 'MG', domain: 'FINANCE', dryRun: true });
  assert.deepEqual(calls, ['MG:FINANCE'], 'sem revisão ativada, sem mudança ou em dry-run: não recalcula');
});

test('control-plane: falha no afterPublication vira aviso e não derruba a coleta', async () => {
  const { CollectorOrchestrator } = await import('../../apps/collector/src/core/control-plane/index.ts');
  const orchestrator = new CollectorOrchestrator({ database: 'db', registry: [fixtureProvider('FINANCE')], query: async () => ({ rows: [{ current_database: 'db' }] }), adapters: adapterWith(true), afterPublication: async () => { throw new Error('banco indisponível'); } });
  const [run] = await orchestrator.dispatch({ command: 'refresh', house: 'MG', domain: 'FINANCE' });
  assert.equal(run?.status, 'SUCCESS');
  assert.equal(run?.revisionActivated, true);
  assert.ok(run?.warnings.some(warning => /after-publication hook failed: banco indisponível/.test(warning)));
});

// Fronteira única de consistência: independe de quem publicou a revisão.
test('reconcileStateHouseStories: recalcula só Casas defasadas, respeita a trava e isola falhas', async () => {
  const { reconcileStateHouseStories } = await import('@senadotracker/db');
  const refreshed: string[] = []; let lockedHouses = new Set<string>();
  const client = { query: async (sql: string, params: unknown[] = []) => { if (/pg_try_advisory_lock/.test(sql)) return { rows: [{ ok: !lockedHouses.has(String(params[0]).split(':')[1] ?? '') }] }; return { rows: [] }; }, release() {} };
  const pool = {
    connect: async () => client,
    query: async (sql: string, params: unknown[] = []) => {
      if (/string_agg/.test(sql)) return { rows: [{ house: 'MG', key: `${V}identity=a|legislative=b` }, { house: 'RJ', key: `${V}identity=c|legislative=NOVA` }, { house: 'SP', key: `${V}identity=s|legislative=t` }, { house: 'BA', key: `${V}identity=x|legislative=y` }, { house: 'ES', key: `${V}identity=e|legislative=f` }] };
      if (/array_agg/.test(sql)) return { rows: [{ house: 'MG', keys: [`${V}identity=a|legislative=b`] }, { house: 'RJ', keys: [`${V}identity=c|legislative=VELHA`] }, { house: 'SP', keys: [`${V}identity=s|legislative=OUTRA`, `${V}identity=s|legislative=t`] }, { house: 'BA', keys: [`${V}identity=VELHA|legislative=y`] }] };
      if (/INSERT INTO civica_state_story/.test(sql)) refreshed.push(String(params[0]));
      return { rows: [], rowCount: 0 };
    },
  };
  lockedHouses = new Set(['BA']);
  const result = await reconcileStateHouseStories(pool as never, { today: new Date('2026-10-09T00:00:00Z') });
  assert.equal(result.checked, 5);
  assert.ok(!result.refreshed.includes('MG'), 'MG está em dia: não recalcula');
  assert.deepEqual([...result.refreshed].sort(), ['ES', 'RJ', 'SP'], 'RJ (chave mudou), SP (seções com chaves diferentes) e ES (nunca calculada)');
  assert.deepEqual(result.skippedLocked, ['BA'], 'outro processo já recalcula BA');
  assert.deepEqual(result.failed, []);
});

// Ligação despesa → parlamentar: nunca por aproximação, sempre auditável.
const roster = [
  { id: '1043', name: 'Hashioka', parliamentaryName: null }, { id: '1044', name: 'João César Mattogrosso', parliamentaryName: 'Mattogrosso' },
  { id: '1050', name: 'Pedro Silva', parliamentaryName: 'Dr. Pedro' }, { id: '1051', name: 'Pedro Silva', parliamentaryName: 'Pedro Silva Filho' },
  { id: '2000', name: 'Dr. Lucas', parliamentaryName: null },
];

test('financeiro: normalização ignora acento, caixa, pontuação e "Dep.", mas não inventa nomes', () => {
  assert.equal(normalizeActorName('DEP. HASHIOKA'), 'hashioka');
  assert.equal(normalizeActorName('Deputada João César'), 'joao cesar');
  assert.equal(normalizeActorName('Dr. Pedro'), 'dr pedro', 'o tratamento só cai na segunda camada');
  assert.equal(normalizeActorNameNoTitle('Dr. Pedro'), 'pedro');
});

test('financeiro: id do cadastro > chave oficial > nome exato único > nome sem tratamento', () => {
  const resolve = createFinanceResolver(roster, new Map([['300188', '1044']]));
  assert.deepEqual(resolve({ id: '1043', labels: [] }), { rosterId: '1043', method: 'EXACT_ID' });
  assert.deepEqual(resolve({ id: '300188', labels: [] }), { rosterId: '1044', method: 'OFFICIAL_BRIDGE' });
  assert.deepEqual(resolve({ id: 'DEP. HASHIOKA', labels: [] }), { rosterId: '1043', method: 'EXACT_UNIQUE_NAME' }, 'MS publica o rótulo no lugar do id');
  assert.deepEqual(resolve({ id: null, labels: ['DEP TOMAZ', 'mattogrosso'] }) ?? null, { rosterId: '1044', method: 'EXACT_UNIQUE_NAME' });
  assert.deepEqual(resolve({ id: null, labels: ['Dr. Pedro'] }), { rosterId: '1050', method: 'EXACT_UNIQUE_NAME' });
  assert.deepEqual(resolve({ id: null, labels: ['Lucas'] }), { rosterId: '2000', method: 'UNIQUE_NAME_NO_TITLE' });
});

test('financeiro: nome ambíguo, desconhecido ou só parecido nunca é ligado', () => {
  const resolve = createFinanceResolver(roster);
  assert.equal(resolve({ id: null, labels: ['Pedro Silva'] }), null, 'dois parlamentares com o mesmo nome');
  assert.equal(resolve({ id: '9999', labels: [] }), null, 'id numérico desconhecido');
  assert.equal(resolve({ id: null, labels: ['Marcos Miranda Madureira'] }), null, 'sem aproximação por partes do nome');
  assert.equal(resolve({ id: null, labels: ['Hashioka', 'Mattogrosso'] }), null, 'rótulos que apontam para pessoas diferentes');
  assert.equal(resolve({ id: '300188', labels: [] }), null, 'sem ponte, a matrícula não vira ligação');
});

test('financeiro: ponte oficial de SP lê matrícula do portal da ALESP', () => {
  const body = JSON.stringify({ content: [{ idParlamentar: 1139, nuMatricula: 300607 }, { idParlamentar: 1050, nuMatricula: 300188 }, { idParlamentar: 7 }] });
  assert.deepEqual([...officialBridgeFromRosterPayload('SP', body)], [['300607', '1139'], ['300188', '1050']]);
  assert.equal(officialBridgeFromRosterPayload('SP', 'não é json').size, 0);
  assert.equal(officialBridgeFromRosterPayload('MG', body).size, 0, 'só Casas com chave oficial comprovada');
});
