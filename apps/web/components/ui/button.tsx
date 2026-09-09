import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva('inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-border bg-background hover:bg-muted', ghost: 'hover:bg-muted' }, size: { default: 'h-10 px-5', sm: 'h-8 px-3 text-xs', icon: 'size-10 p-0' } }, defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) { return <button data-slot="button" className={cn(variants({ variant, size }), className)} {...props} />; }
export { variants as buttonVariants };
