import { streamTseCsv } from '../../apps/collector/src/elections.ts';
import { openPool } from './db.ts';

/** Carrega a correspondência oficial TSE↔IBGE de municípios (fonte: TSE, dataset "Códigos oficiais de UF e
 * municípios segundo o TSE e o IBGE", cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/) em
 * exec_entity_external_id com source = 3 (código TSE do município, 5 dígitos — o mesmo valor de SG_UE nos
 * arquivos consulta_cand). Resolve a lacuna "tabela IBGE↔SG_UE inexistente" registrada nas investigações
 * anteriores (P5/P6/P7) — a tabela existe, publicada pelo próprio TSE; só não tinha sido localizada. */
const FILE = 'D:/Civica/tse-raw/ref/municipio_tse_ibge.csv';
const HEADERS = ['DT_GERACAO', 'HH_GERACAO', 'CD_UF_TSE', 'CD_UF_IBGE', 'SG_UF', 'NM_UF', 'CD_MUNICIPIO_TSE', 'NM_MUNICIPIO_TSE', 'CD_MUNICIPIO_IBGE', 'NM_MUNICIPIO_IBGE'] as const;

async function main() {
  const pool = openPool(2);
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const rows: Array<{ tseCode: string; ibge7: number }> = [];
  for await (const row of streamTseCsv(FILE, HEADERS)) {
    const tseCode = row.CD_MUNICIPIO_TSE!.trim();
    const ibge7 = Number(row.CD_MUNICIPIO_IBGE);
    if (!tseCode || !Number.isInteger(ibge7)) throw new Error(`Linha inválida: ${JSON.stringify(row)}`);
    rows.push({ tseCode, ibge7 });
  }
  console.log(`linhas lidas: ${rows.length}`);

  const known = new Set((await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 4`)).rows.map(r => Number(r.entity_id)));
  const unknownIbge = rows.filter(r => !known.has(r.ibge7));
  console.log(`ibge7 não encontrados em exec_entity: ${unknownIbge.length}`, unknownIbge.slice(0, 10));
  if (unknownIbge.length) throw new Error('Correspondência TSE→IBGE aponta para entity_id inexistente; investigar antes de carregar.');

  const dupTse = rows.length - new Set(rows.map(r => r.tseCode)).size;
  if (dupTse) throw new Error(`código TSE duplicado: ${dupTse} repetições`);

  const values: unknown[] = []; const placeholders: string[] = []; let i = 0;
  for (const r of rows) {
    values.push(3, r.tseCode, r.ibge7);
    placeholders.push(`($${++i}, $${++i}, $${++i})`);
  }
  await pool.query(
    `INSERT INTO civica_exec.exec_entity_external_id (source, code, entity_id)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (source, code, valid_from) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
    values,
  );

  const n = (await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_entity_external_id WHERE source = 3`)).rows[0];
  console.log('resumo source=3:', n);
  await pool.end();
}

await main();
