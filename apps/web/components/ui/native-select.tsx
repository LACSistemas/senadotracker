import * as React from 'react';
import { cn } from '@/lib/utils';
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select data-slot="native-select" className={cn('h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />; }
