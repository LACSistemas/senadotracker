import { fmt, periodLong } from './format.ts';
import type { InstitutionCard, ScopeInfo, StructureChapter } from './types.ts';

interface Pt { value: number | null; status?: string; period?: { start: string; end: string }; source?: string; label?: string; corporation?: string | null }
interface Existence { state: 'yes' | 'no' | 'unknown' | string; existence?: Pt; staff?: Pt }
export interface MuniEdition { survey: string; guard: Existence; policeStation: Existence; specializedStations: Array<{ code: string; label: string; state: string; point?: Pt }>; otherStructures: Array<{ code: string; label: string; point?: Pt }> }
export interface StaffMuni { editions: MuniEdition[]; stateContext?: { label: string; pmFbsp?: Pt | null; pcFbsp?: Pt | null } | null }
export interface StaffState {
  fbsp: { existing: Array<Pt & { corporation: string }>; plans: Array<{ corporation: string; planned: Pt | null; occupancy: Pt | null; difference: Pt | null }> };
  estadic: Array<{ edition: number; referenceDate: string; points: Array<Pt & { corporation: string | null; code: string }> }>;
  municipalGuards: { editions: Array<{ survey: string; municipalitiesWithGuard: Pt | null; staffSum: Pt | null }> };
}
export interface StaffNational { fbsp?: { points?: Array<Pt & { corporation: string; code: string }> } | Array<Pt & { corporation: string; code: string }>; siape?: unknown }

export const CORP_LABEL: Record<string, string> = { PM: 'Polícia Militar', PC: 'Polícia Civil', CBM: 'Corpo de Bombeiros Militar', PERICIA: 'Perícia oficial', POLICIA_PENAL: 'Polícia Penal', GCM: 'Guardas municipais (soma dos municípios da UF)', PF: 'Polícia Federal', PRF: 'Polícia Rodoviária Federal' };
const MUNIC_EDITION = (iso: string) => `Pesquisa MUNIC ${iso.slice(0, 4)}`;
const stateNote = 'Total do estado inteiro: não é o efetivo lotado neste município.';
const yes = (e: Existence | undefined): boolean | null => e?.state === 'yes' ? true : e?.state === 'no' ? false : null;

export function buildStructureChapter(o: { scope: ScopeInfo; muni: StaffMuni | null; state: StaffState | null; national: StaffNational | null }): StructureChapter {
  const { scope, muni, state } = o; const municipal: InstitutionCard[] = []; const editionsOut: StructureChapter['editions'] = [];
  if (muni) {
    const eds = [...muni.editions].sort((a, b) => b.survey.localeCompare(a.survey));
    for (const e of eds) {
      const items: Array<{ label: string; value: string }> = [];
      const g = yes(e.guard); items.push({ label: 'Guarda municipal', value: g === true ? `sim${e.guard.staff?.value != null ? `, ${fmt(e.guard.staff.value)} guardas declarados` : ''}` : g === false ? 'não declarada pela prefeitura' : 'sem resposta' });
      const d = yes(e.policeStation); items.push({ label: 'Delegacia de Polícia Civil', value: d === true ? 'sim' : d === false ? 'não declarada pela prefeitura' : 'sem resposta' });
      for (const s of e.specializedStations) items.push({ label: s.label.replace(/^Município possui /, '').replace(/ \(MUNIC\)$/, ''), value: s.state === 'yes' ? 'sim' : s.state === 'no' ? 'não declarada' : 'sem resposta' });
      for (const s of e.otherStructures) items.push({ label: s.label.replace(/^Município possui /, '').replace(/ \(MUNIC\)$/, ''), value: s.point?.value === 1 ? 'sim' : s.point?.value === 0 ? 'não declarado' : 'sem resposta' });
      editionsOut.push({ label: MUNIC_EDITION(e.survey), items });
    }
    const latest = eds[0];
    if (latest) {
      const g = yes(latest.guard);
      municipal.push({ key: 'guarda', label: 'Guarda municipal', scope: 'municipio', value: g === true ? (latest.guard.staff?.value ?? null) : g === false ? 0 : null, unit: g === true ? 'guardas declarados' : g === false ? 'a prefeitura declarou não ter' : 'sem resposta',
        basis: MUNIC_EDITION(latest.survey), source: 'IBGE — MUNIC (declaração da prefeitura)', note: g === true && latest.guard.staff?.value == null ? 'A prefeitura declarou ter guarda, mas não informou o efetivo.' : 'Declaração da prefeitura na data da pesquisa; não prova que a estrutura funciona hoje.' });
      const d = yes(latest.policeStation);
      municipal.push({ key: 'delegacia', label: 'Delegacia de Polícia Civil', scope: 'municipio', value: d === true ? 1 : d === false ? 0 : null, unit: d === true ? 'existe' : d === false ? 'a prefeitura declarou não ter' : 'sem resposta', basis: MUNIC_EDITION(latest.survey), source: 'IBGE — MUNIC (declaração da prefeitura)', note: 'Existência, não quantidade, lotação nem área atendida.' });
    }
  }
  const stateCards: InstitutionCard[] = []; const planned: StructureChapter['plannedVsExisting'] = [];
  if (state) {
    const plansBy = new Map(state.fbsp.plans.map(p => [p.corporation, p]));
    for (const ex of state.fbsp.existing) {
      if (ex.corporation === 'GCM' && scope.kind === 'municipio') continue;
      const pl = plansBy.get(ex.corporation); const basis = ex.period?.start ? `FBSP, posição de ${periodLong(ex.period.start.slice(0, 7))}` : 'FBSP';
      stateCards.push({ key: ex.corporation.toLowerCase(), label: CORP_LABEL[ex.corporation] ?? ex.corporation, scope: 'estado', value: ex.value, unit: 'servidores da ativa', basis, source: 'Fórum Brasileiro de Segurança Pública — portais da transparência', note: scope.kind === 'municipio' ? stateNote : null, planned: pl?.planned?.value ?? null, occupancyPct: pl?.occupancy?.value ?? null });
      if (pl && pl.planned?.value != null) planned.push({ corporation: CORP_LABEL[ex.corporation] ?? ex.corporation, existing: ex.value, planned: pl.planned.value, occupancyPct: pl.occupancy?.value ?? null, basis });
    }
  }
  const nat = o.national?.fbsp; const natPts = Array.isArray(nat) ? nat : (nat?.points ?? []); const nationalCards: InstitutionCard[] = [];
  for (const c of ['PF', 'PRF']) { const p = natPts.find(x => x.corporation === c && x.value != null); if (p) nationalCards.push({ key: c.toLowerCase(), label: CORP_LABEL[c]!, scope: 'nacional', value: p.value, unit: 'servidores (Brasil inteiro)', basis: p.period?.start ? `FBSP, ${periodLong(p.period.start.slice(0, 7))}` : 'FBSP', source: 'Fórum Brasileiro de Segurança Pública', note: 'Não há efetivo da PF ou da PRF por UF ou município em fonte aberta.' }); }
  const available = municipal.length > 0 || stateCards.length > 0;
  return {
    id: 'estrutura', number: 2, title: 'Estrutura e capacidade institucional', question: 'Que estrutura pública existe para responder aos problemas?', available,
    narrative: { question: 'Que estrutura pública existe para responder aos problemas?', answer: '', context: null, invite: 'Veja o que é da cidade e o que é do estado, e compare o efetivo previsto com o existente.' },
    municipal, state: [...stateCards, ...(scope.kind === 'uf' ? nationalCards : [])], plannedVsExisting: planned, editions: editionsOut,
    detran: {
      available: false,
      statement: 'O Cívica ainda não tem cadastro de unidades, servidores, agentes de fiscalização nem orçamento específico dos Detrans. O que existe sobre trânsito (frota, sinistros, mortes e infrações) está no capítulo de Segurança viária.',
      items: ['Sem efetivo do Detran', 'Sem postos de atendimento nem Ciretrans', 'Sem orçamento do Detran identificado: a despesa estadual aparece só como função Segurança Pública (Siconfi)'],
    },
    restrictions: ['Efetivo estadual (PM, PC, bombeiros, perícia, polícia penal) é um total da UF inteira: nunca é o efetivo lotado em um município.', 'FBSP (2025), ESTADIC (2018 e 2022) e MUNIC (2019 e 2023) são conceitos e datas diferentes: aparecem lado a lado, nunca somados.', 'Quadro previsto não é meta de policiamento nem necessidade estimada; a ocupação do quadro mede o preenchimento de cargos.', 'Ausência de informação é mostrada como ausência, nunca como zero.'],
  };
}
