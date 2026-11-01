import type { Kpi } from '@/lib/security/types';
import type { HeroKpi } from '@/lib/infrastructure/types';
import type { PortraitFact } from '@/lib/wellbeing/types';
import type { MapMetricDef } from '@/lib/territory-map-metrics';
import type { PeerRulerResult } from './peer-distribution.ts';

/**
 * Adaptadores reais (não um contrato fingido de igualdade) que traduzem o que Infraestrutura/Bem-estar/o
 * mapa territorial JÁ TÊM de dado real para o contrato `Kpi` que `KpiCard`/`IndicatorLive` consomem.
 * Limite honesto, documentado em cada função: nenhum adaptador aqui inventa `delta`/`spark`/`ruler` que a
 * fonte de dado não tem — quando a dimensão não existe, o campo correspondente vai `null`/`[]`, nunca um
 * valor sintético. `chapter` vira `''` quando não há âncora de capítulo válida na página onde o `Kpi`
 * adaptado é renderizado (ex.: fora da própria página do tema) — o link "Explorar" de `KpiCard` aponta
 * então para `#` (topo da página atual), uma limitação cosmética menor, não uma quebra funcional.
 */

/** Infraestrutura: `HeroKpi` não carrega delta/sparkline/distribuição de pares — só valor, unidade,
 * período, fonte e, à parte, uma `TerritoryCompare` própria (3 pontos território/UF/Brasil), que este
 * adaptador NÃO absorve em `compare.text` (seria inventar uma frase que `Kpi.compare` não calcula aqui).
 * Quem quiser a comparação de 3 pontos continua usando `TerritoryComparator`/`TerritoryCompareRow` à
 * parte, como o produto já faz. */
export function heroKpiToKpi(h: HeroKpi, opts: { chapterAnchor?: string; territoryName?: string } = {}): Kpi {
  return {
    id: `infra-${h.code}`, label: h.label,
    plain: opts.territoryName ? `${h.label} em ${opts.territoryName}` : h.label,
    value: h.value, unit: h.unit ?? '',
    basis: h.year != null ? String(h.year) : '—', chapter: opts.chapterAnchor ?? '',
    delta: null, compare: null, ruler: null, spark: [], sparkLabel: '',
    secondary: h.note ?? null, caveat: null, source: h.sourceFamily, state: 'ok',
  };
}

/** Bem-estar: `PortraitFact` é o fato mais simples do produto (label/value/unit/period/source, já
 * formatado como texto) — sem nenhuma dimensão de comparação. O adaptador cobre só o Nível 1 (Descobrir);
 * não há Nível 2 (Explorar) possível sem uma `ChartView`, que esta fonte nunca produz. */
export function portraitFactToKpi(p: PortraitFact, opts: { chapterAnchor?: string; territoryName?: string } = {}): Kpi {
  return {
    id: `wb-${p.label}`, label: p.label,
    plain: opts.territoryName ? `${p.label} em ${opts.territoryName}` : p.label,
    value: p.value, unit: p.unit, basis: p.period,
    chapter: opts.chapterAnchor ?? '', delta: null, compare: null, ruler: null, spark: [], sparkLabel: '',
    secondary: null, caveat: null, source: p.source, state: 'ok',
  };
}

/** Atlas Vivo (P3): um indicador do mapa (`MapMetricDef`, registro só com label/unidade/domínio — sem
 * texto de fonte detalhado por indicador) mais a régua de pares já calculada por `buildPeerRuler`. Quando
 * a régua foi bloqueada (coorte pequena, ex. Roraima com poucos municípios elegíveis), o motivo vira
 * `caveat` em vez de desaparecer silenciosamente. `source` é o domínio do indicador (ex. "Segurança
 * Pública"), não uma agência específica — detalhar a fonte exata por indicador não está neste registro e
 * inventar uma citação precisa seria pior do que apontar para a aba do tema, onde a fonte real já aparece. */
export function mapMetricToKpi(args: { metric: MapMetricDef; name: string; valueDisplay: string; year: string; peer: PeerRulerResult; flagTexts: string[] }): Kpi {
  const { metric, name, valueDisplay, year, peer, flagTexts } = args;
  const caveatParts = [...flagTexts, peer.ruler === null ? peer.reason : null].filter((x): x is string => !!x);
  return {
    id: `map-${metric.key}`, label: metric.short, plain: `${metric.label} em ${name}`, value: valueDisplay, unit: metric.unit,
    basis: year, chapter: '', delta: null, compare: null, ruler: peer.ruler, spark: [], sparkLabel: '',
    secondary: null, caveat: caveatParts.length ? caveatParts.join(' ') : null, source: metric.domain, state: 'ok',
  };
}
