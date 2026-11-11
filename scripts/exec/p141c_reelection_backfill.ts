import { streamTseCsv, complementHeaders } from '../../apps/collector/src/elections.ts';
import { openPool } from './db.ts';

/** P14 (reeleição) — backfill de `is_reelection` em exec_executive_mandate/_municipal a partir do arquivo TSE
 * "Candidatos - Informações complementares" (consulta_cand_complementar_<ano>), casado por sq_candidato: o
 * próprio candidato autodeclara ST_REELEICAO ('S'/'N') no ato da candidatura — não é inferido por comparação
 * entre ciclos. 2022 cobre governador/vice (eleitos em 2022); 2024 cobre prefeito/vice (eleitos em 2024,
 * inclusive as eleições suplementares de 2025/2026, que são o MESMO arquivo consulta_cand_2024). Aditivo e
 * idempotente: roda de novo sem problema, nunca grava false por omissão (sq_candidato sem linha no
 * complementar fica NULL, não false).
 */
const FILES: Array<{ year: number; file: string }> = [
  { year: 2022, file: 'D:/Civica/tse-raw/complementar/2022/consulta_cand_complementar_2022_BRASIL.csv' },
  { year: 2024, file: 'D:/Civica/tse-raw/complementar/2024/consulta_cand_complementar_2024_BRASIL.csv' },
];

async function loadReelectionMap(file: string, year: number): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for await (const row of streamTseCsv(file, complementHeaders)) {
    if (Number(row.ANO_ELEICAO) !== year) continue;
    const sq = row.SQ_CANDIDATO; const st = (row.ST_REELEICAO ?? '').trim().toUpperCase();
    if (!sq || (st !== 'S' && st !== 'N')) continue;
    map.set(sq, st === 'S');
  }
  return map;
}

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  for (const { year, file } of FILES) {
    const map = await loadReelectionMap(file, year);
    console.log(`${year}: ${map.size} candidatos com ST_REELEICAO lido`);

    if (year === 2022) {
      const rows = (await pool.query(`SELECT role, uf, sq_candidato FROM civica_exec.exec_executive_mandate WHERE election_year = $1`, [year])).rows;
      let updated = 0, missing = 0;
      for (const r of rows) {
        const val = map.get(String(r.sq_candidato));
        if (val === undefined) { missing++; continue; }
        await pool.query(`UPDATE civica_exec.exec_executive_mandate SET is_reelection = $1 WHERE role = $2 AND uf = $3 AND election_year = $4`, [val, r.role, r.uf, year]);
        updated++;
      }
      console.log(`exec_executive_mandate ${year}: ${updated} atualizados, ${missing} sem linha no complementar (ficam NULL)`);
    } else {
      const rows = (await pool.query(`SELECT role, entity_id, sq_candidato FROM civica_exec.exec_executive_mandate_municipal WHERE election_year = $1`, [year])).rows;
      let updated = 0, missing = 0;
      for (const r of rows) {
        const val = map.get(String(r.sq_candidato));
        if (val === undefined) { missing++; continue; }
        await pool.query(`UPDATE civica_exec.exec_executive_mandate_municipal SET is_reelection = $1 WHERE role = $2 AND entity_id = $3 AND election_year = $4`, [val, r.role, r.entity_id, year]);
        updated++;
      }
      console.log(`exec_executive_mandate_municipal ${year}: ${updated} atualizados, ${missing} sem linha no complementar (ficam NULL)`);
    }
  }

  const summary = await pool.query(`
    SELECT 'estado' AS kind, role, is_reelection, count(*)::int n FROM civica_exec.exec_executive_mandate GROUP BY 1,2,3
    UNION ALL
    SELECT 'municipio' AS kind, role, is_reelection, count(*)::int n FROM civica_exec.exec_executive_mandate_municipal GROUP BY 1,2,3
    ORDER BY 1,2,3`);
  console.log('resumo:', summary.rows);
  await pool.end();
}

await main();
