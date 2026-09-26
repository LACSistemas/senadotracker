'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Crown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfficialPortrait } from '@/components/app-image';
import { CoverageNote } from '@/components/commissions/coverage-note';

const dateLabel = (v: string | null) => v ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v.slice(0, 10)}T12:00:00Z`)) : 'data não informada';

/** Mesma classificação usada no snapshot da Câmara (regex sobre o texto do cargo), aplicada aqui também
    aos membros do Senado — ambos chegam com um `role` em texto livre, só a fonte difere. */
function classifyByRole(members: any[]) {
  const role = (r: any) => String(r.role ?? '').toLowerCase();
  return {
    president: members.find(r => /presidente/.test(role(r)) && !/vice/.test(role(r))) ?? null,
    vicePresidents: members.filter(r => /vice/.test(role(r))),
    titularMembers: members.filter(r => /titular/.test(role(r)) && !/presidente|vice/.test(role(r))),
    alternateMembers: members.filter(r => /suplente|alternate/.test(role(r))),
    otherMembers: members.filter(r => !/(titular|suplente|alternate|presidente|vice)/.test(role(r))),
  };
}

function Avatar({ p, featured }: { p: any; featured?: boolean | undefined }) {
  const name = p.name || p.personName || 'Pessoa não identificada';
  return (
    <span className={cn('relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground', featured && 'ring-2 ring-primary')}>
      {p.photoUrl ? <OfficialPortrait src={p.photoUrl} name={name} sizes="36px" /> : <User size={15} />}
      {featured && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
          <Crown size={9} />
        </span>
      )}
    </span>
  );
}

function PersonRow({ p, index, featured }: { p: any; index: number; featured?: boolean | undefined }) {
  const id = p.profileId ?? p.personExternalId;
  const name = p.name || p.personName || 'Pessoa não identificada';
  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm', index > 0 && 'border-t')}>
      <Avatar p={p} featured={featured} />
      <span className="min-w-0 flex-1 font-semibold">
        {id ? <Link className="focus-ring rounded-sm text-primary hover:underline" href={`/parlamentares/${p.source || 'camara'}/${id}`}>{name}</Link> : name}
      </span>
      <span className="text-xs text-muted-foreground">{[p.role, p.party, p.uf].filter(Boolean).join(' · ')}</span>
    </li>
  );
}

function People({ title, items, limit = 10, featured }: { title: string; items: any[]; limit?: number; featured?: boolean }) {
  const [open, setOpen] = useState(false);
  const visible = open ? items : items.slice(0, limit);
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h4 className="font-bold">{title} <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h4>
        {items.length > limit && <button type="button" className="focus-ring rounded-sm text-sm font-bold text-primary hover:underline" onClick={() => setOpen(v => !v)}>{open ? 'Mostrar menos' : `Ver todos os ${items.length}`}</button>}
      </div>
      <ul className="mt-2 overflow-hidden rounded-xl border">{visible.map((p, i) => <PersonRow key={`${p.profileId ?? p.personExternalId ?? p.name ?? 'person'}-${p.role ?? i}`} p={p} index={i} featured={featured} />)}</ul>
    </div>
  );
}

function PartyBars({ members }: { members: any[] }) {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const p of members) { if (p.party) counts.set(String(p.party), (counts.get(String(p.party)) ?? 0) + 1); else unknown++; }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown: [string, number][] = sorted.slice(0, 8);
  const other = sorted.slice(8).reduce((n, [, v]) => n + v, 0);
  if (unknown) shown.push(['Partido não identificado', unknown]);
  if (other) shown.push(['Outros', other]);
  const max = Math.max(1, ...shown.map(([, v]) => v));
  const total = members.length;
  if (!shown.length) return null;
  return (
    <div>
      <ul className="mt-3 space-y-3">
        {shown.map(([name, count], index) => (
          <li key={name} title={`${name}: ${count} membros`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={index < 3 ? 'font-bold' : ''}>{name}</span>
              <strong className="tabular-nums">{count}</strong>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={cn('h-full rounded-full', index < 3 ? 'bg-primary' : 'bg-primary/70')} style={{ width: `${count / max * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Distribuição por partido entre os {total} membros identificados.</p>
    </div>
  );
}

function CompositionBody({ president, vicePresidents, titularMembers, alternateMembers, otherMembers, allMembers }: {
  president: any; vicePresidents: any[]; titularMembers: any[]; alternateMembers: any[]; otherMembers: any[]; allMembers: any[];
}) {
  return (
    <>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="font-bold">Presidência</h3>
          {president && <People title="Presidente" items={[president]} limit={1} featured />}
          <People title="Vice-presidências" items={vicePresidents} limit={3} featured />
        </div>
        <div>
          <h3 className="font-bold">Distribuição partidária</h3>
          <PartyBars members={allMembers} />
        </div>
      </div>
      <People title="Titulares" items={titularMembers} limit={12} />
      <People title="Suplentes" items={alternateMembers} limit={8} />
      <People title="Outras funções" items={otherMembers} limit={8} />
    </>
  );
}

export function CommissionComposition({ data, source }: { data: any; source: string }) {
  const c = data?.composition;
  const senate = data?.members ?? [];
  const header = <header><p className="eyebrow">Composição</p><h2 id="composicao-title" className="display-title mt-2 text-2xl sm:text-3xl">Quem compõe a comissão</h2></header>;

  if (source === 'senado') {
    if (!senate.length) {
      return (
        <section aria-labelledby="composicao-title">
          {header}
          <p className="mt-2 text-sm text-muted-foreground">Membros identificados na cobertura atual. O Senado ainda não possui snapshot completo por colegiado.</p>
          <CoverageNote className="mt-4">Composição atual ainda não disponível na cobertura coletada.</CoverageNote>
        </section>
      );
    }
    const classified = classifyByRole(senate);
    return (
      <section aria-labelledby="composicao-title">
        {header}
        <p className="mt-2 text-sm text-muted-foreground">Membros identificados na cobertura atual. O Senado ainda não possui snapshot completo por colegiado.</p>
        <h3 className="mt-5 text-lg font-bold">Membros identificados</h3>
        <CompositionBody {...classified} allMembers={senate} />
      </section>
    );
  }

  if (!c || c.coverage === 'unavailable') {
    return (
      <section aria-labelledby="composicao-title">
        {header}
        <CoverageNote className="mt-4">Composição atual ainda não disponível na cobertura coletada.</CoverageNote>
      </section>
    );
  }

  return (
    <section aria-labelledby="composicao-title">
      {header}
      <h3 className="mt-5 text-lg font-bold">{c.coverage === 'complete_current' ? 'Composição atual' : 'Membros identificados'}</h3>
      {c.coverage !== 'complete_current' && <p className="mt-1 text-sm text-muted-foreground">A cobertura disponível não representa necessariamente a composição completa.</p>}
      {c.observedAt && <p className="mt-1 text-sm text-muted-foreground">Atualizado em {dateLabel(c.observedAt)}</p>}
      <CompositionBody
        president={c.president}
        vicePresidents={c.vicePresidents ?? []}
        titularMembers={c.titularMembers ?? []}
        alternateMembers={c.alternateMembers ?? []}
        otherMembers={c.otherMembers ?? []}
        allMembers={c.allMembers ?? []}
      />
    </section>
  );
}
