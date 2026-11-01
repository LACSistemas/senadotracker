import { mirrorPortrait } from '../../packages/db/src/portrait-mirror.ts';
import { createTsePhotoFetchImpl, tsePhotoSourceUrl } from '../../apps/collector/src/tse-photos.ts';
import { openPool } from './db.ts';

/** P14.1c — fotos de prefeito/vice-prefeito. Mesma mecânica dos governadores (apps/collector/src/tse-photos.ts),
 * mas em escala municipal: ~11.110 mandatos, 27 ZIPs (1 por UF, reaproveitado para todos os municípios
 * daquela UF — o diretório central de cada ZIP é lido 1x e cacheado em memória pelo próprio módulo).
 * Eleitos por suplementar (13 municípios) têm `mandate_start` != 2025-01-01 e podem ter candidatura
 * registrada num ano de eleição diferente de 2024 — tenta o ano do mandate_start primeiro e cai para 2024. */
function yearCandidates(electionYear: number, mandateStart: string): number[] {
  const startYear = Number(mandateStart.slice(0, 4));
  if (mandateStart === `${electionYear + 1}-01-01`) return [electionYear];
  return [...new Set([startYear, electionYear])];
}

async function main() {
  const pool = openPool(4);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const rows = (await pool.query(`
    SELECT m.role, m.entity_id, m.election_year, m.mandate_start::text AS mandate_start, m.sq_candidato, m.candidate_name, e.uf
    FROM civica_exec.exec_executive_mandate_municipal m
    JOIN civica_exec.exec_entity e ON e.entity_id = m.entity_id
    ORDER BY e.uf, m.entity_id, m.role
  `)).rows;
  console.log(`mandatos a buscar: ${rows.length}`);

  const fetchImpl = createTsePhotoFetchImpl();
  let stored = 0, notFound = 0, failed = 0; const failures: Array<{ uf: string; entityId: number; role: string; name: string; error?: string }> = [];
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const r = rows[next++]!;
      let outcome: { status: string; error?: string } | null = null;
      for (const year of yearCandidates(Number(r.election_year), r.mandate_start)) {
        const sourceUrl = tsePhotoSourceUrl(year, r.uf, r.sq_candidato);
        outcome = await mirrorPortrait(pool, sourceUrl, { fetchImpl });
        if (outcome.status === 'stored' || outcome.status === 'not_modified') {
          await pool.query(
            `UPDATE civica_exec.exec_executive_mandate_municipal SET photo_url = $1 WHERE role = $2 AND entity_id = $3 AND election_year = $4`,
            [sourceUrl, r.role, r.entity_id, r.election_year],
          );
          stored++; outcome = null; break;
        }
      }
      if (outcome) {
        if (outcome.status === 'failed' && outcome.error === 'HTTP 404') notFound++;
        else { failed++; failures.push({ uf: r.uf, entityId: r.entity_id, role: r.role, name: r.candidate_name, error: outcome.error }); }
      }
      const done = next;
      if (done % 500 === 0) console.log(`progresso: ${done}/${rows.length} (stored=${stored} notFound=${notFound} failed=${failed})`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  console.log(`FIM. stored: ${stored}; notFound: ${notFound}; failed: ${failed}`);
  if (failures.length) console.log('falhas (não 404):', failures.slice(0, 30));
  await pool.end();
}
await main();
