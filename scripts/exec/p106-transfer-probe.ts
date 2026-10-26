import { storageConfig, fetchRaw, assertZipIntact } from '../../apps/collector/src/exec/storage.ts';
const cfg = storageConfig();
const e = await fetchRaw(cfg, {
  url: 'https://portaldatransparencia.gov.br/download-de-dados/transferencias/202510',
  relPath: 'federal/transferencias/202510.zip', competence: 202510, uf: 0, retention: 2,
  dataset: 'p106-portal-transferencias', userAgent: 'civica-exec/1.0 (dados abertos)',
  accept: h => h.subarray(0, 2).toString('ascii') === 'PK', retries: 3,
});
await assertZipIntact(cfg, e.relPath);
console.log(JSON.stringify(e, null, 2));
