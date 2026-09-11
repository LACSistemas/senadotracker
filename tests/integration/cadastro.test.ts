import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { identityKey, externalId, civilDate, civilDateTime, validateProfile, type Expense } from '@senadotracker/domain';
import { openDatabase, startRun, heartbeat, failRun, stageProfile, validateRun, publishRun, listPublished, getPublished, publishActivity, publishedActivity, publishPresence, publishedParticipation, publishComplement, publishedComplement, publishExpenses, publishedExpenses } from '@senadotracker/db';
import { saveRaw, readRaw } from '../../apps/collector/src/raw.ts';
import { parseSenateRoster, parseSenateMandates, parseSenateParties } from '../../apps/collector/src/parsers/senado.ts';
import { parseChamberHistory, parseChamberRoster } from '../../apps/collector/src/parsers/camara.ts';
import { collectSource, loadRoster } from '../../apps/collector/src/collect.ts';
import type { JsonResponse } from '../../apps/collector/src/http.ts';
import senate from '../fixtures/sources/senado-lista.json' with { type: 'json' };
import mandates from '../fixtures/sources/senado-mandatos.json' with { type: 'json' };
import substitute from '../fixtures/sources/senado-suplente-mandatos.json' with { type: 'json' };
import parties from '../fixtures/sources/senado-filiacoes.json' with { type: 'json' };
import history from '../fixtures/sources/camara-historico.json' with { type: 'json' };
import page1 from '../fixtures/sources/camara-lista.json' with { type: 'json' };
import page2 from '../fixtures/sources/camara-page2.json' with { type: 'json' };

const response = (data: unknown, url = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json'): JsonResponse => ({ data, url, fetchedAt: '2026-09-08T12:00:00.000Z', rawId: randomUUID() });
const singleRoster = () => {
  const data = structuredClone(senate);
  data.ListaParlamentarEmExercicio.Parlamentares.Parlamentar = data.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.filter(p => p.IdentificacaoParlamentar.CodigoParlamentar === '5672');
  return data;
};
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'senadotracker-test-'));
  const db = openDatabase(join(directory, 'test.sqlite'));
  return { db, directory };
}
async function staged(db: ReturnType<typeof openDatabase>, directory: string, runId: string) {
  const rawId = await saveRaw(db, runId, directory, { url: response(null).url, fetchedAt: '2026-09-08T12:00:00.000Z', status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify(singleRoster())) });
  const profile = parseSenateRoster({ ...response(singleRoster()), rawId }).profiles[0]!;
  const m = parseSenateMandates({ ...response(mandates), rawId }, profile.externalId);
  profile.mandates = m.mandates; profile.exercises = m.exercises;
  profile.parties = parseSenateParties({ ...response(parties), rawId }, profile.externalId);
  profile.historyAvailability = 'available';
  stageProfile(db, runId, profile);
  const report = { initialIds: [profile.externalId], finalIds: [profile.externalId], changedIds: [], pagesComplete: true, initialRawIds: [rawId], finalRawIds: [rawId] };
  return { profile, rawId, report };
}

test('identidades não colidem entre Casas; números imprecisos e datas impossíveis são rejeitados', () => {
  assert.notEqual(identityKey('senado', 123), identityKey('camara', 123));
  assert.equal(externalId('00123'), '00123');
  assert.throws(() => externalId(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => civilDate('2025-02-29'));
  assert.equal(civilDate('2024-02-29'), '2024-02-29');
  assert.throws(() => civilDateTime('2026-01-01T24:00'));
  assert.throws(() => civilDateTime('2026-01-01T10:00Z'));
});

test('parser do Senado preserva suplência, filiação e limites ausentes; diagnostica campos novos', () => {
  const parsed = parseSenateRoster(response(senate));
  assert.equal(parsed.profiles.length, 3);
  const details = parseSenateMandates(response(substitute), '5936');
  assert.equal(details.mandates[0]!.titularId, '751');
  assert.equal(details.mandates[0]!.role, '1º Suplente');
  assert.equal(details.exercises[0]!.start, '2020-11-03');
  assert.equal(details.exercises[0]!.end, null);
  assert.equal(details.exercises[0]!.endReason, 'not_reported');
  const affiliations = parseSenateParties(response(parties), '5672');
  assert.equal(affiliations.find(p => p.party === 'UNIÃO')!.end, '2025-11-10');
  const changed = singleRoster();
  Object.assign(changed.ListaParlamentarEmExercicio.Parlamentares.Parlamentar[0]!.IdentificacaoParlamentar, { novoCampo: 'novo' });
  assert.equal(parseSenateRoster(response(changed)).issues[0]!.code, 'unknown_field');
  assert.throws(() => parseSenateMandates(response(mandates), '999'));
  assert.throws(() => parseSenateRoster(response({})));
  const anomalous = structuredClone(mandates);
  anomalous.MandatoParlamentar.Parlamentar.Mandatos.Mandato.push({
    UfParlamentar: 'AC',
    PrimeiraLegislaturaDoMandato: { NumeroLegislatura: '57', DataInicio: '2023-02-01', DataFim: '2027-01-31' },
    SegundaLegislaturaDoMandato: { NumeroLegislatura: '58', DataInicio: '2027-02-01', DataFim: '2031-01-31' },
  } as never);
  const recovered = parseSenateMandates(response(anomalous), '5672');
  assert.equal(recovered.mandates.length, 1);
  assert.equal(recovered.issues[0]?.code, 'unidentified_mandate_entry');
});

test('histórico da Câmara não cria exercício/filiação após fim de mandato e conserva nulo', () => {
  const parsed = parseChamberHistory(response(history, 'https://dadosabertos.camara.leg.br/api/v2/deputados/204554/historico'), '204554');
  assert.equal(parsed.events.at(-1)!.state, null);
  assert.equal(parsed.exercises.length, 2);
  assert.equal(parsed.exercises[0]!.start, '2019-02-01T11:45');
  assert.equal(parsed.exercises[0]!.end, '2022-07-13T18:01');
  assert.equal(parsed.exercises[1]!.start, '2022-11-11T00:00');
  assert.equal(parsed.exercises[1]!.end, '2023-01-31T23:59');
  assert.ok(parsed.parties.every(p => p.end !== null && p.end <= '2023-01-31T23:59'));
  assert.equal(parsed.mandates[0]!.officialId, null);
  assert.equal(parsed.mandates[0]!.start, '2019-02-01');
  assert.equal(parsed.mandates[0]!.end, '2023-01-31');
  assert.equal(parsed.issues.some(i => i.code === 'unknown_history_state'), false);
});

test('paginação percorre todas as páginas e rejeita repetição, ciclo e vazio', async () => {
  let count = 0;
  const terminal = structuredClone(page2); terminal.links = terminal.links.filter(l => l.rel !== 'next');
  const client = { json: async (url: string) => response(count++ === 0 ? page1 : terminal, url) };
  const result = await loadRoster(client, 'camara');
  assert.equal(result.profiles.length, 4); assert.equal(count, 2);
  await assert.rejects(loadRoster({ json: async url => response(page1, url) }, 'camara'), /repetida|Ciclo/);
  await assert.rejects(loadRoster({ json: async url => response({ dados: [], links: [] }, url) }, 'camara'), /vazia/);
  const wrong = structuredClone(page1); wrong.dados[0]!.id = 999;
  assert.throws(() => parseChamberRoster(response(wrong)), /diverge/);
});

test('migrações são repetíveis e chaves estrangeiras/identidades duplicadas são protegidas', async () => {
  const { db, directory } = await setup();
  try {
    db.prepare('INSERT INTO people VALUES (?,?)').run('p', 'now');
    db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run('senado', '1', 'p');
    assert.throws(() => db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run('senado', '1', 'p'));
    assert.throws(() => db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run('camara', '1', 'missing'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM schema_migrations').get()!.n, 13);
  } finally { db.close(); }
  const reopened = openDatabase(join(directory, 'test.sqlite'));
  assert.equal(reopened.prepare('SELECT count(*) AS n FROM people').get()!.n, 1); reopened.close();
});

test('lease recusa concorrência, expira e impede publicação pelo dono anterior', async () => {
  const { db } = await setup();
  try {
    const first = startRun(db, 'senado', 1000, 100);
    assert.throws(() => startRun(db, 'senado', 1050, 100), /execução/);
    const second = startRun(db, 'senado', 1101, 100);
    assert.notEqual(first, second);
    assert.throws(() => heartbeat(db, first, 1102), /Lease/);
    assert.equal(db.prepare('SELECT status FROM ingestion_runs WHERE id=?').get(first)!.status, 'failed');
    failRun(db, first, 'old worker');
    assert.equal(db.prepare('SELECT run_id FROM job_locks').get()!.run_id, second);
  } finally { db.close(); }
});

test('brutos têm hash verificável, conteúdo imutável e metadados por requisição', async () => {
  const { db, directory } = await setup();
  try {
    const run = startRun(db, 'senado');
    const payload = { url: response(null).url, fetchedAt: new Date().toISOString(), status: 200, contentType: 'application/json', bytes: Buffer.from('{"texto":"filiação"}') };
    const a = await saveRaw(db, run, directory, payload); const b = await saveRaw(db, run, directory, payload);
    assert.notEqual(a,b); assert.deepEqual(await readRaw(db, a), payload.bytes);
    const rows = db.prepare('SELECT path FROM raw_objects').all(); assert.equal(rows[0]!.path, rows[1]!.path);
    await writeFile(String(rows[0]!.path), 'corrupted');
    await assert.rejects(readRaw(db, a), /Integridade/);
    await assert.rejects(saveRaw(db, run, directory, payload), /corrompido/);
  } finally { db.close(); }
});

test('staging repetido não duplica; somente lote validado torna-se público', async () => {
  const { db, directory } = await setup();
  try {
    const run = startRun(db, 'senado'); const { profile, report } = await staged(db, directory, run);
    stageProfile(db, run, profile);
    assert.equal(db.prepare('SELECT count(*) AS n FROM staged_profiles').get()!.n, 1);
    assert.equal(listPublished(db).total, 0);
    assert.throws(() => publishRun(db, run), /validado/);
    assert.equal(validateRun(db, run, report).valid, true); publishRun(db, run); publishRun(db, run);
    const result = listPublished(db, { uf: 'AC', party: 'REPUBLICANOS', search: 'álan', pageSize: 1 });
    assert.equal(result.total, 1); assert.equal(result.items[0]!.externalId, '5672');
    assert.equal(getPublished(db, 'camara', '5672'), null);
    assert.throws(() => listPublished(db, { page: 0 }));
    assert.equal(listPublished(db, { search: "' OR 1=1 --" }).total, 0);
  } finally { db.close(); }
});

test('retificação mantém pessoa e lote anterior; falha no meio da publicação faz rollback', async () => {
  const { db, directory } = await setup();
  try {
    const first = startRun(db, 'senado'); const initial = await staged(db, directory, first);
    validateRun(db, first, initial.report); publishRun(db, first);
    const personId = getPublished(db, 'senado', '5672')!.personId;
    const second = startRun(db, 'senado'); const correction = await staged(db, directory, second);
    correction.profile.name = 'Nome retificado'; stageProfile(db, second, correction.profile);
    validateRun(db, second, correction.report);
    db.exec("CREATE TRIGGER fail_publication BEFORE INSERT ON exercise_periods BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
    assert.throws(() => publishRun(db, second), /simulated/);
    assert.equal(getPublished(db, 'senado', '5672')!.batchId, first);
    assert.equal(db.prepare('SELECT count(*) AS n FROM publication_batches').get()!.n, 1);
    db.exec('DROP TRIGGER fail_publication'); publishRun(db, second);
    assert.equal(getPublished(db, 'senado', '5672')!.personId, personId);
    assert.equal(getPublished(db, 'senado', '5672')!.name, 'Nome retificado');
    assert.equal(db.prepare('SELECT count(*) AS n FROM people').get()!.n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM publication_batches').get()!.n, 2);
  } finally { db.close(); }
});

test('lote vazio/incompleto ou alterado na fonte é rejeitado sem apagar lote publicado', async () => {
  const { db, directory } = await setup();
  try {
    const first = startRun(db, 'senado'); const good = await staged(db, directory, first);
    validateRun(db, first, good.report); publishRun(db, first);
    const failed = startRun(db, 'senado'); const bad = await staged(db, directory, failed);
    assert.equal(validateRun(db, failed, { ...bad.report, finalIds: [], pagesComplete: false }).valid, false);
    assert.throws(() => publishRun(db, failed)); failRun(db, failed, 'invalid');
    assert.equal(getPublished(db, 'senado', '5672')!.batchId, first);
    bad.profile.uf = 'XX'; assert.ok(validateProfile(bad.profile).some(i => i.code === 'invalid_uf'));
  } finally { db.close(); }
});

test('jornada completa coleta → bruto → staging → validação → publicação é repetível offline', async () => {
  const { db, directory } = await setup();
  try {
    const clientFactory = (runId: string) => ({ json: async (url: string) => {
      const data = url.includes('/mandatos') ? mandates : url.includes('/filiacoes') ? parties : singleRoster();
      const raw = { url, fetchedAt: new Date().toISOString(), status: 200, contentType: 'application/json', bytes: Buffer.from(JSON.stringify(data)) };
      return { url, data, fetchedAt: raw.fetchedAt, rawId: await saveRaw(db, runId, directory, raw) };
    } });
    const first = await collectSource({ db, source: 'senado', rawDirectory: directory, clientFactory });
    const second = await collectSource({ db, source: 'senado', rawDirectory: directory, clientFactory });
    assert.notEqual(first.runId, second.runId); assert.equal(second.count, 1);
    assert.equal(listPublished(db).total, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM people').get()!.n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM job_locks').get()!.n, 0);
  } finally { db.close(); }
});

test('falha de integração registra erro e libera lease', async () => {
  const { db, directory } = await setup();
  try {
    await assert.rejects(collectSource({ db, source: 'senado', rawDirectory: directory, clientFactory: () => ({ json: async () => { throw new Error('source unavailable'); } }) }), /source unavailable/);
    assert.equal(db.prepare('SELECT status FROM ingestion_runs').get()!.status, 'failed');
    assert.equal(db.prepare('SELECT count(*) AS n FROM job_locks').get()!.n, 0);
  } finally { db.close(); }
});

test('reimportação financeira troca lote ativo sem duplicar a consulta publicada', async()=>{
  const {db,directory}=await setup();try{const profileRun=startRun(db,'senado');const seed=await staged(db,directory,profileRun);validateRun(db,profileRun,seed.report);publishRun(db,profileRun);
    const importYear=async(amount:number)=>{const run=startRun(db,'senado');const rawId=await saveRaw(db,run,directory,{url:'https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_2026.csv',fetchedAt:new Date().toISOString(),status:200,contentType:'application/octet-stream',bytes:Buffer.from(String(amount))});const expense:Expense={source:'senado',externalId:'5672',year:2026,month:1,recordKey:'official:1',categoryCode:'A',category:'Aluguel',supplier:'Fornecedor',supplierDocument:null,documentNumber:'1',documentId:'1',documentUrl:null,issuedAt:'01/01/2026',grossCents:null,deductionCents:0,netCents:amount,refundCents:0,installment:null,detail:null,rawId};publishExpenses(db,run,'senado',2026,[expense]);return run};
    const first=await importYear(100);const second=await importYear(90);assert.notEqual(first,second);const published=publishedExpenses(db,'senado','5672');assert.equal(published.items.length,1);assert.equal(published.items[0]!.netCents,90);assert.equal(db.prepare('SELECT count(*) n FROM expense_batches').get()!.n,2);
  }finally{db.close()}
});


test('atividade preserva coautoria e troca lote ativo sem inferir lei', async()=>{const{db,directory}=await setup();try{const profileRun=startRun(db,'senado');const seed=await staged(db,directory,profileRun);validateRun(db,profileRun,seed.report);publishRun(db,profileRun);const ingest=async(status:string)=>{const run=startRun(db,'senado');const rawId=await saveRaw(db,run,directory,{url:'https://legis.senado.leg.br/dadosabertos/senador/5672/autorias',fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes:Buffer.from(status)});publishActivity(db,run,'senado','teste',[{source:'senado',externalId:'10',type:'PL',number:'1',year:2026,label:'PL 1/2026',summary:'Teste',presentedAt:'2026-01-01',status,officialUrl:'https://www25.senado.leg.br/web/atividade/materias/-/materia/10',rawId}],[{proposalId:'10',externalId:'5672',name:'Alan Rick',party:null,uf:null,kind:'Parlamentar',primary:true,order:1,rawId},{proposalId:'10',externalId:null,name:'Comissao',party:null,uf:null,kind:'Orgao',primary:false,order:2,rawId}],[],[]);return run};const first=await ingest('em analise');const second=await ingest('aprovada');assert.notEqual(first,second);const activity=publishedActivity(db,'senado','5672');assert.equal(activity.proposals[0]!.status,'aprovada');assert.equal(activity.laws.length,0);assert.equal(db.prepare('SELECT count(*) n FROM proposal_authors').get()!.n,4)}finally{db.close()}});


test('presenca ignora sessoes fora do exercicio e datas futuras',async()=>{const{db,directory}=await setup();try{const profileRun=startRun(db,'senado');const seed=await staged(db,directory,profileRun);validateRun(db,profileRun,seed.report);publishRun(db,profileRun);const run=startRun(db,'senado');const rawId=await saveRaw(db,run,directory,{url:'https://exemplo.oficial/sessoes',fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes:Buffer.from('{}')});publishPresence(db,run,'senado',2026,'available','teste',[{source:'senado',externalId:'s1',date:'2026-03-01',startedAt:null,endedAt:null,kind:'Sessao Deliberativa',status:'Encerrada',body:'PLEN',eligible:true,officialUrl:'https://exemplo.oficial/s1',rawId},{source:'senado',externalId:'s2',date:'2010-03-01',startedAt:null,endedAt:null,kind:'Sessao Deliberativa',status:'Encerrada',body:'PLEN',eligible:true,officialUrl:'https://exemplo.oficial/s2',rawId},{source:'senado',externalId:'s3',date:'2999-12-31',startedAt:null,endedAt:null,kind:'Sessao Deliberativa',status:'Agendada',body:'PLEN',eligible:true,officialUrl:'https://exemplo.oficial/s3',rawId}],[{source:'senado',sessionId:'s1',externalId:'5672',state:'presenca registrada',justification:null,rawId}]);const metric=publishedParticipation(db,'senado','5672',2026);assert.equal(metric.presence.numerator,1);assert.equal(metric.presence.denominator,1);assert.equal(metric.participation.denominator,null)}finally{db.close()}});


test('complemento troca lote ativo e recusa chaves repetidas sem afetar o anterior',async()=>{const{db,directory}=await setup();try{const profileRun=startRun(db,'senado');const seed=await staged(db,directory,profileRun);validateRun(db,profileRun,seed.report);publishRun(db,profileRun);const make=async(value:string)=>{const run=startRun(db,'senado');const rawId=await saveRaw(db,run,directory,{url:'https://legis.senado.leg.br/dadosabertos/votacaoComissao/parlamentar/5672',fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes:Buffer.from(value)});const record={source:'senado' as const,externalKey:'commission:1:5672',kind:'commission_vote' as const,personExternalId:'5672',proposalId:null,deliberationId:'1',bodyId:'CCJ',occurredAt:'2026-01-01',label:'PL 1/2026',value,officialUrl:'https://legis.senado.leg.br/dadosabertos/',rawId};publishComplement(db,run,'senado','teste',[record],{count:1});return{run,record}};const first=await make('S');const second=await make('N');assert.notEqual(first.run,second.run);assert.equal(publishedComplement(db,'senado','5672').personal[0]!.value,'N');const bad=startRun(db,'senado');const rawId=await saveRaw(db,bad,directory,{url:'https://legis.senado.leg.br/dadosabertos/',fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes:Buffer.from('x')});const duplicate={...second.record,rawId};assert.throws(()=>publishComplement(db,bad,'senado','teste',[duplicate,duplicate],{}),/duplicado/);failRun(db,bad,'duplicado');assert.equal(publishedComplement(db,'senado','5672').personal[0]!.value,'N')}finally{db.close()}});
