import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = 'D:/Civica/raw/infraestrutura/recursos_hidricos';
const snisbUrl = 'https://www.snirh.gov.br/arcgis/rest/services/IG/SNISB/FeatureServer/0';
const atlasUrl = 'https://www.snirh.gov.br/arcgis/rest/services/SPR/ISH_U/MapServer/0';
const anmCsv = 'https://dadosabertos.anm.gov.br/SIGBM/Barragens.csv';
const anmDict = 'https://dadosabertos.anm.gov.br/SIGBM/metadados-sigbm.ods';

async function save(url: string, path: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const b = Buffer.from(await r.arrayBuffer());
  await writeFile(path, b);
  return { url, path, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex'), contentType: r.headers.get('content-type') };
}
async function json(url: string) {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json() as any;
      last = `${r.status} ${url}`;
    } catch (e) { last = String(e); }
    await new Promise(r => setTimeout(r, attempt * 1500));
  }
  throw new Error(last);
}
await mkdir(`${ROOT}/snisb`, { recursive: true });
await mkdir(`${ROOT}/anm`, { recursive: true });
await mkdir(`${ROOT}/atlas`, { recursive: true });
const manifest: any = { startedAt: new Date().toISOString(), sources: [] };
manifest.sources.push(await save(`${snisbUrl}?f=pjson`, `${ROOT}/snisb/layer-metadata.json`));
manifest.sources.push(await save(`${atlasUrl}?f=pjson`, `${ROOT}/atlas/layer-metadata.json`));
manifest.sources.push(await save(anmCsv, `${ROOT}/anm/Barragens.csv`));
manifest.sources.push(await save(anmDict, `${ROOT}/anm/metadados-sigbm.ods`));

async function collectArcgis(base: string, outFields: string, pageSize: number, outDir: string, returnGeometry: boolean) {
  const count = await json(`${base}/query?where=1%3D1&returnCountOnly=true&f=json`);
  const total = Number(count.count ?? 0);
  const pages: any[] = [];
  for (let offset = 0; offset < total; offset += pageSize) {
    const q = new URLSearchParams({ where: '1=1', outFields, returnGeometry: String(returnGeometry), f: 'json', resultOffset: String(offset), resultRecordCount: String(pageSize) });
    if (base.includes('SNISB')) q.set('orderByFields', 'BAR_CD_SNISB');
    else if (pageSize >= 500) q.set('orderByFields', 'CDMUN');
    const u = `${base}/query?${q}`;
    const d = await json(u);
    const path = `${ROOT}/${outDir}/page-${String(pages.length + 1).padStart(3, '0')}.json`;
    await writeFile(path, JSON.stringify(d));
    pages.push({ url: u, path, rows: d.features?.length ?? 0, sha256: createHash('sha256').update(JSON.stringify(d)).digest('hex') });
    if ((d.features?.length ?? 0) === 0) break;
  }
  return { total, pages };
}
manifest.snisb = await collectArcgis(snisbUrl, '*', 2000, 'snisb', true);
manifest.atlas = await collectArcgis(atlasUrl, 'CDMUN,NMMUN,SGUF,ISH,TPMAN,CSMAN,TPSIS,TPOPE', 200, 'atlas', false);
manifest.finishedAt = new Date().toISOString();
manifest.manifestSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
await writeFile(`${ROOT}/collection-manifest.json`, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
