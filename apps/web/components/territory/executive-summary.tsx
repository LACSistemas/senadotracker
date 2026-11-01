import { OfficialPortrait } from '@/components/app-image';
import { loadCurrentExecutive, loadCurrentMayor, loadGdpPerCapita } from '@/lib/territory-executive';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const ROUND_LABEL: Record<number, string> = { 1: '1º turno', 2: '2º turno' };

/** Governo (TSE) + PIB per capita do território da própria página (IBGE/SIDRA — UF ou município, conforme
 * `gdpTerritory`). Em página de município com `municipio` informado, mostra o PREFEITO (titular eleito em
 * 2024, ou eleição suplementar quando a ordinária foi anulada) como figura principal, com o governador da
 * UF em linha secundária; alguns municípios não têm prefeito resolvido (DF, Fernando de Noronha, eleição
 * anulada sem suplementar ainda) e nesse caso cai para mostrar só o governador, como antes. Foto ainda não
 * coletada para nenhum dos dois cargos — `OfficialPortrait` já mostra o retrato quando `photo_url` existir. */
export async function ExecutiveSummary({ uf, stateName, gdpTerritory, municipio }: {
  uf: string; stateName: string;
  gdpTerritory: { level: 'UF'; ufCode: number } | { level: 'MUNICIPIO'; ibge7: string | number };
  municipio?: { entityId: number; name: string };
}) {
  const [executive, gdp, mayorResult] = await Promise.all([
    loadCurrentExecutive(uf), loadGdpPerCapita(gdpTerritory),
    municipio ? loadCurrentMayor(municipio.entityId) : Promise.resolve(null),
  ]);
  if (!executive && !gdp) return null;
  const gov = executive?.governor;
  const mayor = mayorResult?.mayor;
  const headline = mayor ? { role: 'Prefeito', of: municipio!.name } : gov ? { role: 'Governador', of: stateName } : null;
  const headlineOfficial = mayor ?? gov;

  return (
    <section aria-labelledby="exec-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <p className="eyebrow">Governo de {headline ? headline.of : stateName}</p>
      <div className="mt-3 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        {headlineOfficial && headline && <>
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted sm:size-24">
            <OfficialPortrait src={headlineOfficial.photoUrl} name={headlineOfficial.name} sizes="96px" />
          </div>
          <div className="min-w-0">
            <h2 id="exec-resumo" className="display-title text-xl sm:text-2xl">{headlineOfficial.ballotName} <span className="font-sans text-base font-semibold text-muted-foreground">({headlineOfficial.party})</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">{headline.role} · mandato {headlineOfficial.mandateStart.slice(0, 4)}–{headlineOfficial.mandateEnd.slice(0, 4)} · eleito em {headlineOfficial.electionYear} ({ROUND_LABEL[headlineOfficial.electedRound] ?? `${headlineOfficial.electedRound}º turno`})</p>
            {mayor && mayorResult?.viceMayor && <p className="mt-1 text-sm text-muted-foreground">Vice: {mayorResult.viceMayor.ballotName} ({mayorResult.viceMayor.party})</p>}
            {!mayor && executive?.viceGovernor && <p className="mt-1 text-sm text-muted-foreground">Vice: {executive.viceGovernor.ballotName} ({executive.viceGovernor.party})</p>}
            {mayor && gov && <p className="mt-2 text-sm text-muted-foreground">Governador de {stateName}: {gov.ballotName} ({gov.party})</p>}
          </div>
        </>}
        {!headlineOfficial && <h2 id="exec-resumo" className="display-title text-xl sm:text-2xl">PIB per capita</h2>}
      </div>
      {gdp && <dl className="mt-5 inline-flex items-baseline gap-2 rounded-2xl bg-secondary px-4 py-3">
        <dt className="text-xs font-semibold text-secondary-foreground/80">PIB per capita ({gdp.year})</dt>
        <dd className="hero-figure tnum text-2xl text-secondary-foreground">{money.format(gdp.value)}</dd>
      </dl>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {headlineOfficial && 'Titular e vice conforme resultado oficial do TSE (candidatura, não foto de posse). '}
        {gdp && `PIB a preços correntes (IBGE), dividido pela população publicada do mesmo ano.`}
      </p>
    </section>
  );
}
