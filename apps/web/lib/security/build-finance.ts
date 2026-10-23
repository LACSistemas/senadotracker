import type { BenchView, ContractPreview, FinanceChapter, FinanceYear, MoneyStage, ScopeInfo } from './types';

interface Money { value: number | null; cents?: string }
interface FYear { exercicio: number; coverage: string; function06: { empenhada?: Money; liquidada?: Money; paga?: Money } | null; total?: { empenhada?: Money; paga?: Money } | null; shareOfTotalEmpenhada: { percent: number } | null; subfunctions: Array<{ code: string; label: string; empenhada?: Money | null; paga?: Money | null }> }
interface FBudget { exercicio: number; bimestre: number; preliminary: boolean; dotacaoInicial?: Money; dotacaoAtualizada?: Money; empenhadaAcumulada?: Money; liquidadaAcumulada?: Money }
export interface FinancePayload { years: FYear[]; budget: FBudget[]; perCapita: Array<{ exercicio: number; paidPerInhabitant: number | null; population: number | null }>; coverage: Array<{ source: string; exercicio: number; status: string }>; stateContext?: { executor: { name: string }; note: string; latest: FYear | null } | null; restrictions: string[] }

export const STAGES: MoneyStage[] = [
  { key: 'dotacao', label: 'Orçado (dotação atualizada)', hint: 'O que a lei orçamentária autorizou gastar, já com as alterações do ano.' },
  { key: 'empenhada', label: 'Empenhado', hint: 'Compromisso formal de gasto assumido pelo ente.' },
  { key: 'liquidada', label: 'Liquidado', hint: 'Bem ou serviço entregue e conferido.' },
  { key: 'paga', label: 'Pago', hint: 'Dinheiro que de fato saiu do caixa no exercício.' },
];
const num = (m?: Money | null): number | null => m?.value ?? null;

function yearsOf(fin: FinancePayload | null): FinanceYear[] {
  if (!fin) return [];
  const budgetBy = new Map(fin.budget.map(b => [b.exercicio, b])); const pcBy = new Map(fin.perCapita.map(p => [p.exercicio, p.paidPerInhabitant]));
  const out: FinanceYear[] = [];
  for (const y of fin.years) {
    if (!y.function06) continue; const b = budgetBy.get(y.exercicio);
    out.push({ exercicio: y.exercicio, preliminary: false, stages: { dotacao: b && !b.preliminary ? num(b.dotacaoAtualizada) : null, empenhada: num(y.function06.empenhada), liquidada: num(y.function06.liquidada), paga: num(y.function06.paga) },
      share: y.shareOfTotalEmpenhada ? y.shareOfTotalEmpenhada.percent / 100 : null, perCapitaPaid: pcBy.get(y.exercicio) ?? null,
      subfunctions: y.subfunctions.map(s => ({ code: s.code, label: s.label, empenhada: num(s.empenhada), paga: num(s.paga) })) });
  }
  const last = fin.budget.at(-1); const have = new Set(out.map(o => o.exercicio));
  if (last && last.preliminary && !have.has(last.exercicio)) out.push({ exercicio: last.exercicio, preliminary: true, stages: { dotacao: num(last.dotacaoAtualizada), empenhada: num(last.empenhadaAcumulada), liquidada: num(last.liquidadaAcumulada), paga: null }, share: null, perCapitaPaid: null, subfunctions: [] });
  return out.sort((a, b) => a.exercicio - b.exercicio);
}

export function buildFinanceChapter(o: { scope: ScopeInfo; fin: FinancePayload | null; contracts: ContractPreview | null; bench: BenchView | null }): FinanceChapter {
  const { scope, fin } = o; const years = yearsOf(fin);
  const stateLatest = fin?.stateContext?.latest ? yearsOf({ ...fin, years: [fin.stateContext.latest], budget: [], perCapita: [] })[0] ?? null : null;
  const cov = fin ? `Siconfi: despesa anual (DCA) ${years.filter(y => !y.preliminary).at(0)?.exercicio ?? '—'} a ${years.filter(y => !y.preliminary).at(-1)?.exercicio ?? '—'}; execução do exercício corrente pelo RREO (acumulado até o bimestre, preliminar).` : '';
  return {
    id: 'financas', number: 5, title: 'Finanças da Segurança', question: 'Quanto dinheiro público é destinado e executado nessa área?', available: years.length > 0, emptyReason: years.length ? '' : `Sem despesa na função Segurança Pública publicada para ${scope.name}.`,
    narrative: { question: 'Quanto dinheiro público é destinado e executado nessa área?', answer: '', context: null, invite: 'Alterne entre orçado, empenhado, liquidado e pago e abra as subfunções de cada ano.' },
    years, stages: STAGES, stateContext: scope.kind === 'municipio' && fin?.stateContext ? { label: `${fin.stateContext.note}`, latest: stateLatest } : null, bench: o.bench, contractsPreview: o.contracts, restrictions: fin?.restrictions ?? [], coverage: cov,
    organsNote: scope.kind === 'uf' ? 'A despesa por corporação (PM, PC, bombeiros) só existe onde há fonte detalhada: o Siconfi traz apenas função e subfunção, e nada é rateado.' : 'A despesa municipal aparece por função e subfunção; o gasto do estado em seu território não é rateado.',
    detranNote: 'Não há despesa específica de Detran identificada nas fontes: a função Segurança Pública do ente não separa o Detran, e nenhum valor foi estimado.',
  };
}
