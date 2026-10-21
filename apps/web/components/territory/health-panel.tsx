import type { ComponentType } from 'react';
import { AlertCircle, Baby, BedDouble, CalendarDays, CheckCircle2, ClipboardPlus, Hospital, Minus, PersonStanding, Scissors, Syringe, TrendingDown, TrendingUp } from 'lucide-react';
import type { DistStat, Facilities, HealthBenchmarks, PanelValue, VaccineValue } from '@senadotracker/db';
import { PANEL_CARDS, type CardTone, type PanelCardMeta } from '@/lib/health-targets';
import { benchFor, healthLede, prettyType, quintileWord, trendOf, vaccineRows, vaccineSummary, FLAG, type BenchState, type VaccineRow } from '@/lib/health-bench';
import { competenceLabel } from '@/lib/exec-territory';
import { cn } from '@/lib/utils';

const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const int = new Intl.NumberFormat('pt-BR');
const NAVY = 'text-[#14304f]';
const TONES: Record<CardTone, { fg: string; bg: string }> = {
  blue: { fg: '#2563eb', bg: '#e6eefc' }, pink: { fg: '#db2777', bg: '#fce8f2' }, teal: { fg: '#0d9488', bg: '#dcf4f0' }, violet: { fg: '#7c3aed', bg: '#eee7fd' }, green: { fg: '#16a34a', bg: '#e2f5e8' },
};
const ICONS: Record<PanelCardMeta['icon'], ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>> = { bed: BedDouble, baby: Baby, clipboard: ClipboardPlus, pregnant: PersonStanding, scissors: Scissors };

const refLabel = (v: PanelValue) => v.grain === 'A' ? `Ref.: ${v.periodStart.slice(0, 4)}` : `Ref.: ${competenceLabel(v.periodStart)}`;
function IconBox({ tone, children }: { tone: CardTone; children: React.ReactNode }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: TONES[tone].bg }} aria-hidden>{children}</span>;
}

/** Régua de posição: faixa p10–p90 do grupo, tique da mediana do grupo, tique tracejado da referência nacional e ponto do valor. Só SVG. */
function BenchRuler({ value, group, refDist, digits, label }: { value: number; group: DistStat; refDist: DistStat | null; digits: number; label: string }) {
  const lo = Math.min(group.p10, value, refDist?.p50 ?? group.p10), hi = Math.max(group.p90, value, refDist?.p50 ?? group.p90); const span = hi - lo || 1;
  const x = (v: number) => 4 + ((v - lo) / span) * 92;
  return <svg viewBox="0 0 100 16" className="h-4 w-full" role="img" aria-label={label} preserveAspectRatio="none">
    <rect x={x(group.p10)} y="6" width={Math.max(x(group.p90) - x(group.p10), 1)} height="4" rx="2" fill="#dbe4ee" />
    <rect x={x(group.p40)} y="6" width={Math.max(x(group.p60) - x(group.p40), 1)} height="4" rx="2" fill="#b9c8da" />
    <line x1={x(group.p50)} x2={x(group.p50)} y1="3" y2="13" stroke="#14304f" strokeWidth="1" />
    {refDist && <line x1={x(refDist.p50)} x2={x(refDist.p50)} y1="3" y2="13" stroke="#14304f" strokeWidth="1" strokeDasharray="1.5 1.5" />}
    <circle cx={x(value)} cy="8" r="3.2" fill="#115b45" stroke="#fff" strokeWidth="1" />
    <title>{`${nf(digits).format(value)} · mediana ${nf(digits).format(group.p50)}`}</title>
  </svg>;
}

function KpiBenchCard({ meta, v, bench }: { meta: PanelCardMeta; v: PanelValue | undefined; bench: BenchState }) {
  const Icon = ICONS[meta.icon]; const tone = TONES[meta.tone]; const t = trendOf(v);
  const has = v && v.value !== null;
  const flags = v ? [v.status === 'preliminary' || v.flags & FLAG.preliminary ? 'Preliminar' : null, v.flags & FLAG.smallN ? 'Pequeno número' : null, v.flags & FLAG.noDenominator ? 'Sem denominador' : null].filter(Boolean) as string[] : [];
  const unit = meta.unit === '%' ? '%' : '';
  return (
    <article className="card-lift flex min-w-0 flex-col rounded-xl border bg-white p-3" title={meta.note}>
      <header className="flex items-start gap-2"><IconBox tone={meta.tone}><Icon size={18} color={tone.fg} aria-hidden /></IconBox><h3 className="text-[0.74rem] font-semibold leading-tight text-[#14304f]">{meta.title}</h3></header>
      <p className={cn('mt-2 font-display text-[1.9rem] leading-none', NAVY)}>{has ? <>{nf(meta.digits).format(v.value!)}{unit}<span className="ml-1 text-xs font-normal text-muted-foreground">{meta.suffix ?? ''}</span></> : <span className="text-xl text-muted-foreground">Sem registro</span>}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.7rem] text-muted-foreground">
        {v ? refLabel(v) : 'Sem período publicado'}
        {t && <span className="inline-flex items-center gap-0.5" title={`Mesmo período do ano anterior: ${nf(meta.digits).format(v!.prev!.value!)}`}>{t.dir === 'up' ? <TrendingUp size={12} aria-hidden /> : t.dir === 'down' ? <TrendingDown size={12} aria-hidden /> : <Minus size={12} aria-hidden />}{t.dir === 'flat' ? 'estável' : `${t.delta > 0 ? '+' : '−'}${nf(meta.digits).format(Math.abs(t.delta))}`} vs. ano anterior</span>}
      </p>
      {flags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{flags.map(f => <span key={f} className="rounded-full border border-warning/40 px-1.5 text-[0.62rem] font-semibold text-warning">{f}</span>)}</p>}
      <footer className="mt-auto pt-2 text-[0.68rem] leading-snug text-muted-foreground">
        {bench.kind === 'ok' && has ? <>
          <BenchRuler value={v!.value!} group={bench.group} refDist={bench.ref} digits={meta.digits} label={`${quintileWord(bench.quintile)} entre ${bench.group.n} ${bench.groupLabel}`} />
          <span className="font-semibold text-[#14304f]">{quintileWord(bench.quintile)[0]!.toUpperCase() + quintileWord(bench.quintile).slice(1)}</span> entre {int.format(bench.group.n)} {bench.groupLabel}
          <br />mediana {nf(meta.digits).format(bench.group.p50)}{bench.ref ? ` · ${bench.refLabel} ${nf(meta.digits).format(bench.ref.p50)}` : ''}
        </> : <>
          <span className="rounded-full border px-1.5 py-0.5 font-semibold">Sem comparação</span> {bench.kind === 'none' ? `· ${bench.reason}` : ''}
          {bench.ref && <><br />{bench.refLabel}: mediana {nf(meta.digits).format(bench.ref.p50)}</>}
        </>}
      </footer>
    </article>
  );
}

function VaccineMeterCard({ rows, hasPanel }: { rows: VaccineRow[]; hasPanel: boolean }) {
  const s = vaccineSummary(rows); const tone = TONES.green;
  return (
    <article className="card-lift flex min-w-0 flex-col rounded-xl border bg-white p-3" title="Coberturas acima da meta do PNI: 95 % (BCG: 90 %). Doses aplicadas ÷ população-alvo.">
      <header className="flex items-start gap-2"><IconBox tone="green"><Syringe size={18} color={tone.fg} aria-hidden /></IconBox><h3 className="text-[0.78rem] font-semibold leading-tight text-[#14304f]">Cobertura vacinal</h3></header>
      {hasPanel && s.withData > 0 ? <>
        <p className={cn('mt-2 font-display text-[1.5rem] leading-none', NAVY)}>{s.met} de {s.withData} na meta</p>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">Calendário infantil · {s.year}{s.withData < s.total ? ` · ${s.total - s.withData} sem registro` : ''}</p>
        <div className="mt-2 flex gap-1" role="img" aria-label={`${s.met} de ${s.withData} vacinas prioritárias na meta`}>
          {rows.map(r => <span key={r.slug} title={`${r.label}: ${r.value === null ? 'sem registro' : `${nf(1).format(r.value)} %`}`} className="h-2 flex-1 rounded-full" style={{ background: r.status === 'met' ? '#16a34a' : r.status === 'below' ? '#f4a3bd' : '#dfe5ec' }} />)}
        </div>
        <p className="mt-auto pt-2 text-[0.68rem] text-muted-foreground">Metas por imunizante prioritário</p>
      </> : <p className="mt-2 text-sm text-muted-foreground">Sem coberturas publicadas para este território.</p>}
    </article>
  );
}

const DONUT_COLORS = ['#1d4ed8', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ec4899', '#8b5cf6'];
function CardShell({ icon, tone, title, desc, children, className }: { icon: React.ReactNode; tone: CardTone; title: string; desc: string; children: React.ReactNode; className?: string }) {
  return <section className={cn('flex min-w-0 flex-col rounded-xl border bg-white p-4', className)}>
    <header className="flex items-start gap-3"><IconBox tone={tone}>{icon}</IconBox><div><h3 className={cn('text-base font-bold', NAVY)}>{title}</h3><p className="mt-0.5 text-xs leading-snug text-muted-foreground">{desc}</p></div></header>
    {children}
  </section>;
}

function EstablishmentDonut({ facilities, scope, cnesLabel }: { facilities: Facilities; scope: string; cnesLabel: string }) {
  const types = facilities.byType; const top = types.slice(0, 7); const rest = types.slice(7).reduce((n, t) => n + t.n, 0);
  const items = [...top.map((t, i) => ({ label: prettyType(t.code, t.label), n: t.n, color: DONUT_COLORS[i]! })), ...(rest > 0 ? [{ label: 'Outros tipos', n: rest, color: '#94a3b8' }] : [])];
  const total = facilities.total; const R = 62, C = 2 * Math.PI * R; let acc = 0;
  const pct = (n: number) => `${nf(n / total * 100 >= 10 ? 0 : 1).format(n / total * 100)}%`;
  const top1 = items[0]; const hosp = types.filter(t => t.code === 5 || t.code === 7).reduce((n, t) => n + t.n, 0);
  return (
    <CardShell icon={<Hospital size={18} color={TONES.blue.fg} aria-hidden />} tone="blue" title="Tipos de estabelecimento" desc={`Distribuição dos estabelecimentos de saúde em ${scope} por tipo (CNES, ${cnesLabel}).`}>
      <div className="relative mx-auto mt-3 h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`${int.format(total)} estabelecimentos; maior grupo: ${top1?.label ?? '—'}`}>
          {items.map(it => { const len = it.n / total * C; const el = <circle key={it.label} cx="80" cy="80" r={R} fill="none" stroke={it.color} strokeWidth="24" strokeDasharray={`${Math.max(len - 1, 0)} ${C - Math.max(len - 1, 0)}`} strokeDashoffset={-acc}><title>{`${it.label}: ${int.format(it.n)} (${pct(it.n)})`}</title></circle>; acc += len; return el; })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><p className={cn('font-display text-2xl leading-none', NAVY)}>{int.format(total)}</p><p className="mt-1 text-[0.65rem] text-muted-foreground">estabelecimentos<br />no total</p></div></div>
      </div>
      <ul className="mt-3 divide-y text-sm">{items.map(it => <li key={it.label} className="flex items-center gap-2 py-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} aria-hidden /><span className="min-w-0 flex-1 truncate" title={it.label}>{it.label}</span><span className="text-xs text-muted-foreground">{pct(it.n)}</span><strong className="w-14 text-right">{int.format(it.n)}</strong></li>)}</ul>
      {top1 && <p className="mt-auto pt-3 text-xs text-muted-foreground">{top1.label} é o maior grupo ({pct(top1.n)}); hospitais somam {int.format(hosp)}{hosp ? ` (${pct(hosp)})` : ''}.</p>}
    </CardShell>
  );
}

function BedTypes({ facilities, scope, cnesLabel }: { facilities: Facilities; scope: string; cnesLabel: string }) {
  const rows = facilities.beds.byType.filter(b => b.code !== 7); const dayHosp = facilities.beds.byType.find(b => b.code === 7);
  const ex = facilities.beds.existing, su = facilities.beds.sus; const comp = rows.find(b => b.code === 3);
  return (
    <CardShell icon={<BedDouble size={18} color={TONES.blue.fg} aria-hidden />} tone="blue" title="Leitos por tipo" desc={`Leitos hospitalares existentes e leitos SUS em ${scope} (CNES, ${cnesLabel}).`}>
      {rows.length === 0 ? <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum leito registrado no cadastro.</p> :
        <div className="mt-3 overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-[#e6eefc] text-xs text-[#14304f]"><tr><th className="px-3 py-2 text-left">Tipo de leito</th><th className="px-2 text-center">Existentes</th><th className="px-2 text-center">SUS</th></tr></thead>
          <tbody>{rows.map(b => <tr key={b.code} className="border-t"><td className="px-3 py-2"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#2563eb]" aria-hidden />{b.label}</td><td className="border-l text-center">{int.format(b.existing)}</td><td className="border-l text-center">{int.format(b.sus)}</td></tr>)}
            <tr className="border-t bg-[#f4f7fb] font-semibold"><td className="px-3 py-2">Total (sem hospital-dia)</td><td className="border-l text-center">{int.format(ex)}</td><td className="border-l text-center">{int.format(su)}</td></tr></tbody></table></div>}
      <p className="mt-auto pt-3 text-xs text-muted-foreground">{ex > 0 ? `O SUS responde por ${nf(0).format(su / ex * 100)}% dos leitos existentes${comp && ex ? `; complementares (UTI/UCI) são ${nf(0).format(comp.existing / ex * 100)}%` : ''}. ` : ''}{dayHosp && dayHosp.existing > 0 ? `Há ainda ${int.format(dayHosp.existing)} leitos de hospital-dia, fora da soma. ` : ''}{facilities.withoutBeds > 0 ? `${facilities.withoutBeds} hospital(is) sem leito registrado.` : ''}</p>
    </CardShell>
  );
}

function VaccineTable({ rows, scope }: { rows: VaccineRow[]; scope: string }) {
  const s = vaccineSummary(rows); const below = rows.filter(r => r.status === 'below').map(r => r.label);
  return (
    <CardShell icon={<Syringe size={18} color={TONES.green.fg} aria-hidden />} tone="green" title="Cobertura vacinal" desc={`Cobertura vacinal em ${scope} (SI-PNI).`}>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <p className="flex items-center gap-1.5"><CheckCircle2 size={16} color="#16a34a" aria-hidden />Na meta: <strong className={cn('text-base', NAVY)}>{s.met}</strong></p>
        <p className="flex items-center gap-1.5"><AlertCircle size={16} color="#db2777" aria-hidden />Abaixo da meta: <strong className={cn('text-base', NAVY)}>{s.below}</strong></p>
        <p className="flex items-center gap-1.5"><CalendarDays size={16} color="#2563eb" aria-hidden />Ano-base: <strong className={cn('text-base', NAVY)}>{s.year ?? '—'}</strong></p>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-[#e6eefc] text-xs text-[#14304f]"><tr><th className="px-3 py-2 text-left">Status</th><th className="text-left">Vacina</th><th className="px-2 text-right">Cobertura</th><th className="px-3 text-right">Ano</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.slug} className="border-t">
          <td className="px-3 py-1.5">{r.status === 'met' ? <CheckCircle2 size={17} color="#16a34a" aria-label="Na meta" /> : r.status === 'below' ? <AlertCircle size={17} color="#db2777" aria-label="Abaixo da meta" /> : <Minus size={17} color="#94a3b8" aria-label="Sem registro" />}</td>
          <td className="py-1.5">{r.label}<span className="block text-[0.62rem] text-muted-foreground">meta {r.target}%</span></td>
          <td className="px-2 text-right tabular-nums">{r.value === null ? '—' : `${nf(2).format(r.value)}%`}{r.flags & FLAG.above100 ? <span className="block text-[0.62rem] text-muted-foreground">acima de 100%</span> : null}</td>
          <td className="px-3 text-right tabular-nums">{r.year ?? '—'}{r.preliminary ? <span className="block text-[0.62rem] text-warning">parcial</span> : null}</td></tr>)}</tbody></table></div>
      <p className="mt-auto pt-3 text-xs text-muted-foreground">{below.length ? `Abaixo da meta: ${below.join(', ')}. ` : s.withData ? 'Todas as vacinas com registro estão na meta. ' : ''}Doses aplicadas ÷ população-alvo do SI-PNI; pode passar de 100%.</p>
    </CardShell>
  );
}

export interface HealthPanelProps {
  scope: string; kind: 'uf' | 'municipio'; ufCode: number; ufName: string;
  values: Record<string, PanelValue>; vaccines: VaccineValue[]; facilities: Facilities | null; bench: HealthBenchmarks; cnesLabel: string; compact?: boolean;
}
/** Painel de Saúde: 7 cards-resumo com benchmark e 3 análises (tipos de estabelecimento, leitos, vacinas). Todos os dados chegam prontos (sem consulta por card). */
export function HealthPanel(p: HealthPanelProps) {
  const cards = PANEL_CARDS.map(meta => {
    const v = p.values[meta.code];
    const bench = p.kind === 'municipio'
      ? benchFor(v, p.bench.byUf[String(p.ufCode)]?.[meta.code], `municípios de ${p.ufName}`, p.bench.brazilMunicipalities[meta.code], 'Brasil')
      : benchFor(v, p.bench.ufs[meta.code], 'UFs', undefined, '');
    return { meta, v, bench };
  });
  const vrows = vaccineRows(p.vaccines);
  const lede = healthLede({ scope: p.scope, groupLabel: p.kind === 'municipio' ? `municípios de ${p.ufName}` : 'UFs', cards: cards.map(c => ({ title: c.meta.title.replace(/ por 1\.000 habitantes/, ' por mil habitantes'), bench: c.bench, value: c.v?.value ?? null })), vaccines: vrows });
  const hasFacilities = p.facilities && p.facilities.total > 0;
  return (
    <section aria-labelledby="painel-saude" className="space-y-3">
      <div><h2 id="painel-saude" className="section-hairline pt-3 font-display text-2xl">Painel de Saúde</h2>{lede && <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{lede.charAt(0).toUpperCase() + lede.slice(1)}</p>}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.3fr)]">
        {cards.map(c => <KpiBenchCard key={c.meta.code} meta={c.meta} v={c.v} bench={c.bench} />)}
        <VaccineMeterCard rows={vrows} hasPanel={p.vaccines.length > 0} />
      </div>
      {!p.compact && <div className="grid gap-3 lg:grid-cols-[35fr_32fr_33fr]">
        {hasFacilities ? <EstablishmentDonut facilities={p.facilities!} scope={p.scope} cnesLabel={p.cnesLabel} /> : <CardShell icon={<Hospital size={18} color={TONES.blue.fg} aria-hidden />} tone="blue" title="Tipos de estabelecimento" desc="Sem cadastro CNES publicado para este território."><p className="mt-4 text-sm text-muted-foreground">Nenhum estabelecimento registrado.</p></CardShell>}
        {hasFacilities ? <BedTypes facilities={p.facilities!} scope={p.scope} cnesLabel={p.cnesLabel} /> : <CardShell icon={<BedDouble size={18} color={TONES.blue.fg} aria-hidden />} tone="blue" title="Leitos por tipo" desc="Sem cadastro CNES publicado para este território."><p className="mt-4 text-sm text-muted-foreground">Nenhum leito registrado.</p></CardShell>}
        <VaccineTable rows={vrows} scope={p.scope} />
      </div>}
      <p className="text-[0.7rem] text-muted-foreground">Régua: faixa de 10% a 90% do grupo, traço cheio = mediana do grupo, tracejado = mediana do Brasil, ponto verde = este território. A posição descreve a distribuição; não é um ranking de qualidade. Metas vacinais: Ministério da Saúde/PNI (BCG 90%, demais 95%).</p>
    </section>
  );
}
