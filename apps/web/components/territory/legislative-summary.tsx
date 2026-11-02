import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadTerritoryLegislativeComposition } from '@/lib/territory-legislative';
import { PartyHemicycle } from '@/components/party-hemicycle';
import type { PartyComposition } from '@/lib/hemicycle';

/** Vitrine de "quem representa" na visão geral do território: contagem por Casa + hemiciclo partidário combinado.
 * Dado 100% existente (nenhum collector novo) — view `current_legislators_analytics` agrupada por UF.
 * `municipioName` (P8, mandato §4.1): em página de município, deixa explícito que a contagem é de
 * representantes estaduais/federais ligados à UF, não uma bancada exclusiva do município — "não crie a
 * impressão de que os 119 parlamentares do RJ são uma representação legislativa exclusiva de Campos dos
 * Goytacazes" — e reduz o peso visual (hemiciclo some atrás de `<details>`, contagem continua aberta) para
 * não ocupar espaço desproporcional na visão geral municipal; na visão estadual, nada muda. */
export async function TerritoryLegislativeSummary({ uf, stateName, municipioName }: { uf: string; stateName: string; municipioName?: string }) {
  const data = await loadTerritoryLegislativeComposition(uf);
  const total = data.totals.senators + data.totals.federalDeputies + data.totals.stateDeputies + data.totals.districtDeputies;
  if (!total) return null;

  const byParty = new Map<string, number>();
  let unresolved = 0;
  for (const house of data.houses) {
    for (const party of house.parties) byParty.set(party.name ?? party.code, (byParty.get(party.name ?? party.code) ?? 0) + party.count);
    unresolved += house.unresolvedCount;
  }
  const parties = [...byParty.entries()].map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats);
  if (unresolved > 0) parties.push({ party: 'Sem partido', seats: unresolved });
  const composition: PartyComposition = { total, parties };

  const stateLabel = data.totals.districtDeputies > 0 ? 'Dep. Distritais' : 'Dep. Estaduais';
  const stateCount = data.totals.districtDeputies > 0 ? data.totals.districtDeputies : data.totals.stateDeputies;

  const hemicycle = <div className="mt-5"><PartyHemicycle composition={composition} labels={{ noun: 'parlamentares', one: 'um parlamentar', partyHrefTemplate: `/legislativo/parlamentares?uf=${uf}&partido={party}` }} /></div>;
  return (
    <section aria-labelledby="leg-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{municipioName ? `Representação estadual e federal ligada a ${stateName}` : `Quem representa ${stateName}`}</p><h2 id="leg-resumo" className="display-title mt-1 text-2xl sm:text-3xl">{total} parlamentares em exercício</h2></div>
        <Link href={`/estados/${uf}/representacao`} className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ver quem representa<ArrowRight size={14} aria-hidden /></Link>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">Senadores</dt><dd className="hero-figure tnum text-3xl text-secondary-foreground">{data.totals.senators}</dd></div>
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">Dep. Federais</dt><dd className="hero-figure tnum text-3xl text-secondary-foreground">{data.totals.federalDeputies}</dd></div>
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">{stateLabel}</dt><dd className="hero-figure tnum text-3xl text-secondary-foreground">{stateCount}</dd></div>
      </dl>
      {municipioName ? <details className="mt-5"><summary className="focus-ring cursor-pointer text-sm font-semibold text-primary">Ver composição partidária completa</summary>{hemicycle}</details> : hemicycle}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {municipioName ? <>Eleitos pelo estado inteiro, não só por {municipioName} — {municipioName} elege parte dos votos, mas estes parlamentares representam todo {stateName}. </> : null}
        Soma de Senado, Câmara dos Deputados e {data.totals.districtDeputies > 0 ? 'Câmara Legislativa do DF' : 'Assembleia Legislativa'} — não é uma bancada única e não indica que parlamentares do mesmo partido votem juntos.{unresolved > 0 && ` ${unresolved} parlamentares estão com o partido publicado sem normalização e aparecem como "Sem partido".`}</p>
    </section>
  );
}
