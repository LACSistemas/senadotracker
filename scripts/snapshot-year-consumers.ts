import crypto from 'node:crypto';
import * as data from '../apps/web/lib/data-postgres.ts';

/** Retrato estável dos consumidores de `year` (KPIs, listagem, filtros, busca, detalhe). Usado antes/depois da migração 0 → NULL. */
const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const ok = (r: any) => { if (r.status !== 'available') throw new Error(r.message); return r.data; };
const ids = (list: any) => list.result.items.map((i: any) => `${i.proposal.source}:${i.proposal.externalId}`);
const out: Record<string, unknown> = {};
const bundle = ok(await data.propositionOperationalBundle(2026));
out.bundle = { hash: hash(bundle), years: bundle.years, overviewCongress: bundle.overview.congress.total, flowUniverse: [bundle.flow.camara.universe, bundle.flow.senado.universe], rhythmTotals: [bundle.rhythm.presented.houses.camara.total, bundle.rhythm.events.houses.camara.total], dnaRows: bundle.dna.party.rows.length };
const cases: [string, any][] = [['all', { page: 1, pageSize: 20 }], ['year2026', { page: 1, pageSize: 20, year: 2026 }], ['year2019', { page: 1, pageSize: 20, year: 2019 }], ['typePRL', { page: 1, pageSize: 20, type: 'PRL' }], ['groupPareceres', { page: 1, pageSize: 20, group: 'pareceres_relatorios' }], ['searchPRL2', { page: 1, pageSize: 20, search: 'PRL 2' }], ['searchSBT1', { page: 1, pageSize: 20, search: 'SBT 1' }], ['searchPL32', { page: 1, pageSize: 20, search: 'PL 32/2026' }], ['camara2026p3', { page: 3, pageSize: 20, source: 'camara', year: 2026 }]];
out.listing = {};
for (const [name, query] of cases) { const r = ok(await data.propositionListing(query)); (out.listing as any)[name] = { total: r.result.total, ids: hash(ids(r)), first: ids(r).slice(0, 3), facetYears: name === 'all' ? r.result.facets.years.slice(0, 5) : undefined, facetTypes: name === 'all' ? r.result.facets.types.length : undefined }; }
out.composition = { all: ok(await data.propositionResultComposition({})).total, y2026: ok(await data.propositionResultComposition({ year: 2026 })).total, camara: ok(await data.propositionResultComposition({ source: 'camara' })).total, groups: ok(await data.propositionResultComposition({ source: 'camara' })).groups };
const d0 = ok(await data.propositionDetail('camara', '2617409')), d1 = ok(await data.propositionDetail('camara', '2600075'));
out.detail = { year0: { label: d0.proposal.label, year: d0.proposal.year, identifierYear: d0.proposal.identifierYear, presentedYear: d0.proposal.presentedYear, presentedAt: d0.proposal.presentedAt }, normal: { label: d1.proposal.label, year: d1.proposal.year, identifierYear: d1.proposal.identifierYear, presentedYear: d1.proposal.presentedYear } };
out.observed = hash(ok(await data.propositionObservedState('camara', '2600075')));
console.log(JSON.stringify(out, null, 1));
process.exit(0);
