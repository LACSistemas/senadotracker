import { mirrorPortrait } from '../../packages/db/src/portrait-mirror.ts';
import { createTsePhotoFetchImpl, tsePhotoSourceUrl } from '../../apps/collector/src/tse-photos.ts';
import { openPool } from './db.ts';

/** P14.1c — fotos de governador/vice: extrai do ZIP de candidatos do TSE (via Range, sem baixar o ZIP
 * inteiro — ver apps/collector/src/tse-photos.ts) e grava em civica_exec.exec_executive_mandate.photo_url
 * a mesma URL usada como chave do espelho local (civica_media.portraits), para o /api/portrait servir do
 * disco depois. Foto de candidatura (TSE), não foto oficial de posse — rotulado assim na UI. */
async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const rows = (await pool.query(`SELECT role, uf, election_year, sq_candidato, candidate_name FROM civica_exec.exec_executive_mandate WHERE election_year = 2022 ORDER BY uf, role`)).rows;
  console.log(`mandatos a buscar: ${rows.length}`);

  const fetchImpl = createTsePhotoFetchImpl();
  let stored = 0, failed = 0; const failures: Array<{ uf: string; role: string; name: string; error?: string }> = [];
  for (const r of rows) {
    const sourceUrl = tsePhotoSourceUrl(r.election_year, r.uf, r.sq_candidato);
    const outcome = await mirrorPortrait(pool, sourceUrl, { fetchImpl });
    if (outcome.status === 'stored' || outcome.status === 'not_modified') {
      await pool.query(
        `UPDATE civica_exec.exec_executive_mandate SET photo_url = $1 WHERE role = $2 AND uf = $3 AND election_year = $4`,
        [sourceUrl, r.role, r.uf, r.election_year],
      );
      stored++;
    } else {
      failed++; failures.push({ uf: r.uf, role: r.role, name: r.candidate_name, error: outcome.error });
    }
  }
  console.log(`stored/not_modified: ${stored}; failed: ${failed}`);
  if (failures.length) console.log('falhas:', failures);
  await pool.end();
}
await main();
