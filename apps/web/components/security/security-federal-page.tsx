import { ShieldAlert } from 'lucide-react';
import { ChapterShell } from '@/components/security/security-ui';
import { TrendChart } from '@/components/security/trend-chart';
import { StatGrid, BarList } from '@/components/infrastructure/infrastructure-ui';
import type { SecurityFederalPageData, SummaryTable } from '@/lib/security/federal';

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

function SummaryTableView({ table }: { table: SummaryTable }) {
  return <details className="rounded-xl border bg-white/60 p-4 text-sm"><summary className="cursor-pointer py-1 font-semibold text-[#14304f]">{table.title} ({table.rows.length})</summary>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[26rem] text-left text-sm"><thead><tr className="border-b text-muted-foreground">{table.columns.map(c => <th key={c} scope="col" className="py-1.5 pr-3 font-semibold">{c}</th>)}</tr></thead>
      <tbody>{table.rows.map(r => <tr key={r.id} className="border-b last:border-0"><th scope="row" className="py-1.5 pr-3 font-semibold text-[#14304f]">{r.label}</th>{r.cells.map((c, i) => <td key={i} className="py-1.5 pr-3 tabular-nums">{c ?? '—'}</td>)}</tr>)}</tbody>
    </table></div>
    {table.caption && <p className="mt-2 text-xs text-muted-foreground">{table.caption}</p>}
  </details>;
}

export function SecurityFederalPage({ data }: { data: SecurityFederalPageData }) {
  const { crime, structure, prison, finance, sources } = data;
  const ch = (ok: boolean, c: { id: string; number: number; title: string; emptyReason: string }, node: React.ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason} />;

  return <div className="space-y-10">
    {ch(crime.available, { id: 'criminalidade', number: 1, title: 'Criminalidade organizada', emptyReason: crime.emptyReason }, (
      <ChapterShell accent="blue" icon={ShieldAlert} id="criminalidade" number={1} title="Criminalidade organizada" narrative={crime.narrative} limits={['Atividade policial registrada, não extensão real do crime.', 'Fonte estadual (Sinesp VDE) — Polícia Federal/PRF têm série própria, não somada aqui.', crime.stateSourcesNote]} sources="Fonte: Sinesp VDE (MJSP).">
        {crime.charts.map(c => <TrendChart key={c.id} chart={c} />)}
        {crime.summary && <SummaryTableView table={crime.summary} />}
      </ChapterShell>
    ))}

    {ch(structure.available, { id: 'efetivos', number: 2, title: 'Efetivos e estrutura', emptyReason: structure.emptyReason }, (
      <ChapterShell accent="blue" icon={ShieldAlert} id="efetivos" number={2} title="Efetivos e estrutura" narrative={structure.narrative} limits={['Efetivo declarado por cada corporação ao FBSP; não é um cadastro nominal.', 'Registros de vínculo do SIAPE (PF/PRF) não são efetivo policial no mesmo sentido do FBSP.']} sources="Fontes: FBSP e SIAPE.">
        {structure.fbsp.length > 0 && <BarList title="Efetivo por corporação (FBSP)" rows={structure.fbsp} />}
        {structure.pfChart && <TrendChart chart={structure.pfChart} />}
        {structure.prfChart && <TrendChart chart={structure.prfChart} />}
      </ChapterShell>
    ))}

    {ch(prison.available, { id: 'prisional', number: 3, title: 'Sistema prisional', emptyReason: prison.emptyReason }, (
      <ChapterShell accent="blue" icon={ShieldAlert} id="prisional" number={3} title="Sistema prisional" narrative={prison.narrative} limits={['Dados declarados semestralmente pelas unidades ao SISDEPEN/SENAPPEN.', 'Cobertura e completude variam por semestre — UFs participantes nem sempre são as mesmas de um período para outro.']} sources="Fonte: SISDEPEN/SENAPPEN.">
        <StatGrid items={prison.stats} />
        {prison.charts.map(c => <TrendChart key={c.id} chart={c} />)}
        {prison.summary && <SummaryTableView table={prison.summary} />}
      </ChapterShell>
    ))}

    {ch(finance.available, { id: 'financas', number: 4, title: 'Finanças', emptyReason: finance.emptyReason }, (
      <ChapterShell accent="blue" icon={ShieldAlert} id="financas" number={4} title="Finanças" narrative={finance.narrative} limits={['Gasto do órgão superior federal (MJSP), não uma soma dos 27 orçamentos estaduais de segurança.', 'Empenhado, liquidado e pago são estágios diferentes do mesmo gasto: nunca somados entre si.']} sources="Fonte: Siconfi/Portal da Transparência.">
        {finance.chart && <TrendChart chart={finance.chart} />}
      </ChapterShell>
    ))}

    <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">{sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Criminalidade estadual municipalizada e trânsito não têm agregado nacional nesta base — cada estado define seus próprios tipos penais e fontes, o que impede somar com metodologia única; veja cada estado individualmente em <a href="/estados" className="underline">/estados</a>.</p>
    </section>
  </div>;
}
