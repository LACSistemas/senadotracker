import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

/**
 * Dívida pública — Dívida Bruta do Governo Geral (DBGG, % do PIB), Banco Central do Brasil, SGS série
 * 13762 (metodologia vigente desde dez/2006), mensal. É a métrica mais citada publicamente como "a
 * dívida pública do Brasil" — soma as dívidas de responsabilidade do Governo Federal, dos estados e
 * dos municípios com o setor privado, o setor público financeiro e o resto do mundo. Confirmado ao
 * vivo (238 pontos, dez/2006 a set/2026, primeiro valor 55.48, último 82.95).
 *
 * Achado real: o endpoint às vezes devolve 304 Not Modified pro MESMO parâmetro de querystring
 * repetido em sequência — não é cache HTTP padrão por `If-None-Match` (nenhum validador é enviado),
 * parece ser uma camada de CDN na frente da API. Um parâmetro cache-buster (`_cb`) evita isso.
 */
const DEBT_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.13762/dados?formato=json&dataInicial=01/12/2006';
const USER_AGENT = 'Civica/0.1 (official-data-research; public-debt)';

export interface PublicDebtPoint { metric: 'DBGG_PCT_GDP'; periodStart: string; value: number; sourceHash: Buffer }

/** "DD/MM/YYYY" (formato do BCB) → "YYYY-MM-DD" (ISO, pra coluna `date`). */
function parseBrDate(d: string): string {
  const [day, month, year] = d.split('/');
  return `${year}-${month}-${day}`;
}

export async function fetchPublicDebt(url = DEBT_URL): Promise<PublicDebtPoint[]> {
  const bustUrl = `${url}&_cb=${Date.now()}`;
  const res = await fetch(bustUrl, { headers: { 'user-agent': USER_AGENT, 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  const rows = await res.json() as Array<{ data: string; valor: string }>;
  const out: PublicDebtPoint[] = [];
  for (const r of rows) {
    const value = Number(r.valor);
    if (!Number.isFinite(value)) continue;
    out.push({ metric: 'DBGG_PCT_GDP', periodStart: parseBrDate(r.data), value, sourceHash: createHash('sha256').update(`${r.data}|${r.valor}`).digest() });
  }
  return out;
}

export async function writePublicDebt(pool: Pick<Pool, 'query'>, points: PublicDebtPoint[]): Promise<void> {
  for (const p of points) {
    await pool.query(
      `INSERT INTO civica_exec.exec_public_debt (metric, period_start, value, source_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (metric, period_start) DO UPDATE SET value = excluded.value, source_hash = excluded.source_hash, collected_at = now()`,
      [p.metric, p.periodStart, p.value, p.sourceHash],
    );
  }
}
