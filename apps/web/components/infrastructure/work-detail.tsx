import Link from 'next/link';
import type { WorkDetailView } from '@/lib/infrastructure/types';
import { brlShort, fmt } from '@/lib/infrastructure/format';
import { Block, BarList } from './infrastructure-ui';

const NOT_PUBLISHED = 'Não há informação publicada para esta etapa.';

export function WorkDetail({ work, backHref, backLabel }: { work: WorkDetailView; backHref: string | null; backLabel: string }) {
  const { header, locations, multi, stages, physical, contracts, commitments, pncpStatus } = work;
  const latestPhysical = physical[0] ?? null;
  return (
    <div className="space-y-8">
      {backHref && <Link href={backHref} className="text-sm font-semibold text-primary hover:underline">← Voltar para {backLabel}</Link>}

      <header className="rounded-3xl border bg-card p-5 sm:p-8">
        <p className="eyebrow">Obra pública · Obrasgov</p>
        <h1 className="display-title mt-1 text-2xl sm:text-4xl">{header.name}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Código do projeto</dt><dd className="font-semibold text-[#14304f]">{header.sourceProjectId}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Órgão</dt><dd className="font-semibold text-[#14304f]">{header.agencyName ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Situação</dt><dd className="font-semibold text-[#14304f]">{header.situationLabel ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Tipo</dt><dd className="font-semibold text-[#14304f]">{header.categoryLabel ?? '—'}{header.natureLabel ? ` · ${header.natureLabel}` : ''}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Fonte do cadastro</dt><dd className="font-semibold text-[#14304f]">{header.systemLabel ?? 'Obrasgov'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Última atualização</dt><dd className="font-semibold text-[#14304f]">{header.lastUpdated ?? 'não informada'}</dd></div>
        </dl>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Localização{multi ? ` (${locations.length} municípios)` : ''}</p>
          {multi ? (
            <>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">{locations.map(l => <li key={l.ibge7} className="rounded-full border bg-white px-3 py-1">{l.municipality ?? l.ibge7}{l.uf ? ` (${l.uf})` : ''}</li>)}</ul>
              <p className="mt-2 text-xs text-muted-foreground">Projeto multimunicipal: o valor total do projeto não foi rateado entre os municípios listados.</p>
            </>
          ) : <p className="text-sm font-semibold text-[#14304f]">{locations[0]?.municipality ?? 'não informada'}{locations[0]?.uf ? ` (${locations[0].uf})` : ''}</p>}
        </div>
      </header>

      <Block>
        <h2 className="mb-3 font-display text-xl text-[#14304f]">Valores — estágios financeiros</h2>
        {stages.filter((s): s is typeof s & { value: number } => s.value != null).length >= 2 && (
          <BarList title="Comparação entre estágios" rows={stages.filter((s): s is typeof s & { value: number } => s.value != null).map(s => ({ label: s.label, value: s.value, display: s.display ?? String(s.value) }))} caption="Barras na mesma escala só para comparar a magnitude de cada estágio — não representam uma sequência que se soma." />
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stages.map(s => (
            <div key={s.key} className="rounded-xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
              <dd className={s.display ? 'hero-figure tnum mt-1 text-xl text-[#14304f] sm:text-2xl' : 'mt-1 text-xs text-muted-foreground'}>{s.display ?? NOT_PUBLISHED}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Previsto, contratado, empenhado, liquidado e pago são estágios diferentes da mesma obra — nunca somados entre si.</p>
      </Block>

      <Block>
        <h2 className="mb-3 font-display text-xl text-[#14304f]">Progresso físico</h2>
        {latestPhysical?.percent != null ? (
          <>
            <p className="hero-figure tnum text-3xl text-[#14304f]">{fmt(latestPhysical.percent, 1)}%</p>
            <p className="text-xs text-muted-foreground">Medição em {latestPhysical.updatedAt ?? 'data não informada'}. Percentual informado pela fonte — não significa obra entregue.</p>
          </>
        ) : <p className="text-sm text-muted-foreground">Não há medição física publicada para esta obra.</p>}
      </Block>

      <Block>
        <h2 className="mb-3 font-display text-xl text-[#14304f]">Contratos ({contracts.length})</h2>
        {contracts.length === 0 ? <p className="text-sm text-muted-foreground">Não há contrato publicado para esta obra.</p> : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de contratos, com rolagem horizontal"><table className="w-full min-w-[40rem] text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th scope="col" className="py-2 pr-3 font-semibold">Contrato</th><th scope="col" className="py-2 pr-3 font-semibold">Fornecedor</th><th scope="col" className="py-2 pr-3 text-right font-semibold">Valor global</th><th scope="col" className="py-2 pr-3 font-semibold">Vigência</th></tr></thead>
            <tbody>{contracts.map(c => (
              <tr key={c.contractId} className="border-b last:border-0"><td className="py-2 pr-3 font-semibold text-[#14304f]">{c.contractNumber ?? c.contractId}{c.transparencyUrl && <> · <a href={c.transparencyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">portal</a></>}</td>
                <td className="py-2 pr-3">{c.supplierName ?? '—'}</td><td className="tnum py-2 pr-3 text-right">{c.amountGlobal != null ? brlShort(c.amountGlobal) : '—'}</td>
                <td className="py-2 pr-3">{c.vigStart ?? '—'}{c.vigEnd ? ` a ${c.vigEnd}` : ''}</td></tr>
            ))}</tbody></table></div>
        )}
      </Block>

      <Block>
        <h2 className="mb-3 font-display text-xl text-[#14304f]">Empenhos ({fmt(commitments.total)})</h2>
        {commitments.rows.length === 0 ? <p className="text-sm text-muted-foreground">Não há empenho publicado para esta obra.</p> : (
          <>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de empenhos, com rolagem horizontal"><table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th scope="col" className="py-2 pr-3 font-semibold">Empenho</th><th scope="col" className="py-2 pr-3 font-semibold">Emissão</th><th scope="col" className="py-2 pr-3 text-right font-semibold">Empenhado</th><th scope="col" className="py-2 pr-3 text-right font-semibold">Liquidado</th><th scope="col" className="py-2 pr-3 text-right font-semibold">Pago</th></tr></thead>
              <tbody>{commitments.rows.map(c => (
                <tr key={c.commitmentKey} className="border-b last:border-0"><td className="py-2 pr-3 font-semibold text-[#14304f]">{c.nrEmpenho ?? c.commitmentKey}</td>
                  <td className="py-2 pr-3">{c.emissionDate ?? '—'}</td><td className="tnum py-2 pr-3 text-right">{c.value != null ? brlShort(c.value) : '—'}</td>
                  <td className="tnum py-2 pr-3 text-right">{c.liquidation != null ? brlShort(c.liquidation) : '—'}</td><td className="tnum py-2 pr-3 text-right">{c.paid != null ? brlShort(c.paid) : '—'}</td></tr>
              ))}</tbody></table></div>
            <p className="mt-2 text-xs text-muted-foreground">Página {commitments.page} de {Math.max(1, Math.ceil(commitments.total / commitments.pageSize))} — {fmt(commitments.total)} empenhos no total.</p>
          </>
        )}
      </Block>

      <Block>
        <h2 className="mb-2 font-display text-xl text-[#14304f]">Evidências externas</h2>
        <p className="text-sm text-muted-foreground">{pncpStatus === 'AVAILABLE' ? 'Há correspondência confirmada com registros do PNCP para esta obra.' : 'Não há correspondência confirmada com contratos do PNCP para esta obra.'}</p>
      </Block>
    </div>
  );
}
