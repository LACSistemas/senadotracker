import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OFFER_MEASURES } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Relatórios de oferta publicada (P10.2), somente leitura. EXEC_DATABASE_URL aponta para banco de teste quando definido.
 *   npx tsx scripts/exec/educacao-oferta-report.ts <pasta_saida> <pasta_sinopse_json> <reconciliacao.json>
 * Gera COBERTURA_EDUCACAO_P102.csv (edição × UF: linhas, rejeições, escolas com matrícula/turma, bit0 do cadastro, totais e comparação com a Sinopse 1.2/4.2 por UF) e MATRIZ_INDICADORES_P102.csv (uma linha por medida, com histórico real e cobertura).
 */
const [outDir, sinDir, reconPath] = process.argv.slice(2);
if (!outDir || !sinDir || !reconPath) throw new Error('uso: educacao-oferta-report.ts <saida> <sinopse_json> <reconciliacao.json>');
const UF_NAME: Record<number, string> = { 11: 'Rondônia', 12: 'Acre', 13: 'Amazonas', 14: 'Roraima', 15: 'Pará', 16: 'Amapá', 17: 'Tocantins', 21: 'Maranhão', 22: 'Piauí', 23: 'Ceará', 24: 'Rio Grande do Norte', 25: 'Paraíba', 26: 'Pernambuco', 27: 'Alagoas', 28: 'Sergipe', 29: 'Bahia', 31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 41: 'Paraná', 42: 'Santa Catarina', 43: 'Rio Grande do Sul', 50: 'Mato Grosso do Sul', 51: 'Mato Grosso', 52: 'Goiás', 53: 'Distrito Federal' };
const csv = (rows: Array<Record<string, unknown>>) => rows.length ? [Object.keys(rows[0]!).join(','), ...rows.map(r => Object.values(r).map(v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)).join(','))].join('\n') + '\n' : '';
const pool = openPool(2);
try {
  const recon = JSON.parse(await readFile(reconPath, 'utf8')) as Record<string, { tabelas: Record<string, { divergentes_municipio?: number; ufs_divergentes?: number } | string> }>;
  const rows = (await pool.query(`
    SELECT c.year, c.uf, c.layout, c.rows_in, c.valid, c.rejected, c.with_mat, c.with_tur, c.only_tur, e.with_mat AS cad_with_mat,
      coalesce(a.mat, 0)::bigint mat, coalesce(a.tur, 0)::bigint tur, coalesce(a.schools, 0)::int schools
    FROM civica_exec.exec_edu_offer_cov c
    LEFT JOIN civica_exec.exec_edu_cov e ON e.year = c.year AND e.uf = c.uf
    LEFT JOIN (SELECT year, uf, sum(mat_bas) mat, sum(tur_bas) tur, sum(schools) schools FROM civica_exec.exec_edu_offer_agg GROUP BY year, uf) a ON a.year = c.year AND a.uf = c.uf
    ORDER BY c.year, c.uf`)).rows;
  const sin = new Map<number, { t12?: { ufs: Record<string, { E: number }> }; t42?: { ufs: Record<string, { E: number }> } }>();
  for (let y = 2007; y <= 2025; y++) { const o: { t12?: never; t42?: never } = {}; for (const t of ['t12', 't42']) { try { (o as Record<string, unknown>)[t] = JSON.parse(await readFile(join(sinDir, `${t}_${y}.json`), 'utf8')); } catch { /* sem a tabela */ } } sin.set(y, o as never); }
  const cov = rows.map(r => {
    const s = sin.get(Number(r.year)); const name = UF_NAME[Number(r.uf)]!; const sm = s?.t12?.ufs[name]?.E, st = s?.t42?.ufs[name]?.E;
    const dm = sm == null ? null : Number(r.mat) - sm, dt = st == null ? null : Number(r.tur) - st; const ok = dm === 0 && dt === 0 && Number(r.rejected) === 0 && Number(r.with_mat) === Number(r.cad_with_mat);
    return { ano: r.year, uf: r.uf, uf_nome: name, layout: r.layout, escolas_lidas: r.rows_in, validas: r.valid, rejeitadas: r.rejected, escolas_com_matricula: r.with_mat, escolas_com_turma: r.with_tur, so_turma: r.only_tur, escolas_bit0_cadastro_p101: r.cad_with_mat,
      diferenca_bit0: Number(r.with_mat) - Number(r.cad_with_mat), matriculas_banco: r.mat, matriculas_sinopse_1_2: sm ?? '', diferenca_matriculas: dm ?? '', turmas_banco: r.tur, turmas_sinopse_4_2: st ?? '', diferenca_turmas: dt ?? '',
      status: sm == null ? 'PUBLICADO_SEM_CONFERENCIA_SINOPSE' : ok ? 'PUBLICADO_RECONCILIADO_SINOPSE' : 'PUBLICADO_COM_DIVERGENCIA' };
  });
  await writeFile(join(outDir, 'COBERTURA_EDUCACAO_P102.csv'), csv(cov));
  const years = [...new Set(rows.map(r => Number(r.year)))].sort();
  const yearOk = (y: number) => Object.entries(recon[String(y)]?.tabelas ?? {}).every(([t, v]) => typeof v !== 'string' && (y === 2025 && t === 't41' ? true : (v.divergentes_municipio ?? 0) === 0 && (v.ufs_divergentes ?? 0) === 0));
  const RECON = new Set(['mat_bas', 'mat_inf_cre', 'mat_inf_pre', 'mat_fund_ai', 'mat_fund_af', 'mat_med', 'mat_eja_fund', 'mat_eja_med', 'mat_prof', 'mat_esp_cc', 'mat_esp_ce', 'tur_bas', 'tur_inf_cre', 'tur_inf_pre', 'tur_fund_ai', 'tur_fund_af', 'tur_med', 'tur_eja', 'tur_eja_med', 'tur_prof', 'tur_esp_cc', 'tur_esp_ce']);
  const reconStatus = (code: string): string => code === 'tur_eja_fund' ? 'RECONCILIADO_18_EDICOES; 2025 DIVERGENCIA_EXPLICADA (a Sinopse atribui ao fundamental as 4.696 turmas de EJA sem etapa: total − médio)'
    : RECON.has(code) ? (years.every(yearOk) ? 'RECONCILIADO_TODAS_AS_EDICOES_SEM_DIVERGENCIA' : 'VER_RECONCILIACAO') : code === 'mat_prof_ni' || code === 'tur_prof_ni' ? 'DERIVADA_DE_MEDIDAS_RECONCILIADAS' : 'SEM_TABELA_DE_REFERENCIA_INCORPORADA';
  const nonNull = (await pool.query(`SELECT year, ${OFFER_MEASURES.filter(m => m.column !== '(derivada)').map(m => `count(${m.column})::int ${m.column}`).join(', ')} FROM civica_exec.exec_edu_offer_year GROUP BY year ORDER BY year`)).rows;
  const matrix = OFFER_MEASURES.map(m => {
    const first = nonNull.find(r => m.column === '(derivada)' || Number(r[m.column]) > 0);
    return { id: m.code, fonte: 'INEP Censo Escolar', campo_2007_2024: m.sourceColumn, campo_2025: m.sourceColumn.replace('QT_MAT_', 'Tabela_Matricula.QT_MAT_').replace('QT_TUR_', 'Tabela_Turma.QT_TUR_'), unidade: m.unit, definicao: m.definition, etapa: m.stage, modalidade: m.modality,
      aditividade: m.additivity, parte_de: m.partOf ?? '', granularidade: 'escola × edição; município; UF; Brasil', historico: m.column === '(derivada)' ? '2007-2025' : `${first ? first.year : m.validFrom}-2025`, valido_desde: m.validFrom, regra_ausencia: m.absence,
      regra_agregacao: m.aggregation, sobreposicao: m.overlap, edicoes_com_valor: m.column === '(derivada)' ? years.length : nonNull.filter(r => Number(r[m.column]) > 0).length, edicoes_publicadas: years.length,
      reconciliacao_sinopse: reconStatus(m.code), publicabilidade: m.publishable };
  });
  await writeFile(join(outDir, 'MATRIZ_INDICADORES_P102.csv'), csv(matrix));
  console.log(JSON.stringify({ coverageRows: cov.length, statuses: Object.fromEntries(cov.reduce((mp, r) => mp.set(r.status, (mp.get(r.status) ?? 0) + 1), new Map<string, number>())), matrixRows: matrix.length }));
} finally { await pool.end(); }
