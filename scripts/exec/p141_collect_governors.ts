import crypto from 'node:crypto';
import { streamTseCsv, candidateHeaders } from '../../apps/collector/src/elections.ts';
import { openPool } from './db.ts';

/** P14.1 — governador/vice-governador eleito por UF (TSE, eleições 2022). Vencedor é quem tem
 * CD_SIT_TOT_TURNO=1 (ELEITO) em QUALQUER turno — nunca fixar NR_TURNO=1, pois quando há 2º turno
 * só ele carrega o status ELEITO (1º turno marca os dois finalistas como "2º TURNO"). Esse é o bug
 * do pipeline antigo (`elections.ts`'s `parseCandidateRow`, que descartava NR_TURNO!==1). */
const ELECTION_YEAR = 2022;
const CANDIDATES_FILE = 'D:/Civica/tse-raw/2022/consulta_cand_2022_BRASIL.csv';
const CARGOS: Record<string, 'GOVERNADOR' | 'VICE_GOVERNADOR'> = { '3': 'GOVERNADOR', '4': 'VICE_GOVERNADOR' };

function mandateRange(electionYear: number): { start: string; end: string } {
  return { start: `${electionYear + 1}-01-01`, end: `${electionYear + 4}-12-31` };
}

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const { start, end } = mandateRange(ELECTION_YEAR);
  const rows: Array<{ role: string; uf: string; sq: string; name: string; ballot: string; party: string; round: number }> = [];

  for await (const row of streamTseCsv(CANDIDATES_FILE, candidateHeaders)) {
    if (Number(row.ANO_ELEICAO) !== ELECTION_YEAR) continue;
    const role = CARGOS[row.CD_CARGO ?? ''];
    if (!role) continue;
    if ((row.DS_SIT_TOT_TURNO ?? '').trim().toUpperCase() !== 'ELEITO') continue;
    rows.push({
      role, uf: row.SG_UF!, sq: row.SQ_CANDIDATO!, name: row.NM_CANDIDATO!,
      ballot: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO!, party: row.SG_PARTIDO!,
      round: Number(row.NR_TURNO),
    });
  }

  console.log(`candidatos eleitos encontrados: ${rows.length} (esperado: 27 UFs x 2 cargos = 54)`);
  const byUf = new Map<string, number>();
  for (const r of rows) byUf.set(r.uf, (byUf.get(r.uf) ?? 0) + 1);
  const incomplete = [...byUf.entries()].filter(([, n]) => n !== 2);
  if (incomplete.length) throw new Error(`UFs sem exatamente 1 governador + 1 vice eleitos: ${JSON.stringify(incomplete)}`);

  const values: unknown[] = []; const placeholders: string[] = []; let i = 0;
  for (const r of rows) {
    const sourceHash = crypto.createHash('sha256').update(`${r.role}|${r.uf}|${ELECTION_YEAR}|${r.sq}`).digest();
    values.push(r.role, r.uf, ELECTION_YEAR, start, end, r.sq, r.name, r.ballot, r.party, r.round, sourceHash);
    placeholders.push(`($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`);
  }
  await pool.query(
    `INSERT INTO civica_exec.exec_executive_mandate
       (role, uf, election_year, mandate_start, mandate_end, sq_candidato, candidate_name, ballot_name, party, elected_round, source_hash)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (role, uf, election_year) DO UPDATE SET
       mandate_start = EXCLUDED.mandate_start, mandate_end = EXCLUDED.mandate_end,
       sq_candidato = EXCLUDED.sq_candidato, candidate_name = EXCLUDED.candidate_name,
       ballot_name = EXCLUDED.ballot_name, party = EXCLUDED.party, elected_round = EXCLUDED.elected_round,
       source_hash = EXCLUDED.source_hash, collected_at = now()`,
    values,
  );

  const summary = (await pool.query(
    `SELECT role, count(*)::int n FROM civica_exec.exec_executive_mandate WHERE election_year = $1 GROUP BY role ORDER BY role`,
    [ELECTION_YEAR],
  )).rows;
  console.log('resumo:', summary);
  await pool.end();
}

await main();
