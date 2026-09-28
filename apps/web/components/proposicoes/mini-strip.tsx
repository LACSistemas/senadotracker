import { nf, pf } from '@/lib/proposicoes/taxonomy';
import type { CompositionEntry } from '@/lib/proposicoes/composition';

/**
 * Faixa de composição leve para listas densas: só HTML estático (sem observadores por linha), intervalo de 2 px entre
 * segmentos, `title` em cada segmento e um resumo por extenso para leitores de tela.
 */
export function MiniStrip({ entries, total, height = 14, subject }: { entries: CompositionEntry[]; total: number; height?: number; subject: string }) {
  const summary = entries.slice().sort((a, b) => b.share - a.share).slice(0, 4).map(entry => `${entry.verb} ${pf.format(entry.share)}`).join(', ');
  return <div role="img" aria-label={`${subject}: ${nf.format(total)} proposições. ${summary}.`} className="flex gap-[2px] overflow-hidden rounded-[3px]" style={{ height }}>
    {entries.map(entry => <span key={entry.key} title={`${entry.label}: ${nf.format(entry.count)} (${pf.format(entry.share)})`} className="strip-seg block min-w-[2px]" style={{ flexGrow: Math.max(entry.share, 0.0005), flexBasis: 0, background: entry.color }} />)}
  </div>;
}

/** Legenda compacta e fixa das cores dos grupos (sempre presente quando há mais de uma série). */
export function GroupChips({ entries }: { entries: CompositionEntry[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legenda dos grupos funcionais">
    {entries.map(entry => <li key={entry.key} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: entry.color }} aria-hidden="true" />{entry.verb}</li>)}
  </ul>;
}
