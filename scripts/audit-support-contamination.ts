import assert from 'node:assert/strict';
import pg from 'pg';
import * as data from '../apps/web/lib/data-postgres.ts';

/** Auditoria de contaminação: `proposal_support` não pode alterar nenhuma métrica do catálogo ativo. Somente leitura. */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const ACTIVE = `JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id`;
const one = async (sql: string, v: unknown[] = []) => (await pool.query(sql, v)).rows[0];
const res: Record<string, unknown> = {};
const ok = <T,>(r: any): T => { assert.equal(r.status, 'available'); return r.data as T; };
try {
  // baseline independente: SQL só sobre o catálogo ativo
  const sqlTotal = Number((await one(`SELECT count(*) n FROM civica_poc.proposals p ${ACTIVE}`)).n);
  const sqlCamara = Number((await one(`SELECT count(*) n FROM civica_poc.proposals p ${ACTIVE} WHERE p.source='camara'`)).n);
  const sql2026 = Number((await one(`SELECT count(*) n FROM civica_poc.proposals p ${ACTIVE} WHERE p.year=2026`)).n);
  const sqlGroups = Object.fromEntries((await pool.query(`SELECT p.functional_group g,count(*)::int n FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1 ORDER BY 1`)).rows.map((r: any) => [r.g, r.n]));
  const supportRows = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_support`)).n);
  res.supportRows = supportRows;
  res.supportYear2026 = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_support WHERE year=2026 OR extract(year from presented_at)=2026`)).n);
  res.supportIdsAlsoInCatalog = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_support s JOIN civica_poc.proposals p ON p.source=s.source AND p.external_id=s.external_id ${ACTIVE}`)).n);
  res.authorRowsForSupport = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_authors a JOIN civica_poc.proposal_support s ON s.source=a.source AND s.external_id=a.proposal_id`)).n);
  res.catalogThemesForSupport = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_themes t JOIN civica_poc.proposal_support s ON s.source=t.source AND s.external_id=t.proposal_id`)).n);
  res.supportDuplicatedAsCatalogKeys = Number((await one(`SELECT count(*) n FROM (SELECT external_id FROM civica_poc.proposal_support GROUP BY 1 HAVING count(*)>1) x`)).n);

  // KPIs do app (mesmas funções das páginas)
  const bundle = ok<any>(await data.propositionOperationalBundle(2026));
  const overview = bundle.overview;
  res.bundleKeys = Object.keys(bundle);
  const congress = overview.congress ?? {};
  res.appBundle = { year: bundle.year, years: bundle.years?.map((y: any) => y.year), congressTotal: congress.total ?? null, camaraTotal: overview.views?.camara?.total ?? overview.camara?.total ?? null, factsKeys: Object.keys(bundle.facts ?? {}).slice(0, 8) };
  const comp = ok<any>(await data.propositionResultComposition({}));
  res.appCompositionTotal = comp.total; res.sqlTotal = sqlTotal; res.sqlCamara = sqlCamara; res.sql2026 = sql2026;
  assert.equal(comp.total, sqlTotal, 'composição geral difere do catálogo ativo');
  const appGroups = Object.fromEntries(comp.groups.map((g: any) => [g.group, g.count]));
  assert.deepEqual(Object.fromEntries(Object.entries(appGroups).sort()), sqlGroups, 'grupos funcionais diferem');
  res.groupsEqual = true;
  const comp2026 = ok<any>(await data.propositionResultComposition({ year: 2026 }));
  assert.equal(comp2026.total, sql2026); res.appComposition2026 = comp2026.total;
  const compCamara = ok<any>(await data.propositionResultComposition({ source: 'camara' }));
  assert.equal(compCamara.total, sqlCamara); res.appCompositionCamara = compCamara.total;

  // listagem / busca: matéria de suporte nunca aparece
  const list = ok<any>(await data.propositionListing({ page: 1, pageSize: 1 })); res.listingTotal = list.result.total; assert.equal(list.result.total, sqlTotal);
  const by2019 = ok<any>(await data.propositionListing({ page: 1, pageSize: 5, source: 'camara', year: 2019 })); res.listingCamara2019 = by2019.result.total;
  const bySearch = ok<any>(await data.propositionListing({ page: 1, pageSize: 5, source: 'camara', search: 'PEC 221/2019' })); res.searchPEC221Camara = bySearch.result.total;
  const byTheme = ok<any>(await data.propositionListing({ page: 1, pageSize: 1, source: 'camara', theme: 'Direito Constitucional' }));
  const sqlTheme = Number((await one(`SELECT count(DISTINCT p.external_id) n FROM civica_poc.proposals p ${ACTIVE} JOIN civica_poc.proposal_themes t ON t.source=p.source AND t.batch_id=p.batch_id AND t.proposal_id=p.external_id WHERE p.source='camara' AND t.label ILIKE '%Direito Constitucional%'`)).n);
  res.themeListing = { app: byTheme.result.total, sqlCatalogOnly: sqlTheme }; assert.equal(byTheme.result.total, sqlTheme);
  const byType = ok<any>(await data.propositionListing({ page: 1, pageSize: 1, source: 'camara', type: 'PEC' }));
  const sqlPec = Number((await one(`SELECT count(*) n FROM civica_poc.proposals p ${ACTIVE} WHERE p.source='camara' AND p.type='PEC'`)).n);
  res.pecCamara = { app: byType.result.total, sqlCatalogOnly: sqlPec, supportPEC: Number((await one(`SELECT count(*) n FROM civica_poc.proposal_support WHERE type='PEC'`)).n) }; assert.equal(byType.result.total, sqlPec);
  // facetas de ano do explorar
  res.facetYears = list.result.facets?.years ?? null;
  // autoria: top autores de 2026 por proposições apresentadas
  const dna = bundle.dna; res.dnaKeys = dna ? Object.keys(dna) : null;
  const authors2026 = Number((await one(`SELECT count(*) n FROM civica_poc.proposal_authors a JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id ${ACTIVE} WHERE p.year=2026`)).n);
  res.authorLinks2026 = authors2026;
  console.log(JSON.stringify(res));
} finally { await pool.end(); }
