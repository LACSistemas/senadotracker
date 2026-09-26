import { cn } from '@/lib/utils';
import { houseOf } from '@/lib/house';

/**
 * Pill com ícone + rótulo da Casa. `variant="inverted"` é a versão "de papel" para uso sobre fundos
 * escuros (herói verde); o texto some para branco e só o ícone carrega a cor de acento da Casa.
 */
export function HouseBadge({ house, variant = 'default', className }: { house: string; variant?: 'default' | 'inverted'; className?: string }) {
  const info = houseOf(house);
  const Icon = info.icon;
  if (variant === 'inverted') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white', className)}>
        <Icon size={13} className="text-white" aria-hidden="true" />
        {info.short}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-foreground/80', info.soft, className)}>
      <Icon size={12} className={info.text} aria-hidden="true" />
      {info.short}
    </span>
  );
}
