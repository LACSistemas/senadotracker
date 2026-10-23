import type { PoliceChapter } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { EmptyNote } from './security-ui';

export function PoliceChapterBody({ ch }: { ch: PoliceChapter }) {
  return (
    <>
      <p className="rounded-xl border border-[#a65d08]/30 bg-[#fdf3e3] p-3 text-sm leading-6 text-[#7a4606]"><strong>Como ler: </strong>estes são registros da ação do Estado. Mais apreensões ou prisões podem significar mais policiamento, e não mais crime. Nenhum desses números prova a existência de organização criminosa, e medidas diferentes (contagens, pesos, mandados) nunca se somam.</p>
      {ch.families.length === 0 && <EmptyNote title="Sem registros neste território">{ch.emptyReason}</EmptyNote>}
      {ch.families.map(f => (
        <div key={f.code} className="rounded-2xl border bg-white p-4 sm:p-5">
          <h3 className="font-display text-xl text-[#14304f]">{f.label}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{f.semantics}</p>
          <div className={f.series.length > 1 ? 'mt-4 grid gap-5 lg:grid-cols-2' : 'mt-4'}>{f.series.map(s => <div key={s.chart.id} className="min-w-0 rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{s.abrangencia}</p><TrendChart chart={s.chart} compact title={false} hideControls={false} /><p className="mt-1 text-[0.68rem] text-muted-foreground">Fonte: {s.source} · unidade: {s.unit}{s.note ? ` · ${s.note}` : ''}</p></div>)}</div>
          {f.series.length > 1 && <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">As séries acima podem registrar o mesmo fato e <strong>não se somam</strong>.</p>}
        </div>
      ))}
      {ch.national.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">No Brasil (soma das 27 UFs, por medida)</h3>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-xs"><caption className="sr-only">Totais nacionais por medida e ano</caption><thead className="bg-secondary"><tr><th scope="col" className="p-2">Medida</th><th scope="col" className="p-2">Quem informa</th>{ch.national[0]!.years.map(y => <th key={y.year} scope="col" className="p-2 text-right">{y.year}</th>)}</tr></thead>
            <tbody>{ch.national.map(n => <tr key={n.indicatorId} className="border-t"><th scope="row" className="p-2 font-medium">{n.label}</th><td className="p-2">{n.abrangencia}</td>{n.years.map(y => <td key={y.year} className="tnum p-2 text-right">{fmt(y.value, 0)}{!y.complete ? <span className="ml-1 rounded bg-secondary px-1 text-[0.6rem]" title="Ano incompleto ou UF sem dado">parcial</span> : null}</td>)}</tr>)}</tbody></table></div>
          <p className="mt-2 text-[0.7rem] text-muted-foreground">Cada linha soma as UFs do MESMO indicador. Estaduais e PF/PRF aparecem em linhas separadas e nunca se somam; o ano corrente é parcial.</p></div>
      )}
      {ch.notAvailable.length > 0 && <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">O que NÃO existe nas fontes oficiais abertas</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{ch.notAvailable.map(n => <li key={n}>{n}</li>)}</ul></details>}
    </>
  );
}
