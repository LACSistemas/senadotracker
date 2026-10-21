import type { DistStat, PanelValue, VaccineValue } from '@senadotracker/db';
import { VACCINE_PRIORITY } from './health-targets.ts';

export const FLAG = { smallN: 1, preliminary: 2, partialCoverage: 4, suppressed: 8, denominatorDivergent: 16, above100: 32, noDenominator: 64 } as const;
/** Mínimo de territórios comparáveis para exibir faixa (abaixo disso só a mediana de referência). */
export const MIN_COMPARABLE = 10;

export type Quintile = 1 | 2 | 3 | 4 | 5;
export const quintileOf = (value: number, s: DistStat): Quintile => value < s.p20 ? 1 : value < s.p40 ? 2 : value < s.p60 ? 3 : value < s.p80 ? 4 : 5;
/** Texto neutro: descreve a posição na distribuição, nunca "melhor" ou "pior". */
export const quintileWord = (q: Quintile): string => ['faixa mais baixa', 'abaixo da mediana', 'faixa intermediária', 'acima da mediana', 'faixa mais alta'][q - 1]!;

export type BenchState =
  | { kind: 'ok'; quintile: Quintile; group: DistStat; groupLabel: string; ref: DistStat | null; refLabel: string }
  | { kind: 'none'; reason: string; ref: DistStat | null; refLabel: string };

/** Elegibilidade e posição de um valor frente ao grupo (UF ou conjunto das UFs) e à referência nacional, usando distribuições prontas (nada é calculado por requisição). */
export function benchFor(v: PanelValue | undefined, group: DistStat | undefined, groupLabel: string, ref: DistStat | undefined, refLabel: string): BenchState {
  const r = ref ?? null;
  if (!v || v.value === null) return { kind: 'none', reason: 'Sem registro no período', ref: r, refLabel };
  if (v.flags & FLAG.smallN) return { kind: 'none', reason: 'Pequeno número', ref: r, refLabel };
  if (v.flags & (FLAG.noDenominator | FLAG.suppressed)) return { kind: 'none', reason: 'Sem denominador oficial', ref: r, refLabel };
  if (!group || group.n < MIN_COMPARABLE) return { kind: 'none', reason: `Menos de ${MIN_COMPARABLE} territórios comparáveis`, ref: r, refLabel };
  if (group.periodStart !== v.periodStart) return { kind: 'none', reason: 'Período diferente do grupo', ref: r, refLabel };
  return { kind: 'ok', quintile: quintileOf(v.value, group), group, groupLabel, ref: r, refLabel };
}

/** Variação em relação ao mesmo período do ano anterior, só quando ambos os pontos existem e são comparáveis. */
export function trendOf(v: PanelValue | undefined): { dir: 'up' | 'down' | 'flat'; delta: number } | null {
  if (!v || v.value === null || !v.prev || v.prev.value === null) return null;
  if ((v.flags | v.prev.flags) & (FLAG.smallN | FLAG.noDenominator | FLAG.suppressed)) return null;
  const d = v.value - v.prev.value; const scale = Math.max(Math.abs(v.prev.value), 1e-9);
  return Math.abs(d) / scale < 0.005 ? { dir: 'flat', delta: d } : { dir: d > 0 ? 'up' : 'down', delta: d };
}

export type VaccineStatus = 'met' | 'below' | 'none';
export interface VaccineRow { slug: string; label: string; target: number; value: number | null; year: number | null; flags: number; status: VaccineStatus; preliminary: boolean }
/** As 8 vacinas prioritárias; ausente = "sem registro" (fora da contagem). Cobertura acima de 100 % conta como na meta e não é truncada. */
export function vaccineRows(found: VaccineValue[]): VaccineRow[] {
  const by = new Map(found.map(f => [f.slug, f]));
  return VACCINE_PRIORITY.map(t => {
    const f = by.get(t.slug); const value = f?.value ?? null;
    return { slug: t.slug, label: t.short, target: t.target, value, year: f?.year ?? null, flags: f?.flags ?? 0, status: value === null ? 'none' as const : value >= t.target ? 'met' as const : 'below' as const, preliminary: f?.status === 'preliminary' };
  }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}
export const vaccineSummary = (rows: VaccineRow[]) => ({ met: rows.filter(r => r.status === 'met').length, below: rows.filter(r => r.status === 'below').length, withData: rows.filter(r => r.status !== 'none').length, total: rows.length, year: rows.find(r => r.year !== null)?.year ?? null });

/** Frase de abertura: fatos comparativos, sem juízo clínico. Escolhe o indicador mais afastado da mediana do grupo e cita vacinas abaixo da meta. */
export function healthLede(o: { scope: string; groupLabel: string; cards: Array<{ title: string; bench: BenchState; value: number | null }>; vaccines: VaccineRow[] }): string | null {
  const ok = o.cards.filter(c => c.bench.kind === 'ok' && c.value !== null).map(c => {
    const b = c.bench as Extract<BenchState, { kind: 'ok' }>; const spread = Math.max(b.group.p90 - b.group.p10, 1e-9);
    return { c, b, z: (c.value! - b.group.p50) / spread };
  }).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const parts: string[] = [];
  if (ok[0]) { const { c, b } = ok[0]; parts.push(`${c.title} em ${o.scope} está na ${quintileWord(b.quintile)} entre ${b.group.n.toLocaleString('pt-BR')} ${o.groupLabel}`); }
  const s = vaccineSummary(o.vaccines);
  if (s.withData > 0) parts.push(s.below === 0 ? `as ${s.met} vacinas prioritárias com registro estão na meta` : `${s.below} de ${s.withData} vacinas prioritárias estão abaixo da meta`);
  return parts.length ? `${parts.join('; ')}.` : null;
}

const TYPE_NAMES: Record<number, string> = { 1: 'Posto de saúde', 2: 'Centro de saúde / Unidade básica', 4: 'Policlínica', 5: 'Hospital geral', 7: 'Hospital especializado', 15: 'Unidade mista', 22: 'Consultório isolado', 36: 'Clínica / Centro de especialidade', 39: 'SADT isolado', 43: 'Farmácia', 73: 'Pronto atendimento', 62: 'Hospital-dia isolado', 70: 'Centro de atenção psicossocial', 69: 'Centro de hemoterapia', 50: 'Unidade de vigilância em saúde', 71: 'Centro de apoio à saúde da família', 74: 'Polo academia da saúde' };
const WORDS: Record<string, string> = { consultorio: 'consultório', clinica: 'clínica', farmacia: 'farmácia', policlinica: 'policlínica', basica: 'básica', saude: 'saúde', diagnose: 'diagnose', laboratorio: 'laboratório', publico: 'público', regulacao: 'regulação', gestao: 'gestão', atencao: 'atenção', especializada: 'especializada', urgencia: 'urgência', emergencia: 'emergência', movel: 'móvel', terrestre: 'terrestre', unidade: 'unidade', apoio: 'apoio', terapia: 'terapia' };
/** Nome legível do tipo de estabelecimento: tabela por código oficial e, na falta, o rótulo oficial em caixa de frase e com acentos comuns. */
export function prettyType(code: number, label: string): string {
  if (TYPE_NAMES[code]) return TYPE_NAMES[code]!;
  const lower = label.toLowerCase().split(/(\W+)/).map(w => WORDS[w] ?? w).join('');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
