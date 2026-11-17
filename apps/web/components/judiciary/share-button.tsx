'use client';
import * as React from 'react';
import { Share2, Check } from 'lucide-react';

/** P14.45 (ajuste visual) — "Compartilhar" do mock: a URL atual já é a investigação inteira (camada 1
 * de estado, mandato §19), então compartilhar é só copiar `location.href` — nenhum estado novo no
 * servidor, nenhuma "investigação salva" (fora de escopo, exigiria persistência nova). */
export function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard indisponível — sem erro visível, link continua na barra de endereço */ }
      }}
    >
      {copied ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
      {copied ? 'Link copiado!' : 'Compartilhar'}
    </button>
  );
}
