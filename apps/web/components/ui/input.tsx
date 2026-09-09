import * as React from 'react';
import { cn } from '@/lib/utils';
export function Input({ className, type = 'text', ...props }: React.InputHTMLAttributes<HTMLInputElement>) { return <input data-slot="input" type={type} className={cn('h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />; }
