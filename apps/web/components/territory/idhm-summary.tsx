import type { HdiTerritory } from '@senadotracker/db';
import { loadHdiComparison } from '@/lib/territory-idhm';

const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const TERRITORY_COLOR = 'var(--chart-1)'; const BRASIL_COLOR = '#64748b';
const DIMENSIONS = [
  { key: 'idhmRenda', label: 'Renda' },
  { key: 'idhmLongevidade', label: 'Longevidade' },
  { key: 'idhmEducacao', label: 'Educação' },
] as const;

/** "+90 pontos" — convenção de imprensa para variação de IDHM (1 ponto = 0,001 do índice, como pontos
 * percentuais). Sinal sempre explícito (nunca "90 pontos" sozinho, que lido fora de contexto parece positivo
 * por padrão). */
function pontos(delta: number): string {
  const p = Math.round(delta * 1000);
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} ${Math.abs(p) === 1 ? 'ponto' : 'pontos'}`;
}

/** IDHM (PNUD/IPEA/FJP) do território comparado a Brasil. Só 1991/2000/2010 — decenal, ligado ao Censo.
 * P8: marcos de década em vez do `MultiLineChart` genérico (dimensionado para séries longas; com só 3
 * pontos forçava largura mínima e scrollbar horizontal dentro do card — achado nomeado pelo mandato §4.1).
 * Os 2 traços horizontais com 3 pontos cada são sempre o que existe: nunca insinuam um valor entre décadas.
 *
 * P14 (retomada e redesenho editorial a pedido do usuário): card grande sempre visível, linha do território
 * mais expressiva (3px) que a do Brasil (2px, cor secundária), pontos pequenos e rótulos de valor em cada
 * marco — nome e valor direto no fim da linha substituem a legenda convencional (padrão "direct labels"
 * recomendado para poucas séries). Diferença território×Brasil em "pontos" (1 ponto = 0,001) por censo,
 * valor de abertura com a variação desde o primeiro ano disponível, frase gerada a partir da dimensão
 * mais forte/mais fraca, e as 3 subdimensões (Renda/Longevidade/Educação) como barras proporcionais em vez
 * de 3 números soltos.
 */
export async function IdhmSummary({ territory, territoryName }: { territory: HdiTerritory; territoryName: string }) {
  const { territory: series, brasil } = await loadHdiComparison(territory);
  if (!series) return null;

  const years = series.points.map(p => p.year);
  const brasilByYear = new Map((brasil?.points ?? []).map(p => [p.year, p]));
  const values = [...series.points.map(p => p.idhm), ...(brasil?.points.map(p => p.idhm) ?? [])];
  const min = Math.min(...values); const max = Math.max(...values);
  const pad = Math.max(0.015, (max - min) * 0.25);
  const lo = min - pad; const hi = max + pad;
  const xFor = (i: number) => years.length <= 1 ? 50 : (i / (years.length - 1)) * 100;
  const yFor = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const ticks = [hi, (lo + hi) / 2, lo];

  const latest = series.points.at(-1)!;
  const first = series.points[0]!;
  const latestBrasil = brasilByYear.get(latest.year) ?? null;
  const esOnTopAtEnd = latestBrasil == null || latest.idhm >= latestBrasil.idhm;

  const dims: Array<{ label: string; value: number }> = [];
  for (const d of DIMENSIONS) { const v = latest[d.key]; if (v != null) dims.push({ label: d.label, value: v }); }
  const dimMax = dims.length ? dims.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const dimMin = dims.length ? dims.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const sentence = dimMax && dimMin && dimMax.label !== dimMin.label && dimMax.value - dimMin.value > 0.005
    ? `A ${dimMax.label.toLowerCase()} é a dimensão mais forte do desenvolvimento humano de ${territoryName}; a ${dimMin.label.toLowerCase()} apresenta o menor índice.`
    : null;

  return (
    <section aria-labelledby="idhm-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <p className="eyebrow">Desenvolvimento humano</p>
      <h2 id="idhm-resumo" className="display-title mt-1 text-2xl sm:text-3xl">IDHM de {territoryName}</h2>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="hero-figure tnum text-5xl text-[#14304f]">{number.format(latest.idhm)}</p>
        {first.year !== latest.year && <p className="text-sm font-bold text-[#866327]">{pontos(latest.idhm - first.idhm)} desde {first.year}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">IDHM {latest.year} · calculado só em anos de Censo (1991, 2000 e 2010) — não existe valor anual entre eles.</p>

      <div role="img" className="relative mt-10 h-60 pr-20 sm:pr-36"
        aria-label={[series, brasil].filter((s): s is NonNullable<typeof s> => !!s).map(s => `${s === series ? territoryName : 'Brasil'}: ${s.points.map(p => `${p.year} ${number.format(p.idhm)}`).join(', ')}`).join(' · ')}>
        {ticks.map((t, i) => (
          <div key={i} className="absolute left-12 right-20 border-t border-dashed border-border/70 sm:right-36" style={{ top: `${yFor(t)}%` }}>
            <span className="absolute -left-12 top-0 w-10 -translate-y-1/2 text-right text-[0.65rem] tabular-nums text-muted-foreground">{number.format(t)}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-12 right-20 sm:right-36">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <polyline points={series.points.map((p, i) => `${xFor(i)},${yFor(p.idhm)}`).join(' ')} fill="none" stroke={TERRITORY_COLOR} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {brasil && <polyline points={series.points.map((p, i) => { const b = brasilByYear.get(p.year); return b ? `${xFor(i)},${yFor(b.idhm)}` : ''; }).filter(Boolean).join(' ')} fill="none" stroke={BRASIL_COLOR} strokeWidth="2" opacity="0.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          </svg>
          {years.map((y, i) => {
            const es = series.points[i]!.idhm; const b = brasilByYear.get(y) ?? null;
            const esOnTop = b == null || es >= b.idhm;
            return (
              <div key={y}>
                <span className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card" style={{ left: `${xFor(i)}%`, top: `${yFor(es)}%`, background: TERRITORY_COLOR }} />
                <span className="absolute -translate-x-1/2 text-[0.68rem] font-bold tabular-nums" style={{ left: `${xFor(i)}%`, top: `${yFor(es)}%`, color: TERRITORY_COLOR, transform: `translate(-50%, ${esOnTop ? '-160%' : '55%'})` }}>{number.format(es)}</span>
                {b && (
                  <>
                    <span className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card" style={{ left: `${xFor(i)}%`, top: `${yFor(b.idhm)}%`, background: BRASIL_COLOR }} />
                    <span className="absolute -translate-x-1/2 text-[0.68rem] tabular-nums text-muted-foreground" style={{ left: `${xFor(i)}%`, top: `${yFor(b.idhm)}%`, transform: `translate(-50%, ${esOnTop ? '55%' : '-160%'})` }}>{number.format(b.idhm)}</span>
                  </>
                )}
              </div>
            );
          })}
          <div className="absolute text-xs font-bold leading-tight" style={{ left: '100%', top: `${yFor(latest.idhm)}%`, color: TERRITORY_COLOR, transform: `translate(12px, ${esOnTopAtEnd ? '-130%' : '10%'})` }}>
            <div className="truncate">{territoryName}</div>
            <div className="tabular-nums">{number.format(latest.idhm)}</div>
          </div>
          {latestBrasil && (
            <div className="absolute text-xs leading-tight text-muted-foreground" style={{ left: '100%', top: `${yFor(latestBrasil.idhm)}%`, transform: `translate(12px, ${esOnTopAtEnd ? '10%' : '-130%'})` }}>
              <div className="font-semibold">Brasil</div>
              <div className="tabular-nums">{number.format(latestBrasil.idhm)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-12 pr-20 text-xs text-muted-foreground sm:pr-36">
        {years.map((y, i) => {
          const b = brasilByYear.get(y);
          const gap = b ? series.points[i]!.idhm - b.idhm : null;
          return (
            <div key={y} className="text-center">
              <div>{y}</div>
              {gap != null && <div className="mt-0.5 text-[0.62rem] font-semibold tabular-nums" style={{ color: gap >= 0 ? TERRITORY_COLOR : BRASIL_COLOR }}>{gap >= 0 ? '+' : '−'}{Math.abs(Math.round(gap * 1000))}</div>}
            </div>
          );
        })}
      </div>
      {brasil && <p className="mt-1 pl-12 pr-20 text-right text-[0.65rem] text-muted-foreground sm:pr-36">diferença vs. Brasil, em pontos de IDHM</p>}

      {sentence && <p className="mt-6 rounded-xl bg-secondary/70 p-3 text-sm leading-6 text-secondary-foreground">{sentence}</p>}

      {dims.length > 0 && (
        <div className="mt-5 space-y-3 border-t pt-4">
          {dims.map(d => (
            <div key={d.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-muted-foreground">{d.label}{dimMax?.label === d.label && <span className="ml-1.5 text-[#866327]">mais forte</span>}{dimMin?.label === d.label && dimMax?.label !== dimMin?.label && <span className="ml-1.5 text-muted-foreground">menor índice</span>}</span>
                <span className="hero-figure tnum text-sm text-[#14304f]">{number.format(d.value)}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${d.value * 100}%`, background: TERRITORY_COLOR }} /></div>
            </div>
          ))}
          <p className="pt-1 text-[0.68rem] text-muted-foreground">Renda, longevidade e educação de {latest.year} — subíndices do mesmo IDHM, escala 0 a 1.</p>
        </div>
      )}
    </section>
  );
}
