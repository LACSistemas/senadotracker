import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { fetchBundle, fetchEntes, latestBimester, type Anexo } from '../../apps/collector/src/exec/siconfi.ts';
import { UF_CODE } from '../../apps/collector/src/exec/cnes.ts';
import { openPool } from './db.ts';

/**
 * Coleta RAW do Siconfi (P9.5). Uso: node --import tsx scripts/exec/financas-fetch.ts <dca-ie|dca-ig|rreo02> <ano1,ano2|a-b> [UF,UF|all] [concorrência]
 * Grava pacotes em D:\Civica\raw\siconfi (retomável). Não publica nada.
 * RREO Anexo 02 só existe para quem publica o RREO completo (estados, DF, União e municípios ≥ 50 mil hab.; os demais publicam o simplificado, sem função): o universo é a população ≥ 45 mil.
 */
const [kind, yearsArg, ufArg, concArg] = process.argv.slice(2);
const anexo: Anexo = kind === 'dca-ie' ? 'DCA-Anexo I-E' : kind === 'dca-ig' ? 'DCA-Anexo I-G' : kind === 'rreo02' ? 'RREO-Anexo 02' : (() => { throw new Error('kind inválido'); })();
const years = (yearsArg ?? '').includes('-') ? (() => { const [a, b] = yearsArg!.split('-').map(Number); return Array.from({ length: b! - a! + 1 }, (_, i) => b! - i); })() : (yearsArg ?? '').split(',').map(Number);
const ufs = !ufArg || ufArg === 'all' ? [...Object.keys(UF_CODE), 'BR'] : ufArg.split(',').map(s => s.toUpperCase());
/** Universo municipal por anexo: DCA I-E = todos; RREO 02 = ≥ 45 mil (só quem publica o RREO completo); DCA I-G (restos a pagar por função) = ≥ 100 mil, recorte de custo/benefício (estados e União sempre). */
const minPop = anexo === 'DCA-Anexo I-E' ? 0 : anexo === 'RREO-Anexo 02' ? 45000 : 100000;
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `financas-fetch-${kind}.jsonl`), m + '\n'); };
const pool = openPool(2);
try {
  const { entes } = await fetchEntes(pool, cfg);
  for (const year of years) {
    const periodo = anexo.startsWith('RREO') ? latestBimester(year) : 0; if (anexo.startsWith('RREO') && periodo === 0) continue;
    for (const uf of ufs) {
      const ufNum = uf === 'BR' ? 0 : UF_CODE[uf]!; const ufOf = (e: typeof entes[number]) => e.esfera === 'U' ? 0 : e.esfera === 'M' ? UF_CODE[e.uf] : e.cod_ibge;   // estados/DF vêm com uf = 'BR'/null: a UF é o próprio código do ente
      const list = entes.filter(e => ufOf(e) === ufNum)
        .filter(e => e.esfera !== 'M' || (e.populacao ?? 0) >= minPop).map(e => e.cod_ibge);
      if (!list.length) continue;
      const t0 = Date.now(); const r = await fetchBundle(pool, cfg, { anexo, year, uf: uf === 'BR' ? 0 : UF_CODE[uf]!, entes: list, periodo, concurrency: Number(concArg ?? 3), log });
      log(JSON.stringify({ done: true, year, uf, entes: list.length, reused: r.reused, empty: r.empty, s: Math.round((Date.now() - t0) / 1000) }));
    }
  }
} finally { await pool.end(); }
