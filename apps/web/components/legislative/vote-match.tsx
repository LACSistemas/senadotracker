'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Share2, Shuffle } from 'lucide-react';
import { OfficialPortrait } from '@/components/app-image';
import { trackEvent } from '@/lib/analytics/track-client';
import { cn } from '@/lib/utils';

export type DirectionalVote = 'sim' | 'nao' | 'abstencao' | 'obstrucao';
export interface VoteMatchQuestion {
  deliberationId: string; source: 'senado' | 'camara'; proposalLabel: string; pauta: string;
  description: string; date: string; result: string | null; officialUrl: string | null; recordedVotes: number;
}
export interface VoteMatchPerson { externalId: string; name: string; party: string; uf: string; portraitUrl: string | null; votes: Array<DirectionalVote | null> }
export interface VoteMatchDataset { source: 'senado' | 'camara'; questions: VoteMatchQuestion[]; people: VoteMatchPerson[] }
type HouseKey = 'senado' | 'camara';
/** `undefined` = ainda não respondida; `null` = "Pular" (sem posição, nunca entra na comparação). */
type Answer = DirectionalVote | null;
type Match = { person: VoteMatchPerson; ratio: number | null; comparable: number };

const STORAGE_KEY = 'civica:vote-match:v1';
/** Tamanho da rodada: sorteado do banco curado (que é bem maior), não o banco inteiro — é o que dá
 * rotatividade de verdade (jogar de novo tende a trazer um conjunto diferente de votações). */
const DECK_SIZE = 12;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
function loadSession(): { house: HouseKey; order: string[]; answers: Record<string, Answer> } | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveSession(v: { house: HouseKey; order: string[]; answers: Record<string, Answer> }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* funciona sem lembrar a sessão */ }
}
function clearSession() { try { localStorage.removeItem(STORAGE_KEY); } catch { /* nada a limpar */ } }
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const HOUSE_LABEL: Record<HouseKey, string> = { senado: 'Senado Federal', camara: 'Câmara dos Deputados' };

/**
 * "Qual parlamentar vota como você?" — toda a interação e o cálculo de concordância rodam aqui, no
 * client (instantâneo, permite ranking ao vivo e replay sem round-trip ao servidor). O dataset de
 * cada Casa já vem pronto do servidor (`voteMatchDataset`, P14.5x). O cálculo espelha
 * `calculateVoteAgreement`/`directionalVote` de @senadotracker/db: só entram na razão as votações em
 * que AMBOS (usuário e parlamentar) têm posição direcional — ausência, licença e voto não registrado
 * nunca contam a favor nem contra.
 */
export function VoteMatch({ datasets }: { datasets: Record<HouseKey, VoteMatchDataset | null> }) {
  const reducedMotion = useReducedMotion();
  const [house, setHouse] = useState<HouseKey | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'house' | 'answering' | 'results'>('house');
  const [restored, setRestored] = useState(false);
  const [partyFilter, setPartyFilter] = useState('');
  const [ufFilter, setUfFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const dataset = house ? datasets[house] : null;

  useEffect(() => {
    if (restored) return;
    setRestored(true);
    const saved = loadSession();
    if (saved && datasets[saved.house] && saved.order.length) {
      setHouse(saved.house); setOrder(saved.order); setAnswers(saved.answers);
      const answeredCount = saved.order.filter(id => saved.answers[id] !== undefined).length;
      setPhase(answeredCount >= saved.order.length ? 'results' : 'answering');
      setStep(Math.min(answeredCount, saved.order.length - 1));
    }
  }, [restored, datasets]);

  useEffect(() => { if (house && phase !== 'house') saveSession({ house, order, answers }); }, [house, order, answers, phase]);

  const startHouse = (h: HouseKey, isReplay = false) => {
    const ds = datasets[h]; if (!ds || !ds.questions.length) return;
    const pool = shuffle(ds.questions.map(q => q.deliberationId));
    setHouse(h); setOrder(pool.slice(0, Math.min(DECK_SIZE, pool.length))); setAnswers({}); setStep(0); setPhase('answering'); setExpanded(null);
    trackEvent('vote_match_started', { house: h, replay: isReplay });
  };
  const replay = () => { if (house) startHouse(house, true); };
  const changeHouse = () => { clearSession(); setHouse(null); setOrder([]); setAnswers({}); setStep(0); setPhase('house'); };
  const answer = (id: string, v: Answer) => {
    const nextAnswers = { ...answers, [id]: v };
    setAnswers(nextAnswers);
    setStep(prevStep => {
      const next = prevStep + 1;
      if (next >= order.length) {
        setPhase('results');
        const skipped = order.filter(qid => nextAnswers[qid] === null).length;
        trackEvent('vote_match_completed', { house, deckSize: order.length, skipped });
      }
      return next;
    });
  };
  const goBack = () => setStep(s => Math.max(0, s - 1));

  const matches: Match[] = useMemo(() => {
    if (!dataset || phase !== 'results') return [];
    const indexOf = new Map(dataset.questions.map((q, i) => [q.deliberationId, i]));
    return dataset.people.map(p => {
      let equal = 0, total = 0;
      for (const id of order) {
        const mine = answers[id]; const qi = indexOf.get(id); const theirs = qi != null ? p.votes[qi] : null;
        if (mine != null && theirs != null) { total++; if (mine === theirs) equal++; }
      }
      return { person: p, ratio: total > 0 ? equal / total : null, comparable: total };
    }).sort((a, b) => {
      if (a.ratio === null && b.ratio === null) return b.comparable - a.comparable;
      if (a.ratio === null) return 1; if (b.ratio === null) return -1;
      return b.ratio - a.ratio || b.comparable - a.comparable;
    });
  }, [dataset, phase, order, answers]);

  const partyStats = useMemo(() => {
    const byParty = new Map<string, number[]>();
    for (const m of matches) { if (m.ratio == null) continue; const v = byParty.get(m.person.party) ?? []; v.push(m.ratio); byParty.set(m.person.party, v); }
    return [...byParty.entries()].map(([party, values]) => ({ party, mean: values.reduce((a, b) => a + b, 0) / values.length, n: values.length }))
      .filter(r => r.n >= 2).sort((a, b) => b.mean - a.mean);
  }, [matches]);

  if (phase === 'house' || !dataset) return <HousePicker datasets={datasets} onPick={startHouse} />;
  if (phase === 'answering') {
    const q = dataset.questions.find(x => x.deliberationId === order[step]);
    if (!q) return null;
    return <QuestionDeck house={house!} total={order.length} step={step} question={q} reducedMotion={reducedMotion}
      onAnswer={v => answer(q.deliberationId, v)} onBack={goBack} onChangeHouse={changeHouse} />;
  }
  return <ResultsView house={house!} dataset={dataset} order={order} answers={answers} matches={matches} partyStats={partyStats}
    expanded={expanded} setExpanded={setExpanded} partyFilter={partyFilter} setPartyFilter={setPartyFilter} ufFilter={ufFilter} setUfFilter={setUfFilter}
    onReplay={replay} onChangeHouse={changeHouse} />;
}

function RigorNotes() {
  return <ul className="mt-6 space-y-1.5 border-t pt-4 text-xs leading-5 text-muted-foreground">
    <li>Concordância em votações nominais registradas — não é nota de qualidade nem avaliação do parlamentar.</li>
    <li>Ausência, licença ou voto não registrado não contam (nem a favor, nem contra).</li>
    <li>O conjunto de votações é uma curadoria editorial de votações notáveis, não o universo completo.</li>
    <li>Cada rodada sorteia {DECK_SIZE} votações do banco curado — jogar de novo tende a trazer um conjunto diferente.</li>
    <li>Comparação só dentro da mesma Casa; obstrução só conta como posição na Câmara; votos secretos e sem direção ficam de fora.</li>
    <li>Partido e UF são os do cadastro atual do parlamentar, que podem não ser os mesmos de quando o voto foi registrado.</li>
  </ul>;
}

function HousePicker({ datasets, onPick }: { datasets: Record<HouseKey, VoteMatchDataset | null>; onPick: (h: HouseKey) => void }) {
  return <section aria-labelledby="vote-match-title" className="rounded-3xl border bg-card p-6 sm:p-10">
    <p className="eyebrow">Qual parlamentar vota como você?</p>
    <h2 id="vote-match-title" className="mt-2 text-3xl font-black tracking-tight">Responda a votações reais do Congresso e descubra</h2>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Escolha uma Casa, responda Sim, Não ou Pule a uma seleção de votações nominais reais, e veja com quais parlamentares você mais — e menos — concorda, a partir do voto de verdade de cada um.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {(['senado', 'camara'] as const).map(h => { const ds = datasets[h];
        return <button key={h} type="button" disabled={!ds || !ds.questions.length} onClick={() => onPick(h)}
          className="focus-ring rounded-2xl border bg-background p-6 text-left transition hover:-translate-y-0.5 hover:border-primary disabled:opacity-50">
          <strong className="display-title block text-xl">{HOUSE_LABEL[h]}</strong>
          <span className="mt-1 block text-sm text-muted-foreground">{ds && ds.questions.length ? `${Math.min(DECK_SIZE, ds.questions.length)} de ${ds.questions.length} votações no banco, sorteadas a cada rodada · ${ds.people.length} parlamentares` : 'Indisponível no momento'}</span>
        </button>; })}
    </div>
    <RigorNotes />
    <noscript>
      {(['senado', 'camara'] as const).map(h => { const ds = datasets[h]; if (!ds || !ds.questions.length) return null;
        return <div key={h} className="mt-6"><h3 className="font-bold">{HOUSE_LABEL[h]}</h3>
          <ul className="mt-2 list-inside list-disc text-sm leading-6">{ds.questions.map(q => <li key={q.deliberationId}>{q.proposalLabel}: {q.pauta}{q.officialUrl ? <> — <a href={q.officialUrl} className="text-primary underline">fonte oficial</a></> : null}</li>)}</ul>
        </div>; })}
    </noscript>
  </section>;
}

function QuestionDeck({ house, total, step, question, reducedMotion, onAnswer, onBack, onChangeHouse }: {
  house: HouseKey; total: number; step: number; question: VoteMatchQuestion; reducedMotion: boolean;
  onAnswer: (v: Answer) => void; onBack: () => void; onChangeHouse: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (typing) return;
      if (e.key === 'ArrowRight' || e.key === 'y' || e.key === 'Y') onAnswer('sim');
      else if (e.key === 'ArrowLeft' || e.key === 'n' || e.key === 'N') onAnswer('nao');
      else if (e.key === 'Escape') onAnswer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  let touchStartX: number | null = null;
  const onTouchStart = (e: React.TouchEvent) => { touchStartX = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (dx > 70) onAnswer('sim'); else if (dx < -70) onAnswer('nao');
    touchStartX = null;
  };

  return <section aria-labelledby="deck-question" className="mx-auto max-w-xl rounded-3xl border bg-card p-6 sm:p-8" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onChangeHouse} className="focus-ring text-xs font-bold text-muted-foreground underline">Trocar de Casa</button>
      <p aria-live="polite" className="text-xs font-bold text-muted-foreground">{step + 1} de {total}</p>
    </div>
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total} aria-label="Progresso">
      <div className={cn('h-full bg-primary', !reducedMotion && 'transition-all duration-300')} style={{ width: `${((step + 1) / total) * 100}%` }} />
    </div>

    <div className="mt-6">
      <p className="eyebrow">Como você votaria?</p>
      <h2 id="deck-question" className="mt-2 text-2xl font-black leading-tight">{question.pauta}</h2>
      <p className="mt-3 text-xs text-muted-foreground">{question.proposalLabel}{question.officialUrl && <> · <a href={question.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary underline">fonte oficial <ExternalLink size={11} aria-hidden /></a></>}</p>
    </div>

    <div className="mt-6 grid grid-cols-2 gap-3">
      <button type="button" onClick={() => onAnswer('nao')} className="focus-ring rounded-2xl border-2 border-rose-200 bg-rose-50 py-4 text-base font-black text-rose-700 hover:bg-rose-100">Não</button>
      <button type="button" onClick={() => onAnswer('sim')} className="focus-ring rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base font-black text-emerald-700 hover:bg-emerald-100">Sim</button>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <button type="button" onClick={() => onAnswer(null)} className="focus-ring text-sm font-bold text-muted-foreground underline">Pular</button>
      <button type="button" onClick={() => onAnswer('abstencao')} className="focus-ring text-sm font-bold text-muted-foreground underline">Registrar abstenção</button>
      {house === 'camara' && <button type="button" onClick={() => onAnswer('obstrucao')} className="focus-ring text-sm font-bold text-muted-foreground underline">Obstrução (avançado)</button>}
    </div>
    {step > 0 && <button type="button" onClick={onBack} className="focus-ring mt-4 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={13} aria-hidden /> Voltar e mudar a resposta anterior</button>}
  </section>;
}

function PodiumCard({ title, tone, match }: { title: string; tone: 'emerald' | 'rose'; match: Match }) {
  return <div className={cn('rounded-2xl border-2 p-5', tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50')}>
    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="mt-3 flex items-center gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={match.person.portraitUrl} name={match.person.name} sizes="64px" /></div>
      <div className="min-w-0"><strong className="block truncate text-lg">{match.person.name}</strong><span className="text-sm text-muted-foreground">{match.person.party}-{match.person.uf}</span></div>
    </div>
    <p className="mt-3 text-3xl font-black tracking-tight">{match.ratio != null ? pct(match.ratio) : '—'}<span className="ml-1.5 text-sm font-normal text-muted-foreground">de concordância</span></p>
    <p className="text-xs text-muted-foreground">{match.comparable} votações comparáveis</p>
  </div>;
}
function PartyCard({ title, tone, row }: { title: string; tone: 'emerald' | 'rose'; row: { party: string; mean: number; n: number } }) {
  return <div className={cn('rounded-2xl border-2 p-5', tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50')}>
    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
    <p className="mt-2 text-2xl font-black">{row.party}</p>
    <p className="text-sm text-muted-foreground">{pct(row.mean)} de concordância média entre os membros · {row.n} com voto comparável</p>
  </div>;
}

function ResultsView({ house, dataset, order, answers, matches, partyStats, expanded, setExpanded, partyFilter, setPartyFilter, ufFilter, setUfFilter, onReplay, onChangeHouse }: {
  house: HouseKey; dataset: VoteMatchDataset; order: string[]; answers: Record<string, Answer>; matches: Match[];
  partyStats: Array<{ party: string; mean: number; n: number }>; expanded: string | null; setExpanded: (v: string | null) => void;
  partyFilter: string; setPartyFilter: (v: string) => void; ufFilter: string; setUfFilter: (v: string) => void;
  onReplay: () => void; onChangeHouse: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const withRatio = matches.filter(m => m.ratio != null);
  const top = withRatio[0] ?? null;
  const bottom = withRatio.length > 1 ? withRatio[withRatio.length - 1]! : null;
  const closestParty = partyStats[0] ?? null;
  const farthestParty = partyStats.length > 1 ? partyStats[partyStats.length - 1]! : null;
  const comparableCount = withRatio.length;

  const parties = useMemo(() => [...new Set(dataset.people.map(p => p.party))].sort(), [dataset]);
  const ufs = useMemo(() => [...new Set(dataset.people.map(p => p.uf))].filter(Boolean).sort(), [dataset]);
  const filtered = matches.filter(m => (!partyFilter || m.person.party === partyFilter) && (!ufFilter || m.person.uf === ufFilter));
  const indexOf = useMemo(() => new Map(dataset.questions.map((q, i) => [q.deliberationId, i])), [dataset]);

  const shareText = top ? `Eu concordo ${pct(top.ratio!)} com ${top.person.name} (${top.person.party}-${top.person.uf}) em votações reais do ${house === 'senado' ? 'Senado' : 'da Câmara'} — descubra o seu em /legislativo#como-voto.` : '';
  const share = async () => {
    if (!shareText) return;
    const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ text: shareText }); return; } catch { /* usuário cancelou: cai no copiar */ } }
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem clipboard disponível */ }
  };

  return <section className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-3xl font-black tracking-tight">Seu resultado — {HOUSE_LABEL[house]}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onReplay} className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold hover:border-primary"><Shuffle size={14} aria-hidden /> Refazer com novas votações</button>
        <button type="button" onClick={onChangeHouse} className="focus-ring rounded-full border px-4 py-2 text-sm font-bold hover:border-primary">Trocar de Casa</button>
      </div>
    </div>
    <p aria-live="polite" className="text-sm text-muted-foreground">Comparável com {comparableCount} de {dataset.people.length} parlamentares — quem teve posição direcional em pelo menos 1 das votações que você respondeu.</p>

    {top && <div className="grid gap-4 sm:grid-cols-2">
      <PodiumCard title="Mais parecido com você" tone="emerald" match={top} />
      {bottom && <PodiumCard title="Mais oposto a você" tone="rose" match={bottom} />}
    </div>}

    {closestParty && <div className="grid gap-4 sm:grid-cols-2">
      <PartyCard title="Partido mais próximo" tone="emerald" row={closestParty} />
      {farthestParty && <PartyCard title="Partido mais distante" tone="rose" row={farthestParty} />}
    </div>}

    {top && <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm leading-6">{shareText}</p>
      <button type="button" onClick={share} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"><Share2 size={14} aria-hidden /> {copied ? 'Copiado!' : 'Compartilhar'}</button>
    </div>}

    <div>
      <h3 className="text-xl font-black">Ranking completo ({dataset.people.length})</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={partyFilter} onChange={e => setPartyFilter(e.target.value)} aria-label="Filtrar por partido" className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="">Todos os partidos</option>{parties.map(p => <option key={p} value={p}>{p}</option>)}</select>
        <select value={ufFilter} onChange={e => setUfFilter(e.target.value)} aria-label="Filtrar por estado" className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="">Todos os estados</option>{ufs.map(u => <option key={u} value={u}>{u}</option>)}</select>
      </div>
      <ol className="mt-3 max-h-[32rem] divide-y overflow-y-auto rounded-xl border bg-card">
        {filtered.map((m, i) => <li key={m.person.externalId} className="flex items-center gap-3 p-3">
          <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={m.person.portraitUrl} name={m.person.name} sizes="40px" /></div>
          <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{m.person.name}</strong><span className="text-xs text-muted-foreground">{m.person.party}-{m.person.uf}</span></div>
          <strong className="tnum shrink-0 text-sm">{m.ratio != null ? pct(m.ratio) : '—'}</strong>
        </li>)}
        {!filtered.length && <li className="p-4 text-sm text-muted-foreground">Nenhum parlamentar com esse filtro.</li>}
      </ol>
    </div>

    <div>
      <h3 className="text-xl font-black">Votação por votação</h3>
      <div className="mt-3 space-y-2">
        {order.map(id => {
          const q = dataset.questions.find(x => x.deliberationId === id); if (!q) return null;
          const mine = answers[id]; const isOpen = expanded === id; const qi = indexOf.get(id)!;
          const agree = mine != null ? matches.filter(m => m.person.votes[qi] === mine) : [];
          return <details key={id} open={isOpen} onToggle={e => setExpanded(e.currentTarget.open ? id : null)} className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-bold">{q.proposalLabel} — você {mine == null ? 'pulou' : `respondeu ${mine}`}</summary>
            {isOpen && <div className="mt-3 text-sm">
              <p className="text-muted-foreground">{q.pauta}</p>
              {mine == null ? <p className="mt-2 text-muted-foreground">Sem posição registrada — não entra na comparação.</p> : <>
                <p className="mt-2 text-xs text-muted-foreground">{agree.length} parlamentares votaram como você nesta votação.</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">{agree.slice(0, 40).map(m => <li key={m.person.externalId}>{m.person.name} ({m.person.party}-{m.person.uf})</li>)}</ul>
              </>}
              {q.officialUrl && <a href={q.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-primary underline">Ver votação oficial</a>}
            </div>}
          </details>;
        })}
      </div>
    </div>

    <RigorNotes />

    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-bold">Ver tabela completa (parlamentar × concordância × nº de votações comparáveis)</summary>
      <div className="mt-3 max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left"><th className="p-1">Parlamentar</th><th className="p-1">Partido</th><th className="p-1">UF</th><th className="p-1">Concordância</th><th className="p-1">Comparáveis</th></tr></thead>
        <tbody>{matches.map(m => <tr key={m.person.externalId} className="border-t"><td className="p-1">{m.person.name}</td><td className="p-1 text-center">{m.person.party}</td><td className="p-1 text-center">{m.person.uf}</td><td className="p-1 text-center">{m.ratio != null ? pct(m.ratio) : '—'}</td><td className="p-1 text-center">{m.comparable}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}
