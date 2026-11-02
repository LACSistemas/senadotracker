import Link from 'next/link';
import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { UfGeometry } from '@/lib/exec-territory';
import { formatInt } from '@/components/territory/territory-ui';

export interface TerritoryHeroDiscovery { themeLabel: string; value: string; unit: string; sentence: string; href: string }

/**
 * P8 (reconstrução estrutural) — hero das 2 visões gerais (estado/município), substitui o banner de cor
 * sólida do `InstitutionHero` (que nunca recebeu `imageUrl` nestas rotas — confirmado por inspeção de DOM
 * em P8.0: 0 `<svg>`/`<img>` reais, só 1 ícone decorativo de 15px). Integra a geografia real (a mesma
 * malha de `geometry` que a seção de exploração completa usa) DENTRO da composição de abertura — não
 * confinada a um card abaixo (mandato §2.2/§4.1). Decorativo mas descritivo (`role="img"` com rótulo real,
 * não `aria-hidden`): a seção completa com mapa interativo, legenda e busca continua existindo logo
 * abaixo, com mais espaço agora que `.shell-territory` substituiu `.page-shell` (P8.1).
 *
 * `discovery` (só município, por ora — estado ainda não tem sinal de descoberta elegível, ver P8.0/§4.2):
 * quando presente, mostra a manchete (número protagonista) já dentro do hero, a opção mais forte que o
 * mandato permite (§4.1: "integrada ao hero"); quando ausente, a página mantém a manchete no corpo (ver
 * `DiscoveryPanel`), nunca inventa uma.
 */
export function TerritoryHero({ context, title, description, population, populationYear, actions, geometry, mapMode, selectedId, stateName, discovery }: {
  context: string; title: string; description: ReactNode; population: number | null; populationYear: number | null; actions?: ReactNode;
  geometry: UfGeometry | null; mapMode: 'estado' | 'municipio'; selectedId?: number; stateName: string; discovery?: TerritoryHeroDiscovery | null;
}) {
  const mapLabel = mapMode === 'municipio' ? `${title} em destaque no mapa de ${stateName}` : `Mapa de ${title}, com ${geometry?.items.length ?? 0} municípios`;
  return (
    <section className="relative isolate overflow-hidden rounded-[1.5rem] band-gradient text-primary-foreground">
      <div className="grid gap-8 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(240px,34%)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-white/75">{context}</p>
          <h1 className="display-title text-balance mt-4 max-w-2xl text-4xl sm:text-7xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{description}</p>
          {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
          {population !== null && <p className="mt-7 flex items-center gap-2 text-sm text-white/75"><MapPin size={15} aria-hidden />{formatInt(population)} habitantes <span className="text-white/60">({populationYear}, estimativa IBGE)</span></p>}
          {discovery && (
            <div className="mt-7 max-w-md rounded-2xl border border-white/20 bg-white/10 p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-white/65">{discovery.themeLabel} · descoberta</p>
              <p className="hero-figure tnum mt-2 text-4xl text-white">{discovery.value}<span className="ml-1 text-sm font-normal text-white/70">{discovery.unit}</span></p>
              <p className="mt-2 text-sm leading-6 text-white/80">{discovery.sentence}</p>
              <Link href={discovery.href} className="focus-ring mt-3 inline-flex text-xs font-semibold text-white underline underline-offset-2">Ver {discovery.themeLabel.toLowerCase()} completo →</Link>
            </div>
          )}
        </div>
        {geometry && (
          <div className="mx-auto w-full max-w-[22rem]">
            <svg viewBox={geometry.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={mapLabel} className="h-auto w-full">
              {geometry.items.map(item => {
                const isSelected = mapMode === 'municipio' && item.id === selectedId;
                return <path key={item.id} d={item.d} fill={isSelected ? 'var(--brand-amber)' : 'rgba(255,255,255,0.14)'}
                  stroke={isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'} strokeWidth={isSelected ? 2.4 : 0.7} vectorEffect="non-scaling-stroke" />;
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
