import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { mirrorPortrait } from '@senadotracker/db';
import { streamTseCsv, candidateHeaders } from './elections.ts';
import { tsePhotoSourceUrl, createTsePhotoFetchImpl } from './tse-photos.ts';

/**
 * P14.13: presidente/vice-presidente eleitos (TSE, candidatos — mesmo CSV e parser já usados pro
 * Congresso em elections.ts, filtro próprio de cargo/eleito). Amplia civica_exec.exec_executive_mandate
 * (P14.1) pro nível federal com uf='BR' (ddl-v45) — mesma tabela, mesmo contrato de leitura
 * (getCurrentExecutive), nenhuma tabela nova. Posse 1º de janeiro do ano seguinte à eleição, mandato de 4
 * anos — mesma regra constitucional já usada pro governador.
 */
const empty = (v: unknown): string => { const s = String(v ?? '').trim(); return !s || s === '#NULO#' || s === '#NULO' ? '' : s; };
const ELECTED_STATUSES = new Set(['ELEITO', 'ELEITO POR QP', 'ELEITO POR MÉDIA']);
const ROLE_MAP: Record<string, 'PRESIDENTE' | 'VICE_PRESIDENTE'> = { PRESIDENTE: 'PRESIDENTE', 'VICE-PRESIDENTE': 'VICE_PRESIDENTE' };

export interface FederalExecutiveCandidacy {
  role: 'PRESIDENTE' | 'VICE_PRESIDENTE';
  electionYear: number;
  sqCandidato: string;
  candidateName: string;
  ballotName: string;
  party: string;
  electedRound: number;
  mandateStart: string;
  mandateEnd: string;
  sourceHash: Buffer;
}

/** Lê um CSV de candidatos do TSE já escopado a nível federal (ex. consulta_cand_{year}_BR.csv —
 * confirmado ao vivo: bem menor que o arquivo nacional de todos os cargos, só presidente/vice) e devolve
 * os eleitos. Lança erro se um campo essencial faltar — nunca grava uma candidatura incompleta. */
export async function parseFederalExecutives(file: string, year: number): Promise<FederalExecutiveCandidacy[]> {
  const out: FederalExecutiveCandidacy[] = [];
  const mandateStart = `${year + 1}-01-01`, mandateEnd = `${year + 5}-01-01`;
  for await (const row of streamTseCsv(file, candidateHeaders)) {
    if (Number(row.ANO_ELEICAO) !== year) continue;
    const role = ROLE_MAP[empty(row.DS_CARGO)];
    if (!role) continue;
    if (!ELECTED_STATUSES.has(empty(row.DS_SIT_TOT_TURNO).toUpperCase())) continue;
    const sqCandidato = empty(row.SQ_CANDIDATO), candidateName = empty(row.NM_CANDIDATO), party = empty(row.SG_PARTIDO);
    if (!sqCandidato || !candidateName || !party) throw new Error(`Candidatura federal incompleta (${role}, ${year}): SQ_CANDIDATO=${sqCandidato || 'ausente'}`);
    out.push({
      role, electionYear: year, sqCandidato, candidateName, ballotName: empty(row.NM_URNA_CANDIDATO) || candidateName, party,
      electedRound: Number(row.NR_TURNO), mandateStart, mandateEnd,
      sourceHash: createHash('sha256').update(JSON.stringify(row)).digest(),
    });
  }
  return out;
}

/** Grava (upsert, idempotente) as candidaturas federais eleitas em exec_executive_mandate (uf='BR'). */
export async function writeFederalExecutives(pool: Pick<Pool, 'query'>, rows: FederalExecutiveCandidacy[]): Promise<void> {
  for (const r of rows) {
    await pool.query(
      `INSERT INTO civica_exec.exec_executive_mandate
         (role, uf, election_year, mandate_start, mandate_end, sq_candidato, candidate_name, ballot_name, party, elected_round, source_hash)
       VALUES ($1,'BR',$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (role, uf, election_year) DO UPDATE SET
         mandate_start = excluded.mandate_start, mandate_end = excluded.mandate_end, sq_candidato = excluded.sq_candidato,
         candidate_name = excluded.candidate_name, ballot_name = excluded.ballot_name, party = excluded.party,
         elected_round = excluded.elected_round, source_hash = excluded.source_hash, collected_at = now()`,
      [r.role, r.electionYear, r.mandateStart, r.mandateEnd, r.sqCandidato, r.candidateName, r.ballotName, r.party, r.electedRound, r.sourceHash],
    );
  }
}

/** Espelha a foto de cada candidatura (extração via HTTP Range de dentro do ZIP do TSE — nunca o ZIP
 * inteiro) e grava a URL de origem em `photo_url` (a própria rota `/api/portrait` espera a URL de origem,
 * não um caminho local). `dir` deve apontar pro D: nesta coleta (PORTRAIT_DIR), nunca pro repositório. */
export async function mirrorFederalExecutivePhotos(pool: Pick<Pool, 'query'>, rows: FederalExecutiveCandidacy[], dir?: string): Promise<Array<{ role: string; status: string; error?: string }>> {
  const fetchImpl = createTsePhotoFetchImpl();
  const results: Array<{ role: string; status: string; error?: string }> = [];
  for (const r of rows) {
    const url = tsePhotoSourceUrl(r.electionYear, 'BR', r.sqCandidato);
    const outcome = await mirrorPortrait(pool, url, { fetchImpl, ...(dir ? { dir } : {}) });
    results.push({ role: r.role, status: outcome.status, ...(outcome.error ? { error: outcome.error } : {}) });
    if (outcome.status === 'stored' || outcome.status === 'not_modified') {
      await pool.query(`UPDATE civica_exec.exec_executive_mandate SET photo_url = $1 WHERE role = $2 AND uf = 'BR' AND election_year = $3`, [url, r.role, r.electionYear]);
    }
  }
  return results;
}
