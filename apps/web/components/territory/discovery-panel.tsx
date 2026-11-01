import Link from 'next/link';
import type { DiscoveryResult } from '@/lib/territory-discoveries';

/**
 * Abertura editorial de "descobertas" (Parte V.10.1 do mandato) — 1 manchete (quando elegível) + até 3
 * complementares, antes do grid de teasers por tema. Nunca mostra uma manchete inventada: sem KPI
 * comparável em nenhum tema, `headline` é `null` e a seção abre com um texto neutro, nunca uma frase vazia
 * tipo placeholder. `selectDiscoveries` (lib/territory-discoveries.ts) decide a elegibilidade.
 */
export function DiscoveryPanel({ scopeName, result }: { scopeName: string; result: DiscoveryResult }) {
  const { headline, supporting } = result;
  if (!headline && supporting.length === 0) return null;
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
