import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Um número com palco: valor grande em serif tabular, rótulo discreto, ícone opcional em chip —
 * mesmo padrão de destaque do `HighlightCard`. Sem coverage/comparação: comissões não têm essa semântica.
 */
export function StatTile({ icon: Icon, iconClassName, value, valueClassName, label, action, className }: {
  icon?: ComponentType<{ size?: number }>;
  iconClassName?: string;
  value: ReactNode;
  valueClassName?: string;
  label: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card-elevated flex flex-col rounded-2xl border bg-card p-5', className)}>
      {Icon && (
        <span className={cn('grid size-9 place-items-center rounded-xl bg-secondary text-primary', iconClassName)}>
          <Icon size={17} aria-hidden="true" />
        </span>
      )}
      <strong className={cn('display-title mt-4 text-4xl leading-none tabular-nums', valueClassName)}>{value}</strong>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
