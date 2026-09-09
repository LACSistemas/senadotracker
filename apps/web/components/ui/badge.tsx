import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) { return <span data-slot="badge" className={cn('inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground', className)} {...props} />; }
