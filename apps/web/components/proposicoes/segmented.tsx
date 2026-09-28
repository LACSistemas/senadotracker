'use client';
import { useRef, type KeyboardEvent } from 'react';

/** Segmented control acessível e genérico (radiogroup, tabindex móvel, setas). */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; size?: 'sm' | 'md' }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value); refs.current[next]?.focus();
  };
  return <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border bg-card p-1">
    {options.map((option, index) => {
      const active = option.value === value;
      return <button key={option.value} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} onClick={() => onChange(option.value)} onKeyDown={event => move(event, index)}
        className={`focus-ring rounded-full font-bold transition-colors ${size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{option.label}</button>;
    })}
  </div>;
}
