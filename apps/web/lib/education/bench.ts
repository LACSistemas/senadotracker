import {
  higherEdMunicipalBench, higherEdUfBench, capesMunicipalBench, capesUfBench, enemMunicipalBench, enemUfBench,
  saebMunicipalBench, saebUfBench, idebMunicipalBench, idebUfBench, flowAbandonoMunicipalBench, flowAbandonoUfBench,
  type HigherEdBenchMetric,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { rulerOf } from '@/lib/security/bench';
import { stateDe } from '@/lib/security/catalog';
import { benchView } from '@/lib/security/series';
import type { Ruler } from '@/lib/security/types';
import type { EduScope } from './types';

/**
 * Réguas de ESCALA para Ensino Superior e CAPES (nº de IES, matrículas, vagas, programas de pós-graduação): município ×
 * municípios da mesma UF, ou UF × as 27 UFs. Nunca qualidade — IGC/CPC/Enade/IDD não entram numa régua de comparação
 * (ver `quality-highlights`): misturar porte com qualidade produziria uma comparação inválida.
 */
const toRuler = (p: { period: string; p25: number; p50: number; p75: number; n: number; universe: number } | null, cohort: string, own: number, digits: number, unit: string): Ruler | null =>
  p ? rulerOf(benchView({ label: '', cohort, basis: '', points: [{ t: p.period, p25: p.p25, p50: p.p50, p75: p.p75, n: p.n, universe: p.universe }] }), { t: p.period, v: own }, { digits, unit }) : null;

export async function higherEdRuler(scope: EduScope, year: number, metric: HigherEdBenchMetric, own: number | null, opts: { digits: number; unit: string }): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await higherEdUfBench(pool, { year, metric }); return toRuler(p, 'unidades da federação', own, opts.digits, opts.unit); }
  const p = await higherEdMunicipalBench(pool, { ufCode: scope.ufCode, year, metric }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)} com oferta de ensino superior`, own, opts.digits, opts.unit);
}

export async function capesRuler(scope: EduScope, year: number, own: number | null): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await capesUfBench(pool, { year }); return toRuler(p, 'unidades da federação', own, 0, 'programas'); }
  const p = await capesMunicipalBench(pool, { uf: scope.uf, year }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)} com programa de pós-graduação`, own, 0, 'programas');
}

/**
 * Réguas dos 3 KPIs do herói que são TAXAS/notas (comparáveis entre territórios de porte diferente): Saeb (matemática, 5º
 * ano), Ideb (anos iniciais) e abandono (fundamental). Só compara na MESMA rede (`dep`) que o território próprio exibe —
 * nunca mistura "todas as redes" com um recorte de rede específico no mesmo benchmark. Matrículas (contagem bruta) não
 * entra aqui: comparar o número absoluto de alunos entre cidades de porte diferente não é um benchmark válido.
 */
export async function saebRuler(scope: EduScope, year: number, subj: number, grade: number, dep: number, own: number | null): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await saebUfBench(pool, { year, subj, grade, dep }); return toRuler(p, 'unidades da federação', own, 0, 'pontos'); }
  const p = await saebMunicipalBench(pool, { ufCode: scope.ufCode, year, subj, grade, dep }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)}`, own, 0, 'pontos');
}
export async function idebRuler(scope: EduScope, year: number, stage: number, dep: number, own: number | null): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await idebUfBench(pool, { year, stage, dep }); return toRuler(p, 'unidades da federação', own, 1, ''); }
  const p = await idebMunicipalBench(pool, { ufCode: scope.ufCode, year, stage, dep }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)}`, own, 1, '');
}
export async function abandonoRuler(scope: EduScope, year: number, own: number | null): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await flowAbandonoUfBench(pool, { year }); return toRuler(p, 'unidades da federação', own, 1, '%'); }
  const p = await flowAbandonoMunicipalBench(pool, { ufCode: scope.ufCode, year }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)}`, own, 1, '%');
}

/** Régua da nota média do Enem numa disciplina: município × municípios da UF, ou UF × as 27 UFs. Só rede "todas" e células não suprimidas. */
export async function enemRuler(scope: EduScope, edition: number, subject: string, own: number | null): Promise<Ruler | null> {
  if (own == null) return null; const pool = webPostgresPool();
  if (scope.kind === 'uf') { const p = await enemUfBench(pool, { edition, subject }); return toRuler(p, 'unidades da federação', own, 1, 'pontos'); }
  const p = await enemMunicipalBench(pool, { ufCode: scope.ufCode, edition, subject }); return toRuler(p, `municípios ${stateDe(scope.uf, scope.stateName)} com nota publicada`, own, 1, 'pontos');
}
