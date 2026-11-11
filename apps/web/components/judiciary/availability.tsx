import type { ComponentType } from 'react';
import type { DataCoverage, PeriodGrain } from '@senadotracker/domain';
import { AlertTriangle, CheckCircle2, Clock, FileQuestion, Lock, MinusCircle, ShieldAlert } from 'lucide-react';

/** P14.8 — o Judiciário tem dois conjuntos de estado mais ricos que o `Availability` de 5 estados usado no
 * resto do produto: `AvailabilityState` (10 estados, serving geral) e `ThematicAvailability` (6 estados,
 * temas). As diferenças importam de verdade (o brief é explícito: `METHOD_INCOMPATIBLE` ≠
 * `LEGAL_RESTRICTION` ≠ `NOT_REPORTED` — cada um é uma explicação diferente pro leitor), então em vez de
 * forçar tudo no `Availability` de 5 estados, este módulo tem duas peças:
 *  - `JudiciaryAvailabilityNote`: mostra o estado completo e explicado (usado em metodologia, cobertura
 *    temática, cabeçalhos de capítulo) — nunca perde nuance.
 *  - `toChartCoverage`: adapta pro `DataCoverage` de 5 estados só quando o DADO vai dentro de um
 *    componente existente (`BarChart`, `KpiCard`, `DataTable`...) que não tem como saber da nuance; o texto
 *    completo da nuance sempre acompanha em `note`, então nada se perde — só o ícone/badge simplifica. */
export type JudiciaryAvailability =
  | 'AVAILABLE' | 'NOT_APPLICABLE' | 'NOT_REPORTED' | 'NOT_PUBLISHED' | 'PARTIAL_COVERAGE'
  | 'METHOD_INCOMPATIBLE' | 'SOURCE_UNAVAILABLE' | 'LEGAL_RESTRICTION' | 'STALE' | 'UNVERIFIED_RELATION'
  | 'DOCUMENTATION_ONLY';

const META: Record<JudiciaryAvailability, { label: string; explain: string; icon: ComponentType<{ size?: number }>; tone: 'good' | 'partial' | 'blocked' | 'none' }> = {
  AVAILABLE: { label: 'Disponível', explain: 'Dado publicado pela fonte oficial e elegível para este recorte.', icon: CheckCircle2, tone: 'good' },
  PARTIAL_COVERAGE: { label: 'Cobertura parcial', explain: 'Parte do universo elegível está coberta nesta revisão; o restante não tem dado publicado — a ausência não vira zero.', icon: AlertTriangle, tone: 'partial' },
  NOT_APPLICABLE: { label: 'Não se aplica', explain: 'Este indicador ou seção não existe para este tribunal ou recorte — não é falta de dado, é um universo diferente.', icon: MinusCircle, tone: 'none' },
  NOT_REPORTED: { label: 'Não publicado', explain: 'A fonte oficial não publicou este dado para o recorte pedido.', icon: MinusCircle, tone: 'none' },
  NOT_PUBLISHED: { label: 'Ainda não publicado', explain: 'Há expectativa de publicação, mas a edição mais recente ainda não trouxe este dado.', icon: Clock, tone: 'none' },
  METHOD_INCOMPATIBLE: { label: 'Não agregável nacionalmente', explain: 'É uma taxa ou índice oficial — somar ou tirar média entre tribunais produziria um número sem significado estatístico. Mostramos por tribunal ou ramo em vez de uma média nacional inventada.', icon: AlertTriangle, tone: 'partial' },
  SOURCE_UNAVAILABLE: { label: 'Fonte indisponível', explain: 'A revisão publicada ativa não está carregada no momento.', icon: ShieldAlert, tone: 'blocked' },
  LEGAL_RESTRICTION: { label: 'Restrição de licenciamento', explain: 'A fonte existe e é identificada, mas republicar os fatos estruturados exige uma revisão de licenciamento ainda pendente.', icon: Lock, tone: 'blocked' },
  DOCUMENTATION_ONLY: { label: 'Só documentação', explain: 'Há fontes e metodologia oficiais identificadas, mas nenhum fato estruturado elegível para publicar nesta revisão.', icon: FileQuestion, tone: 'blocked' },
  STALE: { label: 'Desatualizado', explain: 'O dado existe, mas é de uma edição anterior à mais recente publicada.', icon: Clock, tone: 'partial' },
  UNVERIFIED_RELATION: { label: 'Relação não comprovada', explain: 'Não há evidência oficial suficiente para confirmar este vínculo (ex. território x unidade) — por isso não aparece como fato publicado.', icon: AlertTriangle, tone: 'partial' },
};
const TONE_CLASS: Record<string, string> = { good: 'text-[#115b45] bg-[#115b45]/10', partial: 'text-amber-700 bg-amber-50', blocked: 'text-rose-700 bg-rose-50', none: 'text-muted-foreground bg-muted' };

export function JudiciaryAvailabilityNote({ availability, limitations, asOf, source, compact = false }: { availability: string; limitations?: string[] | undefined; asOf?: string | null | undefined; source?: string | undefined; compact?: boolean }) {
  const meta = META[availability as JudiciaryAvailability] ?? META.NOT_REPORTED;
  const Icon = meta.icon;
  if (compact) return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[meta.tone]}`} title={meta.explain}><Icon size={13} aria-hidden /> {meta.label}</span>;
  return (
    <div className={`rounded-xl border p-3 text-xs leading-5 ${meta.tone === 'blocked' ? 'border-rose-200' : meta.tone === 'partial' ? 'border-amber-200' : 'border-border'}`}>
      <p className={`inline-flex items-center gap-1.5 font-bold ${TONE_CLASS[meta.tone]?.split(' ')[0] ?? ''}`}><Icon size={14} aria-hidden /> {meta.label}</p>
      <p className="mt-1 text-muted-foreground">{meta.explain}</p>
      {limitations && limitations.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">{limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {(source || asOf) && <p className="mt-2 text-[0.68rem] text-muted-foreground">{source}{source && asOf ? ' · ' : ''}{asOf ? `atualizado em ${new Date(asOf).toLocaleDateString('pt-BR')}` : ''}</p>}
    </div>
  );
}

const CHART_MAP: Record<JudiciaryAvailability, DataCoverage['availability']> = {
  AVAILABLE: 'available', PARTIAL_COVERAGE: 'partial', STALE: 'stale', NOT_APPLICABLE: 'not_applicable',
  NOT_REPORTED: 'unavailable', NOT_PUBLISHED: 'unavailable', METHOD_INCOMPATIBLE: 'unavailable',
  SOURCE_UNAVAILABLE: 'unavailable', LEGAL_RESTRICTION: 'unavailable', DOCUMENTATION_ONLY: 'unavailable',
  UNVERIFIED_RELATION: 'unavailable',
};
/** Adapta o estado rico do Judiciário pro `DataCoverage` que `charts.tsx`/`metrics.tsx`/`data-table.tsx`
 * já sabem renderizar — a nuance completa vai em `note` (sempre visível no badge/tooltip desses
 * componentes), só o ícone/cor que simplifica para o conjunto de 5 que esses componentes conhecem. */
export function toChartCoverage(availability: string, note: string, opts: { from?: string | null; to?: string | null; grain?: PeriodGrain; sampleSize?: number | null } = {}): DataCoverage {
  return { availability: CHART_MAP[availability as JudiciaryAvailability] ?? 'unavailable', source: 'multiple', period: { from: opts.from ?? null, to: opts.to ?? null, grain: opts.grain ?? 'year' }, batchId: null, note, sampleSize: opts.sampleSize ?? null };
}
