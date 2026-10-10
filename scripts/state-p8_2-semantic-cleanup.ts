import fs from 'node:fs';

const PUBLIC_DIMENSIONS = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'] as const;
const IDENTITY_REVISION = 'state:MA:identity:8b53e6201b9b75e1505cb7d6ff15e583fc5e3f0a09017f7efa753bcc68f03d1f';
const LEGISLATIVE_REVISION = 'state:MA:legislative:6378a27bd14ff6a1899b5528b199fb0d2b6a5db5dea4dd261db252ce1483f7f0';
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const write = (file: string, value: unknown): void => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const nullCell = (dimension: string, note: string): any => ({ house: 'MA', dimension, status: 'NOT_COLLECTED', recordsFound: null, recordsExpected: null, recordsResolved: null, primaryRecordsFound: null, primaryRecordsExpected: null, primaryRecordsResolved: null, components: {}, completenessPercentage: null, earliestRecordDate: null, latestRecordDate: null, historicalVerified: false, lastSuccessfulRun: null, activeRevisionId: null, note });

const result: any = read('artifacts/p8_1_ma_alemalegis_results.json');
if (result.database !== 'civica_postgres_lab' || result.provider !== 'alemalegis') throw new Error('P8.1 artifact target/provider mismatch');
if (result.revisions?.identity !== IDENTITY_REVISION || result.revisions?.legislative !== LEGISLATIVE_REVISION) throw new Error('P8.1 revisions changed unexpectedly');
if (result.counts?.first?.persons !== 10 || result.counts?.first?.proposals !== 10 || result.counts?.first?.authors !== 9 || result.counts?.first?.movements !== 29) throw new Error('P8.1 counts do not match approved corpus');

const byDimension = new Map<string, any>((result.operationalCoverage ?? []).map((x: any) => [x.dimension, x]));
const name = { ...byDimension.get('name'), dimension: 'name', note: 'P8.1 ALEMALEGIS controlled corpus' };
const proposals = { ...byDimension.get('proposals'), dimension: 'proposals', primaryRecordsFound: 10, primaryRecordsResolved: 10, components: { proposals: { status: 'CONSUMABLE', recordsFound: 10, recordsResolved: 10 }, authorship: { status: 'CONSUMABLE', recordsFound: 9, recordsResolved: 9 }, movements: { status: 'CONSUMABLE', recordsFound: 29, recordsResolved: 29 } }, note: 'P8.1 ALEMALEGIS controlled corpus; component counts are not proposal counts' };
if (!name || !proposals) throw new Error('P8.1 name/proposals projections missing');
result.operationalCoverage = [name, nullCell('party', 'P8.1 ALEMALEGIS party relation not operationally observed'), nullCell('mandate_history', 'P8.1 does not infer mandate history from legislature catalog'), proposals, nullCell('cabinet', 'P8.1 capability not collected'), nullCell('parliamentary_allowance', 'P8.1 capability not collected')];
result.status = 'P8_2_PASS'; result.semanticCleanup = { publicDimensions: [...PUBLIC_DIMENSIONS], invalidPublicDimensions: 0, componentsKeptNested: true, partyNotCollected: true, revisionsUnchanged: true, persistenceChanged: false };
write('artifacts/p8_1_ma_alemalegis_results.json', result);

const matrix: any = read('artifacts/state_coverage_operational_p8_1.json');
if (matrix.dimensions.length !== 162 || new Set(matrix.dimensions.map((x: any) => x.house)).size !== 27) throw new Error('coverage matrix must remain 27 x 6');
for (const row of matrix.dimensions) if (row.status === 'NOT_COLLECTED' && (row.lastSuccessfulRun !== null || row.activeRevisionId !== null)) throw new Error(`invalid NOT_COLLECTED metadata for ${row.house}/${row.dimension}`);
const projectionByDim = new Map(result.operationalCoverage.map((x: any) => [x.dimension, x]));
for (const row of matrix.dimensions.filter((x: any) => x.house === 'MA')) {
  const source = projectionByDim.get(row.dimension); if (!source) throw new Error(`missing MA projection ${row.dimension}`);
  Object.assign(row, source);
  if (row.dimension === 'proposals') row.components = proposals.components;
}
matrix.stage = 'P8_2_SEMANTIC_CLEANUP'; matrix.projection = { ...matrix.projection, publicDimensions: [...PUBLIC_DIMENSIONS], totalCells: 162 };
write('artifacts/state_coverage_operational_p8_1.json', matrix);
console.log(JSON.stringify({ status: 'P8_2_PASS', rows: matrix.dimensions.length, houses: new Set(matrix.dimensions.map((x: any) => x.house)).size, dimensionsPerHouse: 6, revisionsUnchanged: true, ma: result.operationalCoverage }, null, 2));
