import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';

/** Métricas do grafo pai → filhos das emendas/substitutivos da Câmara (somente leitura). */
const store = new PostgresCollectorStore();
const ROOT = 'proposicoes_legislativas_principais', AMEND = 'emendas_substitutivos';
try {
  await store.assertTarget();
  const batch = (await store.query<{ batch_id: string }>(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0]!.batch_id;
  const catalog = (await store.query<any>(`SELECT external_id id,type,functional_group g,principal_id pid FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1`, [batch])).rows;
  const hasSupport = (await store.query<any>(`SELECT to_regclass('civica_poc.proposal_support') t`)).rows[0].t;
  const support = hasSupport ? (await store.query<any>(`SELECT external_id id,type,functional_group g,principal_id pid FROM civica_poc.proposal_support WHERE source='camara'`)).rows : [];
  const ctxTyped = new Set((await store.query<any>(`SELECT DISTINCT parent_external_id id FROM civica_poc.proposal_parent_context WHERE parent_source='camara' AND parent_type IS NOT NULL`)).rows.map((r: any) => r.id));
  const cat = new Map(catalog.map((r: any) => [r.id, r])), sup = new Map(support.map((r: any) => [r.id, r]));
  const kids = catalog.filter((r: any) => r.g === AMEND);
  const m = { totalAmendments: kids.length, withImmediateParent: 0, parentInCatalog: 0, parentInSupport: 0, parentUnresolved: 0, reachesRoot: 0, reachesRootViaCatalogOnly: 0, depth: { 1: 0, 2: 0, '3+': 0 } as Record<string, number>, rootDepth: { 1: 0, 2: 0, '3+': 0 } as Record<string, number>, cycles: 0, distinctUnresolvedParents: 0, chainEnds: {} as Record<string, number> };
  const unresolved = new Set<string>(), childCount = new Map<string, number>(), parentTypes = new Map<string, Record<string, number>>();
  for (const k of kids) {
    if (!k.pid) continue; m.withImmediateParent++;
    childCount.set(k.pid, (childCount.get(k.pid) ?? 0) + 1);
    const inCat = cat.has(k.pid), inSup = sup.has(k.pid);
    if (inCat) m.parentInCatalog++; else if (inSup) m.parentInSupport++; else { m.parentUnresolved++; unresolved.add(k.pid); }
    let cur: string | null = k.pid, hops = 1, end = '', seen = new Set<string>([k.id]), cyc = false;
    while (cur) {
      if (seen.has(cur)) { cyc = true; end = 'ciclo'; break; } seen.add(cur);
      const node: any = cat.get(cur) ?? sup.get(cur);
      if (!node) { end = 'ausente'; break; }
      if (node.g === ROOT) { end = 'raiz'; break; }
      if (!node.pid) { end = 'sem_principal:' + node.type; break; }
      cur = node.pid; hops++; if (hops > 12) { end = 'profundo'; break; }
    }
    if (cyc) m.cycles++;
    const bucket = hops >= 3 ? '3+' : String(hops); m.depth[bucket]++;
    m.chainEnds[end] = (m.chainEnds[end] ?? 0) + 1;
    if (end === 'raiz') { m.reachesRoot++; m.rootDepth[bucket]++; }
  }
  m.distinctUnresolvedParents = unresolved.size;
  const withPage = [...childCount].filter(([id]) => cat.has(id) || sup.has(id));
  const bucketOf = (n: number) => n === 1 ? '1' : n <= 10 ? '2-10' : n <= 50 ? '11-50' : n <= 100 ? '51-100' : '100+';
  const buckets: Record<string, number> = { '1': 0, '2-10': 0, '11-50': 0, '51-100': 0, '100+': 0 };
  for (const [, n] of withPage) buckets[bucketOf(n)]++;
  const top = [...withPage].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, n, type: (cat.get(id) ?? sup.get(id)).type }));
  const queue = hasSupport ? (await store.query<any>(`SELECT state,count(*)::int n FROM civica_poc.principal_resolution_queue WHERE source='camara' GROUP BY state`).catch(() => ({ rows: [] }))).rows : [];
  console.log(JSON.stringify({ ...m, parentsWithAmendmentSection: withPage.length, sectionBuckets: buckets, maxAmendmentsOfOneMatter: withPage.length ? Math.max(...withPage.map(([, n]) => n)) : 0, top, supportPages: support.length, supportTypedInContext: ctxTyped.size, queue }, null, 1));
} finally { await store.pool.end(); }
