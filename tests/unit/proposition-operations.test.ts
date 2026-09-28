import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publishedPropositionComposition, activityCalendar, activityDnaByAuthor, activityRhythm, buildEditorialFacts, openDatabase, principalStageFlow, principalStaleness, proposalFunctionalOverview,
  proposalObservedState, recentLegislativeEvents, PROPOSITION_GROUP_ORDER, type PropositionHouse,
} from '@senadotracker/db';
import { GROUP_KEYS } from '../../apps/web/lib/proposicoes/taxonomy.ts';

type Db = ReturnType<typeof openDatabase>;
interface SeedProposal { id: string; type: string; group: string; year: number; presentedAt: string; label: string }
interface SeedAuthor { proposalId: string; person: string | null; name: string; party: string | null; uf?: string | null; primary?: boolean | null }
interface SeedEvent { proposalId: string; kind: string; at: string; label: string }
interface SeedHouse {
  scope?: string; proposals: SeedProposal[]; authors?: SeedAuthor[]; events?: SeedEvent[];
  rapporteurs?: Array<{ proposalId: string; start: string }>; deliberations?: Array<{ proposalId: string; date: string; approved: boolean }>;
}
const PRINCIPAL = 'proposicoes_legislativas_principais';

function addHouse(db: Db, source: PropositionHouse, house: SeedHouse) {
  const run = `run-${source}`, raw = `raw-${source}`, scope = house.scope ?? `full-${source}`, complementRun = `crun-${source}`, legislativeRun = `lrun-${source}`;
  for (const id of [run, complementRun, legislativeRun]) db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-09-09','published','test',1)").run(id, source);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-09-09',200,'application/json',?,?,0)").run(raw, run, `https://example.invalid/${source}`, '0'.repeat(64), `raw/${source}`);
  db.prepare("INSERT INTO activity_batches VALUES (?,?,?,'2026-09-09',?,?,0,0)").run(run, source, scope, house.proposals.length, house.authors?.length ?? 0);
  db.prepare('INSERT INTO active_activity_publications VALUES (?,?,?)').run(source, scope, run);
  for (const proposal of house.proposals) {
    const payload = { source, externalId: proposal.id, type: proposal.type, functionalGroup: proposal.group, number: '1', year: proposal.year, label: proposal.label, summary: `Ementa de ${proposal.label}`, presentedAt: proposal.presentedAt, status: null, officialUrl: 'https://example.invalid/p', rawId: raw };
    db.prepare('INSERT INTO proposals(batch_id,source,external_id,raw_id,payload,grupo_atribuido) VALUES (?,?,?,?,?,?)').run(run, source, proposal.id, raw, JSON.stringify(payload), proposal.group);
  }
  (house.authors ?? []).forEach((author, index) => {
    const payload = { proposalId: author.proposalId, externalId: author.person, name: author.name, party: author.party, uf: author.uf ?? null, kind: 'Parlamentar', primary: author.primary ?? null, order: index, rawId: raw };
    db.prepare('INSERT INTO proposal_authors VALUES (?,?,?,?,?,?)').run(run, author.proposalId, `a${index}`, author.person, raw, JSON.stringify(payload));
  });
  (house.rapporteurs ?? []).forEach((item, index) => {
    const payload = { source, externalId: `r${index}`, personExternalId: 'rel', kind: 'rapporteurship', bodyId: '1', bodyLabel: 'CCJ', role: 'Relator', start: item.start, end: null, status: null, proposalId: item.proposalId, officialUrl: 'https://example.invalid/r', rawId: raw };
    db.prepare('INSERT INTO legislative_appointments VALUES (?,?,?,?,?,?,?)').run(run, `r${index}`, source, 'rel', 'rapporteurship', raw, JSON.stringify(payload));
  });
  if (house.events?.length) {
    db.prepare("INSERT INTO complement_batches VALUES (?,?,?,'2026-09-09',?,'{}')").run(complementRun, source, `events-${source}`, house.events.length);
    db.prepare('INSERT INTO active_complement_publications VALUES (?,?,?)').run(source, `events-${source}`, complementRun);
    house.events.forEach((event, index) => {
      const payload = { source, externalKey: `e${index}`, kind: event.kind, proposalId: event.proposalId, occurredAt: event.at, label: event.label };
      db.prepare('INSERT INTO legislative_complements VALUES (?,?,?,?,NULL,?,NULL,NULL,?,?,?)').run(complementRun, source, `e${index}`, event.kind, event.proposalId, event.at, raw, JSON.stringify(payload));
    });
  }
  if (house.deliberations?.length) {
    db.prepare("INSERT INTO legislative_batches VALUES (?,?,2026,'2026-09-09',?,0)").run(legislativeRun, source, house.deliberations.length);
    db.prepare('INSERT INTO active_legislative_publications VALUES (?,2026,?)').run(source, legislativeRun);
    house.deliberations.forEach((item, index) => {
      const field = source === 'camara' ? 'actualVotedProposalId' : 'proposalId';
      const payload = { source, externalId: `d${index}`, year: 2026, date: item.date, chamberBody: 'PLEN', description: 'Votação', result: item.approved ? 'Aprovada' : 'Rejeitada', approved: item.approved, [field]: item.proposalId, proposalLabel: null, rawId: raw };
      db.prepare('INSERT INTO deliberations VALUES (?,?,?,2026,?,?,?)').run(legislativeRun, source, `d${index}`, item.date, raw, JSON.stringify(payload));
    });
  }
}

const camara: SeedHouse = {
  proposals: [
    { id: 'c1', type: 'PL', group: PRINCIPAL, year: 2026, presentedAt: '2026-02-10', label: 'PL 1/2026' },
    { id: 'c2', type: 'PL', group: PRINCIPAL, year: 2026, presentedAt: '2026-03-05', label: 'PL 2/2026' },
    { id: 'c3', type: 'PL', group: PRINCIPAL, year: 2026, presentedAt: '2026-08-01', label: 'PL 3/2026' },
    { id: 'c4', type: 'REQ', group: 'requerimentos', year: 2026, presentedAt: '2026-02-11', label: 'REQ 1/2026' },
    { id: 'c5', type: 'REQ', group: 'requerimentos', year: 2026, presentedAt: '2026-03-01', label: 'REQ 2/2026' },
    { id: 'c6', type: 'PRL', group: 'pareceres_relatorios', year: 2026, presentedAt: '2026-04-01', label: 'PRL 1/2026' },
    { id: 'c7', type: 'SBT', group: 'emendas_substitutivos', year: 2026, presentedAt: '2026-08-30', label: 'SBT 1/2026' },
    { id: 'c8', type: 'PL', group: PRINCIPAL, year: 2025, presentedAt: '2025-12-01', label: 'PL 9/2025' },
  ],
  authors: [
    { proposalId: 'c1', person: 'p1', name: 'Ana', party: 'AAA', uf: 'SP' }, { proposalId: 'c1', person: 'p2', name: 'Bia', party: 'AAA', uf: 'MG' },
    { proposalId: 'c2', person: 'p1', name: 'Ana', party: 'AAA', uf: 'SP' }, { proposalId: 'c4', person: 'p1', name: 'Ana', party: 'AAA', uf: 'SP' },
    { proposalId: 'c5', person: 'p3', name: 'Caio', party: 'BBB', uf: 'BA' },
  ],
  events: [
    { proposalId: 'c1', kind: 'movement', at: '2026-03-01T10:00', label: 'Distribuição' },
    { proposalId: 'c1', kind: 'agenda_item', at: '2026-08-20', label: 'Item de pauta' },
    { proposalId: 'c2', kind: 'movement', at: '2026-03-10', label: 'Apresentação de Proposição' },
    { proposalId: 'c2', kind: 'movement', at: '2026-04-10', label: 'Arquivamento' },
    { proposalId: 'c5', kind: 'movement', at: '2026-09-01', label: 'Aprovação de Requerimento' },
    { proposalId: 'c4', kind: 'movement', at: '2026-09-02', label: 'Distribuição' },
  ],
  rapporteurs: [{ proposalId: 'c1', start: '2026-03-05' }],
  deliberations: [{ proposalId: 'c1', date: '2026-08-25', approved: true }],
};
const senado: SeedHouse = {
  scope: 'current-roster-person-activity',
  proposals: [
    { id: 's1', type: 'PL', group: PRINCIPAL, year: 2026, presentedAt: '2026-02-01', label: 'PL 10/2026' },
    { id: 's2', type: 'RQS', group: 'requerimentos', year: 2026, presentedAt: '2026-02-02', label: 'RQS 1/2026' },
    { id: 's3', type: 'PEC', group: PRINCIPAL, year: 2026, presentedAt: '2026-05-05', label: 'PEC 3/2026' },
  ],
  authors: [
    { proposalId: 's1', person: 'x1', name: 'Carlos', party: 'CCC', uf: 'RJ', primary: true }, { proposalId: 's1', person: 'x2', name: 'Dora', party: 'DDD', uf: 'PE', primary: false },
    { proposalId: 's3', person: 'x1', name: 'Carlos', party: 'CCC', uf: 'RJ', primary: false },
  ],
  events: [
    { proposalId: 's1', kind: 'situation', at: '2026-03-01', label: 'MATÉRIA EM TRAMITAÇÃO' },
    { proposalId: 's1', kind: 'situation', at: '2026-05-10', label: 'TRANSFORMADA EM NORMA JURÍDICA' },
    { proposalId: 's1', kind: 'resulting_norm', at: '2026-05-10', label: 'Lei 1/2026' },
    { proposalId: 's3', kind: 'situation', at: '2026-05-06', label: 'ARQUIVADA' },
    { proposalId: 's3', kind: 'movement', at: '2026-06-01', label: 'Desarquivamento' },
    { proposalId: 's2', kind: 'movement', at: '2026-09-10', label: 'Aprovado' },
  ],
};
function seed(options: { senadoScope?: string } = {}) {
  const db = openDatabase(':memory:');
  addHouse(db, 'camara', camara);
  addHouse(db, 'senado', { ...senado, scope: options.senadoScope ?? senado.scope! });
  return db;
}
const clean = <T,>(work: (db: Db) => T, options?: { senadoScope?: string }): T => { const db = seed(options); try { return work(db); } finally { db.close(); } };

test('a taxonomia da web e a ordem do banco descrevem os mesmos dez grupos, na mesma ordem', () => {
  assert.deepEqual([...GROUP_KEYS], [...PROPOSITION_GROUP_ORDER]);
});

test('composição funcional: contagens por grupo, anos e universo não comparável quando o Senado é recorte', () => {
  const overview = clean(db => proposalFunctionalOverview(db, {}));
  assert.equal(overview.year, 2026);
  assert.deepEqual(overview.years.map(item => [item.year, item.camara, item.senado]), [[2026, 7, 3], [2025, 1, 0]]);
  const view = overview.houses.camara!;
  assert.equal(view.total, 7);
  assert.equal(view.groups.find(group => group.group === PRINCIPAL)!.count, 3);
  assert.equal(view.groups.find(group => group.group === 'requerimentos')!.topTypes[0]!.type, 'REQ');
  assert.equal(overview.houses.senado!.partial, true);
  assert.equal(overview.houses.senado!.coverage.availability, 'partial');
  assert.equal(overview.congress.comparable, false);
  assert.equal(overview.congress.groups, null, 'sem agregado do Congresso quando não comparável');
  assert.match(overview.congress.reason, /lado a lado/);
});

test('composição funcional: Congresso agrega quando os dois universos são completos', () => {
  const overview = clean(db => proposalFunctionalOverview(db, { year: 2026 }), { senadoScope: 'processes-2026' });
  assert.equal(overview.congress.comparable, true);
  assert.equal(overview.congress.total, 10);
  assert.equal(overview.congress.groups!.find(group => group.group === PRINCIPAL)!.count, 5);
});

test('composição funcional: ano sem dados vira cobertura indisponível, não zero fabricado', () => {
  const overview = clean(db => proposalFunctionalOverview(db, { year: 2025 }));
  assert.equal(overview.houses.camara!.total, 1);
  assert.equal(overview.houses.senado!.total, 0);
  assert.equal(overview.houses.senado!.coverage.availability, 'unavailable');
  assert.deepEqual(overview.houses.senado!.groups, []);
});

test('rio de tramitação: só evidência estruturada; rito segue indisponível', () => {
  const flow = clean(db => principalStageFlow(db, 'camara', 2026, { asOf: '2026-09-28' }));
  assert.equal(flow.universe, 3);
  const byKey = Object.fromEntries(flow.stages.map(stage => [stage.key, stage]));
  assert.equal(byKey.presented!.count, 3);
  assert.equal(byKey.rite!.count, null);
  assert.equal(byKey.rite!.available, false);
  assert.equal(byKey.instruction!.count, 1);
  assert.equal(byKey.agenda!.count, 1);
  assert.equal(byKey.deliberation!.count, 1);
  assert.equal(byKey.post!.count, 1);
  assert.equal(byKey.outcome!.count, 0);
  assert.equal(byKey.instruction!.share, 1 / 3);
  const sen = clean(db => principalStageFlow(db, 'senado', 2026, { asOf: '2026-09-28' }));
  assert.equal(sen.stages.find(stage => stage.key === 'outcome')!.count, 1, 'norma resultante do Senado');
  assert.equal(sen.stages.find(stage => stage.key === 'deliberation')!.count, null, 'sem deliberações publicadas não há contagem');
});

test('rio de tramitação: ano sem matérias principais devolve cobertura indisponível e nenhuma etapa', () => {
  const flow = clean(db => principalStageFlow(db, 'camara', 2024, { asOf: '2026-09-28' }));
  assert.equal(flow.universe, 0);
  assert.deepEqual(flow.stages, []);
  assert.equal(flow.coverage.availability, 'unavailable');
});

test('tempo sem movimentação: âncora no último registro, encerradas fora e sem-histórico contadas à parte', () => {
  const stale = clean(db => principalStaleness(db, 'camara', { year: 2026 }));
  assert.equal(stale.asOf, '2026-09-02', 'âncora é o último registro publicado, não hoje');
  assert.equal(stale.universe, 3);
  assert.equal(stale.withHistory, 2);
  assert.equal(stale.withoutHistory, 1);
  assert.equal(stale.closed, 1, 'c2 termina em Arquivamento');
  assert.deepEqual(stale.buckets.map(bucket => bucket.count), [0, 1, 0, 0, 0]);
  assert.deepEqual(stale.points, [{ id: 'c1', label: 'PL 1/2026', days: 8, stage: 'post' }]);
  assert.equal(stale.recentShare, 1);
  assert.equal(stale.coverage.availability, 'partial');
});

test('tempo sem movimentação: desarquivamento reabre a matéria e norma resultante a encerra', () => {
  const stale = clean(db => principalStaleness(db, 'senado', { year: 2026 }));
  assert.equal(stale.closed, 1, 's1 virou norma');
  assert.deepEqual(stale.points.map(point => point.id), ['s3'], 's3 foi arquivada e depois desarquivada');
  assert.equal(stale.points[0]!.days, 101, '2026-06-01 até 2026-09-10');
  assert.equal(stale.buckets.find(bucket => bucket.key === 'd90')!.count, 1);
});

test('DNA por partido: proposições distintas diferem de vínculos e "autor principal" é null quando a Casa não publica a marca', () => {
  const dna = clean(db => activityDnaByAuthor(db, { dimension: 'party', year: 2026 }));
  assert.deepEqual(dna.primaryPublished, { camara: false, senado: true });
  const aaa = dna.rows.find(row => row.key === 'camara:AAA')!;
  assert.equal(aaa.distinctProposals, 3);
  assert.equal(aaa.links, 4, 'c1 tem dois autores do partido');
  assert.equal(aaa.primaryAuthored, null);
  assert.equal(aaa.coauthored, null);
  assert.deepEqual(aaa.counts.slice(0, 2), [2, 1]);
  assert.equal(aaa.counts.reduce((sum, value) => sum + value, 0), aaa.distinctProposals);
  const ccc = dna.rows.find(row => row.key === 'senado:CCC')!;
  assert.equal(ccc.distinctProposals, 2);
  assert.equal(ccc.primaryAuthored, 1);
  assert.equal(ccc.coauthored, 1);
});

test('DNA por parlamentar: parlamentares com poucas proposições ficam fora e a contagem de exclusão é publicada', () => {
  const strict = clean(db => activityDnaByAuthor(db, { dimension: 'member', year: 2026 }));
  assert.equal(strict.rows.length, 0);
  assert.equal(strict.excludedMembers.camara, 3);
  assert.equal(strict.coverage.availability, 'unavailable');
  const open = clean(db => activityDnaByAuthor(db, { dimension: 'member', year: 2026, minProposals: 1 }));
  const ana = open.rows.find(row => row.key === 'camara:p1')!;
  assert.deepEqual([ana.name, ana.party, ana.uf, ana.distinctProposals], ['Ana', 'AAA', 'SP', 3]);
  assert.equal(open.medians.camara!.members, 3);
  assert.ok(open.medians.camara!.shares.every(value => value >= 0 && value <= 1));
});

test('ritmo: proposições por mês de apresentação e eventos por mês de ocorrência, cada um no grupo da proposição', () => {
  const presented = clean(db => activityRhythm(db, { mode: 'presented', year: 2026 }));
  assert.deepEqual(presented.houses.camara.months.map(month => [month.month, month.total]), [['2026-02', 2], ['2026-03', 2], ['2026-04', 1], ['2026-08', 2]]);
  assert.equal(presented.houses.camara.months[0]!.counts[0], 1, 'PL de fevereiro no grupo principal');
  assert.equal(presented.houses.camara.months[0]!.counts[1], 1, 'REQ de fevereiro em requerimentos');
  const events = clean(db => activityRhythm(db, { mode: 'events', year: 2026 }));
  assert.deepEqual(events.houses.camara.months.map(month => [month.month, month.total]), [['2026-03', 2], ['2026-04', 1], ['2026-08', 1], ['2026-09', 2]]);
  assert.equal(events.houses.camara.coverage.availability, 'partial');
});

test('calendário: contagem diária, exemplos e janela de cobertura explícita', () => {
  const calendar = clean(db => activityCalendar(db, 'camara', 2026));
  assert.equal(calendar.days.length, 6);
  assert.equal(calendar.max, 1);
  assert.equal(calendar.coverageFrom, '2026-03-01');
  assert.equal(calendar.coverageTo, '2026-09-02');
  assert.deepEqual(calendar.days.at(-1)!.examples, [{ proposalId: 'c4', label: 'REQ 1/2026', kind: 'movement' }]);
  assert.equal(activityCalendar(seed(), 'camara', 2030).coverage.availability, 'unavailable');
});

test('eventos recentes: a janela termina no último registro desses tipos e cada matéria conta uma vez por tipo', () => {
  const recent = clean(db => recentLegislativeEvents(db, 'camara', 7, { asOf: '2026-09-28' }));
  assert.equal(recent.windowTo, '2026-08-30');
  assert.equal(recent.windowFrom, '2026-08-24');
  const totals = Object.fromEntries(recent.types.map(entry => [entry.type, entry.total]));
  assert.deepEqual(totals, { new_principal: 0, stage_change: 0, text_change: 1, decision: 1, new_norm: 0, institutional: 0 });
  assert.equal(recent.types.find(entry => entry.type === 'text_change')!.items[0]!.label, 'SBT 1/2026');
  const decision = recent.types.find(entry => entry.type === 'decision')!.items[0]!;
  assert.deepEqual([decision.label, decision.detail, decision.date], ['PL 1/2026', 'Aprovada', '2026-08-25']);
  assert.equal(decision.summary, 'Ementa de PL 1/2026');
  const wide = clean(db => recentLegislativeEvents(db, 'camara', 30, { asOf: '2026-09-28' }));
  assert.equal(wide.types.find(entry => entry.type === 'stage_change')!.total, 1, 'pauta de c1 em 20/08');
});

test('estado observado da proposição usa o mesmo dado do rio e da inatividade', () => {
  const [c1, c2, c3, s1, req] = clean(db => [
    proposalObservedState(db, 'camara', 'c1'), proposalObservedState(db, 'camara', 'c2'), proposalObservedState(db, 'camara', 'c3'),
    proposalObservedState(db, 'senado', 's1'), proposalObservedState(db, 'camara', 'c4'),
  ] as const);
  assert.deepEqual([c1.principal, c1.stage, c1.lastEventDay, c1.daysSinceLastEvent, c1.closed], [true, 'post', '2026-08-25', 8, false]);
  assert.equal(c2.closed, true);
  assert.deepEqual([c3.lastEventDay, c3.daysSinceLastEvent, c3.eventCount], [null, null, 0], 'sem evento, sem dias inventados');
  assert.deepEqual([s1.stage, s1.closed], ['outcome', true]);
  assert.deepEqual([req.principal, req.stage], [false, null]);
});

test('frases editoriais: derivadas dos números, sempre com base e sem linguagem de ranking', () => {
  const facts = clean(db => {
    const overview = proposalFunctionalOverview(db, { year: 2026 });
    return buildEditorialFacts({
      overview, groupLabels: { requerimentos: 'Requerimentos', [PRINCIPAL]: 'Proposições principais' },
      staleness: { camara: principalStaleness(db, 'camara', { year: 2026 }) },
    });
  });
  const text = (fact: (typeof facts)[number]) => `${fact.before}${fact.emphasis ?? ''}${fact.after}`;
  const thesisCamara = facts.find(fact => fact.id === 'thesis' && fact.scope === 'camara')!;
  assert.equal(text(thesisCamara), 'Em 2026, a maior parte da atividade registrada na Câmara não foi a apresentação de novas leis.');
  assert.equal(thesisCamara.denominator, 7);
  const thesisSenado = facts.find(fact => fact.id === 'thesis' && fact.scope === 'senado')!;
  assert.match(text(thesisSenado), /66,7% da atividade registrada no Senado foi a apresentação de proposições legislativas principais/);
  const thesisCongresso = facts.find(fact => fact.id === 'thesis' && fact.scope === 'congresso')!;
  assert.match(text(thesisCongresso), /a composição da atividade registrada difere entre a Câmara e o Senado/, 'Câmara 42,9% x Senado 66,7% de principais');
  assert.match(text(facts.find(fact => fact.id === 'group_share' && fact.scope === 'camara')!), /^Requerimentos representam 28,6% da atividade registrada na Câmara em 2026\.$/);
  assert.match(text(facts.find(fact => fact.id === 'recent_movement')!), /100% tiveram movimentação nos últimos 30 dias/);
  assert.match(text(facts.find(fact => fact.id === 'history_coverage')!), /2 de 3 matérias principais na Câmara têm histórico/);
  for (const fact of facts) assert.doesNotMatch(text(fact), /produtiv|emperrad|melhor|pior|ranking/i);
});

test('frases editoriais: com uma Casa só, a tese diz isso em vez de comparar', () => {
  const facts = clean(db => buildEditorialFacts({ overview: proposalFunctionalOverview(db, { year: 2025 }), groupLabels: {} }));
  const thesis = facts.find(fact => fact.id === 'thesis' && fact.scope === 'congresso')!;
  assert.equal(`${thesis.before}${thesis.emphasis}${thesis.after}`, 'Em 2025, só a Câmara tem proposições publicadas, então não há comparação entre as Casas.');
  assert.equal(facts.some(fact => fact.scope === 'senado'), false, 'sem fatos do Senado quando ele não publicou o ano');
});

test('composição do resultado da busca usa os mesmos filtros da listagem e ignora o filtro de grupo', () => {
  const [all, camaraOnly, onlyRequests, searched] = clean(db => [
    publishedPropositionComposition(db, {}), publishedPropositionComposition(db, { source: 'camara' }),
    publishedPropositionComposition(db, { source: 'camara', group: 'requerimentos' }), publishedPropositionComposition(db, { search: 'PL 1/2026' }),
  ] as const);
  assert.equal(all.total, 11, '8 da Câmara + 3 do Senado');
  assert.equal(camaraOnly.total, 8);
  assert.deepEqual(onlyRequests, camaraOnly, 'filtrar por grupo não altera a composição: ela mostra o que a busca encontra em cada grupo');
  assert.equal(camaraOnly.groups.find(group => group.group === PRINCIPAL)!.count, 4);
  assert.equal(Math.round(camaraOnly.groups.reduce((sum, group) => sum + group.share, 0) * 1000) / 1000, 1);
  assert.equal(searched.total, 4, 'busca por identificador: a semente numera todas como 1, então as 4 PL de 2026 casam');
});
