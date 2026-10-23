import { changeRatio, directionOf, fmt, signedPct } from './format';
import type { ChartPoint, CrimeChapter, FinanceChapter, PoliceChapter, PrisonChapter, ScopeInfo, StructureChapter, TrafficChapter } from './types';

/**
 * Frases de abertura de cada capítulo: descrevem o que os dados mostram e o que NÃO mostram. Nunca atribuem causa
 * ("por causa de", "graças a", "devido a"): variações são descritas, não explicadas.
 */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const cmp = (cur: number, prev: number | null | undefined, prevT: string): string => {
  const r = changeRatio(prev ?? null, cur); if (r == null) return ''; const d = directionOf(r);
  return d === 'flat' ? `, praticamente estável em relação a ${prevT}` : `, ${r > 0 ? 'um aumento' : 'uma redução'} de ${signedPct(r).replace(/^[+−]/, '')} em relação a ${prevT}`;
};
const lastTwo = (pts: ChartPoint[]): [ChartPoint, ChartPoint | null] | null => { const ok = pts.filter(p => p.v != null && p.state !== 'partial'); const c = ok.at(-1); return c ? [c, ok.at(-2) ?? null] : null; };
export type Said = { answer: string; context: string | null };

export function crimeNarrative(scope: ScopeInfo, ch: CrimeChapter, benchSentence: string | null): Said {
  const op = ch.options.find(o => o.id === ch.defaultOptionId); if (!op) return { answer: 'Ainda não há registros de criminalidade publicados para este território.', context: null };
  const c = op.measures[0]!.chart; const lt = lastTwo(c.series[0]!.points); if (!lt) return { answer: 'Os registros disponíveis ainda não formam um ano completo.', context: null };
  const [cur, prev] = lt; const who = scope.kind === 'uf' ? scope.stateName : scope.name;
  const answer = `Em ${cur.t}, ${who} teve ${fmt(cur.v!)} ${lower(op.plain)}${cmp(cur.v!, prev?.v, prev?.t ?? '')}. ${ch.options.length > 1 ? `Há ${fmt(ch.options.length)} tipos de registro para explorar abaixo, de homicídios a roubos e furtos.` : ''}`.trim();
  const stateOnly = ch.stateOnly.length ? `Alguns crimes só existem para o estado inteiro (${ch.stateOnly.slice(0, 3).map(lower).join(', ')}${ch.stateOnly.length > 3 ? ' e outros' : ''}): aparecem identificados como contexto estadual, não como números da cidade.` : null;
  return { answer, context: [benchSentence, stateOnly].filter(Boolean).join(' ') || null };
}
export function structureNarrative(scope: ScopeInfo, ch: StructureChapter): Said {
  const g = ch.municipal.find(c => c.key === 'guarda'); const d = ch.municipal.find(c => c.key === 'delegacia'); const pm = ch.state.find(c => c.key === 'pm'); const pc = ch.state.find(c => c.key === 'pc');
  if (scope.kind === 'municipio') {
    const bits: string[] = [];
    if (g) bits.push(g.value === 0 ? `a prefeitura declarou que não tem guarda municipal (${g.basis})` : g.value != null ? `a prefeitura declarou ter guarda municipal, com ${fmt(g.value)} guardas (${g.basis})` : `a prefeitura declarou ter guarda municipal, sem informar o efetivo (${g.basis})`);
    if (d) bits.push(d.value === 1 ? 'há delegacia de Polícia Civil no município' : d.value === 0 ? 'a prefeitura declarou não haver delegacia de Polícia Civil no município' : 'não há resposta sobre delegacia');
    const answer = bits.length ? `Em ${scope.name}, ${bits.join('; ')}.` : `Não há declaração sobre a estrutura local de ${scope.name} nas pesquisas coletadas.`;
    return { answer, context: pm && pc ? `As polícias Militar e Civil são estaduais: ${fmt(pm.value ?? 0)} policiais militares e ${fmt(pc.value ?? 0)} civis atuam em todo o estado de ${scope.stateName}; esses números não são o efetivo lotado em ${scope.name}.` : null };
  }
  return { answer: pm ? `${scope.stateName} declarou ${fmt(pm.value ?? 0)} policiais militares${pc ? ` e ${fmt(pc.value ?? 0)} policiais civis` : ''} na ativa (${pm.basis}).` : 'Não há efetivo estadual publicado.', context: ch.plannedVsExisting.length ? 'Em cada corporação, o efetivo existente pode ser comparado com o quadro previsto: a ocupação mede o preenchimento de cargos, não a cobertura do policiamento.' : null };
}
export function trafficNarrative(scope: ScopeInfo, ch: TrafficChapter, benchSentence: string | null): Said {
  const who = scope.kind === 'uf' ? scope.stateName : scope.name; const d = ch.deaths.residence ?? ch.deaths.occurrence;
  const lt = d ? lastTwo(d.series[0]!.points) : null; const fl = ch.fleet ? ch.fleet.series[0]!.points.filter(p => p.v != null).at(-1) : null;
  const a: string[] = [];
  if (lt) a.push(`${who} teve ${fmt(lt[0].v!)} mortes no trânsito ${d === ch.deaths.residence ? 'de moradores ' : ''}em ${lt[0].t}${cmp(lt[0].v!, lt[1]?.v, lt[1]?.t ?? '')}`);
  if (fl) a.push(`a frota registrada chega a ${fmt(fl.v!)} veículos${ch.fleetBasis ? ` (${ch.fleetBasis.toLowerCase()})` : ''}`);
  return { answer: a.length ? a.join('; ') + '.' : 'Não há série de trânsito publicada para este território.', context: [benchSentence, 'Mortes (saúde), sinistros (RENAEST e PRF) e frota são fontes diferentes: não se somam nem se igualam, e os dados não demonstram relação de causa entre elas.'].filter(Boolean).join(' ') };
}
export function prisonNarrative(scope: ScopeInfo, ch: PrisonChapter): Said {
  const occ = ch.scopeKind === 'municipio' ? ch.stateContext?.occupancy : ch.occupancy; const last = occ?.series[0]!.points.filter(p => p.v != null).at(-1);
  if (scope.kind === 'municipio') return { answer: ch.observed, context: last ? `No sistema estadual de ${scope.stateName}, as celas físicas estavam com ${fmt(last.v!, 0)}% das vagas ocupadas no último ciclo; essa é a situação do estado, não do município.` : null };
  const cap = ch.capacityVsPopulation?.series.find(s => s.key === 'cap')?.points.filter(p => p.v != null).at(-1); const pop = ch.capacityVsPopulation?.series.find(s => s.key === 'pop')?.points.filter(p => p.v != null).at(-1);
  return { answer: cap && pop ? `No último ciclo, o sistema estadual tinha ${fmt(cap.v!)} vagas em celas físicas e ${fmt(pop.v!)} pessoas custodiadas${last ? ` (${fmt(last.v!, 0)}% de ocupação)` : ''}.` : 'Não há série do sistema prisional publicada.', context: ch.domiciliary ? `${ch.domiciliary.label}: ${fmt(ch.domiciliary.value ?? 0)}.` : null };
}
export function financeNarrative(scope: ScopeInfo, ch: FinanceChapter): Said {
  const fy = ch.years.filter(y => !y.preliminary && y.stages.paga != null); const y = fy.at(-1); const p = fy.at(-2);
  if (!y) return { answer: 'Não há despesa na função Segurança Pública publicada.', context: null };
  const r = p ? changeRatio(p.stages.paga ?? null, y.stages.paga ?? null) : null; const who = scope.kind === 'uf' ? `O governo de ${scope.stateName}` : `A prefeitura de ${scope.name}`;
  const mil = (v: number) => v >= 1e9 ? `R$ ${fmt(v / 1e9, 2)} bilhões` : `R$ ${fmt(v / 1e6, 1)} milhões`;
  return {
    answer: `${who} pagou ${mil(y.stages.paga!)} na função Segurança Pública em ${y.exercicio}${y.perCapitaPaid != null ? ` (R$ ${fmt(y.perCapitaPaid, 0)} por habitante)` : ''}${r != null ? `, ${signedPct(r)} em valores correntes em relação a ${p!.exercicio}` : ''}${y.share != null ? `, ${fmt(y.share * 100, 1)}% da despesa total` : ''}.`,
    context: 'Orçado, empenhado, liquidado e pago são etapas diferentes do mesmo gasto e nunca se somam. O valor é a função Segurança Pública do ente, não o gasto das corporações, e não mede eficiência.',
  };
}
export function policeNarrative(scope: ScopeInfo, ch: PoliceChapter): Said {
  const who = scope.kind === 'uf' ? scope.stateName : scope.name; const f = ch.families.length;
  return {
    answer: f ? `Os registros oficiais de atuação policial em ${who} cobrem ${fmt(f)} ${f === 1 ? 'tema' : 'temas'}: ${ch.families.map(x => lower(x.label)).join('; ')}. Cada medida tem unidade própria.` : `Não há registros de atuação policial publicados para ${who}.`,
    context: 'Estes números descrevem a atividade registrada pela polícia. Um aumento pode significar mais ação policial, e não mais crime; nenhum desses registros prova a existência de organização criminosa.',
  };
}
