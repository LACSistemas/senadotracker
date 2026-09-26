import type { ComponentType, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Bloco padronizado para estados de cobertura/vazio: dá forma sem alarmar. */
export function CoverageNote({ icon: Icon = Info, children, className }: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground', className)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="leading-6">{children}</p>
    </div>
  );
}
