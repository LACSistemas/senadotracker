import assert from 'node:assert/strict';
import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { postgresPropositionRepository } from '../packages/db/src/postgres-propositions.ts';
import { withRelationGraph } from '../packages/db/src/postgres-proposition-graph.ts';

/** Casos obrigatórios do grafo pai → filhos (somente leitura, usa o PostgreSQL local). */
const store = new PostgresCollectorStore(); const repo = postgresPropositionRepository(store.pool);
const detail = async (id: string, q = {}) => withRelationGraph(store.pool, 'camara', id, await repo.detail('camara', id), q);
const row = (d: any) => ({ label: d.proposal.label, role: d.proposal.catalogRole, group: d.proposal.functionalGroup, parent: d.relation.parent?.label ?? null, root: d.relation.root?.label ?? null, depth: d.relation.depth, reachesRoot: d.relation.reachesRoot, themes: d.themes.length, total: d.amendmentGraph?.total ?? 0, bySigla: Object.fromEntries((d.amendmentGraph?.bySigla ?? []).map((s: any) => [s.type, s.count])), shown: d.amendments.length, nested: d.amendmentGraph?.nestedTotal ?? 0 });
try {
  const out: Record<string, unknown> = {};
  const pec = await detail('2233802'); assert.ok(pec, 'PEC 221/2019 deve existir como matéria de suporte');
  assert.equal(pec.proposal.label, 'PEC 221/2019'); assert.equal(pec.proposal.year, 2019); assert.equal(pec.proposal.catalogRole, 'relationship_support');
  assert.equal(pec.amendmentGraph.total, 5); assert.deepEqual(Object.fromEntries(pec.amendmentGraph.bySigla.map((s: any) => [s.type, s.count])), { EMC: 2, SBT: 1, 'SBT-A': 1, EMA: 1 });
  out.pec221 = row(pec);
  const mpv1343 = await detail('2610975'); assert.equal(mpv1343.amendmentGraph.total, 427); assert.equal(mpv1343.amendments.length, 25); assert.equal(mpv1343.amendmentGraph.pageCount, 18); out.mpv1343 = row(mpv1343);
  const mpv1343p2 = await detail('2610975', { type: 'EMC', page: 18 }); assert.equal(mpv1343p2.amendments.length, 427 - 17 * 25); out.mpv1343_page18 = { shown: mpv1343p2.amendments.length };
  const mpv1357 = await detail('2624161'); assert.equal(mpv1357.amendmentGraph.total, 112); assert.equal(mpv1357.amendmentGraph.bySigla[0].type, 'EMC'); out.mpv1357 = row(mpv1357);
  const plp14 = await detail('2601040'); assert.equal(plp14.amendmentGraph.total, 1); assert.equal(plp14.amendments[0].type, 'SBT'); out.plp14 = row(plp14);
  const pl278 = await detail('2600838'); assert.equal(pl278.amendmentGraph.total, 78); assert.equal(pl278.amendmentGraph.bySigla.find((s: any) => s.type === 'EMP').count, 77); out.pl278 = row(pl278);
  const pl303 = await detail('2601001'); const sbt = pl303.amendments.find((a: any) => a.id === '2641654'); assert.ok(sbt, 'SBT 1 (2641654) deve ser filho direto do PL 303/2026');
  assert.ok(sbt.children.some((c: any) => c.id === '2642452'), 'ESB 1/2026 (2642452) deve aparecer sob o SBT'); assert.equal(sbt.children[0].relationDepth, 2); assert.equal(sbt.children[0].immediateParentId, '2641654'); assert.equal(sbt.children[0].rootProposalId, '2601001'); out.pl303 = row(pl303);
  const esb = await detail('2642452'); assert.equal(esb.relation.parent.id, '2641654'); assert.equal(esb.relation.root.id, '2601001'); assert.equal(esb.relation.depth, 2); out.esb1 = row(esb);
  const pl209 = await detail('2600608'); const sbta = pl209.amendments.find((a: any) => a.id === '2632282'); assert.ok(sbta, 'SBT-A 1 (2632282) deve ser filho direto do PL 209/2026'); assert.ok(sbta.children.some((c: any) => c.id === '2642043'), 'SBR 1 (2642043) deve estar sob o SBT-A'); out.pl209 = row(pl209);
  const sbr = await detail('2642043'); assert.equal(sbr.relation.parent.id, '2632282'); assert.equal(sbr.relation.root.id, '2600608'); out.sbr1 = row(sbr);
  const emc = await detail('2625996'); assert.equal(emc.relation.parent.label, 'MPV 1334/2026'); assert.equal(emc.relation.root.id, '2599928'); assert.equal(emc.amendments.length, 0); out.emc1 = row(emc);
  const missing = await detail('999999999'); assert.equal(missing, null);
  console.log(JSON.stringify(out, null, 1));
} finally { await store.pool.end(); }
