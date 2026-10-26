'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Scale, Crown, Tags, Calendar, Search } from 'lucide-react';
import { StatTile } from '@/components/commissions/stat-tile';
import { GROUPS, groupMeta, inkOn, nf, pf, formatDate, type GroupKey } from '@/lib/proposicoes/taxonomy';

/**
 * "O que propõe?" — redesenho da seção de produção legislativa do perfil.
 *
 * Tudo aqui opera sobre as proposições JÁ carregadas pelo servidor (até as 100 mais
 * recentes, sem pareceres/relatórios, que são relatorias). O filtro pelos grupos funcionais,
 * a busca e a ordenação são 100% client-side: nenhuma consulta nova, nenhum N+1.
 */

export interface PanelProposal {
  source: string;
  externalId: string;
  type: string | null;
  number: string | null;
  year: number | null;
  label: string | null;
  summary: string | null;
  status: string | null;
  functionalGroup: string | null;
  presentedAt: string | null;
  officialUrl: string;
}

const PRINCIPAL: GroupKey = 'proposicoes_legislativas_principais';
const presentedYear = (p: PanelProposal) => {
  const fromDate = p.presentedAt?.match(/^(\d{4})/)?.[1];
  return fromDate ? Number(fromDate) : p.year ?? null;
};
const norm = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function ProposalCard({ item, themeLabel }: { item: PanelProposal; themeLabel?: string | undefined }) {
  const meta = groupMeta(item.functionalGroup ?? '');
  const sigla = item.type ?? 'Proposição';
  const ref = [sigla, [item.number, item.year].filter(Boolean).join('/')].filter(Boolean).join(' ');
  const canBecomeLaw = item.functionalGroup === PRINCIPAL;
  return (
    <article className="card-elevated flex flex-col rounded-2xl border bg-card p-4 transition hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ background: meta.color, color: inkOn(meta.color) }}>{sigla}</span>
        <Link href={`/legislativo/proposicoes/${item.source}/${encodeURIComponent(item.externalId)}`}
          className="focus-ring text-sm font-bold text-primary underline-offset-2 hover:underline">{ref}</Link>
        {canBecomeLaw && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Scale size={12} aria-hidden="true" />Pode virar lei</span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6">{item.summary || item.label || 'Ementa não informada.'}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-semibold" style={{ color: meta.color }}>{meta.verb}</span>
        {themeLabel ? <> · {themeLabel}</> : null}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>{item.status || 'Situação não informada'} · {formatDate(item.presentedAt)}</span>
        <a href={item.officialUrl} className="focus-ring inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline">
          Fonte oficial <ExternalLink size={12} aria-hidden="true" /></a>
      </div>
    </article>
  );
}

export function ProposalsPanel({ proposals, proposalTotal, relatoriasTotal, themeByProposal }: {
  proposals: PanelProposal[];
  proposalTotal: number;
  relatoriasTotal: number;
  themeByProposal?: Record<string, string>;
}) {
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'old'>('recent');
  const [visible, setVisible] = useState(8);
  const truncated = proposalTotal > proposals.length;

  // Contagem por grupo funcional entre as proposições carregadas (ordem taxonômica fixa).
  const groupEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) counts.set(p.functionalGroup ?? 'atos_documentos_especiais', (counts.get(p.functionalGroup ?? 'atos_documentos_especiais') ?? 0) + 1);
    return GROUPS.flatMap(g => {
      const count = counts.get(g.key) ?? 0;
      return count ? [{ ...g, count, share: count / proposals.length }] : [];
    });
  }, [proposals]);

  const principalCount = useMemo(() => proposals.filter(p => p.functionalGroup === PRINCIPAL).length, [proposals]);

  // Temas publicados entre as carregadas (só os que a base vinculou; sem preencher o resto).
  const topThemes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) { const t = themeByProposal?.[p.externalId]; if (t) counts.set(t, (counts.get(t) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  }, [proposals, themeByProposal]);

  // Ano com mais proposições entre as carregadas.
  const topYear = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of proposals) { const y = presentedYear(p); if (y) counts.set(y, (counts.get(y) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [proposals]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const rows = proposals.filter(p => {
      if (group && p.functionalGroup !== group) return false;
      if (!q) return true;
      return norm([p.label, p.summary, p.type, p.number, p.status].filter(Boolean).join(' ')).includes(q);
    });
    rows.sort((a, b) => (a.presentedAt ?? '').localeCompare(b.presentedAt ?? '') * (sort === 'recent' ? -1 : 1));
    return rows;
  }, [proposals, group, query, sort]);

  const highlights = useMemo(() => proposals.filter(p => p.functionalGroup === PRINCIPAL)
    .sort((a, b) => (b.presentedAt ?? '').localeCompare(a.presentedAt ?? '')).slice(0, 3), [proposals]);

  if (!proposals.length) return (
    <div className="mt-6 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      Nenhuma proposição de autoria vinculada nos lotes publicados.
    </div>
  );

  const shown = filtered.slice(0, visible);
  const selectClass = 'focus-ring rounded-xl border bg-card px-3 py-2 text-sm font-semibold';

  return (
    <div className="mt-6 space-y-7">
      {/* Resumo — números com palco, no espírito dos tiles de comissões */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Tags} value={truncated ? `${nf.format(proposals.length)}+` : nf.format(proposalTotal)} label="Proposições apresentadas"
          action={<span className="text-xs text-muted-foreground">autoria registrada nos lotes</span>} />
        <StatTile icon={Crown} value={nf.format(relatoriasTotal)} label="Relatorias"
          action={<span className="text-xs text-muted-foreground">pareceres em que foi designado</span>} />
        <StatTile icon={Scale} value={nf.format(principalCount)} label="Podem virar lei"
          action={<span className="text-xs text-muted-foreground">projetos, PECs e medidas</span>} />
        <StatTile icon={Tags} value={nf.format(topThemes.length)} label="Temas principais"
          action={<span className="line-clamp-1 text-xs text-muted-foreground">{topThemes.slice(0, 3).join(', ') || 'sem tema publicado'}</span>} />
        <StatTile icon={Calendar} value={topYear ? String(topYear[0]) : '—'} label="Ano com mais proposições"
          action={<span className="text-xs text-muted-foreground">{topYear ? `${nf.format(topYear[1])} no período carregado` : 'sem data publicada'}</span>} />
      </div>

      {/* Faixa de composição pelos grupos funcionais — a cor codifica a entidade, não enfeite */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full border bg-muted" role="img"
          aria-label={`Composição: ${groupEntries.map(e => `${e.verb} ${pf.format(e.share)}`).join(', ')}`}>
          {groupEntries.map(e => (
            <span key={e.key} style={{ width: `${e.share * 100}%`, background: e.color, opacity: group && group !== e.key ? 0.3 : 1 }}
              className="transition-opacity" title={`${e.verb}: ${nf.format(e.count)} (${pf.format(e.share)})`} />
          ))}
        </div>
      </div>

      {/* Filtro pelos grupos funcionais ("os 10 tipos") + busca + ordenação, tudo client-side */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de proposição">
          <FilterPill active={group === null} onClick={() => { setGroup(null); setVisible(8); }} label={`Tudo (${nf.format(proposals.length)})`} />
          {groupEntries.map(e => (
            <FilterPill key={e.key} active={group === e.key} color={e.color}
              onClick={() => { setGroup(group === e.key ? null : e.key); setVisible(8); }}
              label={`${e.verb} (${nf.format(e.count)})`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex-1 min-w-[12rem]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={e => { setQuery(e.target.value); setVisible(8); }}
              placeholder="Buscar por tema, número ou ementa…"
              className="focus-ring w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm" aria-label="Buscar proposição" />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">Ordenar por
            <select value={sort} onChange={e => setSort(e.target.value as 'recent' | 'old')} className={selectClass}>
              <option value="recent">Mais recentes</option>
              <option value="old">Mais antigas</option>
            </select>
          </label>
        </div>
      </div>

      {/* Destaques — as proposições que podem virar lei, as de maior consequência */}
      {highlights.length > 0 && group === null && !query && (
        <section aria-label="Destaques">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Scale size={16} className="text-primary" aria-hidden="true" />Destaques</h3>
          <p className="mt-1 text-xs text-muted-foreground">Projetos e propostas de emenda à Constituição — as de maior potencial de impacto.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {highlights.map(item => <ProposalCard key={item.externalId} item={item} themeLabel={themeByProposal?.[item.externalId]} />)}
          </div>
        </section>
      )}

      {/* Lista filtrada */}
      <section aria-label="Proposições">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">{group ? groupMeta(group).verb : query ? 'Resultados' : 'Mais recentes'}</h3>
          <span className="text-xs text-muted-foreground">
            {nf.format(filtered.length)} {filtered.length === 1 ? 'proposição' : 'proposições'}
            {truncated && !group && !query ? ` · as ${nf.format(proposals.length)} mais recentes de ${nf.format(proposalTotal)}` : ''}
          </span>
        </div>
        {shown.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {shown.map(item => <ProposalCard key={item.externalId} item={item} themeLabel={themeByProposal?.[item.externalId]} />)}
          </div>
        ) : <p className="mt-3 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Nenhuma proposição corresponde a este filtro.</p>}
        {filtered.length > visible && (
          <button type="button" onClick={() => setVisible(v => v + 8)}
            className="focus-ring mt-4 w-full rounded-xl border bg-card py-2.5 text-sm font-bold text-primary transition hover:bg-muted">
            Ver mais {nf.format(Math.min(8, filtered.length - visible))} de {nf.format(filtered.length - visible)} restantes
          </button>
        )}
      </section>
    </div>
  );
}

function FilterPill({ active, label, color, onClick }: { active: boolean; label: string; color?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
      {color && <i className="size-2 rounded-full" style={{ background: active ? 'currentColor' : color }} aria-hidden="true" />}
      {label}
    </button>
  );
}
