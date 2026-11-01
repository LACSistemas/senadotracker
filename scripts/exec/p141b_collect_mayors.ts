import crypto from 'node:crypto';
import { streamTseCsv, candidateHeaders } from '../../apps/collector/src/elections.ts';
import { openPool } from './db.ts';

/** P14.1b — prefeito/vice-prefeito eleito por município (TSE, eleições municipais 2024). Mesma regra de
 * vencedor usada para governador: CD_SIT_TOT_TURNO/DS_SIT_TOT_TURNO=ELEITO em QUALQUER turno (só cidades com
 * mais de 200 mil eleitores têm 2º turno). SG_UE é o código do município pelo TSE — resolvido para o
 * entity_id canônico (IBGE7) via exec_entity_external_id (source=3), carregada por p141b_load_crosswalk.ts.
 *
 * Armadilha real encontrada (confirmada linha a linha, não suposição): 13 municípios tiveram a eleição
 * ordinária de 2024 anulada e refeita como "eleição suplementar" (TSE: ELEIÇÃO SUPLEMENTAR, datas entre
 * 10/2025 e 10/2026 — todas já ocorridas). Isso gera 2 linhas ELEITO para o mesmo entity_id+role: a
 * ordinária (anulada) e a suplementar (vigente). Fica com a de DT_ELEICAO mais recente. A suplementar
 * preenche o RESTANTE do mandato (não reinicia 4 anos): mandate_start = data da eleição suplementar,
 * mandate_end permanece 2028-12-31. */
const ELECTION_YEAR = 2024;
const TERM_END = `${ELECTION_YEAR + 4}-12-31`;
const CANDIDATES_FILE = 'D:/Civica/tse-raw/2024/consulta_cand_2024_BRASIL.csv';
const CARGOS: Record<string, 'PREFEITO' | 'VICE_PREFEITO'> = { '11': 'PREFEITO', '12': 'VICE_PREFEITO' };

function civilDate(v: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) throw new Error(`DT_ELEICAO inválida: ${v}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const tseToEntity = new Map<string, number>();
  for (const r of (await pool.query(`SELECT code, entity_id FROM civica_exec.exec_entity_external_id WHERE source = 3`)).rows) {
    tseToEntity.set(String(r.code), Number(r.entity_id));
  }
  console.log(`correspondência TSE→IBGE carregada: ${tseToEntity.size} municípios`);

  const today = new Date().toISOString().slice(0, 10);
  type Row = { role: string; entityId: number; sq: string; name: string; ballot: string; party: string; round: number; electionDate: string; supplementary: boolean };
  const rows: Row[] = [];
  const unresolved = new Set<string>();
  const future: Row[] = [];

  for await (const row of streamTseCsv(CANDIDATES_FILE, candidateHeaders)) {
    if (Number(row.ANO_ELEICAO) !== ELECTION_YEAR) continue;
    const role = CARGOS[row.CD_CARGO ?? ''];
    if (!role) continue;
    if ((row.DS_SIT_TOT_TURNO ?? '').trim().toUpperCase() !== 'ELEITO') continue;
    const sgUe = row.SG_UE!.trim();
    const entityId = tseToEntity.get(sgUe);
    if (!entityId) { unresolved.add(`${sgUe}|${row.NM_UE}|${row.SG_UF}`); continue; }
    const electionDate = civilDate(row.DT_ELEICAO!);
    const supplementary = (row.NM_TIPO_ELEICAO ?? '').toUpperCase().includes('SUPLEMENTAR');
    const r: Row = {
      role, entityId, sq: row.SQ_CANDIDATO!, name: row.NM_CANDIDATO!,
      ballot: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO!, party: row.SG_PARTIDO!,
      round: Number(row.NR_TURNO), electionDate, supplementary,
    };
    if (electionDate > today) { future.push(r); continue; }
    rows.push(r);
  }

  console.log(`candidatos eleitos encontrados: ${rows.length}`);
  if (unresolved.size) console.log(`SG_UE sem correspondência IBGE (${unresolved.size}):`, [...unresolved].slice(0, 20));
  if (future.length) console.log(`eleições suplementares com data futura, descartadas (ainda não vigentes): ${future.length}`, future.map(r => `${r.entityId}|${r.role}|${r.electionDate}`));

  // Eleição suplementar substitui a ordinária anulada: fica a de DT_ELEICAO mais recente por entity+role.
  const latest = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.entityId}|${r.role}`;
    const prev = latest.get(k);
    if (!prev || r.electionDate > prev.electionDate) latest.set(k, r);
  }
  const resolved = [...latest.values()];
  const supplanted = rows.length - resolved.length;
  console.log(`linhas substituídas por eleição suplementar mais recente: ${supplanted}`);

  const byEntity = new Map<number, Set<string>>();
  for (const r of resolved) {
    if (!byEntity.has(r.entityId)) byEntity.set(r.entityId, new Set());
    byEntity.get(r.entityId)!.add(r.role);
  }

  const totalMunicipios = (await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_entity WHERE kind = 4`)).rows[0].n;
  const withPrefeito = [...byEntity.values()].filter(s => s.has('PREFEITO')).length;
  const withVice = [...byEntity.values()].filter(s => s.has('VICE_PREFEITO')).length;
  console.log(`municípios: ${totalMunicipios}; com prefeito eleito: ${withPrefeito}; com vice eleito: ${withVice}`);

  const values: unknown[] = []; const placeholders: string[] = []; let i = 0;
  for (const r of resolved) {
    const mandateStart = r.supplementary ? r.electionDate : `${ELECTION_YEAR + 1}-01-01`;
    const sourceHash = crypto.createHash('sha256').update(`${r.role}|${r.entityId}|${ELECTION_YEAR}|${r.sq}`).digest();
    values.push(r.role, r.entityId, ELECTION_YEAR, mandateStart, TERM_END, r.sq, r.name, r.ballot, r.party, r.round, sourceHash);
    placeholders.push(`($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`);
  }
  const BATCH = 2000;
  for (let startIdx = 0; startIdx < placeholders.length; startIdx += BATCH) {
    const chunkPlaceholders = placeholders.slice(startIdx, startIdx + BATCH);
    const chunkValues = values.slice(startIdx * 11, (startIdx + chunkPlaceholders.length) * 11);
    // renumerar os placeholders do chunk a partir de 1
    const renumbered = chunkPlaceholders.map((_, idx) => {
      const base = idx * 11;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`;
    });
    await pool.query(
      `INSERT INTO civica_exec.exec_executive_mandate_municipal
         (role, entity_id, election_year, mandate_start, mandate_end, sq_candidato, candidate_name, ballot_name, party, elected_round, source_hash)
       VALUES ${renumbered.join(',')}
       ON CONFLICT (role, entity_id, election_year) DO UPDATE SET
         mandate_start = EXCLUDED.mandate_start, mandate_end = EXCLUDED.mandate_end,
         sq_candidato = EXCLUDED.sq_candidato, candidate_name = EXCLUDED.candidate_name,
         ballot_name = EXCLUDED.ballot_name, party = EXCLUDED.party, elected_round = EXCLUDED.elected_round,
         source_hash = EXCLUDED.source_hash, collected_at = now()`,
      chunkValues,
    );
  }

  const summary = (await pool.query(
    `SELECT role, count(*)::int n FROM civica_exec.exec_executive_mandate_municipal WHERE election_year = $1 GROUP BY role ORDER BY role`,
    [ELECTION_YEAR],
  )).rows;
  console.log('resumo:', summary);
  await pool.end();
}

await main();
