import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';

/**
 * Cobertura nacional por dataset × UF × competência (esperado × publicado), a partir de exec_publication/exec_ingestion_run/exec_raw_manifest.
 * Estados: PUBLISHED, PUBLISHED_WITH_CAVEATS (stage preliminar ou ressalva de qualidade), NOT_COLLECTED, METHODOLOGY_PENDING, SOURCE_UNAVAILABLE.
 * Uso: node --import tsx scripts/exec/coverage-report.ts <pasta-de-saída>
 */
const out = process.argv[2] ?? 'docs/executivo-collector-plan/execucao/saude-nacional-p1';
const UFS: Array<[number, string]> = [[11, 'RO'], [12, 'AC'], [13, 'AM'], [14, 'RR'], [15, 'PA'], [16, 'AP'], [17, 'TO'], [21, 'MA'], [22, 'PI'], [23, 'CE'], [24, 'RN'], [25, 'PB'], [26, 'PE'], [27, 'AL'], [28, 'SE'], [29, 'BA'], [31, 'MG'], [32, 'ES'], [33, 'RJ'], [35, 'SP'], [41, 'PR'], [42, 'SC'], [43, 'RS'], [50, 'MS'], [51, 'MT'], [52, 'GO'], [53, 'DF']];
const ymRange = (a: number, b: number) => { const r: number[] = []; for (let c = a; c <= b; c = c % 100 === 12 ? c + 89 : c + 1) r.push(c); return r; };
const years = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => (a + i) * 100 + 1);
const decs = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => (a + i) * 100 + 12);
interface Grid { id: number; fonte: string; dataset: string; national: boolean; comps: number[]; rawLike: string; pending?: 'METHODOLOGY_PENDING' | 'SOURCE_UNAVAILABLE' }
const grids: Grid[] = [
  { id: 3, fonte: 'DATASUS CNES', dataset: 'cnes_st', national: false, comps: ymRange(201301, 202609), rawLike: 'datasus/cnes/ST/%' },
  { id: 4, fonte: 'DATASUS CNES', dataset: 'cnes_lt', national: false, comps: ymRange(201301, 202609), rawLike: 'datasus/cnes/LT/%' },
  { id: 5, fonte: 'DATASUS CNES', dataset: 'cnes_eq', national: false, comps: ymRange(201301, 202609), rawLike: 'datasus/cnes/EQ/%' },
  { id: 6, fonte: 'DATASUS CNES', dataset: 'cnes_pf', national: false, comps: [...decs(2013, 2025), 202609], rawLike: 'datasus/cnes/PF/%' },
  { id: 7, fonte: 'DATASUS SIM', dataset: 'sim', national: false, comps: years(2013, 2025), rawLike: 'datasus/sim/%' },
  { id: 8, fonte: 'DATASUS SINASC', dataset: 'sinasc', national: false, comps: years(2013, 2025), rawLike: 'datasus/sinasc/%' },
  { id: 10, fonte: 'DATASUS SIH-RD', dataset: 'sih_hospital', national: false, comps: ymRange(201301, 202607), rawLike: 'datasus/sih-rd/%' },
  { id: 11, fonte: 'DATASUS SIH-RD', dataset: 'sih_residencia', national: true, comps: ymRange(201301, 202607), rawLike: 'datasus/sih-rd/%' },
];
const pool = openPool(2);
try {
  const pubs = (await pool.query(`SELECT p.dataset_id, p.uf, p.competence, p.row_count, p.stage, p.state, p.activated_at, p.run_id, encode(p.source_hash,'hex') sh, r.parser_version, r.quality
    FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r USING (run_id) WHERE p.dataset_id IN (3,4,5,6,7,8,9,10,11)`)).rows;
  const key = (d: number, u: number, c: number) => `${d}:${u}:${c}`;
  const byKey = new Map(pubs.map(p => [key(Number(p.dataset_id), Number(p.uf), Number(p.competence)), p]));
  const man = (await pool.query(`SELECT rel_path, uf, competence FROM civica_exec.exec_raw_manifest`)).rows;
  const rawHas = (like: string, uf: number, comp: number) => { const pre = like.replace('%', ''); return man.some(m => String(m.rel_path).startsWith(pre) && (Number(m.uf) === uf || Number(m.uf) === 0) && (m.competence === null || Number(m.competence) === comp || like.includes('sim') || like.includes('sinasc'))); };
  const rows: string[] = ['fonte,dataset,uf,competencia,status,registros,valor_controle,source_hash,run_id,publicacao_ativa,raw_disponivel,ultima_atualizacao,parser'];
  const sum: Record<string, { esperado: number; publicado: number; ressalva: number; ausente: number }> = {};
  const add = (g: string, st: string) => { const s = sum[g] ??= { esperado: 0, publicado: 0, ressalva: 0, ausente: 0 }; s.esperado++; if (st === 'PUBLISHED') s.publicado++; else if (st === 'PUBLISHED_WITH_CAVEATS') s.ressalva++; else s.ausente++; };
  for (const g of grids) {
    for (const [uc, us] of g.national ? [[0, 'BR'] as [number, string]] : UFS) {
      for (const c of g.comps) {
        const p = byKey.get(key(g.id, uc, c));
        let st = 'NOT_COLLECTED';
        if (p) st = Number(p.stage) === 1 || (p.quality as { aihDroppedNoTerritory?: number } | null)?.aihDroppedNoTerritory ? 'PUBLISHED_WITH_CAVEATS' : 'PUBLISHED';
        add(g.dataset, st);
        rows.push([g.fonte, g.dataset, us, c, st, p?.row_count ?? '', '', p?.sh ?? '', p?.run_id ?? '', p ? p.state === 1 : false, p ? rawHas(g.rawLike, uc === 0 ? 0 : uc, c) : false, p ? new Date(p.activated_at).toISOString() : '', p?.parser_version ?? ''].join(','));
      }
    }
  }
  // PNI: uma fatia por UF (competência = mês da carga)
  for (const [uc, us] of UFS) {
    const p = pubs.find(x => Number(x.dataset_id) === 9 && Number(x.uf) === uc);
    const st = p ? 'PUBLISHED_WITH_CAVEATS' : 'NOT_COLLECTED'; add('pni', st);
    rows.push(['DATASUS SI-PNI', 'pni', us, p?.competence ?? '', st, p?.row_count ?? '', '', p?.sh ?? '', p?.run_id ?? '', !!p, !!p, p ? new Date(p.activated_at).toISOString() : '', p?.parser_version ?? ''].join(','));
  }
  // APS e Siconfi: sem publicação por decisão metodológica
  for (const [uc, us] of UFS) { add('aps', 'METHODOLOGY_PENDING'); rows.push(['e-Gestor APS', 'aps', us, '', uc === 32 ? 'METHODOLOGY_PENDING' : 'NOT_COLLECTED', '', '', '', '', false, uc === 32, '', ''].join(',')); add('siconfi', 'METHODOLOGY_PENDING'); rows.push(['Siconfi', 'siconfi', us, '', 'METHODOLOGY_PENDING', '', '', '', '', false, uc === 32, '', ''].join(',')); }
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'cobertura_nacional.csv'), rows.join('\n') + '\n');
  const munis = (await pool.query(`SELECT d.code, count(DISTINCT v.entity_id) FILTER (WHERE e.kind = 4)::int municipios, count(*)::int valores, min(v.period_start)::text de, max(v.period_start)::text ate FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) JOIN civica_exec.exec_entity e USING (entity_id) GROUP BY d.code ORDER BY d.code`)).rows;
  const cnes = (await pool.query(`SELECT count(*) FILTER (WHERE valid_to IS NULL)::int vigentes, count(DISTINCT cnes)::int distintos FROM civica_exec.exec_sau_cnes_estab_v`)).rows[0];
  await writeFile(join(out, '_cobertura_resumo.json'), JSON.stringify({ geradoEm: new Date().toISOString(), porDataset: sum, indicadores: munis, cnes }, null, 2));
  console.log(JSON.stringify(sum));
} finally { await pool.end(); }
