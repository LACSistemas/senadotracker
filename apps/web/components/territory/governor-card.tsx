import { OfficialPortrait } from '@/components/app-image';
import { loadCurrentExecutive, loadCurrentMayor } from '@/lib/territory-executive';

const ROUND_LABEL: Record<number, string> = { 1: '1º turno', 2: '2º turno' };

/** Governador/Prefeito com foto, dentro do Hero (antes vivia numa seção própria mais abaixo, junto do PIB
 * per capita — agora o PIB foi para a faixa de KPIs antes do mapa e este card fica só com "quem governa").
 * Renderizado dentro de `<Suspense>` pela própria página — nunca bloqueia o hero (texto/mapa) enquanto
 * espera o retrato: a consulta já era enxuta (1-2 linhas por território, cacheada 5min), não é o tipo de
 * carga que motivou o achado de desempenho de P8.7 (aquele era sobre reaproveitar 4 páginas inteiras). */
export async function GovernorCard({ uf, stateName, municipio }: { uf: string; stateName: string; municipio?: { entityId: number; name: string } }) {
  const [executive, mayorResult] = await Promise.all([
    loadCurrentExecutive(uf),
    municipio ? loadCurrentMayor(municipio.entityId) : Promise.resolve(null),
  ]);
  const gov = executive?.governor;
  const mayor = mayorResult?.mayor;
  const headline = mayor ? { role: 'Prefeito', of: municipio!.name } : gov ? { role: 'Governador', of: stateName } : null;
  const headlineOfficial = mayor ?? gov;
  if (!headlineOfficial || !headline) return null;

  return (
    <div id="exec-resumo" className="mt-7 max-w-md rounded-2xl border border-white/20 bg-white/10 p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-white/65">Governo de {headline.of}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/10 sm:size-20">
          <OfficialPortrait src={headlineOfficial.photoUrl} name={headlineOfficial.name} sizes="80px" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-white sm:text-xl">{headlineOfficial.ballotName} <span className="font-sans text-sm font-semibold text-white/70">({headlineOfficial.party})</span></p>
          <p className="mt-0.5 text-xs text-white/70">{headline.role} · mandato {headlineOfficial.mandateStart.slice(0, 4)}–{headlineOfficial.mandateEnd.slice(0, 4)}</p>
          <p className="text-xs text-white/70">eleito em {headlineOfficial.electionYear} ({ROUND_LABEL[headlineOfficial.electedRound] ?? `${headlineOfficial.electedRound}º turno`}){headlineOfficial.isReelection && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">reeleito</span>}</p>
        </div>
      </div>
      {mayor && mayorResult?.viceMayor && <p className="mt-2 text-xs text-white/70">Vice: {mayorResult.viceMayor.ballotName} ({mayorResult.viceMayor.party})</p>}
      {!mayor && executive?.viceGovernor && <p className="mt-2 text-xs text-white/70">Vice: {executive.viceGovernor.ballotName} ({executive.viceGovernor.party})</p>}
      {mayor && gov && <p className="mt-2 text-xs text-white/70">Governador de {stateName}: {gov.ballotName} ({gov.party})</p>}
      <p className="mt-3 text-[0.68rem] leading-5 text-white/55">Titular e vice conforme resultado oficial do TSE (foto de candidatura, não de posse). "Reeleito" é autodeclarado pelo candidato no ato da candidatura (TSE).</p>
    </div>
  );
}
