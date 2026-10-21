import { Home } from 'lucide-react';
import { heatBand, monthName, type EvoBandPoint, type ResidentStory } from '@/lib/health-story';
import { sequentialRamp, emptyFill } from '@/lib/scale';
import { competenceLabel } from '@/lib/exec-territory';

const int = new Intl.NumberFormat('pt-BR');
const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const medianAt = (b: EvoBandPoint[], year: number) => b.find(x => x.year === year)?.p50 ?? null;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return <div className="rounded-lg border bg-[#f7f9fc] px-3 py-2.5"><p className="text-[0.68rem] text-muted-foreground">{label}</p><p className="font-display text-2xl leading-tight text-[#14304f]">{value}</p>{sub && <p className="text-[0.68rem] text-muted-foreground">{sub}</p>}</div>;
}

/** "Como os moradores usam o hospital": 4 números dos últimos 12 meses, calendário de calor (índice sobre o mês típico) e onde os moradores são internados. */
export function ResidentsPanel({ story, scope, kind, ufName }: { story: ResidentStory; scope: string; kind: 'uf' | 'municipio'; ufName: string }) {
  const w = story.window; const lastYear = Math.floor(story.lastCompetence / 100);
  const gRate = medianAt(story.group, lastYear) ?? medianAt(story.group, lastYear - 1); const gIn = medianAt(story.groupInMun, lastYear) ?? medianAt(story.groupInMun, lastYear - 1);
  const groupWord = kind === 'municipio' ? `mediana dos municípios de ${ufName}` : 'mediana das UFs';
  const inPct = w.inMun; const lastFull = [...story.years].reverse().find(y => !y.partial && y.inMun !== null);
  const legend = ['até 60', '60–85', '85–110', '110–135', '135 ou mais'];
  return (
    <section aria-labelledby="moradores" className="rounded-xl border bg-white p-4 sm:p-5">
      <header className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: '#fce8f2' }} aria-hidden><Home size={18} color="#db2777" /></span>
        <div><h2 id="moradores" className="font-display text-2xl text-[#14304f]">Como os moradores de {scope} usam o hospital</h2><p className="mt-0.5 text-xs text-muted-foreground">Internações SUS de residentes, por mês de processamento, até {competenceLabel(`${Math.floor(story.lastCompetence / 100)}-${String(story.lastCompetence % 100).padStart(2, '0')}-01`)}.</p></div></header>
      {story.story && <p className="mt-4 max-w-4xl text-sm leading-relaxed text-[#14304f]">{story.story}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Internações nos últimos 12 meses" value={int.format(w.aih)} sub={w.rate !== null ? `${nf(1).format(w.rate)} por 1.000 hab.${gRate !== null ? ` · ${groupWord}: ${nf(1).format(gRate)}` : ''}` : 'taxa indisponível (sem população)'} />
        <Tile label={kind === 'municipio' ? 'Tratadas no próprio município' : 'Atendidas no município de residência'} value={inPct === null ? '—' : `${nf(0).format(inPct)}%`} sub={gIn !== null ? `${groupWord}: ${nf(0).format(gIn)}%` : undefined} />
        <Tile label="Permanência média" value={w.stay === null ? '—' : `${nf(1).format(w.stay)} dias`} sub={w.icsapPct !== null ? `${nf(1).format(w.icsapPct)}% por condições evitáveis na atenção básica (ICSAP)` : undefined} />
        <Tile label="Valor médio aprovado por internação" value={w.avgValue === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(w.avgValue)} sub="valor aprovado, não pago" />
      </div>
      {inPct !== null && <div className="mt-4"><p className="mb-1 text-xs font-semibold text-[#14304f]">Onde os moradores são internados (12 meses)</p>
        <div className="relative h-5 overflow-hidden rounded-full bg-[#fce8f2]" role="img" aria-label={`${nf(0).format(inPct)}% no município de residência, ${nf(0).format(100 - inPct)}% fora`}>
          <div className="h-full rounded-full bg-[#115b45]" style={{ width: `${inPct}%` }} />{gIn !== null && <span className="absolute top-0 h-full w-0.5 bg-[#14304f]" style={{ left: `${gIn}%` }} title={`${groupWord}: ${nf(0).format(gIn)}%`} />}
        </div>
        <p className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground"><span><strong className="text-[#115b45]">{nf(0).format(inPct)}%</strong> no município de residência</span>{gIn !== null && <span>traço: {groupWord}</span>}<span><strong className="text-[#db2777]">{nf(0).format(100 - inPct)}%</strong> fora</span></p>
        <p className="text-[0.68rem] text-muted-foreground">O arquivo do SIH informa se a internação foi fora do município de residência, mas não o destino: por isso não há mapa de fluxo.</p></div>}
      <div className="mt-5">
        <h3 className="text-sm font-bold text-[#14304f]">Calendário de internações</h3>
        {story.heatOk ? <>
          <p className="text-[0.7rem] text-muted-foreground">Cada quadrado é um mês; 100 = mês típico de 2013–2019 ({int.format(Math.round(story.baselineMonthly ?? 0))} internações). Mais escuro, mais movimento.</p>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] border-separate text-[0.65rem]" style={{ borderSpacing: 2 }} aria-label="Calendário de internações por mês e ano">
            <thead><tr><th className="w-10" /><>{Array.from({ length: 12 }, (_, i) => <th key={i} className="font-normal text-muted-foreground">{monthName(i + 1)}</th>)}</><th className="w-24 pl-2 text-left font-normal text-muted-foreground">{kind === 'municipio' ? 'Por 1.000 hab.' : 'Por 1.000 hab.'}</th></tr></thead>
            <tbody>{story.heat.map((row, ri) => { const y = story.years[ri]!; const g = medianAt(story.group, y.year);
              return <tr key={y.year}><th scope="row" className="pr-1 text-right font-normal text-muted-foreground">{y.year}</th>
                {row.map(c => { const b = heatBand(c.index); return <td key={c.month} title={c.aih === null ? 'sem dado' : `${monthName(c.month)}/${c.year}: ${int.format(c.aih)} internações (índice ${Math.round(c.index ?? 0)})`} className="h-5 rounded-sm" style={{ background: b < 0 ? emptyFill : sequentialRamp[b] }} />; })}
                <td className="whitespace-nowrap pl-2 text-[#14304f]">{y.rate === null ? <span className="text-muted-foreground">{y.partial ? 'parcial' : '—'}</span> : <><strong>{nf(1).format(y.rate)}</strong>{g !== null && <span className="text-muted-foreground"> · med. {nf(0).format(g)}</span>}</>}</td></tr>; })}</tbody></table></div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground">{legend.map((l, i) => <span key={l} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: sequentialRamp[i] }} aria-hidden />{l}</span>)}<span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border" style={{ background: emptyFill }} aria-hidden />sem dado</span></p>
        </> : <>
          <p className="text-[0.7rem] text-muted-foreground">Poucas internações por mês para um calendário confiável; veja o total por ano.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4 lg:grid-cols-7">{story.years.map(y => <li key={y.year} className="rounded-lg border px-2 py-1.5"><span className="text-muted-foreground">{y.year}{y.partial ? ' (parcial)' : ''}</span><br /><strong className="text-[#14304f]">{int.format(y.aih)}</strong></li>)}</ul>
        </>}
        {lastFull && <p className="sr-only">Último ano completo: {lastFull.year}.</p>}
      </div>
      <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">Mês de processamento da AIH, não da internação. Valores aprovados pelo SUS; internações particulares e de planos não entram. Taxas usam a população oficial do IBGE (sem estimativa em 2022 e 2023).</p>
    </section>
  );
}
