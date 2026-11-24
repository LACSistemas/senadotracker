export interface TrendPoint { label: string; pageviews: number; sessions: number }

/** Gráfico de linha simples pro painel admin — sem o acoplamento a `DataCoverage` dos gráficos
 * públicos (telemetria de uso do site não tem "cobertura de dados" no mesmo sentido que dado cívico;
 * forçar o mesmo contrato seria uma abstração errada). */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(...data.map(d => Math.max(d.pageviews, d.sessions)), 1);
  const x = (i: number) => (data.length === 1 ? 340 : 40 + 600 * i / (data.length - 1));
  const y = (v: number) => 210 - 180 * v / max;
  const line = (key: 'pageviews' | 'sessions') => data.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));

  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">Pageviews e sessões por dia</h2>
        <ul className="flex gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><i className="size-3 rounded-full" style={{ background: 'var(--chart-1)' }} />Pageviews</li>
          <li className="flex items-center gap-2"><i className="size-3 rounded-full" style={{ background: 'var(--chart-2)' }} />Sessões</li>
        </ul>
      </div>
      <div tabIndex={0} role="region" aria-label="Pageviews e sessões por dia, com rolagem horizontal" className="focus-ring overflow-x-auto">
        <svg role="img" aria-label="Gráfico de linha: pageviews e sessões por dia" viewBox="0 0 680 235" className="h-auto min-w-[560px] w-full">
          <g stroke="var(--border)">{ticks.map((t, i) => <line key={i} x1="40" x2="640" y1={y(t)} y2={y(t)} />)}</g>
          <g fill="var(--muted-foreground)" fontSize="11">{ticks.map((t, i) => <text key={i} x="34" y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>)}</g>
          <polyline fill="none" stroke="var(--chart-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={line('pageviews')} />
          <polyline fill="none" stroke="var(--chart-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={line('sessions')} />
          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={x(i)} cy={y(d.pageviews)} r="4" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="2.5"><title>{`${d.label} · Pageviews: ${d.pageviews}`}</title></circle>
              <circle cx={x(i)} cy={y(d.sessions)} r="4" fill="var(--card)" stroke="var(--chart-2)" strokeWidth="2.5"><title>{`${d.label} · Sessões: ${d.sessions}`}</title></circle>
            </g>
          ))}
          <g fill="var(--muted-foreground)" fontSize="11">{data.map((d, i) => (i % labelEvery === 0 ? <text key={d.label} x={x(i)} y="228" textAnchor="middle">{d.label}</text> : null))}</g>
        </svg>
      </div>
      <details className="mt-4 text-sm">
        <summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver dados do gráfico</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b"><th className="p-2">Dia</th><th className="p-2 text-right">Pageviews</th><th className="p-2 text-right">Sessões</th></tr></thead>
            <tbody>{data.map(d => <tr className="border-b" key={d.label}><th className="p-2 font-normal">{d.label}</th><td className="p-2 text-right tabular-nums">{d.pageviews}</td><td className="p-2 text-right tabular-nums">{d.sessions}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
