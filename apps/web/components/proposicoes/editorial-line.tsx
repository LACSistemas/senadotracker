'use client';
import type { EditorialFact } from '@senadotracker/db';
import { useScope } from './scope-toggle';

/** Frases da Casa escolhida. No Congresso não comparável, cada Casa mostra a sua própria frase (nunca uma soma). */
export function factsFor(facts: EditorialFact[], id: EditorialFact['id'], scope: 'congresso' | 'camara' | 'senado') {
  if (scope !== 'congresso') return facts.filter(fact => fact.id === id && fact.scope === scope);
  const own = facts.filter(fact => fact.id === id && fact.scope === 'congresso');
  if (own.length) return own;
  return facts.filter(fact => fact.id === id && (fact.scope === 'camara' || fact.scope === 'senado'));
}

function Sentence({ fact }: { fact: EditorialFact }) {
  return <>{fact.before}{fact.emphasis ? <strong className="font-bold text-primary">{fact.emphasis}</strong> : null}{fact.after}</>;
}

/** Uma frase editorial entre visualizações: sempre derivada de números publicados, com a base logo abaixo. */
export function EditorialLine({ facts, ids, className = '' }: { facts: EditorialFact[]; ids: EditorialFact['id'][]; className?: string }) {
  const { scope } = useScope();
  const lines = ids.flatMap(id => factsFor(facts, id, scope));
  if (!lines.length) return null;
  return <div className={`space-y-3 ${className}`}>{lines.map(fact => <blockquote key={`${fact.id}:${fact.scope}`} className="border-l-4 border-primary/70 pl-5">
    <p className="font-display text-xl leading-snug text-foreground sm:text-2xl"><Sentence fact={fact} /></p>
    <footer className="mt-1.5 text-xs text-muted-foreground">{fact.scope === 'camara' ? 'Câmara' : fact.scope === 'senado' ? 'Senado' : 'Congresso'} · {fact.note}</footer>
  </blockquote>)}</div>;
}

export function HeroSentence({ facts }: { facts: EditorialFact[] }) {
  const { scope } = useScope();
  const fact = factsFor(facts, 'thesis', scope)[0] ?? facts.find(item => item.id === 'thesis');
  if (!fact) return <>A atividade legislativa vai além das leis.</>;
  return <><span>{fact.before}</span>{fact.emphasis ? <em>{fact.emphasis}</em> : null}<span>{fact.after}</span></>;
}
