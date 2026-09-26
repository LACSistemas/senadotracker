import Link from 'next/link';
import type { ReactNode } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { houseOf } from '@/lib/house';
import { HouseBadge } from './house-badge';

/**
 * Card de reunião consistente para os três contextos (índice, detalhe, agenda). `date`/`time` ficam de
 * fora quando o chamador já mostra o horário em outra coluna (linha do tempo da agenda). `compact`
 * reduz o título para uso em listagens densas; `highlight` marca a "próxima reunião" como destaque.
 */
export function MeetingCard({
  title,
  titleHref,
  subtitle,
  date,
  time,
  house,
  location,
  itemCount,
  highlight,
  compact,
  children,
  className,
}: {
  title: ReactNode;
  titleHref?: string | undefined;
  subtitle?: ReactNode;
  date?: string | null;
  time?: string | null;
  house?: string;
  location?: string | null;
  itemCount?: number;
  highlight?: boolean | undefined;
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const accent = house ? houseOf(house).text : 'text-primary';
  const hasHeader = date !== undefined || time !== undefined || Boolean(house);
  const heading = titleHref
    ? <Link href={titleHref} className="focus-ring rounded-sm font-bold leading-snug hover:text-primary">{title}</Link>
    : <span className="font-bold leading-snug">{title}</span>;
  return (
    <article className={cn('card-elevated rounded-2xl border bg-card p-5', highlight && 'border-primary/40 bg-secondary/20', className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {date && <span className={cn('text-sm font-bold', accent)}>{date}</span>}
          {time !== undefined && (
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-bold tabular-nums', accent)}>
              <Clock size={14} aria-hidden="true" />
              {time ?? 'Horário não informado'}
            </span>
          )}
          {house && <HouseBadge house={house} className="ml-auto" />}
        </div>
      )}
      <div className={hasHeader ? 'mt-2' : ''}>
        {compact ? <p className="line-clamp-2 text-sm">{heading}</p> : <h3 className="text-lg font-bold sm:text-xl">{heading}</h3>}
      </div>
      {subtitle && <p className="mt-1 text-sm font-semibold text-foreground">{subtitle}</p>}
      {location && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin size={13} className="shrink-0" aria-hidden="true" />
          {location}
        </p>
      )}
      {itemCount !== undefined && <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{itemCount} {itemCount === 1 ? 'item' : 'itens'} em pauta</p>}
      {children}
    </article>
  );
}
