import { mkChart, mkSeries, monthlyToAnnual } from './series';
import type { ChartPoint, PoliceChapter, PoliceFamilyView, ScopeInfo } from './types';

interface OcSeries { family: string; indicatorId: number; source: string; abrangencia: string; measure: string; unit: string; level: string; note: string | null; points: Array<{ period: string; value: number | null; preliminary: boolean }>; first: string | null; last: string | null }
export interface OcPayloadLite { families: Array<{ code: string; label: string; semantics: string; series: OcSeries[] }>; restrictions: string[]; notAvailable: string[] }
export interface OcNationalLite { series: Array<{ family: string; indicatorId: number; abrangencia: string; unit: string; years: Array<{ year: number; value: number; ufsWithData: number; complete: boolean }> }>; families: Array<{ code: string; label: string }> }

const SRC_PLAIN: Record<string, string> = { VDE: 'Sinesp (MJSP) — dados informados pelas secretarias estaduais, PF e PRF', 'ISP-RJ': 'Instituto de Segurança Pública do RJ', 'SSP-RS': 'Secretaria da Segurança Pública do RS', 'SSP-SP': 'Secretaria da Segurança Pública de SP' };
const ABR_PLAIN: Record<string, string> = { Estadual: 'polícias estaduais', 'PF/PRF': 'Polícia Federal e PRF', PF: 'Polícia Federal', 'Estadual (fonte única)': 'registro da secretaria estadual' };
const UNIT_PLAIN = (u: string): string => u.startsWith('peso informado') ? 'peso informado' : u;
const SEMANTICS_PLAIN: Record<string, string> = {
  'OC.DRUG.TRAFFICKING_RECORDS': 'Registros policiais com título de tráfico de drogas. Refletem a atividade da polícia; não provam participação em organização criminosa.',
  'OC.DRUG.POSSESSION_RECORDS': 'Registros de posse ou porte de drogas para uso: universo diferente do tráfico.', 'OC.DRUG.SEIZURE_EVENTS': 'Quantos registros de apreensão de drogas houve — não é a quantidade de droga apreendida.',
  'OC.DRUG.SEIZED_MASS_COCAINE': 'Peso de cocaína apreendida informado ao Sinesp. A unidade do peso não é declarada pela fonte; nada foi convertido.', 'OC.DRUG.SEIZED_MASS_MARIJUANA': 'Peso de maconha apreendida informado ao Sinesp. A unidade do peso não é declarada pela fonte; nada foi convertido.',
  'OC.WEAPON.FIREARMS_SEIZED': 'Armas de fogo apreendidas (soma dos tipos informados). Não inclui entrega voluntária, recolhimento administrativo, posse nem porte.', 'OC.WEAPON.OFFENSE_RECORDS': 'Registros de delitos com armas (porte ilegal e afins): não é a arma apreendida.',
  'OC.ENFORCEMENT.ARREST_WARRANTS_SERVED': 'Mandados de prisão cumpridos: ato processual; não comprova culpa.', 'OC.ENFORCEMENT.FLAGRANT_ARRESTS': 'Autos de prisão em flagrante: ato policial; não é condenação.',
};

export function buildPoliceChapter(o: { scope: ScopeInfo; oc: OcPayloadLite | null; national: OcNationalLite | null }): PoliceChapter {
  const { scope, oc } = o; const where = scope.kind === 'uf' ? scope.stateName : scope.name;
  const families: PoliceFamilyView[] = [];
  for (const f of oc?.families ?? []) {
    const series = f.series.filter(s => s.points.some(p => p.value != null)).map(s => {
      const monthly: ChartPoint[] = s.points.map(p => ({ t: p.period, v: p.value, state: p.value == null ? 'absent' as const : p.preliminary ? 'prelim' as const : 'ok' as const }));
      const annual = monthlyToAnnual(monthly); const abr = ABR_PLAIN[s.abrangencia] ?? s.abrangencia; const src = SRC_PLAIN[s.source] ?? s.source;
      return { source: src, abrangencia: abr, unit: UNIT_PLAIN(s.unit), note: s.note, chart: mkChart({ id: `oc:${s.indicatorId}`, title: `${f.label} — ${abr}`, unit: UNIT_PLAIN(s.unit), digits: s.measure === 'peso_informado' ? 1 : 0, grain: 'A', series: [mkSeries('t', where, annual, s.abrangencia.startsWith('PF') ? 'amber' : 'primary')], monthly: [mkSeries('t', where, monthly, s.abrangencia.startsWith('PF') ? 'amber' : 'primary')],
        source: src, coverage: `${s.first ?? '—'} a ${s.last ?? '—'}`, notes: [s.note ?? '', 'Não somar com as séries de outras abrangências ou fontes.'].filter(Boolean) }) };
    });
    if (series.length) families.push({ code: f.code, label: f.label, semantics: SEMANTICS_PLAIN[f.code] ?? f.semantics, series });
  }
  const nat = scope.kind === 'uf' && o.national ? o.national.series.map(s => ({ family: s.family, label: o.national!.families.find(f => f.code === s.family)?.label ?? s.family, indicatorId: s.indicatorId, abrangencia: ABR_PLAIN[s.abrangencia] ?? s.abrangencia, unit: UNIT_PLAIN(s.unit), years: s.years.slice(-4).map(y => ({ year: y.year, value: y.value, complete: y.complete, ufs: y.ufsWithData })) })).filter(s => s.years.length) : [];
  return {
    id: 'apreensoes', number: 6, title: 'Apreensões e atuação policial', question: 'O que as estatísticas oficiais mostram sobre a atuação do Estado?', available: families.length > 0, emptyReason: families.length ? '' : `Sem registros de atuação policial publicados para ${where}.`,
    narrative: { question: 'O que as estatísticas oficiais mostram sobre a atuação do Estado?', answer: '', context: null, invite: 'Cada medida tem unidade própria: contagens, pesos e mandados não se somam.' },
    families, notAvailable: oc?.notAvailable ?? [], restrictions: oc?.restrictions ?? [], national: nat,
  };
}
