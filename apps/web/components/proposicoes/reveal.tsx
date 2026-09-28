'use client';
import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { nf, pf } from '@/lib/proposicoes/taxonomy';

const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Observa a entrada na viewport, uma única vez. Com movimento reduzido ou sem IntersectionObserver o elemento
 * já nasce "visto". Sem JavaScript, a animação de segurança do CSS revela o conteúdo sozinha (ver globals.css).
 */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setInView(true); observer.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -6% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** Entrada suave (fade + subida) quando o bloco aparece na tela. */
export function Reveal({ as = 'div', delay = 0, className = '', style, children, ...rest }: { as?: 'div' | 'section' | 'article' | 'li' | 'header' | 'aside'; delay?: number; className?: string; style?: CSSProperties; children?: ReactNode } & Record<`data-${string}`, string>) {
  const [ref, inView] = useInView<HTMLElement>(0.12);
  return createElement(as, { ref, 'data-in': inView ? 'true' : 'false', className: `prop-rise ${className}`, style: { transitionDelay: `${delay}ms`, ...style }, ...rest }, children);
}

export type CountKind = 'int' | 'percent' | 'decimal';
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const formatCount = (value: number, kind: CountKind) => kind === 'percent' ? pf.format(value) : kind === 'decimal' ? decimal.format(value) : nf.format(Math.round(value));

/**
 * Número que sobe até o valor final ao entrar na tela. O HTML de servidor já traz o valor final (leitura
 * por leitores de tela e sem JavaScript); a versão animada é `aria-hidden`. Mudanças posteriores de valor
 * (troca de Casa) animam a partir do valor exibido.
 */
export function CountUp({ value, kind = 'int', duration = 1100, className }: { value: number; kind?: CountKind; duration?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value), played = useRef(false);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { shownRef.current = value; setShown(value); played.current = true; return; }
    const first = !played.current, from = first ? 0 : shownRef.current, delta = value - from, span = first ? duration : 600;
    played.current = true;
    if (delta === 0) { setShown(value); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / span), eased = 1 - (1 - progress) ** 3, current = from + delta * eased;
      shownRef.current = current; setShown(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);
  return <><span ref={ref} aria-hidden="true" className={className}>{formatCount(shown, kind)}</span><span className="sr-only">{formatCount(value, kind)}</span></>;
}
