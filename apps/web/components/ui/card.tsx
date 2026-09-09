import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="card" className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-[0_1px_0_rgba(20,35,30,.03)]', className)} {...props} />; }
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="card-header" className={cn('p-6', className)} {...props} />; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="card-content" className={cn('px-6 pb-6', className)} {...props} />; }
