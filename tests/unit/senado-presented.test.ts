import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresCollectorStore } from '../../apps/collector/src/postgres-collector.ts';
import { collectSenadoPresentedPostgres, parseSenadoIdentification, senadoAuthors } from '../../apps/collector/src/postgres-senado-presented.ts';

test('identificação do Senado: sigla, número e ano, inclusive com sufixo de comissão', () => {
  assert.deepEqual(parseSenadoIdentification('PL 199/2026'), { type: 'PL', number: 199, year: 2026 });
  assert.deepEqual(parseSenadoIdentification('REQ 1/2026 - CDIR'), { type: 'REQ', number: 1, year: 2026 });
  assert.deepEqual(parseSenadoIdentification('R.S 5/2019'), { type: 'R.S', number: 5, year: 2019 });
  assert.equal(parseSenadoIdentification('sem formato'), null); assert.equal(parseSenadoIdentification(null), null);
});

test('autores do Senado: código do parlamentar, partido, UF só de senadores e órgãos sem código', () => {
  const authors = senadoAuthors({ autoriaIniciativa: [
    { autor: 'Eduardo Girão', siglaTipo: 'SENADOR', codigoParlamentar: 5976, siglaPartido: 'NOVO', ordem: 1 },
    { autor: 'Ricardo Izar', siglaTipo: 'DEPUTADO', codigoParlamentar: 5375, siglaPartido: 'PP', ordem: 2 },
    { autor: 'Câmara dos Deputados', siglaTipo: 'CAMARA', ordem: 3 },
  ] }, 'Senador Eduardo Girão (NOVO/CE)');
  assert.deepEqual(authors.map(a => [a.personId, a.name, a.party, a.uf]), [['5976', 'Eduardo Girão', 'NOVO', 'CE'], ['5375', 'Ricardo Izar', 'PP', null], [null, 'Câmara dos Deputados', null, null]]);
  assert.equal(new Set(authors.map(a => a.key)).size, 3);
});

const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
// datas em 2031: intervalo em que o catálogo real não tem linhas
const list: any[] = [
  { id: 9000001, codigoMateria: 999600001, identificacao: 'PL 199/2026', dataApresentacao: '2031-02-03', autoria: 'Câmara dos Deputados', ementa: 'PL de origem na Câmara, numerado em 2026' },
  { id: 9000002, codigoMateria: 999600002, identificacao: 'PDL 5/2025', dataApresentacao: '2031-02-20', autoria: 'Senador Eduardo Girão (NOVO/CE)', ementa: 'PDL de ano anterior' },
  { id: 9000003, codigoMateria: 999600003, identificacao: 'REQ 7/2031 - CDIR', dataApresentacao: '2031-03-02', autoria: 'Comissão de Direção', ementa: 'Requerimento de comissão' },
];
const fakeApi = () => {
  const requests: string[] = [];
  const respond = (data: unknown, url: string) => ({ data, rawId: 'raw-test', fetchedAt: new Date().toISOString(), url });
  return { requests, json: async (url: string) => {
    requests.push(url);
    const window = /processo\?dataInicioApresentacao=([\d-]+)&dataFimApresentacao=([\d-]+)/.exec(url);
    if (window) return respond(list.filter(x => x.dataApresentacao >= window[1]! && x.dataApresentacao <= window[2]!), url);
    const item = list.find(x => url.endsWith(`/processo/${x.id}`))!;
    const sen = item.codigoMateria === 999600002;
    return respond({ id: item.id, codigoMateria: item.codigoMateria, identificacao: item.identificacao, conteudo: { ementa: item.ementa },
      autoriaIniciativa: sen ? [{ autor: 'Eduardo Girão', siglaTipo: 'SENADOR', codigoParlamentar: 5976, siglaPartido: 'NOVO', ordem: 1 }] : [{ autor: item.autoria, siglaTipo: 'CAMARA', ordem: 1 }],
      classificacoes: [{ codigo: 33805332, descricaoHierarquia: 'Política Social / Trabalho e Emprego' }] }, url);
  } };
};

test('coletor universal do Senado: matérias de qualquer origem, número anterior, idempotência e COMPLETE', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)' }, async () => {
  const real = new PostgresCollectorStore(); const client = await real.pool.connect();
  try {
    await client.query('BEGIN');
    const batch = (await client.query(`SELECT batch_id FROM civica_poc.active_publications WHERE source='senado'`)).rows[0].batch_id;
    const store = { pool: client, assertTarget: async () => ({}), query: (sql: string, values?: unknown[]) => client.query(sql, values), transaction: async (work: any) => work(client), startRun: async () => 'test-run', saveRaw: async () => 'raw-test' } as unknown as PostgresCollectorStore;
    const api = fakeApi();
    const run = (extra = {}) => collectSenadoPresentedPostgres({ store, from: '2031-02-01', to: '2031-03-31', concurrency: 1, clientFactory: () => api, ...extra });
    const first = await run({ runId: 'presented:senado-test:1' });
    assert.equal(first.officialCount, 3); assert.equal(first.inserted, 3); assert.equal(first.failed, 0); assert.equal(first.requests, 2 + 3, '2 janelas + 1 detalhe por matéria nova');
    assert.equal(first.reconciliation.coverage, 'COMPLETE');
    const rows = (await client.query(`SELECT external_id,type,number,year,presented_year,label,status FROM civica_poc.proposals WHERE batch_id=$1 AND external_id LIKE '99960000%' ORDER BY external_id`, [batch])).rows;
    assert.deepEqual(rows.map(r => [r.type, Number(r.number), r.year, r.presented_year, r.label]), [['PL', 199, 2026, 2031, 'PL 199/2026'], ['PDL', 5, 2025, 2031, 'PDL 5/2025'], ['REQ', 7, 2031, 2031, 'REQ 7/2031 - CDIR']]);
    const authors = (await client.query(`SELECT proposal_id,person_external_id,name,party,uf FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id='999600002'`, [batch])).rows;
    assert.deepEqual(authors.map(a => [a.person_external_id, a.name, a.party, a.uf]), [['5976', 'Eduardo Girão', 'NOVO', 'CE']]);
    assert.equal(Number((await client.query(`SELECT count(*)::int n FROM civica_poc.proposal_themes WHERE batch_id=$1 AND proposal_id='999600001'`, [batch])).rows[0].n), 1);

    const before = api.requests.length;
    const second = await run({ runId: 'presented:senado-test:2' });
    assert.equal(second.newEntities, 0); assert.equal(second.inserted, 0); assert.equal(second.reconciliation.coverage, 'COMPLETE');
    assert.equal(api.requests.slice(before).filter(u => !u.includes('dataInicioApresentacao')).length, 0, 'sem detalhe de matérias já existentes');
    assert.equal(Number((await client.query(`SELECT count(*)::int n FROM civica_poc.proposals WHERE batch_id=$1 AND external_id LIKE '99960000%'`, [batch])).rows[0].n), 3);
  } finally { try { await client.query('ROLLBACK'); } finally { client.release(); await real.pool.end(); } }
});
