import { openPool } from './db.ts';
import { parseFederalExecutives, writeFederalExecutives, mirrorFederalExecutivePhotos } from '../../apps/collector/src/federal-executive.ts';

// Fotos ficam no diretório padrão (data/portraits/, git-ignored) — mesmo lugar de todos os outros
// retratos (deputados, senadores, assembleias). São poucos KB cada e nunca vão pro Postgres (só a linha
// de metadado); não há razão pra desviar pro D: só pra este coletor — isso só quebraria a rota
// /api/portrait, que resolve pelo diretório padrão a menos que PORTRAIT_DIR esteja configurado (não está,
// no servidor de dev deste ambiente).
const YEARS: Array<{ year: number; file: string }> = [
  { year: 2022, file: 'D:\\Civica\\tse-raw\\2022\\consulta_cand_2022_BRASIL.csv' },
  { year: 2026, file: 'D:\\Civica\\tse-raw\\2026\\consulta_cand_2026_BR.csv' },
];

const pool = openPool(1);
try {
  for (const { year, file } of YEARS) {
    const rows = await parseFederalExecutives(file, year);
    console.log(`${year}: ${rows.length} candidaturas eleitas`, rows.map(r => `${r.role} ${r.ballotName} (${r.party}) turno ${r.electedRound}`));
    await writeFederalExecutives(pool, rows);
    const photoResults = await mirrorFederalExecutivePhotos(pool, rows);
    console.log(`${year} fotos:`, photoResults);
  }
} finally {
  await pool.end();
}
