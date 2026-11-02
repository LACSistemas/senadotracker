import Link from 'next/link';
import type { DiscoveryResult } from '@/lib/territory-discoveries';

/**
 * Abertura editorial de "descobertas" (Parte V.10.1 do mandato) — 1 manchete (quando elegível) + até 3
 * complementares, antes do grid de teasers por tema. Nunca mostra uma manchete inventada: sem KPI
 * comparável em nenhum tema, `headline` é `null` e a seção abre com um texto neutro, nunca uma frase vazia
 * tipo placeholder. `selectDiscoveries` (lib/territory-discoveries.ts) decide a elegibilidade.
 *
 * `headlineInHero` (P8): quando a manchete já foi integrada ao `TerritoryHero` da própria página (mandato
 * §4.1, "integrada ao hero"), esta seção não a repete — mostra só os complementares, sob um título mais
 * discreto ("Outros números já confirmados"). Sem manchete elegível em lugar nenhum, o texto neutro
 * continua existindo normalmente (nunca esconde a ausência honesta de comparação).
 */
export function DiscoveryPanel({ scopeName, result, headlineInHero = false }: { scopeName: string; result: DiscoveryResult; headlineInHero?: boolean }) {
  const { headline, supporting } = result;
  if (!headline && supporting.length === 0) return null;
  if (headlineInHero && headline) {
    if (supporting.length === 0) return null;
    return (
      <section aria-labelledby="descobertas-complementares">
        <h2 id="descobertas-complementares" className="section-hairline pt-3 font-display text-xl">Outros números já confirmados</h2>
        <ul className="mt-4 grid gap-5 sm:grid-cols-3">
          {supporting.map((s, i) => (
            <li key={i} className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.themeLabel}</p>
              <p className="mt-1 text-sm font-semibold leading-snug">{s.kind === 'kpi' ? s.heading : s.label}</p>
              <p className="hero-figure tnum mt-1 text-2xl text-[#14304f]">{s.value}<span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{s.kind === 'kpi' ? s.note : s.meta}</p>
              <Link href={s.href} className="focus-ring mt-2 inline-flex text-xs font-semibold text-primary hover:underline">Ver mais →</Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section aria-labelledby="descobertas" className="grid-12">
      <div className="col-reading">
        <p className="eyebrow">Descoberta em {scopeName}</p>
        {headline ? (
          <>
            <h2 id="descobertas" className="display-title mt-2 text-3xl sm:text-4xl">{headline.heading}</h2>
            <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">{headline.sentence}</p>
            <Link href={headline.href} className="focus-ring mt-3 inline-flex text-sm font-semibold text-primary hover:underline">Ver {headline.themeLabel.toLowerCase()} completo →</Link>
          </>
        ) : (
          <>
            <h2 id="descobertas" className="display-title mt-2 text-3xl sm:text-4xl">O que já se sabe sobre {scopeName}</h2>
            <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">Os dados já coletados para {scopeName} ainda não sustentam uma comparação direta e validada com o estado ou o Brasil. Abaixo, o que já foi publicado por área — a leitura completa de cada tema mostra fonte, cobertura e o que falta.</p>
          </>
        )}
      </div>
      {supporting.length > 0 && (
        <ul className="col-explore mt-6 grid gap-3 sm:grid-cols-3">
          {supporting.map((s, i) => (
            <li key={i} className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.themeLabel}</p>
              <p className="mt-1 text-sm font-semibold leading-snug">{s.kind === 'kpi' ? s.heading : s.label}</p>
              <p className="hero-figure tnum mt-1 text-xl text-[#14304f]">{s.value}<span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{s.kind === 'kpi' ? s.note : s.meta}</p>
              <Link href={s.href} className="focus-ring mt-2 inline-flex text-xs font-semibold text-primary hover:underline">Ver mais →</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
