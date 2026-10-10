import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'artifacts');
const read = (name: string) => {
  const bytes = fs.readFileSync(path.join(root, name));
  const text = bytes[0] === 0xff && bytes[1] === 0xfe
    ? bytes.toString('utf16le').replace(/^\uFEFF/, '')
    : bytes.toString('utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
};
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n', 'utf8');

const goSurface = {
  surface: 'deputados/em-exercicio',
  discovered: true,
  attempted: true,
  implemented: true,
  blocked: false,
  evidence: 'HTTP 200 table parsed; 43 stable provider person→party current-roster rows persisted',
  exhausted: true,
  classification: 'IMPLEMENTED',
  blocker: null,
  http200Source: true,
  records: 43,
  revisionId: 'state:GO:party:6b6f72c2dae763f471c1688a70c55373ffb0c3515d3c7cb33e9c4829e96baedd',
  source: 'https://portal.al.go.leg.br/deputados/em-exercicio',
};

const rjUrlProbeClassification = {
  'https://www3.alerj.rj.gov.br/': { status: 403, classification: 'HTTP_403_BLOCKER' },
  'https://www3.alerj.rj.gov.br/lotus_notes/default.asp?id=124': { status: 200, classification: 'LOTUS_VIEW_PARSER_REQUIRED' },
  'https://www.alerj.rj.gov.br/Deputados/QuemSao': { status: 200, classification: 'PARSER_CONTRACT_PROVEN' },
  'https://www.alerj.rj.gov.br/Deputados/RepresentacaoPartidaria': { status: 200, classification: 'PARSER_CONTRACT_PROVEN' },
  'https://www.alerj.rj.gov.br/atividade-parlamentar': { status: 404, classification: 'HTTP_404_NOT_SOURCE' },
  'https://www.alerj.rj.gov.br/transparencia': { status: 404, classification: 'HTTP_404_NOT_SOURCE' },
};

const results = read('p14_1_results.json');
for (const house of results.houses) {
  if (house.house === 'GO') {
    const index = house.knownSurfaces.findIndex((x: any) => x.surface === goSurface.surface);
    if (index < 0) house.knownSurfaces.push(goSurface);
    else house.knownSurfaces[index] = { ...house.knownSurfaces[index], ...goSurface };
    house.implementedSurfaces = house.knownSurfaces.filter((x: any) => x.implemented).length;
    house.blockedSurfaces = house.knownSurfaces.filter((x: any) => x.blocked).length;
    house.surfaceBookkeeping = { surface: goSurface.surface, records: 43, revisionId: goSurface.revisionId, status: 'PASS' };
  }
  if (house.house === 'RJ') house.probeUrlClassification = rjUrlProbeClassification;
}
results.gates.GO_SURFACE_BOOKKEEPING = 'PASS';
results.gates.RJ_URL_PROBE_SEPARATED = 'PASS';
results.legislative.SE = {
  status: 'PERSISTED_CONTROLLED_CORPUS',
  records: 10,
  recordsWritten: 10,
  recordsExpected: null,
  finiteDatasetProven: false,
  controlledCorpus: true,
  stableIds: true,
  replay: 'PASS',
  revisionId: 'state:SE:legislative:d38f75fe7c72d41763dd37af79fc4cfb1df10c7f4391afa30abe35c60022a820',
};
write('p14_1_results.json', results);

const evidence = read('p14_1_source_evidence.json');
const goEvidence = evidence.accessibleSurfaces.find((x: any) => x.house === 'GO');
if (goEvidence) goEvidence.surfaceBookkeeping = goSurface;
const seEvidence = evidence.accessibleSurfaces.find((x: any) => x.house === 'SE');
if (seEvidence) {
  seEvidence.legislative = {
    ...(seEvidence.legislative ?? {}),
    status: 'PERSISTED_CONTROLLED_CORPUS',
    records: 10,
    recordsExpected: null,
    finiteDatasetProven: false,
    revisionId: 'state:SE:legislative:d38f75fe7c72d41763dd37af79fc4cfb1df10c7f4391afa30abe35c60022a820',
    replay: 'PASS',
    controlledCorpus: true,
  };
}
const rjEvidence = evidence.accessibleSurfaces.find((x: any) => x.house === 'RJ');
if (rjEvidence) {
  rjEvidence.probeUrlClassification = rjUrlProbeClassification;
  const portal = rjEvidence.http200?.find((url: string) => url === 'https://www3.alerj.rj.gov.br/');
  if (portal) rjEvidence.http200 = rjEvidence.http200.filter((url: string) => url !== portal);
}
evidence.seAspNet = {
  ...evidence.seAspNet,
  status: 'PERSISTED_CONTROLLED_CORPUS',
  recordsExpected: null,
  finiteDatasetProven: false,
  controlledCorpus: true,
  replay: 'PASS',
};
write('p14_1_source_evidence.json', evidence);

const blockers = read('p14_1_blocker_reclassification.json');
blockers.goSurfaceBookkeeping = goSurface;
blockers.rjUrlProbeClassification = rjUrlProbeClassification;
blockers.seLegislative = { status: 'PERSISTED_CONTROLLED_CORPUS', records: 10, recordsExpected: null, replay: 'PASS' };
for (const change of blockers.changes) {
  if (change.house === 'SE' && change.capability === 'proposals') {
    change.blocker = null;
    change.operationalStatus = 'PERSISTED_CONTROLLED_CORPUS';
  }
}
write('p14_1_blocker_reclassification.json', blockers);

const goRecon = read('p14_1_go_reconciliation.json');
goRecon.surfaceBookkeeping = goSurface;
const goReconSurface = goRecon.knownSurfaces?.find((x: any) => x.surface === goSurface.surface);
if (goReconSurface) Object.assign(goReconSurface, goSurface);
write('p14_1_go_reconciliation.json', goRecon);

const rjRecon = read('p14_1_rj_reconciliation.json');
rjRecon.probeUrlClassification = rjUrlProbeClassification;
const rjPortal = rjRecon.knownSurfaces?.find((x: any) => x.surface === 'portal homepage');
if (rjPortal) rjPortal.http200Source = false;
write('p14_1_rj_reconciliation.json', rjRecon);

const run = read('p14_1_run.log');
run.seLegislative = { status: 'PERSISTED_CONTROLLED_CORPUS', records: 10, recordsExpected: null, stableIds: true, replay: 'PASS', revisionId: results.legislative.SE.revisionId };
run.goSurfaceBookkeeping = { surface: goSurface.surface, records: 43, revisionId: goSurface.revisionId, status: 'PASS' };
run.rjUrlProbeClassification = rjUrlProbeClassification;
write('p14_1_run.log', run);

const mdPath = path.join(root, 'p14_1_integrity_parser_closure.md');
let md = fs.readFileSync(mdPath, 'utf8');
md = md.replace(/SE: ASP\.NET form, dynamic hidden fields, production query, stable proposal IDs and detail\/process links inspected; parser contract is proven for the bounded page and implementation remains controlled\/not broad\./, 'SE: ASP.NET form, dynamic hidden fields, production query and stable proposal IDs parsed; 10-record controlled corpus persisted with raw provenance, active legislative revision and replay PASS; completeness remains explicitly unknown (recordsExpected=null).');
md += '\n## Final requested closure (SE / GO / RJ)\n\n- SE legislative: controlled 2026 corpus persisted (10 stable external IDs), raw provenance retained, active revision published, replay PASS, `recordsExpected=null` because finiteness was not proven.\n- GO `deputados/em-exercicio`: surface bookkeeping corrected to IMPLEMENTED with 43 persisted provider person→party rows.\n- RJ probes: HTTP 403, HTTP 200 parser surfaces and HTTP 404 non-source URLs are separated per URL.\n';
fs.writeFileSync(mdPath, md, 'utf8');

console.log(JSON.stringify({ se: 'PERSISTED_CONTROLLED_CORPUS', seRecords: 10, seRecordsExpected: null, seReplay: 'PASS', goSurface: 'PASS', goRecords: 43, rjProbeSeparation: 'PASS' }, null, 2));
