import Link from 'next/link';
import type { WorksListPageData } from '@/lib/infrastructure/types';
import { WORK_CATEGORY_OPTIONS, WORK_SITUATION_OPTIONS } from '@/lib/infrastructure/catalog';
import { brlShort, fmt } from '@/lib/infrastructure/format';

function Checkbox({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} value="true" defaultChecked={checked} className="size-4 rounded border-input" />{label}</label>;
}

/** Formulário GET: cada filtro vira parâmetro de URL, sem JavaScript — a página preserva o contexto e pode ser
 * recarregada, compartilhada ou voltada sem perder o que foi filtrado. Só filtros com suporte real no backend. */
export function WorksFilterForm({ basePath, filters }: { basePath: string; filters: WorksListPageData['filters'] }) {
  return (
    <form method="GET" action={basePath} className="grid gap-4 rounded-2xl border bg-white/70 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Situação</span>
        <select name="status" defaultValue={filters.status ?? ''} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm">
          <option value="">Todas</option>{WORK_SITUATION_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select></label>
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Categoria</span>
        <select name="category" defaultValue={filters.category ?? ''} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm">
          <option value="">Todas</option>{WORK_CATEGORY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select></label>
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Órgão (contém)</span>
        <input type="text" name="agency" defaultValue={filters.agency ?? ''} placeholder="ex.: saúde, educação, DNIT" className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm" /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Abrangência</span>
        <select name="scope" defaultValue={filters.territorialScope ?? ''} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm">
          <option value="">Todas</option><option value="SINGLE">Um município</option><option value="MULTI">Multimunicipal</option>
        </select></label>
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Período previsto — de</span>
        <input type="date" name="from" defaultValue={filters.periodFrom ?? ''} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm" /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold text-[#14304f]">Período previsto — até</span>
        <input type="date" name="to" defaultValue={filters.periodTo ?? ''} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm" /></label>
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
        <Checkbox name="hasPhysical" label="Com medição física" checked={!!filters.hasPhysicalMeasurement} />
        <Checkbox name="hasContracts" label="Com contratos" checked={!!filters.hasContracts} />
        <Checkbox name="hasPayment" label="Com pagamento informado" checked={!!filters.hasPayment} />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" className="rounded-full bg-[#115b45] px-5 py-2 text-sm font-semibold text-white">Filtrar</button>
        <Link href={basePath} className="rounded-full border px-5 py-2 text-sm font-semibold hover:border-[#115b45]/50">Limpar filtros</Link>
      </div>
    </form>
  );
}

function pageHref(basePath: string, filters: WorksListPageData['filters'], page: number): string {
  const p = new URLSearchParams();
  if (filters.status != null) p.set('status', String(filters.status));
  if (filters.category != null) p.set('category', String(filters.category));
  if (filters.agency) p.set('agency', filters.agency);
  if (filters.territorialScope) p.set('scope', filters.territorialScope);
  if (filters.periodFrom) p.set('from', filters.periodFrom);
  if (filters.periodTo) p.set('to', filters.periodTo);
  if (filters.hasPhysicalMeasurement) p.set('hasPhysical', 'true');
  if (filters.hasContracts) p.set('hasContracts', 'true');
  if (filters.hasPayment) p.set('hasPayment', 'true');
  p.set('page', String(page));
  return `${basePath}?${p.toString()}`;
}

export function WorksList({ data, basePath, detailBase, from }: { data: WorksListPageData; basePath: string; detailBase: string; from: string }) {
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="space-y-4">
      <WorksFilterForm basePath={basePath} filters={data.filters} />
      <p className="text-sm text-muted-foreground">{fmt(data.total)} projetos encontrados — página {data.page} de {fmt(lastPage)}.</p>
      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">Nenhuma obra corresponde a estes filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[52rem] text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-semibold">Obra</th><th scope="col" className="px-3 py-2 font-semibold">Situação</th>
              <th scope="col" className="px-3 py-2 font-semibold">Categoria</th><th scope="col" className="px-3 py-2 font-semibold">Órgão</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Previsto</th><th scope="col" className="px-3 py-2 text-right font-semibold">Físico</th>
            </tr></thead>
            <tbody>{data.items.map(it => (
              <tr key={it.projectId} className="border-b last:border-0 hover:bg-[#e8f3ee]/40">
                <td className="max-w-[20rem] px-3 py-2"><Link href={`${detailBase}/${it.projectId}?from=${from}`} className="font-semibold text-[#14304f] hover:underline">{it.name}</Link>
                  <p className="text-xs text-muted-foreground">{it.sourceProjectId}{it.multi && ` · multimunicipal (${it.territoryCount} municípios)`}</p></td>
                <td className="px-3 py-2">{it.situationLabel ?? '—'}</td>
                <td className="px-3 py-2">{it.categoryLabel ?? '—'}</td>
                <td className="max-w-[12rem] truncate px-3 py-2" title={it.agencyName ?? undefined}>{it.agencyName ?? '—'}</td>
                <td className="tnum px-3 py-2 text-right">{it.multi ? <span title="Valor total do projeto, sem rateio entre municípios">não ratado</span> : it.plannedValue != null ? brlShort(it.plannedValue) : '—'}</td>
                <td className="tnum px-3 py-2 text-right">{it.physicalPercent != null ? `${fmt(it.physicalPercent, 1)}%` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {lastPage > 1 && (
        <nav aria-label="Paginação de obras" className="flex items-center justify-between text-sm">
          {data.page > 1 ? <Link href={pageHref(basePath, data.filters, data.page - 1)} className="rounded-full border px-4 py-1.5 font-semibold hover:border-[#115b45]/50">← Anterior</Link> : <span />}
          {data.page < lastPage ? <Link href={pageHref(basePath, data.filters, data.page + 1)} className="rounded-full border px-4 py-1.5 font-semibold hover:border-[#115b45]/50">Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
