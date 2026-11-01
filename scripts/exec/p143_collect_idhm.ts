import crypto from 'node:crypto';
import dns from 'node:dns';
import { openPool } from './db.ts';

dns.setDefaultResultOrder('ipv4first'); // undici/fetch falha por ENOTFOUND em ipeadata.gov.br via IPv6 neste ambiente.

/** P14.3 — IDHM (PNUD/IPEA/FJP, Atlas do Desenvolvimento Humano), via espelho público do Ipeadata
 * (api/odata4). Só 1991/2000/2010 (decenal, ligado ao Censo) — nunca uma série anual. Cada série
 * (SERCODIGO) devolve de uma vez só Brasil + UF + município, para os 3 anos — sem paginação necessária
 * (confirmado real: 16.776 linhas por série). */
const SERIES = { idhm: 'ADH_IDHM', idhm_renda: 'ADH_IDHM_R', idhm_longevidade: 'ADH_IDHM_L', idhm_educacao: 'ADH_IDHM_E' } as const;
type SeriesKey = keyof typeof SERIES;

interface IpeaRow { SERCODIGO: string; VALDATA: string; VALVALOR: number; NIVNOME: string; TERCODIGO: string }

async function fetchSeries(code: string): Promise<IpeaRow[]> {
  const url = `http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${code}')`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'civica-exec/1.0 (pesquisa de dados abertos)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { value: IpeaRow[] };
      return data.value;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(res => setTimeout(res, 800 * attempt));
    }
  }
  throw new Error('unreachable');
}

function levelOf(nivnome: string): 'BRASIL' | 'UF' | 'MUNICIPIO' | null {
  if (nivnome === 'Brasil') return 'BRASIL'; if (nivnome === 'Estados') return 'UF'; if (nivnome === 'Municípios') return 'MUNICIPIO'; return null;
}

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const bySeries = new Map<SeriesKey, IpeaRow[]>();
  for (const [key, code] of Object.entries(SERIES) as [SeriesKey, string][]) {
    const rows = await fetchSeries(code);
    console.log(`${code}: ${rows.length} linhas`);
    bySeries.set(key, rows);
  }

  // junta por (level, code, year) — cada território/ano precisa das 4 dimensões juntas.
  type Merged = { level: string; code: string; year: number; idhm?: number; idhm_renda?: number; idhm_longevidade?: number; idhm_educacao?: number };
  const merged = new Map<string, Merged>();
  for (const [key, rows] of bySeries) {
    for (const row of rows) {
      const level = levelOf(row.NIVNOME); if (!level) continue;
      const year = Number(row.VALDATA.slice(0, 4));
      const code = level === 'BRASIL' ? '1' : row.TERCODIGO;
      const k = `${level}|${code}|${year}`;
      const entry = merged.get(k) ?? { level, code, year }; entry[key] = row.VALVALOR; merged.set(k, entry);
    }
  }

  const rows = [...merged.values()].filter(m => m.idhm != null);
  console.log(`territórios/anos com IDHM: ${rows.length} (esperado: ~5594 territórios x 3 anos)`);
  const incomplete = rows.filter(m => m.idhm_renda == null || m.idhm_longevidade == null || m.idhm_educacao == null);
  if (incomplete.length) console.log(`atenção: ${incomplete.length} linhas sem as 3 dimensões completas (seguem com o que houver)`);

  const BATCH = 2000; // 8 params/linha; limite do protocolo Postgres é 65535 params por query.
  for (let start = 0; start < rows.length; start += BATCH) {
    const chunk = rows.slice(start, start + BATCH);
    const values: unknown[] = []; const placeholders: string[] = []; let i = 0;
    for (const m of chunk) {
      const sourceHash = crypto.createHash('sha256').update(`${m.level}|${m.code}|${m.year}|${m.idhm}`).digest();
      values.push(m.level, m.code, m.year, m.idhm, m.idhm_renda ?? null, m.idhm_longevidade ?? null, m.idhm_educacao ?? null, sourceHash);
      placeholders.push(`($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`);
    }
    await pool.query(
      `INSERT INTO civica_exec.exec_idhm_territory
         (territory_level, territory_code, year, idhm, idhm_renda, idhm_longevidade, idhm_educacao, source_hash)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (territory_level, territory_code, year) DO UPDATE SET
         idhm = EXCLUDED.idhm, idhm_renda = EXCLUDED.idhm_renda, idhm_longevidade = EXCLUDED.idhm_longevidade,
         idhm_educacao = EXCLUDED.idhm_educacao, source_hash = EXCLUDED.source_hash, collected_at = now()`,
      values,
    );
  }

  const summary = (await pool.query(
    `SELECT territory_level, count(*)::int n, min(year) min_year, max(year) max_year FROM civica_exec.exec_idhm_territory GROUP BY territory_level ORDER BY territory_level`,
  )).rows;
  console.log('resumo:', summary);
  await pool.end();
}

await main();
