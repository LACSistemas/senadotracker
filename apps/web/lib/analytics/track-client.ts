/** Envia um evento de analytics pro servidor (pageview ou evento próprio, ex. vote_match_started).
 * Usa sendBeacon quando disponível (não bloqueia navegação/unload); nunca lança — analytics não pode
 * quebrar nenhuma interação real do site. */
export function trackEvent(eventName: string, props: Record<string, unknown> = {}, path?: string): void {
  try {
    const payload = JSON.stringify({
      event_name: eventName,
      path: path ?? location.pathname,
      referrer: document.referrer || null,
      props,
    });
    const blob = new Blob([payload], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/track', blob)) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // analytics nunca deve quebrar a navegação
  }
}
