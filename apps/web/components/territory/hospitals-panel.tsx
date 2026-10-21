import { Hospital } from 'lucide-react';
import type { HospitalStory } from '@/lib/health-story';
import { prettyType } from '@/lib/health-bench';
import { ymLabel } from '@/lib/exec-territory';
import { cn } from '@/lib/utils';

const int = new Intl.NumberFormat('pt-BR');
const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number) => `${nf(v * 100 >= 10 ? 0 : 1).format(v * 100)}%`;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])([a-zà-ú])/g, (_m, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, m => m.toLowerCase());

/** "Quem atende": estabelecimentos que mais atenderam nos últimos 12 meses, com parcela, leitos, permanência e letalidade. Dados prontos (uma consulta). */
export function HospitalsPanel({ story, scope, from, to, kind }: { story: HospitalStory; scope: string; from: number; to: number; kind: 'uf' | 'municipio' }) {
  const maxShare = Math.max(...story.rows.map(r => r.share), 0.01);
  return (
    <section aria-labelledby="quem-atende" className="rounded-xl border bg-white p-4 sm:p-5">
      <header className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: '#e6eefc' }} aria-hidden><Hospital size={18} color="#2563eb" /></span>
        <div><h2 id="quem-atende" className="font-display text-2xl text-[#14304f]">Quem atende em {scope}</h2><p className="mt-0.5 text-xs text-muted-foreground">Internações aprovadas pelo SUS por estabelecimento, {ymLabel(from)} a {ymLabel(to)} ({int.format(story.total)} no total).</p></div></header>
      <p className="mt-4 max-w-4xl text-sm leading-relaxed text-[#14304f]">{story.story}</p>
      {story.ratio !== null && <p className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: story.poloWord === 'polo' ? '#2563eb' : story.poloWord === 'parte-fora' ? '#db2777' : '#cbd5e1', color: '#14304f', background: story.poloWord === 'polo' ? '#e6eefc' : story.poloWord === 'parte-fora' ? '#fce8f2' : '#f7f9fc' }}>
        {story.poloWord === 'polo' ? 'Polo regional' : story.poloWord === 'parte-fora' ? 'Parte dos moradores se trata fora' : 'Atendimento equilibrado'} · {nf(1).format(story.ratio)} atendida por internação de morador</p>}
      <ol className="mt-4 divide-y">
        {story.rows.map((r, i) => (
          <li key={r.cnes} className="grid gap-x-4 gap-y-1 py-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_17rem]">
            <div className="min-w-0">
              <p className="flex items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e6eefc] text-[0.65rem] font-bold text-[#14304f]">{i + 1}</span><strong className="text-sm text-[#14304f] md:truncate" title={r.name}>{titleCase(r.name)}</strong></p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-7 text-[0.7rem] text-muted-foreground">{prettyType(0, r.typeLabel)}{r.sus && <span className="rounded-full border border-[#16a34a]/40 px-1.5 font-semibold text-[#15803d]">SUS</span>}</p>
            </div>
            <div className="self-center">
              <div className="h-3 overflow-hidden rounded-full bg-[#eef2f7]" role="img" aria-label={`${pct(r.share)} das internações`}><div className="h-full rounded-full" style={{ width: `${r.share / maxShare * 100}%`, background: i === 0 ? '#115b45' : '#2f8a6d' }} /></div>
              <p className="mt-1 text-xs"><strong className="text-[#14304f]">{int.format(r.aih)}</strong> internações · {pct(r.share)}</p>
            </div>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] md:justify-between">
              <div><dt className="text-muted-foreground">Leitos</dt><dd className="font-semibold text-[#14304f]">{r.bedsExisting > 0 ? <>{int.format(r.bedsExisting)} <span className="font-normal text-muted-foreground">({int.format(r.bedsSus)} SUS)</span></> : '—'}</dd></div>
              <div><dt className="text-muted-foreground">Permanência</dt><dd className="font-semibold text-[#14304f]">{r.stay === null ? '—' : `${nf(1).format(r.stay)} dias`}</dd></div>
              <div><dt className="text-muted-foreground">Óbitos/internação</dt><dd className="font-semibold text-[#14304f]">{r.lethality === null ? '—' : `${nf(1).format(r.lethality)}%`}</dd></div>
            </dl>
          </li>
        ))}
        {story.others.n > 0 && <li className="py-3 text-xs text-muted-foreground">Mais {story.others.n} estabelecimento(s) somam {int.format(story.others.aih)} internações ({pct(story.others.share)}).</li>}
      </ol>
      <p className={cn('mt-1 text-[0.7rem] leading-snug text-muted-foreground')}>Valores do SIH são AIH <strong>aprovadas</strong>, não pagamentos. A letalidade hospitalar depende da complexidade do caso e do perfil do hospital: não mede qualidade e só aparece com 100 internações ou mais.{kind === 'municipio' ? ' Atendimento ≠ residência: hospitais de polo recebem moradores de outros municípios.' : ''}</p>
    </section>
  );
}
