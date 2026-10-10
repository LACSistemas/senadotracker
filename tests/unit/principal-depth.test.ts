import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresCollectorStore } from '../../apps/collector/src/postgres-collector.ts';
import { resolveCamaraPrincipalsPostgres, DEFAULT_MAX_DEPTH } from '../../apps/collector/src/postgres-principal-resolver.ts';
import { loadRelationGraph, ensurePropositionGraphSchema } from '../../packages/db/src/postgres-proposition-graph.ts';

/**
 * Cadeia oficial de 7 níveis (SBT → SBR → SBT-A → EMC-A → SBE-A → ESB → PL) resolvida até a raiz, e ciclo barrado.
 * Roda no PostgreSQL local dentro de uma transação revertida (nada é gravado) com um cliente HTTP falso (sem rede).
 */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const API = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/';
const CHILD = '999000001';
const TYPES = ['SBT', 'SBR', 'SBT-A', 'EMC-A', 'SBE-A', 'ESB', 'PL'];
const chainId = (level: number) => `99910000${level}`; // níveis 1..7
const CYCLE_A = '999200001', CYCLE_B = '999200002', CYCLE_CHILD = '999000002';

const fakeClient = () => {
  const requests: string[] = [];
  const principalOf = (id: string) => {
    const level = Number(id.slice(-1));
    if (id.startsWith('99910000')) return level < 7 ? chainId(level + 1) : null;
    if (id === CYCLE_A) return CYCLE_B;
    if (id === CYCLE_B) return CYCLE_A;
    return null;
  };
  return {
    requests,
    json: async (url: string) => {
      requests.push(url);
      const id = /proposicoes\/(\d+)/.exec(url)![1]!;
      if (url.endsWith('/temas')) return { data: { dados: [{ codTema: 1, tema: 'Tema de teste', relevancia: 1 }] }, rawId: 'raw-test', fetchedAt: new Date().toISOString(), url };
      const level = Number(id.slice(-1)), type = id.startsWith('99910000') ? TYPES[level - 1]! : 'SBT', next = principalOf(id);
      return { data: { dados: { id: Number(id), siglaTipo: type, numero: level, ano: 2001, ementa: `Matéria de teste ${id}`, dataApresentacao: '2001-02-03T10:00', uriPropPrincipal: next ? `${API}${next}` : null, statusProposicao: { descricaoSituacao: 'Teste' } } }, rawId: 'raw-test', fetchedAt: new Date().toISOString(), url };
    },
  };
};

test('cadeia oficial de 7 níveis é resolvida até a raiz; limite não é ilimitado; ciclo não trava', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)' }, async () => {
  const real = new PostgresCollectorStore(); const client = await real.pool.connect();
  try {
    await ensurePropositionGraphSchema(real.pool);
    await client.query('BEGIN');
    const batch = (await client.query(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0].batch_id;
    for (const [id, principal, label] of [[CHILD, chainId(1), 'EMC 1/2026 (teste)'], [CYCLE_CHILD, CYCLE_A, 'EMC 2/2026 (teste)']] as const)
      await client.query(`INSERT INTO civica_poc.proposals(batch_id,source,external_id,type,number,year,functional_group,label,summary,presented_at,status,principal_id,payload,raw_id) VALUES($1,'camara',$2,'EMC',1,2026,'emendas_substitutivos',$3,'teste',now(),NULL,$4,'{}','raw-test')`, [batch, id, label, principal]);
    // Todas as consultas passam pelo mesmo cliente/transação: o DDL idempotente do resolvedor não disputa lock com o INSERT acima.
    const store = { pool: client, assertTarget: async () => ({}), query: (sql: string, values?: unknown[]) => client.query(sql, values), transaction: async (work: any) => work(client), startRun: async () => 'test-run', saveRaw: async () => 'raw-test' } as unknown as PostgresCollectorStore;
    const http = fakeClient();

    // 1) com limite 5: resolve só 5 níveis e deixa o 6º pendente (o limite existe e é respeitado)
    const limited = await resolveCamaraPrincipalsPostgres({ store, scope: 'amendments', maxDepth: 5, concurrency: 1, clientFactory: () => http });
    const states = (await client.query(`SELECT parent_id,state,depth FROM civica_poc.principal_resolution_queue WHERE parent_id LIKE '99910000%' ORDER BY depth`)).rows;
    assert.equal(states.filter(r => r.state === 'resolved').length, 5);
    assert.equal(states.find(r => r.depth === 6)?.state, 'pending');
    assert.ok(limited.remaining >= 1);

    // 2) com o limite padrão (10): resolve os 7 níveis até a raiz oficial
    assert.equal(DEFAULT_MAX_DEPTH, 10);
    await resolveCamaraPrincipalsPostgres({ store, scope: 'amendments', concurrency: 1, clientFactory: () => http });
    const chain = (await client.query(`SELECT external_id,type,functional_group,principal_id,depth,year FROM civica_poc.proposal_support WHERE external_id LIKE '99910000%' ORDER BY depth`)).rows;
    assert.equal(chain.length, 7);
    assert.deepEqual(chain.map(r => r.depth), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(chain[6].principal_id, null, 'o último nível é a raiz oficial (sem uriPropPrincipal)');
    assert.equal(chain[6].functional_group, 'proposicoes_legislativas_principais');
    assert.equal(chain[0].year, 2001, 'ano real preservado');
    assert.equal((await client.query(`SELECT count(*)::int n FROM civica_poc.principal_resolution_queue WHERE parent_id LIKE '99910000%' AND state<>'resolved'`)).rows[0].n, 0);
    assert.equal(http.requests.filter(u => u.includes('/99910000') && u.endsWith('/temas')).length, 7, 'cada pai é buscado uma única vez (sem repetição entre execuções)');

    // 3) o grafo de ancestrais atravessa os 7 níveis e chega à raiz (o limite de caminhada anterior era 6)
    const graph = await loadRelationGraph(client, 'camara', chainId(1), CHILD);
    assert.equal(graph.depth, 7, 'depth'); assert.equal(graph.reachesRoot, true, `reachesRoot ${JSON.stringify(graph.ancestors.map(a => [a.id, a.role, a.functionalGroup]))}`); assert.equal(graph.cycle, false, 'cycle'); assert.equal(graph.truncated, false, 'truncated');
    assert.equal(graph.root?.id, chainId(7)); assert.equal(graph.parent?.id, chainId(1));

    // 4) ciclo A → B → A: cada pai é resolvido uma vez, não há laço, e a caminhada de ancestrais detecta o ciclo
    await resolveCamaraPrincipalsPostgres({ store, scope: 'amendments', concurrency: 1, clientFactory: () => http });
    assert.equal(http.requests.filter(u => u.endsWith(`/${CYCLE_A}`) || u.endsWith(`/${CYCLE_B}`)).length, 2);
    const cyc = await loadRelationGraph(client, 'camara', CYCLE_A, CYCLE_CHILD);
    assert.equal(cyc.cycle, true, `cycle ${JSON.stringify(cyc.ancestors.map(a => [a.id, a.role, a.principalId]))}`); assert.equal(cyc.reachesRoot, false); assert.equal(cyc.ancestors.length, 2);
  } finally { try { await client.query('ROLLBACK'); } finally { client.release(); await real.pool.end(); } }
});
