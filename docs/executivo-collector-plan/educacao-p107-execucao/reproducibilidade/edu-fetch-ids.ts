import { readFile, writeFile } from 'node:fs/promises';
import { storageConfig, readManifest } from '../../apps/collector/src/exec/storage.ts';
import { pncpBundleRel, readPncpBundle } from '../../apps/collector/src/exec/pncp.ts';

/** Somente leitura: busca no RAW do PNCP o órgão, a unidade e o objeto de uma lista de ids (auditoria amostral). npx tsx scripts/exec/edu-fetch-ids.ts <ids.json> <saida.json> */
const [idsFile, out] = process.argv.slice(2);
const want = new Set<string>(JSON.parse(await readFile(idsFile!, 'utf8')) as string[]); const found: Record<string, unknown> = {};
const cfg = storageConfig(); const man = await readManifest(cfg);
for (let y = 2021; y <= 2026 && Object.keys(found).length < want.size; y++) for (let m = 1; m <= 12; m++) {
  const rel = pncpBundleRel(y, m); if (!man.has(rel)) continue;
  for await (const page of readPncpBundle(cfg, rel)) {
    if (page.s !== 200) continue;
    for (const c of (JSON.parse(page.b) as { data?: Array<Record<string, any>> }).data ?? []) if (want.has(c.numeroControlePNCP)) found[c.numeroControlePNCP] = { orgao: c.orgaoEntidade?.razaoSocial, esfera: c.orgaoEntidade?.esferaId, unidade: c.unidadeOrgao?.nomeUnidade, objeto: String(c.objetoContrato ?? '').slice(0, 300), valor: c.valorGlobal ?? null };
  }
}
await writeFile(out!, JSON.stringify(found, null, 1)); console.log(Object.keys(found).length, 'de', want.size);
