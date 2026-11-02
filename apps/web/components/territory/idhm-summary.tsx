import type { HdiTerritory } from '@senadotracker/db';
import { loadHdiComparison } from '@/lib/territory-idhm';

const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const TERRITORY_COLOR = 'var(--chart-1)'; const BRASIL_COLOR = '#64748b';

/** IDHM (PNUD/IPEA/FJP) do território comparado a Brasil. Só 1991/2000/2010 — decenal, ligado ao Censo.
 * P8: marcos de década em vez do `MultiLineChart` genérico (dimensionado para séries longas; com só 3
 * pontos forçava largura mínima e scrollbar horizontal dentro do card — achado nomeado pelo mandato §4.1).
 * Os 2 traços horizontais com 3 pontos cada são sempre o que existe: nunca insinuam um valor entre décadas. */
export async function IdhmSummary({ territory, territoryName }: { territory: HdiTerritory; territoryName: string }) {
  const { territory: series, brasil } = await loadHdiComparison(territory);
  if (!series) return null;

  const years: number[] = series.points.map(p => p.year);
  const lo = Math.min(...[...series.points.map(p => p.idhm), ...(brasil?.points.map(p => p.idhm) ?? [])]) - 0.04;
  const hi = Math.max(...[...series.points.map(p => p.idhm), ...(brasil?.points.map(p => p.idhm) ?? [])]) + 0.04;
  const xFor = (i: number) => years.length <= 1 ? 50 : (i / (years.length - 1)) * 100;
  const yFor = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const rows: Array<{ label: string; color: string; points: Array<{ year: number; idhm: number | null }> }> = [
    { label: territoryName, color: TERRITORY_COLOR, points: series.points.map(p => ({ year: p.year, idhm: p.idhm })) },
    ...(brasil ? [{ label: 'Brasil', color: BRASIL_COLOR, points: series.points.map(p => ({ year: p.year, idhm: brasil.points.find(b => b.year === p.year)?.idhm ?? null })) }] : []),
  ];
  const latest = series.points.at(-1)!;

  return (
    <section aria-labelledby="idhm-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <p className="eyebrow">Desenvolvimento humano</p>
      <h2 id="idhm-resumo" className="display-title mt-1 text-2xl sm:text-3xl">IDHM de {territoryName}</h2>
      <p className="hero-figure tnum mt-3 text-5xl text-[#14304f]">{number.format(latest.idhm)}</p>
      <p className="mt-1 text-xs text-muted-foreground">IDHM {latest.year} · calculado só em anos de Censo (1991, 2000 e 2010) — não existe valor anual entre eles.</p>
      <div role="img" aria-label={rows.map(r => `${r.label}: ${r.points.map(p => `${p.year} ${p.idhm != null ? number.format(p.idhm) : 'sem dado'}`).join(', ')}`).join(' · ')} className="relative mt-6 h-28">
        {rows.map(row => (
          <svg key={row.label} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <polyline points={row.points.filter(p => p.idhm != null).map(p => `${xFor(years.indexOf(p.year))},${yFor(p.idhm!)}`).join(' ')} fill="none" stroke={row.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {row.points.map(p => p.idhm != null && <circle key={p.year} cx={xFor(years.indexOf(p.year))} cy={yFor(p.idhm)} r="4" fill={row.color} vectorEffect="non-scaling-stroke" />)}
          </svg>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">{years.map(y => <span key={y}>{y}</span>)}</div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">{rows.map(r => <span key={r.label} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} aria-hidden />{r.label}</span>)}</div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-center text-sm">
        <div><dt className="text-xs font-semibold text-muted-foreground">Renda ({latest.year})</dt><dd className="hero-figure tnum mt-0.5 text-xl text-[#14304f]">{latest.idhmRenda != null ? number.format(latest.idhmRenda) : '—'}</dd></div>
        <div><dt className="text-xs font-semibold text-muted-foreground">Longevidade ({latest.year})</dt><dd className="hero-figure tnum mt-0.5 text-xl text-[#14304f]">{latest.idhmLongevidade != null ? number.format(latest.idhmLongevidade) : '—'}</dd></div>
        <div><dt className="text-xs font-semibold text-muted-foreground">Educação ({latest.year})</dt><dd className="hero-figure tnum mt-0.5 text-xl text-[#14304f]">{latest.idhmEducacao != null ? number.format(latest.idhmEducacao) : '—'}</dd></div>
      </dl>
    </section>
  );
}
