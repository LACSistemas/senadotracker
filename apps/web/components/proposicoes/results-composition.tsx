'use client';
import { useRouter } from 'next/navigation';
import type { CompositionEntry } from '@/lib/proposicoes/composition';
import { OTHER_KEY } from '@/lib/proposicoes/composition';
import { AnimatedBarStrip } from './animated-bar-strip';

/**
 * Micro-faixa de composição dos resultados atuais. Clicar em um segmento aplica (ou remove) o filtro de grupo pela URL,
 * então a busca continua compartilhável. "Outras formas" reúne três grupos e por isso não filtra um grupo só.
 */
export function ResultsComposition({ entries, hrefs, clearHref, selectedKey, total, className = '' }: { entries: CompositionEntry[]; hrefs: Record<string, string>; clearHref: string; selectedKey: string | null; total: number; className?: string }) {
  const router = useRouter();
  return <AnimatedBarStrip className={className} size="md" selectedKey={selectedKey} onSelect={key => { if (key === null) router.push(clearHref); else if (key !== OTHER_KEY && hrefs[key]) router.push(hrefs[key]!); }}
    segments={entries.map(entry => ({ key: entry.key, label: entry.label, value: entry.count, share: entry.share, color: entry.color, ...(entry.key === OTHER_KEY ? { note: 'Reúne três grupos menores' } : {}) }))}
    ariaLabel={`Composição dos ${total.toLocaleString('pt-BR')} resultados por função. Clique em um segmento para filtrar por esse grupo.`} tableCaption="Resultados da busca por grupo funcional" valueHeader="Resultados" />;
}
