import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

/**
 * P14.13: PISA (OCDE), via espelho público da Our World in Data — Brasil, média OCDE e média dos
 * participantes do PISA, por disciplina e edição (2003-2022, 7 ciclos). PISA é internacional e só
 * nível-país (sem recorte estadual/municipal) — comparador PARALELO ao Ideb/Saeb (INEP), nunca na mesma
 * escala.
 */
export type PisaSubject = 'MATEMATICA' | 'LEITURA' | 'CIENCIAS';
const SUBJECT_URL: Record<PisaSubject, string> = {
  MATEMATICA: 'https://ourworldindata.org/grapher/academic-performance.csv?sex=both&subject=mathematics',
  LEITURA: 'https://ourworldindata.org/grapher/academic-performance.csv?sex=both&subject=reading',
  CIENCIAS: 'https://ourworldindata.org/grapher/academic-performance.csv?sex=both&subject=science',
};
const SUBJECT_COLUMN: Record<PisaSubject, string> = { MATEMATICA: 'Mathematics', LEITURA: 'Reading', CIENCIAS: 'Science' };
const USER_AGENT = 'Civica/0.1 (official-data-research; pisa)';
const ENTITY_MAP: Record<string, 'BRASIL' | 'MEDIA_OCDE' | 'MEDIA_PARTICIPANTES_PISA'> = { Brazil: 'BRASIL', 'OECD average': 'MEDIA_OCDE', 'PISA participants average': 'MEDIA_PARTICIPANTES_PISA' };

export interface PisaPoint { entity: 'BRASIL' | 'MEDIA_OCDE' | 'MEDIA_PARTICIPANTES_PISA'; subject: PisaSubject; edition: number; score: number; sourceHash: Buffer }

/** Busca e filtra o CSV de uma disciplina — só Brasil + os 2 agregados já prontos da OWID (não recalcula
 * médias). Cada CSV é pequeno (~450 linhas, todos os países × 7 edições), nada disso vai pro Postgres. */
export async function fetchPisaSubject(subject: PisaSubject): Promise<PisaPoint[]> {
  const url = SUBJECT_URL[subject];
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  const lines = (await res.text()).trim().split('\n').map(l => l.split(','));
  const header = lines[0];
  if (!header) throw new Error(`CSV de PISA vazio: ${url}`);
  const entityIdx = header.indexOf('Entity'), yearIdx = header.indexOf('Year'), scoreIdx = header.indexOf(SUBJECT_COLUMN[subject]);
  if (entityIdx < 0 || yearIdx < 0 || scoreIdx < 0) throw new Error(`Colunas inesperadas no CSV de PISA (${subject}): ${header.join(',')}`);
  const out: PisaPoint[] = [];
  for (const row of lines.slice(1)) {
    const entity = ENTITY_MAP[row[entityIdx] ?? ''];
    if (!entity) continue;
    const edition = Number(row[yearIdx]), score = Number(row[scoreIdx]);
    if (!Number.isFinite(edition) || !Number.isFinite(score)) continue;
    out.push({ entity, subject, edition, score, sourceHash: createHash('sha256').update(row.join(',')).digest() });
  }
  return out;
}

export async function fetchPisaAll(): Promise<PisaPoint[]> {
  const subjects: PisaSubject[] = ['MATEMATICA', 'LEITURA', 'CIENCIAS'];
  return (await Promise.all(subjects.map(fetchPisaSubject))).flat();
}

export async function writePisa(pool: Pick<Pool, 'query'>, points: PisaPoint[]): Promise<void> {
  for (const p of points) {
    await pool.query(
      `INSERT INTO civica_exec.exec_pisa_score (entity, subject, edition, score, source_hash) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (entity, subject, edition) DO UPDATE SET score = excluded.score, source_hash = excluded.source_hash, collected_at = now()`,
      [p.entity, p.subject, p.edition, p.score, p.sourceHash],
    );
  }
}
