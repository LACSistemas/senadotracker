import assert from 'node:assert/strict';
import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { postgresPropositionRepository } from '../packages/db/src/postgres-propositions.ts';
import { withRelationGraph } from '../packages/db/src/postgres-proposition-graph.ts';

/** PEC 221/2019 mora em proposal_support; os filhos moram em proposals. Valida a ponte entre os dois universos (somente leitura). */
const store = new PostgresCollectorStore(); const repo = postgresPropositionRepository(store.pool);
try {
  const batch = (await store.query<any>(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0].batch_id;
  const inSupport = (await store.query<any>(`SELECT count(*)::int n FROM civica_poc.proposal_support WHERE source='camara' AND external_id='2233802'`)).rows[0].n;
  const inCatalog = (await store.query<any>(`SELECT count(*)::int n FROM civica_poc.proposals WHERE source='camara' AND external_id='2233802'`)).rows[0].n;
  const kids = (await store.query<any>(`SELECT functional_group g,type,count(*)::int n FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1 AND principal_id='2233802' GROUP BY 1,2 ORDER BY 1,2`, [batch])).rows;
  const sqlAmendIds = (await store.query<any>(`SELECT external_id FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1 AND principal_id='2233802' AND functional_group='emendas_substitutivos' ORDER BY 1`, [batch])).rows.map((r: any) => r.external_id);
  const base = await repo.detail('camara', '2233802');
  const d: any = await withRelationGraph(store.pool, 'camara', '2233802', base, { page: 1 });
  assert.equal(base, null, 'o detalhe do catálogo não deve achar a PEC (ela não está em proposals)');
  const appIds = d.amendments.map((a: any) => a.id).sort();
  assert.deepEqual(appIds, sqlAmendIds);
  const child: any = await withRelationGraph(store.pool, 'camara', '2628653', await repo.detail('camara', '2628653'), {});
  console.log(JSON.stringify({ inSupport, inCatalog, totalChildrenInProposals: kids.reduce((s: number, r: any) => s + r.n, 0), childrenByGroup: kids.reduce((m: any, r: any) => (m[r.g] = (m[r.g] ?? 0) + r.n, m), {}), amendmentTypes: d.amendmentGraph.bySigla, appAmendmentIds: appIds, equalsSql: true, pageRole: d.proposal.catalogRole, pageYear: d.proposal.year, themes: d.themes.map((t: any) => t.label),
    childPage: { id: '2628653', label: child.proposal.label, parent: child.relation.parent.label, parentRole: child.relation.parent.role, parentHasPage: child.relation.parent.hasPage, parentThemes: child.relation.parent.themes } }, null, 1));
} finally { await store.pool.end(); }
