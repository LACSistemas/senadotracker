import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresCollectorStore } from '../../apps/collector/src/postgres-collector.ts';
import { collectCamaraPresentedPostgres, monthWindows, reconcilePresented } from '../../apps/collector/src/postgres-camara-presented.ts';

/** Janelas, paginação, idempotência, identifierYear nulo/anterior, suporte promovido e reconciliação COMPLETE (transação revertida, sem rede). */
test('monthWindows divide o intervalo em meses, respeitando o limite de 3 meses da API', () => {
  assert.deepEqual(monthWindows('2026-01-15', '2026-03-10'), [{ from: '2026-01-15', to: '2026-01-31' }, { from: '2026-02-01', to: '2026-02-28' }, { from: '2026-03-01', to: '2026-03-10' }]);
  assert.deepEqual(monthWindows('2026-02-01', '2026-02-01'), [{ from: '2026-02-01', to: '2026-02-01' }]);
  assert.deepEqual(monthWindows('2026-12-20', '2027-01-05'), [{ from: '2026-12-20', to: '2026-12-31' }, { from: '2027-01-01', to: '2027-01-05' }]);
});

const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const API = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes';
// (datas em 2031: intervalo em que o catálogo real não tem linhas)
// 105 entidades em fevereiro (força 2ª página) e 2 em março; casos especiais: número anterior (2019), sem ano (ano 0) e id que já está como suporte.
const ids = [...Array.from({ length: 105 }, (_, i) => String(999700000 + i)), '999700500', '999700501'];
const entity = (id: string): any => {
  const n = Number(id) - 999700000;
  if (id === '999700001') return { siglaTipo: 'PL', numero: 2645, ano: 2019, ementa: 'PL antigo reapresentado', dataApresentacao: '2031-02-10T09:30' };
  if (id === '999700002') return { siglaTipo: 'PRL', numero: 1, ano: 0, ementa: 'Parecer sem ano', dataApresentacao: '2031-02-11T14:00' };
  if (id === '999700003') return { siglaTipo: 'EMC', numero: 7, ano: 2026, ementa: 'Emenda', dataApresentacao: '2031-03-01T00:00', uriPropPrincipal: `${API}/999700001` };
  return { siglaTipo: 'REQ', numero: n, ano: 2026, ementa: `Requerimento ${n}`, dataApresentacao: id === '999700500' || id === '999700501' || id === '999700600' ? '2031-03-02T10:00' : '2031-02-12T10:00' };
};
const fakeApi = () => {
  const requests: string[] = [];
  const respond = (data: unknown, url: string) => ({ data, rawId: 'raw-test', fetchedAt: new Date().toISOString(), url });
  return {
    requests,
    json: async (url: string) => {
      requests.push(url);
      const list = /proposicoes\?dataApresentacaoInicio=([\d-]+)&dataApresentacaoFim=([\d-]+)&itens=100&pagina=(\d+)/.exec(url);
      if (list) {
        const [, from, to, page] = list;
        const inWindow = ids.filter(id => { const d = entity(id).dataApresentacao.slice(0, 10); return d >= from! && d <= to!; });
        return respond({ dados: inWindow.slice((Number(page) - 1) * 100, Number(page) * 100).map(id => ({ id: Number(id), siglaTipo: entity(id).siglaTipo, numero: entity(id).numero, ano: entity(id).ano })) }, url);
      }
      const id = /proposicoes\/(\d+)/.exec(url)![1]!;
      if (url.endsWith('/autores')) return respond({ dados: [{ uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/178866', nome: 'Luizianne Lins', ordemAssinatura: 1, proponente: 1 }] }, url);
      if (url.endsWith('/temas')) return respond({ dados: [{ codTema: 41, tema: 'Tema de teste' }] }, url);
      return respond({ dados: { id: Number(id), ...entity(id), statusProposicao: { descricaoSituacao: 'Aguardando' } } }, url);
    },
  };
};

test('coletor por apresentação: insere o que falta, é idempotente e reconcilia COMPLETE', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)' }, async () => {
  const real = new PostgresCollectorStore(); const client = await real.pool.connect();
  try {
    await client.query('BEGIN');
    const batch = (await client.query(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0].batch_id;
    const count = async (extra = '') => Number((await client.query(`SELECT count(*)::int n FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1 ${extra}`, [batch])).rows[0].n);
    const before = await count();
    // um dos ids já existe como matéria de suporte (deve ser promovido ao catálogo: uma entidade só)
    await client.query(`INSERT INTO civica_poc.proposal_support(source,external_id,type,number,year,functional_group,label,presented_at) VALUES('camara','999700001','PL',2645,2019,'proposicoes_legislativas_principais','PL 2645/2019',now())`);
    const store = { pool: client, assertTarget: async () => ({}), query: (sql: string, values?: unknown[]) => client.query(sql, values), transaction: async (work: any) => work(client), startRun: async () => 'test-run', saveRaw: async () => 'raw-test' } as unknown as PostgresCollectorStore;
    const api = fakeApi();
    const run = (extra = {}) => collectCamaraPresentedPostgres({ store, from: '2031-02-01', to: '2031-03-31', concurrency: 1, resolvePrincipals: false, clientFactory: () => api, ...extra });

    const first = await run({ runId: 'presented:test:1' });
    assert.equal(first.officialCount, 107); assert.equal(first.inserted, 107); assert.equal(first.failed, 0);
    assert.equal(first.pages, 3, 'fevereiro tem 2 páginas (105 entidades) e março 1');
    assert.equal(first.supportPromoted, 1);
    assert.equal(first.reconciliation.coverage, 'COMPLETE'); assert.equal(first.reconciliation.onlyOfficial, 0); assert.equal(first.reconciliation.dateDivergent, 0); assert.equal(first.reconciliation.duplicateExternalIds, 0);
    const rows = (await client.query(`SELECT external_id,type,year,presented_year,label,principal_id FROM civica_poc.proposals WHERE batch_id=$1 AND external_id IN ('999700001','999700002','999700003') ORDER BY external_id`, [batch])).rows;
    assert.deepEqual(rows.map(r => [r.type, r.year, r.presented_year, r.label]), [['PL', 2019, 2031, 'PL 2645/2019'], ['PRL', null, 2031, 'PRL 1'], ['EMC', 2026, 2031, 'EMC 7/2026']]);
    assert.equal(rows[2].principal_id, '999700001');
    assert.equal(Number((await client.query(`SELECT count(*)::int n FROM civica_poc.proposal_support WHERE external_id='999700001'`)).rows[0].n), 0, 'suporte promovido: não há duas representações');
    assert.equal(Number((await client.query(`SELECT count(*)::int n FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id='999700002'`, [batch])).rows[0].n), 1);
    assert.equal(await count(), before + 107);

    // 2ª execução: nada novo, nenhuma duplicação, mesma reconciliação
    const requestsBefore = api.requests.length;
    const second = await run({ runId: 'presented:test:2' });
    assert.equal(second.newEntities, 0); assert.equal(second.inserted, 0); assert.equal(second.reconciliation.coverage, 'COMPLETE');
    assert.equal(api.requests.slice(requestsBefore).filter(u => !u.includes('dataApresentacaoInicio')).length, 0, 'sem detalhe/autores/temas de entidades já existentes');
    assert.equal(await count(), before + 107);

    // entidade registrada com atraso é reencontrada pela sobreposição, sem duplicar
    ids.push('999700600');
    const third = await run({ runId: 'presented:test:3', from: '2031-03-01' });
    assert.equal(third.newEntities, 1); assert.equal(third.inserted, 1);
    assert.equal(await count(`AND external_id='999700600'`), 1);
    const fourth = await run({ runId: 'presented:test:4', from: '2031-03-01' });
    assert.equal(fourth.inserted, 0); assert.equal(await count(`AND external_id='999700600'`), 1);

    // o reconciliador detecta lacuna: apaga uma linha e confere "somente oficial"
    await run({ runId: 'presented:test:5', ingest: false });
    await client.query(`DELETE FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id='999700010'`, [batch]);
    await client.query(`DELETE FROM civica_poc.proposal_themes WHERE batch_id=$1 AND proposal_id='999700010'`, [batch]);
    await client.query(`DELETE FROM civica_poc.proposals WHERE batch_id=$1 AND external_id='999700010'`, [batch]);
    const gap = await reconcilePresented(store, 'presented:test:5', '2031-02-01', '2031-03-31');
    assert.equal(gap.coverage, 'PARTIAL'); assert.deepEqual(gap.onlyOfficialSample, ['999700010']);
  } finally { try { await client.query('ROLLBACK'); } finally { client.release(); await real.pool.end(); } }
});
