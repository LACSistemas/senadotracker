import { OfficialPortrait } from '@/components/app-image';
import { loadFederalExecutive } from '@/lib/territory-executive';

const ROUND_LABEL: Record<number, string> = { 1: '1º turno', 2: '2º turno' };

/** Presidente/vice-presidente, mesma composição de `GovernorCard` (territory/governor-card.tsx) — paridade
 * estrutural real: `/executivo` passa a mostrar "quem governa o Brasil" do mesmo jeito que `/estados/{uf}`
 * mostra "quem governa o estado" (P14.13). Foto de candidatura (TSE), não de posse, mesma ressalva já
 * usada pro governador. */
export async function PresidentCard() {
  const executive = await loadFederalExecutive();
  const president = executive?.president;
  if (!president) return null;
  return (
    <div id="exec-resumo-federal" className="mt-7 max-w-md rounded-2xl border border-white/20 bg-white/10 p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-white/65">Governo do Brasil</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/10 sm:size-20">
          <OfficialPortrait src={president.photoUrl} name={president.name} sizes="80px" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-white sm:text-xl">{president.ballotName} <span className="font-sans text-sm font-semibold text-white/70">({president.party})</span></p>
          <p className="mt-0.5 text-xs text-white/70">Presidente · mandato {president.mandateStart.slice(0, 4)}–{president.mandateEnd.slice(0, 4)}</p>
          <p className="text-xs text-white/70">eleito em {president.electionYear} ({ROUND_LABEL[president.electedRound] ?? `${president.electedRound}º turno`}){president.isReelection && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">reeleito</span>}</p>
        </div>
      </div>
      {executive?.vicePresident && <p className="mt-2 text-xs text-white/70">Vice: {executive.vicePresident.ballotName} ({executive.vicePresident.party})</p>}
      <p className="mt-3 text-[0.68rem] leading-5 text-white/55">Titular e vice conforme resultado oficial do TSE (foto de candidatura, não de posse).</p>
    </div>
  );
}
