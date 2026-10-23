import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CRIME_DEF_BY_ID, CRIME_SOURCES, OC_BY_INDICATOR } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Inventário consolidado do domínio Segurança para a P9.8 (somente SELECT): matriz de indicadores, cobertura por município-caso e contrato dos read models.
 *   npx tsx scripts/exec/security-matrix.ts <pasta de saída>
 */
const out = process.argv[2]; if (!out) throw new Error('informe a pasta');
const csv = (rows: Array<Array<string | number | null>>) => rows.map(r => r.map(v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)).join(',')).join('\n') + '\n';
type Wave = { key: string; label: string; a: number; b: number; readModels: string[]; periodicity: string };
const WAVES: Wave[] = [
  { key: 'P9.1', label: 'Criminalidade nacional (SIM/VDE)', a: 3001, b: 3299, readModels: ['getSegState', 'getSegMunicipality'], periodicity: 'mensal (VDE) / anual (SIM)' },
  { key: 'P9.2', label: 'Trânsito e segurança viária', a: 4000, b: 4999, readModels: ['getTrafficState', 'getTrafficMunicipality'], periodicity: 'mensal/anual conforme fonte' },
  { key: 'P9.3', label: 'Efetivos e estrutura policial', a: 5001, b: 5399, readModels: ['getSecurityStaffingNational', 'getSecurityStaffingState', 'getSecurityStructureMunicipality'], periodicity: 'edição (FBSP 2025, ESTADIC 2018/2022, MUNIC 2019/2023)' },
  { key: 'P9.4', label: 'Sistema prisional', a: 6000, b: 6999, readModels: ['getPrisonNational', 'getPrisonState', 'getPrisonMunicipality'], periodicity: 'semestral (SISDEPEN)' },
  { key: 'P9.5', label: 'Finanças da Segurança', a: 7000, b: 7999, readModels: ['getSecurityFinanceNational', 'getSecurityFinanceState', 'getSecurityFinanceMunicipality', 'getSecurityFinanceUnion', 'getSecurityFinanceOrgans'], periodicity: 'anual (DCA), bimestral (RREO), mensal (PNCP)' },
  { key: 'P9.6', label: 'Criminalidade estadual municipalizada', a: 8000, b: 8999, readModels: ['getStateCrimeState', 'getStateCrimeMunicipality'], periodicity: 'mensal por fonte estadual' },
];
const CASES: Array<[string, number]> = [['Vitória/ES', 3205309], ['Serra/ES', 3205002], ['Alto Rio Novo/ES', 3200359], ['São Paulo/SP', 3550308], ['Rio de Janeiro/RJ', 3304557], ['Belo Horizonte/MG', 3106200], ['Recife/PE', 2611606], ['Porto Alegre/RS', 4314902], ['Salvador/BA (sem fonte estadual)', 2927408], ['Curitiba/PR (sem fonte estadual)', 4106902]];
const pool = openPool(2);
try {
  const bandOf = (id: number) => WAVES.find(w => id >= w.a && id <= w.b);
  const defs = (await pool.query(`SELECT indicator_id, code, label, unit, grain, ranking_allowed, aggregation_allowed FROM civica_exec.exec_ind_def WHERE indicator_id >= 3001 ORDER BY 1`)).rows;
  const cov = new Map((await pool.query(`SELECT v.indicator_id, count(*)::int n, count(DISTINCT e.uf_code)::int ufs, count(DISTINCT v.entity_id) FILTER (WHERE e.kind = 4)::int muns, min(v.period_start)::text a, max(v.period_start)::text b,
      count(*) FILTER (WHERE (v.flags & 2) <> 0)::int prelim, count(*) FILTER (WHERE (v.flags & 8) <> 0)::int supp, count(*) FILTER (WHERE v.value IS NULL)::int nulls
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id >= 3001 GROUP BY 1`)).rows.map(r => [Number(r.indicator_id), r]));
  const rows: Array<Array<string | number | null>> = [['indicator_id', 'onda', 'codigo', 'rotulo', 'unidade', 'fonte', 'linhas', 'ufs_com_dado', 'municipios_com_dado', 'primeiro_periodo', 'ultimo_periodo', 'preliminares', 'suprimidas', 'comparabilidade', 'classificacao_pagina_uf', 'classificacao_pagina_municipio', 'read_model', 'familia_p97']];
  const tally: Record<string, Record<string, number>> = {};
  for (const d of defs) {
    const id = Number(d.indicator_id); const w = bandOf(id); if (!w) continue; const c = cov.get(id); const crime = CRIME_DEF_BY_ID.get(id); const oc = OC_BY_INDICATOR.get(id);
    const muns = c?.muns ?? 0; const srcName = crime?.source ?? (String(d.code).includes('-VDE-') ? 'VDE' : String(d.code).includes('-SIM-') ? 'SIM' : w.key);
    const stateSource = !!crime; const composite = !!crime?.composite; const sensitive = !!crime?.sensitive || (c?.supp ?? 0) > 0;
    const cmp = crime ? crime.comparability : 'DENTRO_DA_FONTE';
    let uf: string, mun: string;
    if (!c) { uf = 'NOT_READY'; mun = 'NOT_READY'; }
    else {
      uf = composite || sensitive || stateSource ? 'READY_WITH_CAVEATS' : 'READY_FOR_FRONTEND';
      mun = muns >= 1000 ? (sensitive ? 'READY_WITH_CAVEATS' : 'READY_FOR_FRONTEND') : muns > 0 ? 'READY_WITH_CAVEATS' : 'CONTEXT_ONLY';
      if (w.key === 'P9.3' || w.key === 'P9.4') { if (muns === 0) mun = 'CONTEXT_ONLY'; uf = 'READY_WITH_CAVEATS'; }
      if (w.key === 'P9.5') { uf = 'READY_WITH_CAVEATS'; if (mun !== 'CONTEXT_ONLY') mun = 'READY_WITH_CAVEATS'; }
    }
    (tally[w.key] ??= {})[uf] = (tally[w.key]![uf] ?? 0) + 1;
    rows.push([id, w.key, d.code, d.label, d.unit, srcName, c?.n ?? 0, c?.ufs ?? 0, muns, c?.a?.slice(0, 7) ?? null, c?.b?.slice(0, 7) ?? null, c?.prelim ?? 0, c?.supp ?? 0, cmp, uf, mun, w.readModels.join(' | '), oc ? oc.family.code : null]);
  }
  await writeFile(join(out, 'MATRIZ_INDICADORES_SEGURANCA_P98.csv'), csv(rows));
  // casos de prontidão: séries por município e onda
  const cases: Record<string, unknown> = {};
  for (const [name, ibge] of CASES) {
    const r = await pool.query(`SELECT v.indicator_id, count(*)::int n, max(v.period_start)::text last, bool_or((v.flags & 8) <> 0) supp FROM civica_exec.exec_ind_value v WHERE v.entity_id = $1 AND v.indicator_id >= 3001 GROUP BY 1`, [ibge]);
    const by: Record<string, { indicadores: number; pontos: number; ultimo: string | null; suprimidas: boolean }> = {};
    for (const x of r.rows) { const w = bandOf(Number(x.indicator_id)); if (!w) continue; const b = by[w.key] ??= { indicadores: 0, pontos: 0, ultimo: null, suprimidas: false }; b.indicadores++; b.pontos += Number(x.n); if (!b.ultimo || String(x.last) > b.ultimo) b.ultimo = String(x.last).slice(0, 7); b.suprimidas ||= !!x.supp; }
    const uf = Math.floor(ibge / 100000); const srcUf = CRIME_SOURCES.find(s => s.ufCode === uf);
    const stateRows = Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id BETWEEN 8000 AND 8999`, [uf])).rows[0].n);
    cases[name] = { ibge7: ibge, porOnda: by, fonteEstadualPublicadaParaUF: srcUf && stateRows > 0 ? srcUf.key : null, linhasP96NoNivelUF: stateRows, leitura: srcUf && stateRows > 0 && !by['P9.6'] ? 'município sem linha na fonte estadual (ausência ≠ zero) — mostrar contexto da UF' : by['P9.6'] ? 'município com série estadual municipalizada' : 'UF sem fonte estadual publicada — usar VDE (UF) como contexto' };
  }
  await writeFile(join(out, 'prontidao_casos_p98.json'), JSON.stringify({ geradoEm: new Date().toISOString(), casos: cases, resumoClassificacaoUF: tally }, null, 2));
  console.log(JSON.stringify({ tally }));
} finally { await pool.end(); }
