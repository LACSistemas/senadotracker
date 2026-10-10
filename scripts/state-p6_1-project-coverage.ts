import fs from 'node:fs';
import path from 'node:path';

type Json = Record<string, any>;

const PUBLIC_DIMENSIONS = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'] as const;
const ROLLOUT_HOUSES = new Set(['AC', 'AL', 'AM', 'MT', 'PI', 'RR', 'TO']);
const UNCHANGED_HOUSES = new Set(['RO', 'PR', 'AP', 'ES']);
const root = process.cwd();
const readJson = (file: string): Json => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as Json;
const writeJson = (file: string, value: unknown) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);

const base = readJson('artifacts/state_coverage_operational_p5.json');
const rollout = readJson('artifacts/p6_sapl_rollout_results.json');
const baseRows: Json[] = base.dimensions;
const byHouse = new Map<string, Json[]>();
for (const row of baseRows) byHouse.set(row.house, [...(byHouse.get(row.house) ?? []), row]);

const runAt = rollout.generatedAt;
const cell = (house: string, dimension: string) => byHouse.get(house)?.find(row => row.dimension === dimension);
const component = (status: string, recordsFound: number) => ({ status, recordsFound, recordsExpected: null, recordsResolved: recordsFound });
const statusForObserved = (records: number, complete = true) => records > 0 && complete ? 'CONSUMABLE' : 'PARTIAL';

for (const row of rollout.rows as Json[]) {
  if (!ROLLOUT_HOUSES.has(row.house)) throw new Error(`unexpected rollout house ${row.house}`);
  const counts = row.controlledCorpus;
  const revisions = row.revisions;
  const common = { lastSuccessfulRun: runAt, historicalVerified: false };
  const name = { ...cell(row.house, 'name'), ...common, status: statusForObserved(counts.persons), recordsFound: counts.persons, recordsResolved: counts.persons, primaryRecordsFound: counts.persons, primaryRecordsResolved: counts.persons, activeRevisionId: revisions.identity, note: 'P6 SAPL controlled corpus; public name projection from persisted identity revision' };
  const party = { ...cell(row.house, 'party'), ...common, status: statusForObserved(counts.memberships), recordsFound: counts.memberships, recordsResolved: counts.memberships, primaryRecordsFound: counts.memberships, primaryRecordsResolved: counts.memberships, activeRevisionId: revisions.identity, note: counts.memberships > 0 ? 'P6 SAPL controlled corpus; current party membership projection' : 'P6 SAPL capability executed; zero party memberships observed in controlled corpus' };
  const mandates = { ...cell(row.house, 'mandate_history'), ...common, status: statusForObserved(counts.mandates), recordsFound: counts.mandates, recordsResolved: counts.mandates, primaryRecordsFound: counts.mandates, primaryRecordsResolved: counts.mandates, activeRevisionId: revisions.identity, note: 'P6 SAPL controlled corpus; mandate interval projection' };
  const proposals = { ...cell(row.house, 'proposals'), ...common, status: counts.proposals > 0 && counts.authors > 0 && counts.movements > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: counts.proposals, recordsResolved: counts.proposals, primaryRecordsFound: counts.proposals, primaryRecordsResolved: counts.proposals, activeRevisionId: revisions.legislative, components: { proposals: component(statusForObserved(counts.proposals), counts.proposals), authorship: component(statusForObserved(counts.authors), counts.authors), movements: component(statusForObserved(counts.movements), counts.movements) }, note: 'P6 SAPL controlled corpus; primaryRecordsFound is proposal records only; authorship and movements are separate components' };
  byHouse.set(row.house, [name, party, mandates, proposals, cell(row.house, 'cabinet'), cell(row.house, 'parliamentary_allowance')]);
}

const dimensions = [...byHouse.values()].flat().filter(Boolean).sort((a, b) => a.house.localeCompare(b.house) || a.dimension.localeCompare(b.dimension));
const houses = [...new Set(dimensions.map(row => row.house))].sort();
if (dimensions.length !== 162 || houses.length !== 27 || dimensions.some(row => !PUBLIC_DIMENSIONS.includes(row.dimension))) throw new Error(`invalid projected matrix: rows=${dimensions.length}, houses=${houses.length}`);
for (const house of houses) {
  const rows = dimensions.filter(row => row.house === house);
  if (rows.length !== 6 || new Set(rows.map(row => row.dimension)).size !== 6) throw new Error(`invalid dimension set for ${house}`);
}

const report = { generatedAt: new Date().toISOString(), database: base.database, stage: 'P6_1_PUBLIC_COVERAGE_PROJECTION', sourceArtifacts: ['artifacts/state_coverage_operational_p5.json', 'artifacts/p6_sapl_rollout_results.json'], expectedCells: 162, houses: 27, publicDimensions: [...PUBLIC_DIMENSIONS], projection: { internalCapabilities: ['people', 'party_membership', 'mandates', 'proposals', 'authorship', 'movements'], proposalPrimaryRecordsRule: 'primaryRecordsFound equals proposals only', zeroObservedStatus: 'PARTIAL when capability executed with zero observed records', unchangedHouses: [...UNCHANGED_HOUSES].sort(), rolloutHouses: [...ROLLOUT_HOUSES].sort() }, dimensions };
writeJson('artifacts/state_coverage_operational_p6.json', report);
console.log(JSON.stringify({ stage: report.stage, rows: dimensions.length, houses: houses.length, dimensionsPerHouse: 6 }, null, 2));
