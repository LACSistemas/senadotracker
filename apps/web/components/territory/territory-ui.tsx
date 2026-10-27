import Link from 'next/link';
import type { ReactNode } from 'react';
import type { IndicatorView } from '@senadotracker/db';
import { sequentialRamp, emptyFill, darkFrom } from '@/lib/scale';
import { competenceLabel, type UfGeometry } from '@/lib/exec-territory';
import { cn } from '@/lib/utils';

const FLAG = { smallN: 1, preliminary: 2, partialCoverage: 4, suppressed: 8, denominatorDivergent: 16, above100: 32, noDenominator: 64 };
const nf = (digits: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const n0 = nf(0);

export function flagLabels(flags: number, status?: 'preliminary' | 'final'): string[] {
  const out: string[] = [];
  if (status === 'preliminary' || flags & FLAG.preliminary) out.push('Preliminar');
  if (flags & FLAG.smallN) out.push('Pequeno número: não comparar');
  if (flags & FLAG.partialCoverage) out.push('Cobertura parcial');
  if (flags & FLAG.denominatorDivergent) out.push('Denominador divergente');
  if (flags & FLAG.above100) out.push('Acima de 100%: possível problema de cadastro');
  if (flags & FLAG.noDenominator) out.push('Sem denominador oficial no ano');
  return out;
}
export function formatIndicator(code: string, value: number | null): string {
  if (value === null) return '—';
  if (code === 'IND-SAU-08') return nf(1).format(value);
  if (code === 'IND-SAU-10' || code === 'IND-SAU-11' || code === 'IND-SAU-12') return `${nf(1).format(value)}%`;
  return nf(2).format(value);
}
export const formatInt = (v: number | null) => v === null ? '—' : n0.format(v);

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold', tone === 'warn' ? 'border-warning/40 text-warning' : 'border-border text-muted-foreground')}>{children}</span>;
}

export function IndicatorCard({ ind, href }: { ind: IndicatorView; href?: string }) {
  const flags = flagLabels(ind.flags, ind.status);
  return (
    <article className="card-lift flex flex-col gap-2 rounded-xl border bg-card p-5">
      <p className="text-sm font-semibold leading-snug">{ind.label}</p>
      <p className="font-display text-4xl leading-none text-primary">{formatIndicator(ind.code, ind.value)}</p>
      <p className="text-xs text-muted-foreground">{ind.unit} · {ind.grain === 'A' ? `ano de ${ind.periodStart.slice(0, 4)}` : competenceLabel(ind.periodStart)}</p>
      {ind.denominator !== null && ind.numerator !== null && <p className="text-xs text-muted-foreground">{formatInt(ind.numerator)} de {formatInt(ind.denominator)}</p>}
      {flags.length > 0 && <div className="flex flex-wrap gap-1">{flags.map(f => <Chip key={f} tone="warn">{f}</Chip>)}</div>}
      {ind.note && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground/80">Como ler</summary><p className="mt-1">{ind.note}</p></details>}
      {href && <Link href={href} className="mt-auto text-xs font-semibold text-primary underline-offset-2 hover:underline">Ver série histórica</Link>}
    </article>
  );
}

export interface SeriesPoint { periodStart: string; value: number | null; flags: number }
/** Série temporal em SVG com tabela equivalente; lacunas ficam como interrupção da linha, nunca como zero. */
export function SeriesChart({ title, code, points, unit }: { title: string; code: string; points: SeriesPoint[]; unit: string }) {
  const valid = points.filter(p => p.value !== null);
  if (valid.length < 2) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Série insuficiente para gráfico: {valid.length} ponto(s) com valor.</p>;
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 28;
  const times = points.map(p => Date.parse(p.periodStart));
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const vs = valid.map(p => p.value as number);
  const lo = Math.min(0, ...vs), hi = Math.max(...vs) * 1.08 || 1;
  const x = (t: number) => L + (t1 === t0 ? 0 : (t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let d = ''; let open = false;
  for (const p of points) {
    if (p.value === null) { open = false; continue; }
    d += `${open ? 'L' : 'M'}${x(Date.parse(p.periodStart)).toFixed(1)} ${y(p.value).toFixed(1)}`; open = true;
  }
  const ticks = [lo, (lo + hi) / 2, hi];
  const years = [...new Set(points.map(p => p.periodStart.slice(0, 4)))];
  const labelYears = years.filter((_, i) => i % Math.ceil(years.length / 6) === 0);
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-2 text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">({unit})</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: de ${formatIndicator(code, valid[0]!.value)} em ${competenceLabel(valid[0]!.periodStart)} a ${formatIndicator(code, valid.at(-1)!.value)} em ${competenceLabel(valid.at(-1)!.periodStart)}`} className="h-auto w-full">
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{nf(t < 10 ? 1 : 0).format(t)}</text></g>)}
        {labelYears.map(yr => <text key={yr} x={x(Date.parse(`${yr}-01-01`))} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-foreground)">{yr}</text>)}
        <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" />
        {valid.length <= 40 && valid.map(p => <circle key={p.periodStart} cx={x(Date.parse(p.periodStart))} cy={y(p.value as number)} r="3" fill={p.flags & FLAG.preliminary ? 'var(--card)' : 'var(--primary)'} stroke="var(--primary)" strokeWidth="1.5"><title>{`${competenceLabel(p.periodStart)}: ${formatIndicator(code, p.value)}`}</title></circle>)}
      </svg>
      <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Tabela da série</summary>
        <div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-1">Período</th><th>Valor</th><th>Situação</th></tr></thead>
          <tbody>{points.map(p => <tr key={p.periodStart} className="border-t"><td className="py-1">{competenceLabel(p.periodStart)}</td><td>{formatIndicator(code, p.value)}</td><td>{flagLabels(p.flags).join('; ') || (p.value === null ? 'sem registro' : 'definitivo')}</td></tr>)}</tbody></table></div>
      </details>
      <p className="mt-2 text-xs text-muted-foreground">Círculos vazios: dado preliminar. Intervalos sem linha: sem registro na fonte, não zero.</p>
    </figure>
  );
}

export interface MapMetric { key: string; label: string; unit: string; digits: number }
/** Mapa municipal da UF: cada município é um link; ausência de valor ou de polígono é dita, não preenchida. */
export function MunicipalMap({ geometry, names, values, hrefFor, selectedId, metric, missing }: {
  geometry: UfGeometry; names: Map<number, string>; values: Map<number, number>; hrefFor: (id: number) => string; selectedId?: number | undefined; metric: MapMetric; missing: string[];
}) {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const edges = [0.2, 0.4, 0.6, 0.8].map(q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
  const band = (v: number) => edges.filter(e => v >= e).length;
  const fmt = nf(metric.digits);
  const legend = sequentialRamp.map((c, i) => ({ c, label: i === 0 ? `até ${fmt.format(edges[0] ?? 0)}` : i === 4 ? `${fmt.format(edges[3] ?? 0)} ou mais` : `${fmt.format(edges[i - 1] ?? 0)} a ${fmt.format(edges[i] ?? 0)}` }));
  return (
    <figure>
      <svg viewBox={geometry.viewBox} role="group" aria-label={`Mapa dos municípios, colorido por ${metric.label}`} className="mx-auto h-auto max-h-[34rem] w-full">
        {geometry.items.map(item => {
          const v = values.get(item.id); const name = names.get(item.id) ?? String(item.id);
          const fill = v === undefined ? emptyFill : sequentialRamp[band(v)]!;
          const sel = item.id === selectedId;
          return <Link key={item.id} href={hrefFor(item.id)} aria-label={`${name}: ${v === undefined ? 'sem dado' : `${fmt.format(v)} ${metric.unit}`}`}>
            <path d={item.d} fill={fill} stroke={sel ? 'var(--foreground)' : 'var(--card)'} strokeWidth={sel ? 2.4 : 0.6} vectorEffect="non-scaling-stroke" className="transition-opacity hover:opacity-80"><title>{`${name}: ${v === undefined ? 'sem dado' : `${fmt.format(v)} ${metric.unit}`}`}</title></path>
          </Link>;
        })}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map((l, i) => <span key={l.c} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border" style={{ background: l.c }} aria-hidden data-dark={i >= darkFrom} />{l.label}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border" style={{ background: emptyFill }} aria-hidden />sem dado</span>
      </figcaption>
      {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Sem polígono na malha oficial utilizada: {missing.join(', ')}. O município continua acessível pela busca.</p>}
    </figure>
  );
}

export function ThemeTabs({ base, active, themes }: { base: string; active: string; themes: Array<{ slug: string; label: string; ready: boolean }> }) {
  const items = [{ slug: '', label: 'Visão geral', ready: true }, ...themes];
  return <nav aria-label="Áreas temáticas" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
    {items.map(t => <Link key={t.slug} href={t.slug ? `${base}/${t.slug}` : base} aria-current={active === t.slug ? 'page' : undefined}
      className={cn('whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold', active === t.slug ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
      {t.label}{!t.ready && <span className="ml-1.5 text-[0.65rem] font-normal opacity-70">em preparação</span>}</Link>)}
  </nav>;
}

export const THEMES = [
  { slug: 'saude', label: 'Saúde', ready: true },
  { slug: 'educacao', label: 'Educação', ready: true },
  { slug: 'seguranca', label: 'Segurança', ready: true },
  { slug: 'bem-estar', label: 'Bem-estar', ready: false },
  { slug: 'infraestrutura', label: 'Infraestrutura', ready: false },
] as const;

const THEME_PLAN: Record<string, { title: string; sources: string[]; text: string }> = {
  educacao: { title: 'Educação', sources: ['Censo Escolar (INEP)', 'IDEB (INEP)', 'FNDE'], text: 'Matrículas, rede escolar e resultados de aprendizagem estão mapeados, mas ainda não foram coletados nem conferidos.' },
  seguranca: { title: 'Segurança', sources: ['SINESP', 'Secretarias estaduais de segurança', 'SIM (óbitos por causas externas)'], text: 'Cada estado publica registros policiais com definições próprias; a comparação entre territórios exige uma camada de harmonização que ainda não existe.' },
  'bem-estar': { title: 'Bem-estar', sources: ['Cadastro Único e Bolsa Família (MDS)', 'IBGE (renda e trabalho)', 'RAIS/CAGED'], text: 'Renda, proteção social e trabalho serão tratados quando as fontes forem coletadas e reconciliadas.' },
  infraestrutura: { title: 'Infraestrutura', sources: ['SNIS (saneamento)', 'ANATEL (conectividade)', 'ANEEL (energia)'], text: 'Saneamento, conectividade e mobilidade dependem de fontes ainda não ingeridas.' },
};
export function ThemePlaceholder({ slug, scope }: { slug: string; scope: string }) {
  const t = THEME_PLAN[slug]; if (!t) return null;
  return <section className="rounded-xl border border-dashed bg-card p-6">
    <p className="eyebrow">Cobertura</p>
    <h2 className="mt-1 font-display text-2xl">{t.title} em {scope}: ainda sem dados publicados</h2>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t.text} Nenhum número é exibido até que a coleta, a reconciliação com a fonte e a definição metodológica estejam concluídas.</p>
    <p className="mt-3 text-sm font-semibold">Fontes previstas</p>
    <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">{t.sources.map(s => <li key={s}>{s}</li>)}</ul>
  </section>;
}

export function MunicipalFinder({ action, defaultValue, ufHidden }: { action: string; defaultValue?: string | undefined; ufHidden?: string | undefined }) {
  return <form action={action} method="get" role="search" className="flex w-full gap-2">
    {ufHidden && <input type="hidden" name="uf" value={ufHidden} />}
    <label className="sr-only" htmlFor="q-muni">Buscar município</label>
    <input id="q-muni" name="q" defaultValue={defaultValue} placeholder="Buscar município pelo nome" autoComplete="off" className="h-11 min-w-0 flex-1 rounded-lg border bg-card px-4 text-sm" />
    <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">Buscar</button>
  </form>;
}
