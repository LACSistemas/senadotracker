import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CoverageNote } from '@/components/commissions/coverage-note';

function RapporteurEvents({ x }: { x: any }) {
  if (!x.eventCount || x.eventCount <= 1) return null;
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer font-semibold text-primary">Ver histórico</summary>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {(x.events ?? []).map((e: any, j: number) => (
          <li key={`${e.start ?? ''}-${e.status ?? ''}-${j}`}>{e.start ? e.start.slice(0, 10) : 'Data não informada'}{e.status ? ` · ${e.status}` : ''}</li>
        ))}
      </ul>
    </details>
  );
}

function RapporteurRow({ x }: { x: any }) {
  const period = x.eventCount && x.eventCount > 1 && x.firstRecordDate && x.lastRecordDate
    ? ` · ${x.firstRecordDate.slice(0, 10)}–${x.lastRecordDate.slice(0, 10)}`
    : '';
  const registro = x.eventCount && x.eventCount > 1 ? ` · ${x.eventCount} registros conhecidos` : x.start ? ` · registro em ${x.start.slice(0, 10)}` : '';
  const status = x.status && (!x.eventCount || x.eventCount === 1) ? ` · ${x.status}` : '';
  return (
    <div className="text-sm">
      <p className="font-semibold">
        {x.role || 'Relatoria'} ·{' '}
        {x.personId ? <Link className="focus-ring rounded-sm text-primary hover:underline" href={`/parlamentares/${x.source}/${x.personId}`}>{x.personName || x.personId}</Link> : x.personName || 'Pessoa não resolvida'}
      </p>
      <p className="text-xs text-muted-foreground">{[x.party, x.uf].filter(Boolean).join(' · ')}{registro}{period}{status}</p>
      <RapporteurEvents x={x} />
    </div>
  );
}

function RapporteurshipGroup({ g, source }: { g: any; source: string }) {
  return (
    <article className="card-elevated flex gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/30">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><FileText size={15} /></span>
      <div className="min-w-0 flex-1">
        <Link href={`/legislativo/proposicoes/${source}/${g.proposalId}`} className="focus-ring inline-block rounded-full">
          <Badge className="border-0 bg-secondary font-mono text-xs normal-case tracking-normal text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{g.proposalLabel || g.proposalId}</Badge>
        </Link>
        {g.proposalSummary && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{g.proposalSummary}</p>}
        <div className="mt-3 space-y-3">{g.rapporteurs.map((x: any, i: number) => <RapporteurRow key={`${x.personId || 'unknown'}-${x.role || ''}-${i}`} x={x} />)}</div>
      </div>
    </article>
  );
}

export function CommissionRapporteurships({ data }: { data: any }) {
  const r = data?.rapporteurships;
  const header = (
    <header><p className="eyebrow">Relatorias</p><h2 id="relatorias-title" className="display-title mt-2 text-2xl sm:text-3xl">Relatorias conhecidas</h2></header>
  );

  if (!r || r.coverage === 'unavailable' || !r.known?.length) {
    return (
      <section aria-labelledby="relatorias-title">
        {header}
        <p className="mt-2 text-sm text-muted-foreground">Relatorias identificadas na cobertura atual. A presença nesta lista não significa que a relatoria permaneça vigente.</p>
        <CoverageNote className="mt-4">Nenhuma relatoria identificada na cobertura atual.</CoverageNote>
      </section>
    );
  }

  return (
    <section aria-labelledby="relatorias-title">
      {header}
      <p className="mt-2 text-sm text-muted-foreground">Relatorias identificadas no histórico coberto. A presença nesta lista não significa que a relatoria permaneça vigente.</p>
      <p className="mt-3 text-sm text-muted-foreground">{r.distinctProposals} matérias com relatoria identificada</p>
      <div className="mt-5 space-y-4">{r.known.map((g: any) => <RapporteurshipGroup key={g.proposalId} g={g} source={r.source} />)}</div>
      {r.distinctProposals > r.known.length && <p className="mt-4 text-sm text-muted-foreground">Mostrando as {r.known.length} matérias mais recentes entre {r.distinctProposals} matérias com relatoria identificada.</p>}
    </section>
  );
}
