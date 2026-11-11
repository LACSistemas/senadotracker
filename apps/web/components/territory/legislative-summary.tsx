import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadTerritoryLegislativeComposition } from '@/lib/territory-legislative';
import { LegislativeHouseToggle, type HouseOption } from './legislative-house-toggle';
import type { PartyComposition } from '@/lib/hemicycle';

const HOUSE_NOUN: Record<string, { noun: string; one: string }> = {
  FEDERAL_SENATOR: { noun: 'senadores', one: 'um senador' },
  FEDERAL_DEPUTY: { noun: 'deputados federais', one: 'um deputado federal' },
  STATE_DEPUTY: { noun: 'deputados estaduais', one: 'um deputado estadual' },
  DISTRICT_DEPUTY: { noun: 'deputados distritais', one: 'um deputado distrital' },
};

/** Vitrine de "quem representa" na visão geral do território: contagem por Casa + hemiciclo partidário —
 * agora um PRÓPRIO por Casa (P8, reorganização de hierarquia a pedido do usuário), com um alternador em vez
 * de misturar Senado/Câmara/Assembleia num hemiciclo só (o que fazia parecer uma bancada única). Dado 100%
 * existente (nenhum collector novo) — view `current_legislators_analytics` agrupada por UF, já separada
 * por Casa desde que este read model foi construído; só a composição visual mudou.
 * `municipioName` (P8.1): em página de município, deixa explícito que a contagem é de representantes
 * estaduais/federais ligados à UF, não uma bancada exclusiva do município. */
export async function TerritoryLegislativeSummary({ uf, stateName, municipioName }: { uf: string; stateName: string; municipioName?: string }) {
  const data = await loadTerritoryLegislativeComposition(uf);
  const total = data.totals.senators + data.totals.federalDeputies + data.totals.stateDeputies + data.totals.districtDeputies;
  if (!total) return null;

  const options: HouseOption[] = data.houses.map(house => {
    const parties = house.parties.map(p => ({ party: p.name ?? p.code, seats: p.count })).sort((a, b) => b.seats - a.seats);
    if (house.unresolvedCount > 0) parties.push({ party: 'Sem partido', seats: house.unresolvedCount });
    const composition: PartyComposition = { total: house.count, parties };
    const labels = HOUSE_NOUN[house.level] ?? { noun: 'parlamentares', one: 'um parlamentar' };
    const houseKind: 'senado' | 'camara' | undefined = house.level === 'FEDERAL_SENATOR' ? 'senado' : house.level === 'FEDERAL_DEPUTY' ? 'camara' : undefined;
    const option: HouseOption = {
      key: house.houseId, label: house.houseName, composition, noun: labels.noun, one: labels.one,
      house: houseKind,
      partyHrefTemplate: `/legislativo/parlamentares?uf=${uf}&partido={party}`,
    };
    return option;
  }).sort((a, b) => b.composition.total - a.composition.total);

  const stateLabel = data.totals.districtDeputies > 0 ? 'Dep. Distritais' : 'Dep. Estaduais';
  const stateCount = data.totals.districtDeputies > 0 ? data.totals.districtDeputies : data.totals.stateDeputies;
  const unresolved = data.houses.reduce((n, h) => n + h.unresolvedCount, 0);

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
      <div className="mt-5"><LegislativeHouseToggle options={options} /></div>
      {municipioName && <p className="mt-3 text-xs leading-5 text-muted-foreground">Eleitos pelo estado inteiro, não só por {municipioName} — {municipioName} elege parte dos votos, mas estes parlamentares representam todo {stateName}.</p>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Cada Casa tem seu próprio hemiciclo acima — não é uma bancada única e não indica que parlamentares do mesmo partido votem juntos.{unresolved > 0 && ` ${unresolved} parlamentares estão com o partido publicado sem normalização e aparecem como "Sem partido".`}</p>
    </section>
  );
}
