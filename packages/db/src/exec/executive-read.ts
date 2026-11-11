import type { Pool } from 'pg';

/** P14.1 — governador/vice-governador eleito, por UF (TSE). Foto ainda não coletada (photo_url sempre
 * null por ora). P14.1b — prefeito/vice-prefeito eleito, por município (TSE, ciclo 2024). Alguns
 * municípios não têm prefeito resolvido (DF e Fernando de Noronha/PE não têm prefeitura eletiva; um
 * punhado tem eleição anulada sem suplementar ainda realizada) — nesses casos `getCurrentMayor`
 * devolve null, e a página mostra só o governador, mesmo padrão de ausência honesta do resto do produto.
 * P14.13 — presidente/vice-presidente (TSE, uf='BR'), mesma tabela. */
type Q = Pick<Pool, 'query'>;
export interface ExecutiveOfficial {
  role: 'GOVERNADOR' | 'VICE_GOVERNADOR' | 'PREFEITO' | 'VICE_PREFEITO' | 'PRESIDENTE' | 'VICE_PRESIDENTE';
  name: string; ballotName: string; party: string; photoUrl: string | null;
  electionYear: number; electedRound: number; mandateStart: string; mandateEnd: string;
  /** Autodeclarado pelo próprio candidato (TSE, ST_REELEICAO) no ato da candidatura — null quando a
   * candidatura não casou com o arquivo de informações complementares (nunca false por omissão). */
  isReelection: boolean | null;
}
export interface CurrentExecutive { governor: ExecutiveOfficial; viceGovernor: ExecutiveOfficial | null }
export interface CurrentMayor { mayor: ExecutiveOfficial; viceMayor: ExecutiveOfficial | null }
export interface CurrentFederalExecutive { president: ExecutiveOfficial; vicePresident: ExecutiveOfficial | null }

export async function getCurrentExecutive(q: Q, uf: string): Promise<CurrentExecutive | null> {
  const rows = (await q.query(
    `SELECT role, candidate_name, ballot_name, party, photo_url, election_year, elected_round, is_reelection,
            mandate_start::text AS mandate_start, mandate_end::text AS mandate_end
     FROM civica_exec.exec_executive_mandate
     WHERE uf = $1 AND mandate_start <= current_date AND mandate_end >= current_date
     ORDER BY role, election_year DESC`,
    [uf],
  )).rows;
  const toOfficial = (r: (typeof rows)[number]): ExecutiveOfficial => ({
    role: r.role, name: r.candidate_name, ballotName: r.ballot_name, party: r.party, photoUrl: r.photo_url,
    electionYear: Number(r.election_year), electedRound: Number(r.elected_round), isReelection: r.is_reelection,
    mandateStart: r.mandate_start, mandateEnd: r.mandate_end,
  });
  const governorRow = rows.find(r => r.role === 'GOVERNADOR');
  if (!governorRow) return null;
  const viceRow = rows.find(r => r.role === 'VICE_GOVERNADOR');
  return { governor: toOfficial(governorRow), viceGovernor: viceRow ? toOfficial(viceRow) : null };
}

export async function getCurrentMayor(q: Q, entityId: number): Promise<CurrentMayor | null> {
  const rows = (await q.query(
    `SELECT role, candidate_name, ballot_name, party, photo_url, election_year, elected_round, is_reelection,
            mandate_start::text AS mandate_start, mandate_end::text AS mandate_end
     FROM civica_exec.exec_executive_mandate_municipal
     WHERE entity_id = $1 AND mandate_start <= current_date AND mandate_end >= current_date
     ORDER BY role, election_year DESC`,
    [entityId],
  )).rows;
  const toOfficial = (r: (typeof rows)[number]): ExecutiveOfficial => ({
    role: r.role, name: r.candidate_name, ballotName: r.ballot_name, party: r.party, photoUrl: r.photo_url,
    electionYear: Number(r.election_year), electedRound: Number(r.elected_round), isReelection: r.is_reelection,
    mandateStart: r.mandate_start, mandateEnd: r.mandate_end,
  });
  const mayorRow = rows.find(r => r.role === 'PREFEITO');
  if (!mayorRow) return null;
  const viceRow = rows.find(r => r.role === 'VICE_PREFEITO');
  return { mayor: toOfficial(mayorRow), viceMayor: viceRow ? toOfficial(viceRow) : null };
}

export async function getCurrentFederalExecutive(q: Q): Promise<CurrentFederalExecutive | null> {
  const rows = (await q.query(
    `SELECT role, candidate_name, ballot_name, party, photo_url, election_year, elected_round, is_reelection,
            mandate_start::text AS mandate_start, mandate_end::text AS mandate_end
     FROM civica_exec.exec_executive_mandate
     WHERE uf = 'BR' AND mandate_start <= current_date AND mandate_end >= current_date
     ORDER BY role, election_year DESC`,
  )).rows;
  const toOfficial = (r: (typeof rows)[number]): ExecutiveOfficial => ({
    role: r.role, name: r.candidate_name, ballotName: r.ballot_name, party: r.party, photoUrl: r.photo_url,
    electionYear: Number(r.election_year), electedRound: Number(r.elected_round), isReelection: r.is_reelection,
    mandateStart: r.mandate_start, mandateEnd: r.mandate_end,
  });
  const presidentRow = rows.find(r => r.role === 'PRESIDENTE');
  if (!presidentRow) return null;
  const viceRow = rows.find(r => r.role === 'VICE_PRESIDENTE');
  return { president: toOfficial(presidentRow), vicePresident: viceRow ? toOfficial(viceRow) : null };
}
