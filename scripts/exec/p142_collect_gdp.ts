import crypto from 'node:crypto';
import { openPool } from './db.ts';

/** P14.2 — PIB a preços correntes (IBGE/SIDRA, tabela 5938, variável 37), Brasil + UF + município, 2002–2023.
 * Fonte pública, sem autenticação. Uma consulta por ano cobre os três níveis territoriais ao mesmo tempo
 * (n1/1 + n3/all + n6/all), confirmado real: 5.598 linhas por ano (1 Brasil + 27 UF + 5.570 municípios). */
const YEARS = Array.from({ length: 2023 - 2002 + 1 }, (_, i) => 2002 + i);
const TABLE = 5938; const VARIABLE = 37;

type SidraRow = { NC: string; D1C: string; D1N: string; D3C: string; V: string };

async function fetchYear(year: number): Promise<SidraRow[]> {
  const url = `https://apisidra.ibge.gov.br/values/t/${TABLE}/n1/1/n3/all/n6/all/v/${VARIABLE}/p/${year}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'civica-exec/1.0 (pesquisa de dados abertos)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as unknown[];
      return (data.slice(1) as SidraRow[]);
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(res => setTimeout(res, 800 * attempt));
    }
  }
  throw new Error('unreachable');
}

function levelOf(nc: string): 'BRASIL' | 'UF' | 'MUNICIPIO' | null {
  if (nc === '1') return 'BRASIL'; if (nc === '3') return 'UF'; if (nc === '6') return 'MUNICIPIO'; return null;
}

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  let totalRows = 0; const perYear: Array<{ year: number; rows: number }> = [];
  for (const year of YEARS) {
    const rows = await fetchYear(year);
    const values: unknown[] = []; const placeholders: string[] = [];
    let i = 0;
    for (const row of rows) {
      const level = levelOf(row.NC); if (!level) continue;
      const gdp = Number(row.V); if (!Number.isFinite(gdp)) continue;
      const sourceHash = crypto.createHash('sha256').update(`${level}|${row.D1C}|${year}|${row.V}`).digest();
      values.push(level, row.D1C, row.D1N, year, gdp, sourceHash);
      placeholders.push(`($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`);
    }
    if (placeholders.length) {
      await pool.query(
        `INSERT INTO civica_exec.exec_gdp_territory (territory_level, territory_code, territory_name, year, gdp_thousand_reais, source_hash)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (territory_level, territory_code, year) DO UPDATE SET
           territory_name = EXCLUDED.territory_name, gdp_thousand_reais = EXCLUDED.gdp_thousand_reais,
           source_hash = EXCLUDED.source_hash, collected_at = now()`,
        values,
      );
    }
    totalRows += placeholders.length;
    perYear.push({ year, rows: placeholders.length });
    console.log(`ano ${year}: ${placeholders.length} linhas`);
  }

  const summary = (await pool.query(`
    SELECT territory_level, count(*)::int n, min(year) min_year, max(year) max_year
    FROM civica_exec.exec_gdp_territory GROUP BY territory_level ORDER BY territory_level
  `)).rows;
  console.log('\nResumo final por nível territorial:', JSON.stringify(summary, null, 2));
  console.log('Total de linhas inseridas/atualizadas nesta execução:', totalRows);
  await pool.end();
}

await main();
