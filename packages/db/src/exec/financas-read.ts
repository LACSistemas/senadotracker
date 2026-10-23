import type { Pool } from 'pg';
import { COV_NAME, FIN_DOMAIN, SEC_SUBFUNCTIONS } from './financas-defs.ts';

/**
 * Contratos de leitura das Finanças da Segurança Pública (P9.5) para as futuras páginas de estados e municípios. Somente SELECT; por entidade (índice
 * da PK de exec_fin_fact) e por exercício; nada carrega contratos nem credores para montar um resumo. TODA medida monetária devolve moeda, valor exato
 * (centavos, em texto: sem perda de precisão), estágio, período, fonte, ente executor, classificação, cobertura, revisão e limitações.
 * REGRAS (em `restrictions`): função 06 ≠ gasto das corporações; dotação, empenho, liquidação e pagamento são estágios do mesmo processo (nunca se somam);
 * restos a pagar inscritos não são pagamento; RREO é acumulado do exercício (nunca somar bimestres); estado e municípios não se somam; gasto estadual
 * não é atribuído a município; nenhum rateio por população, efetivo ou crime.
 */
type Q = Pick<Pool, 'query'>;
export const FIN_RESTRICTIONS = [
  'A medida é a despesa classificada pelo próprio ente na FUNÇÃO orçamentária 06 (Segurança Pública). Não é o gasto das corporações policiais: órgãos de segurança também executam Previdência e Administração, e a função 06 pode ser executada por órgão que não é secretaria de segurança.',
  'Dotação (planejamento), empenhado, liquidado e pago são estágios distintos do mesmo processo financeiro e nunca devem ser somados. Restos a pagar inscritos são saldo, não pagamento; pagamentos de restos a pagar de exercícios anteriores não estão nas despesas pagas do exercício.',
  'A DCA é a declaração anual do ente (fluxo do exercício, exceto intra-orçamentárias). O RREO é ACUMULADO do exercício até o bimestre do snapshot: não se somam bimestres e um exercício com bimestre < 6 é preliminar. DCA e RREO podem diferir por versão e escopo; a igualdade não é imposta.',
  'Despesa estadual e despesa municipal não se somam (há transferências entre esferas) e um município nunca recebe despesa do estado. O gasto do estado permanece estadual: não é rateado por população, efetivo, delegacias ou crimes.',
  'Ausência não é zero: ente que não declarou o demonstrativo no exercício não tem valor. Declaração sem a linha da função 06 (DECLARED_WITHOUT_FUNCTION) indica que o ente não registrou despesa na função, mas o Cívica não grava zero por inferência.',
  'A subfunção 122 (Administração Geral) concentra, em muitos entes, folha e custeio das corporações: "Policiamento" isolado não é o gasto das polícias. A despesa de pessoal da função 06 NÃO é publicada por ente (a DCA não cruza função × natureza).',
  'Variações são NOMINAIS (sem deflacionar); o Cívica não publica crescimento real. Valores por habitante só existem onde há população do mesmo ano na fundação territorial (2022 e 2023 não têm estimativa).',
];
const STAGE: Record<string, { label: string; kind: 'planejamento' | 'execucao' | 'restos_a_pagar_inscritos' }> = {
  EMP: { label: 'empenhada', kind: 'execucao' }, LIQ: { label: 'liquidada', kind: 'execucao' }, PAG: { label: 'paga', kind: 'execucao' },
  RPNP_INSC: { label: 'restos a pagar não processados inscritos', kind: 'restos_a_pagar_inscritos' }, RPP_INSC: { label: 'restos a pagar processados inscritos', kind: 'restos_a_pagar_inscritos' },
  DOT_INI: { label: 'dotação inicial', kind: 'planejamento' }, DOT_ATU: { label: 'dotação atualizada', kind: 'planejamento' },
  EMP_ATE: { label: 'empenhada (acumulada até o bimestre)', kind: 'execucao' }, LIQ_ATE: { label: 'liquidada (acumulada até o bimestre)', kind: 'execucao' }, EMP_NO: { label: 'empenhada no bimestre (fluxo)', kind: 'execucao' }, LIQ_NO: { label: 'liquidada no bimestre (fluxo)', kind: 'execucao' },
};
export interface Executor { entityId: number; name: string; kind: 'uniao' | 'estado' | 'municipio' }
export interface Money {
  currency: 'BRL'; cents: string; value: number; stage: string; stageKind: string; exercicio: number;
  period: { kind: 'ANUAL' | 'ACUMULADO_ATE_BIMESTRE' | 'FLUXO_NO_BIMESTRE' | 'MES'; bimestre?: number; month?: number };
  source: string; executor: Executor; classification: { funcao: string; subfuncao: string | null; label: string }; coverage: string; revision: { runId: number | null; publishedAt: string | null }; limitations: string[];
}
const KIND: Record<number, Executor['kind']> = { 1: 'uniao', 3: 'estado', 4: 'municipio' };
const SUB_LABEL = new Map<string, string>([...SEC_SUBFUNCTIONS, ['FU06', 'Demais subfunções'], ['06', 'Segurança Pública']]);
const iso = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString() : String(v);
async function entityOf(q: Q, where: string, arg: number): Promise<(Executor & { ufCode: number | null }) | null> {
  const r = await q.query(`SELECT entity_id, kind, name, uf_code FROM civica_exec.exec_entity WHERE ${where}`, [arg]); const x = r.rows[0]; if (!x) return null;
  return { entityId: Number(x.entity_id), name: String(x.name), kind: KIND[Number(x.kind)] ?? 'municipio', ufCode: x.uf_code == null ? null : Number(x.uf_code) };
}
interface FactRow { exercicio: number; periodo: number; conta: string; col: string; domain: number; valor: string }
const SRC = (domain: number) => domain === FIN_DOMAIN.colDcaIE ? 'Siconfi DCA, Anexo I-E (declaração anual)' : domain === FIN_DOMAIN.colRreo02 ? 'Siconfi RREO, Anexo 02' : 'Siconfi DCA, Anexo I-G';
async function revisions(q: Q, ufCode: number | null): Promise<Map<string, { runId: number; at: string | null }>> {
  const r = await q.query(`SELECT dataset_id, competence, run_id, activated_at FROM civica_exec.exec_publication WHERE dataset_id IN (30, 31, 32, 33, 34, 35) AND uf = $1`, [ufCode ?? 0]);
  return new Map(r.rows.map(x => [`${x.dataset_id}:${Math.floor(Number(x.competence) / 100)}`, { runId: Number(x.run_id), at: iso(x.activated_at) }]));
}
export interface FinCoverageRow { source: 'DCA_I_E' | 'RREO_02' | 'DCA_I_G'; exercicio: number; periodo: number; status: string; items: number; hasFunction06: boolean; caveats: string[] }
const SRC_NAME: Record<number, FinCoverageRow['source']> = { 1: 'DCA_I_E', 2: 'RREO_02', 3: 'DCA_I_G' };
const CAV = (b: number) => [b & 1 ? 'soma das funções difere do total' : '', b & 2 ? 'soma das subfunções difere da função 06' : '', b & 4 ? 'linhas duplicadas divergentes' : '', b & 8 ? 'rótulo desconhecido na função 06' : ''].filter(Boolean);
async function coverageOf(q: Q, entityId: number): Promise<FinCoverageRow[]> {
  const r = await q.query(`SELECT source, exercicio, periodo, status, items, fn06, caveats FROM civica_exec.exec_fin_cov WHERE entity_id = $1 ORDER BY source, exercicio`, [entityId]);
  return r.rows.map(x => ({ source: SRC_NAME[Number(x.source)] ?? 'DCA_I_E', exercicio: Number(x.exercicio), periodo: Number(x.periodo), status: COV_NAME[Number(x.status)] ?? String(x.status), items: Number(x.items), hasFunction06: Number(x.fn06) === 1, caveats: CAV(Number(x.caveats)) }));
}
export interface SubfunctionLine { code: string; label: string; empenhada: Money | null; paga: Money | null }
export interface FinYear {
  exercicio: number; coverage: string; function06: { empenhada: Money | null; liquidada: Money | null; paga: Money | null; restosNaoProcessadosInscritos: Money | null; restosProcessadosInscritos: Money | null };
  total: { empenhada: Money | null; paga: Money | null }; shareOfTotalEmpenhada: { percent: number; numeratorCents: string; denominatorCents: string } | null;
  nominalChange: { empenhadaPercent: number | null; pagaPercent: number | null; basis: 'NOMINAL_SEM_DEFLACAO'; previousExercicio: number } | null; subfunctions: SubfunctionLine[];
}
export interface BudgetSnapshot { exercicio: number; bimestre: number; preliminary: boolean; dotacaoInicial: Money | null; dotacaoAtualizada: Money | null; empenhadaAcumulada: Money | null; liquidadaAcumulada: Money | null;
  execution: { empenhadaSobreDotacaoAtualizada: number | null; liquidadaSobreDotacaoAtualizada: number | null } }
export interface FinanceProfile { executor: Executor; years: FinYear[]; budget: BudgetSnapshot[]; coverage: FinCoverageRow[]; perCapita: Array<{ exercicio: number; paidPerInhabitant: number; population: number }>; organs: { status: 'NOT_AVAILABLE' | 'AVAILABLE'; reason: string }; restrictions: string[]; sources: string[] }

async function profileOf(q: Q, ex: Executor & { ufCode: number | null }, o: { from?: number; to?: number } = {}): Promise<FinanceProfile> {
  const [facts, cov, rev] = await Promise.all([
    q.query(`SELECT f.exercicio, f.periodo, c.code AS conta, k.code AS col, k.domain, f.valor::text AS valor FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code c ON c.ref_id = f.conta_id AND c.domain = ${FIN_DOMAIN.conta}
      JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id WHERE f.entity_id = $1 AND f.exercicio BETWEEN $2 AND $3 AND (c.code IN ('06', 'TOT') OR c.code LIKE '06.%' OR c.code = 'FU06') AND k.domain IN (${FIN_DOMAIN.colDcaIE}, ${FIN_DOMAIN.colRreo02})`, [ex.entityId, o.from ?? 1900, o.to ?? 2999]),
    coverageOf(q, ex.entityId), revisions(q, ex.kind === 'uniao' ? 0 : ex.ufCode)]);
  const covBy = new Map<string, string>(); for (const c of cov) covBy.set(`${c.source}:${c.exercicio}`, c.status);
  const rows = facts.rows as FactRow[]; const by = new Map<string, FactRow>();
  for (const r of rows) by.set(`${r.exercicio}:${r.domain}:${r.conta}:${r.col}`, r);
  const money = (r: FactRow | undefined, sub: string | null, limitations: string[] = []): Money | null => {
    if (!r) return null; const dca = Number(r.domain) === FIN_DOMAIN.colDcaIE; const st = STAGE[r.col]!; const ds = dca ? 30 : 31; const rv = rev.get(`${ds}:${r.exercicio}`);
    const periodKind = dca ? 'ANUAL' : r.col.endsWith('_ATE') ? 'ACUMULADO_ATE_BIMESTRE' : r.col.endsWith('_NO') ? 'FLUXO_NO_BIMESTRE' : 'ANUAL';
    return { currency: 'BRL', cents: r.valor, value: Number(r.valor) / 100, stage: st.label, stageKind: st.kind, exercicio: Number(r.exercicio), period: { kind: periodKind as Money['period']['kind'], ...(dca ? {} : { bimestre: Number(r.periodo) }) },
      source: SRC(Number(r.domain)), executor: { entityId: ex.entityId, name: ex.name, kind: ex.kind }, classification: { funcao: r.conta === 'TOT' ? 'TOTAL' : '06', subfuncao: sub, label: r.conta === 'TOT' ? 'Total das despesas exceto intra-orçamentárias' : (SUB_LABEL.get(r.conta) ?? r.conta) },
      coverage: covBy.get(`${dca ? 'DCA_I_E' : 'RREO_02'}:${r.exercicio}`) ?? 'UNKNOWN', revision: { runId: rv?.runId ?? null, publishedAt: rv?.at ?? null }, limitations };
  };
  const g = (y: number, domain: number, conta: string, col: string) => by.get(`${y}:${domain}:${conta}:${col}`);
  const years = [...new Set(rows.filter(r => Number(r.domain) === FIN_DOMAIN.colDcaIE).map(r => Number(r.exercicio)))].sort((a, b) => a - b);
  const subCodes = [...new Set(rows.filter(r => r.conta.startsWith('06.') || r.conta === 'FU06').map(r => r.conta))].sort();
  const out: FinYear[] = []; const D = FIN_DOMAIN.colDcaIE;
  for (const y of years) {
    const emp = g(y, D, '06', 'EMP'), pag = g(y, D, '06', 'PAG'), tEmp = g(y, D, 'TOT', 'EMP'); const prev = out.at(-1);
    const chg = (a: string | undefined, b: string | undefined) => a != null && b != null && BigInt(b) !== 0n ? Number(((BigInt(a) - BigInt(b)) * 10000n) / BigInt(b)) / 100 : null;
    out.push({
      exercicio: y, coverage: covBy.get(`DCA_I_E:${y}`) ?? 'UNKNOWN',
      function06: { empenhada: money(emp, null), liquidada: money(g(y, D, '06', 'LIQ'), null), paga: money(pag, null, ['Não inclui pagamento de restos a pagar de exercícios anteriores.']), restosNaoProcessadosInscritos: money(g(y, D, '06', 'RPNP_INSC'), null), restosProcessadosInscritos: money(g(y, D, '06', 'RPP_INSC'), null) },
      total: { empenhada: money(tEmp, null), paga: money(g(y, D, 'TOT', 'PAG'), null) },
      shareOfTotalEmpenhada: emp && tEmp && BigInt(tEmp.valor) > 0n ? { percent: Number((BigInt(emp.valor) * 10000n) / BigInt(tEmp.valor)) / 100, numeratorCents: emp.valor, denominatorCents: tEmp.valor } : null,
      nominalChange: prev && prev.exercicio === y - 1 ? { empenhadaPercent: chg(emp?.valor, prev.function06.empenhada?.cents), pagaPercent: chg(pag?.valor, prev.function06.paga?.cents), basis: 'NOMINAL_SEM_DEFLACAO', previousExercicio: y - 1 } : null,
      subfunctions: subCodes.map(c => ({ code: c, label: SUB_LABEL.get(c) ?? c, empenhada: money(g(y, D, c, 'EMP'), c, c === '06.122' ? ['Administração Geral concentra folha e custeio: não é "gasto policial".'] : []), paga: money(g(y, D, c, 'PAG'), c) })).filter(s => s.empenhada || s.paga),
    });
  }
  const R = FIN_DOMAIN.colRreo02; const bYears = [...new Set(rows.filter(r => Number(r.domain) === R).map(r => Number(r.exercicio)))].sort((a, b) => a - b);
  const budget: BudgetSnapshot[] = bYears.map(y => { const any = rows.find(r => Number(r.domain) === R && Number(r.exercicio) === y)!; const b = Number(any.periodo); const m = (c: string) => money(g(y, R, '06', c), null, ['Snapshot acumulado do exercício até o bimestre indicado; não somar bimestres.']);
    const dot = g(y, R, '06', 'DOT_ATU'); const ratio = (c: string) => { const n = g(y, R, '06', c); return n && dot && BigInt(dot.valor) > 0n ? Number((BigInt(n.valor) * 10000n) / BigInt(dot.valor)) / 100 : null; };
    return { exercicio: y, bimestre: b, preliminary: b < 6, dotacaoInicial: m('DOT_INI'), dotacaoAtualizada: m('DOT_ATU'), empenhadaAcumulada: m('EMP_ATE'), liquidadaAcumulada: m('LIQ_ATE'), execution: { empenhadaSobreDotacaoAtualizada: ratio('EMP_ATE'), liquidadaSobreDotacaoAtualizada: ratio('LIQ_ATE') } }; });
  const pops = years.length ? (await q.query(`SELECT year, value FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1 AND year = ANY($2::int[])`, [ex.entityId, years])).rows : [];
  const popBy = new Map(pops.map(p => [Number(p.year), Number(p.value)]));
  const perCapita = out.flatMap(y => { const p = popBy.get(y.exercicio); const pag = y.function06.paga; return p && pag ? [{ exercicio: y.exercicio, paidPerInhabitant: pag.value / p, population: p }] : []; });
  const detail = await q.query(`SELECT 1 FROM civica_exec.exec_fin_exec WHERE entity_id = $1 LIMIT 1`, [ex.entityId]);
  return { executor: { entityId: ex.entityId, name: ex.name, kind: ex.kind }, years: out, budget, coverage: cov, perCapita,
    organs: detail.rowCount ? { status: 'AVAILABLE', reason: ex.kind === 'uniao' ? 'Execução por unidade orçamentária disponível (getSecurityFinanceUnion).' : 'Execução da função 06 por unidade disponível para este ente (getSecurityFinanceOrgans); cobre só a função 06, não toda a despesa do órgão.' } : { status: 'NOT_AVAILABLE', reason: 'A execução por órgão (PM, PC, bombeiros, secretaria, guarda) não tem fonte comprovada para este ente; o Siconfi só traz função/subfunção. Nenhum valor foi rateado.' },
    restrictions: FIN_RESTRICTIONS, sources: ['Siconfi — DCA Anexo I-E (despesa por função e subfunção)', 'Siconfi — RREO Anexo 02 (dotação e execução acumulada, entes com RREO completo)'] };
}
/** Perfil financeiro da UF: no máximo 6 consultas (entidade, fatos, cobertura, revisões, população, detalhe). */
export async function getSecurityFinanceState(q: Q, ufCode: number, o: { from?: number; to?: number } = {}): Promise<FinanceProfile | null> {
  const ex = await entityOf(q, `kind = 3 AND uf_code = $1`, ufCode); return ex ? profileOf(q, ex, o) : null;
}
export interface MunicipalFinance extends FinanceProfile { stateContext: { executor: Executor; note: string; latest: FinYear | null } | null }
/** Perfil do município (ibge7). O contexto estadual vem rotulado como ESTADUAL: nunca como despesa do município. */
export async function getSecurityFinanceMunicipality(q: Q, ibge7: number, o: { from?: number; to?: number } = {}): Promise<MunicipalFinance | null> {
  const ex = await entityOf(q, `kind = 4 AND ibge7 = $1`, ibge7); if (!ex) return null;
  const p = await profileOf(q, ex, o); const st = ex.ufCode ? await getSecurityFinanceState(q, ex.ufCode, { from: o.from ?? 0, to: o.to ?? 9999 }) : null;
  return { ...p, stateContext: st ? { executor: st.executor, note: 'Despesa do ESTADO na função 06. Não é gasto do município, não foi rateada e não se soma ao valor municipal.', latest: st.years.at(-1) ?? null } : null };
}
export async function getSecurityFinanceNational(q: Q, o: { from?: number; to?: number } = {}): Promise<FinanceProfile | null> {
  const ex = await entityOf(q, `kind = 1 AND $1::integer IS NOT NULL`, 1); return ex ? profileOf(q, ex, o) : null;
}

export interface UnionOrganLine { orgId: number; code: string; name: string; superiorCode: string | null; empenhada: string; liquidada: string; paga: string; restosInscritos: string; restosCancelados: string; restosPagos: string }
export interface UnionYear {
  exercicio: number; months: number; preliminary: boolean; function06ByOrgan: UnionOrganLine[]; mjspByFunction: Array<{ funcao: number; empenhada: string; liquidada: string; paga: string }>;
  function06ByNature: Array<{ categoria: number; grupo: number; label: string; empenhada: string; paga: string }>; budget: { dotacaoInicial: string; dotacaoAtualizada: string; orcamentoEmpenhado: string; orcamentoRealizado: string; note: string } | null;
}
const GRUPO: Record<number, string> = { 1: 'Pessoal e encargos sociais', 2: 'Juros e encargos da dívida', 3: 'Outras despesas correntes', 4: 'Investimentos', 5: 'Inversões financeiras', 6: 'Amortização da dívida', [-1]: 'Sem informação' };
/**
 * Execução federal (Portal da Transparência): função 06 por órgão subordinado, órgão superior MJSP (30000) por função e natureza econômica da função 06. Valores = Σ dos fluxos mensais em centavos (texto).
 * São duas perspectivas separadas: a funcional (função 06, qualquer órgão) e a institucional (órgãos do MJSP, qualquer função); os totais NÃO se fundem.
 */
export async function getSecurityFinanceUnion(q: Q, o: { from?: number; to?: number } = {}): Promise<{ years: UnionYear[]; restrictions: string[]; sources: string[] }> {
  const lo = o.from ?? 1900, hi = o.to ?? 2999; const now = new Date();
  const [org, mj, nat, dot, months] = await Promise.all([
    q.query(`SELECT x.exercicio, sub.org_id, sub.code, sub.name, sup.code AS sup_code, sum(x.emp)::text AS emp, sum(x.liq)::text AS liq, sum(x.pago)::text AS pago, sum(x.rp_insc)::text AS rpi, sum(x.rp_canc)::text AS rpc, sum(x.rp_pago)::text AS rpp
      FROM civica_exec.exec_fin_exec x JOIN civica_exec.exec_fin_org uo ON uo.org_id = x.org_id JOIN civica_exec.exec_fin_org sub ON sub.org_id = uo.parent_id LEFT JOIN civica_exec.exec_fin_org sup ON sup.org_id = sub.parent_id
      WHERE x.entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND x.exercicio BETWEEN $1 AND $2 AND x.funcao = 6 GROUP BY 1, 2, 3, 4, 5 ORDER BY 1, sum(x.emp) DESC`, [lo, hi]),
    q.query(`SELECT x.exercicio, x.funcao, sum(x.emp)::text AS emp, sum(x.liq)::text AS liq, sum(x.pago)::text AS pago FROM civica_exec.exec_fin_exec x JOIN civica_exec.exec_fin_org uo ON uo.org_id = x.org_id JOIN civica_exec.exec_fin_org sub ON sub.org_id = uo.parent_id
      WHERE x.entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND x.exercicio BETWEEN $1 AND $2 AND sub.parent_id = 1030000 GROUP BY 1, 2 ORDER BY 1, 2`, [lo, hi]),
    q.query(`SELECT exercicio, categoria, grupo, sum(emp)::text AS emp, sum(pago)::text AS pago FROM civica_exec.exec_fin_exec WHERE entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND exercicio BETWEEN $1 AND $2 AND funcao = 6 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`, [lo, hi]),
    q.query(`SELECT exercicio, sum(dot_ini)::text AS di, sum(dot_atu)::text AS da, sum(orc_emp)::text AS oe, sum(orc_real)::text AS orr FROM civica_exec.exec_fin_dot WHERE entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND exercicio BETWEEN $1 AND $2 AND funcao = 6 GROUP BY 1`, [lo, hi]),
    q.query(`SELECT exercicio, count(DISTINCT mes)::int AS n FROM civica_exec.exec_fin_exec WHERE entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND exercicio BETWEEN $1 AND $2 GROUP BY 1`, [lo, hi])]);
  const ys = [...new Set([...months.rows.map(r => Number(r.exercicio))])].sort((a, b) => a - b);
  const years: UnionYear[] = ys.map(y => { const mn = Number(months.rows.find(r => Number(r.exercicio) === y)!.n); const d = dot.rows.find(r => Number(r.exercicio) === y);
    return { exercicio: y, months: mn, preliminary: y >= now.getUTCFullYear() || mn < 12,
      function06ByOrgan: org.rows.filter(r => Number(r.exercicio) === y).map(r => ({ orgId: Number(r.org_id), code: String(r.code), name: String(r.name), superiorCode: r.sup_code == null ? null : String(r.sup_code), empenhada: r.emp, liquidada: r.liq, paga: r.pago, restosInscritos: r.rpi, restosCancelados: r.rpc, restosPagos: r.rpp })),
      mjspByFunction: mj.rows.filter(r => Number(r.exercicio) === y).map(r => ({ funcao: Number(r.funcao), empenhada: r.emp, liquidada: r.liq, paga: r.pago })),
      function06ByNature: nat.rows.filter(r => Number(r.exercicio) === y).map(r => ({ categoria: Number(r.categoria), grupo: Number(r.grupo), label: `${Number(r.categoria) === 3 ? 'Despesa corrente' : Number(r.categoria) === 4 ? 'Despesa de capital' : 'Sem informação'}: ${GRUPO[Number(r.grupo)] ?? r.grupo}`, empenhada: r.emp, paga: r.pago })),
      budget: d ? { dotacaoInicial: d.di, dotacaoAtualizada: d.da, orcamentoEmpenhado: d.oe, orcamentoRealizado: d.orr, note: 'Arquivo de orçamento do Portal da Transparência: snapshot anual por unidade; "orçamento realizado" é o valor PAGO (inclui intra-orçamentárias); não se soma à execução mensal.' } : null }; });
  return { years, restrictions: FIN_RESTRICTIONS, sources: ['Portal da Transparência — despesas-execucao (mensal)', 'Portal da Transparência — orcamento-despesa (anual)'] };
}

export interface OrganLine { orgId: number; code: string; name: string; emp: string; liq: string; pago: string; restosPagos: string; pessoalPago: string; capitalPago: string }
export interface OrganYear { exercicio: number; organs: OrganLine[]; bySubfunction: Array<{ subfuncao: number; pago: string; emp: string }>; byNature: Array<{ categoria: number; grupo: number; label: string; emp: string; pago: string }> }
/**
 * Função 06 por unidade (UG/UO) de um ente com execução detalhada (Estado de Pernambuco; prefeituras gaúchas): valores exatos em centavos (texto), fluxo por exercício.
 * É a perspectiva FUNCIONAL desse ente (despesa da função 06 executada pela unidade), não o total da corporação. Estágio "pago" = pagamentos dos empenhos do exercício (nas fontes
 * estaduais, até a data da extração); "restosPagos" = pagamentos de empenhos de exercícios anteriores (só onde a fonte separa). Nenhum rateio entre entes.
 */
export async function getSecurityFinanceOrgans(q: Q, entityId: number, o: { from?: number; to?: number } = {}): Promise<{ entityId: number; years: OrganYear[]; restrictions: string[]; source: string } | null> {
  const lo = o.from ?? 1900, hi = o.to ?? 2999;
  const [org, sub, nat] = await Promise.all([
    q.query(`SELECT x.exercicio, g.org_id, g.code, g.name, sum(x.emp)::text emp, sum(x.liq)::text liq, sum(x.pago)::text pago, sum(x.rp_pago)::text rpp, coalesce(sum(x.pago) FILTER (WHERE x.grupo = 1), 0)::text pessoal, coalesce(sum(x.pago) FILTER (WHERE x.categoria = 4), 0)::text capital
      FROM civica_exec.exec_fin_exec x JOIN civica_exec.exec_fin_org g ON g.org_id = x.org_id WHERE x.entity_id = $1 AND x.exercicio BETWEEN $2 AND $3 AND x.funcao = 6 GROUP BY 1, 2, 3, 4 ORDER BY 1, sum(x.emp) DESC`, [entityId, lo, hi]),
    q.query(`SELECT exercicio, subfuncao, sum(emp)::text emp, sum(pago)::text pago FROM civica_exec.exec_fin_exec WHERE entity_id = $1 AND exercicio BETWEEN $2 AND $3 AND funcao = 6 GROUP BY 1, 2 ORDER BY 1, sum(emp) DESC`, [entityId, lo, hi]),
    q.query(`SELECT exercicio, categoria, grupo, sum(emp)::text emp, sum(pago)::text pago FROM civica_exec.exec_fin_exec WHERE entity_id = $1 AND exercicio BETWEEN $2 AND $3 AND funcao = 6 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`, [entityId, lo, hi])]);
  if (!org.rowCount) return null;
  const ys = [...new Set(org.rows.map(r => Number(r.exercicio)))].sort((a, b) => a - b);
  return { entityId, restrictions: FIN_RESTRICTIONS, source: 'TCE-PE DespesasEstaduais (Estado de Pernambuco) | TCE-RS empenhos municipais (prefeituras gaúchas)', years: ys.map(y => ({ exercicio: y,
    organs: org.rows.filter(r => Number(r.exercicio) === y).map(r => ({ orgId: Number(r.org_id), code: String(r.code), name: String(r.name), emp: r.emp, liq: r.liq, pago: r.pago, restosPagos: r.rpp, pessoalPago: r.pessoal, capitalPago: r.capital })),
    bySubfunction: sub.rows.filter(r => Number(r.exercicio) === y).map(r => ({ subfuncao: Number(r.subfuncao), emp: r.emp, pago: r.pago })),
    byNature: nat.rows.filter(r => Number(r.exercicio) === y).map(r => ({ categoria: Number(r.categoria), grupo: Number(r.grupo), label: `${Number(r.categoria) === 3 ? 'Despesa corrente' : Number(r.categoria) === 4 ? 'Despesa de capital' : 'Sem informação'}: ${GRUPO[Number(r.grupo)] ?? r.grupo}`, emp: r.emp, pago: r.pago })) })) };
}
