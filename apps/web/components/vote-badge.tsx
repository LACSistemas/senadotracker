import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { voteClass, voteDescription } from '@/lib/vote-semantics';
export { voteColor } from '@/lib/vote-semantics';
export function VoteBadge({value,className,title}:{value:string;className?:string;title?:string}){return <Badge title={title??`${voteDescription(value)} · valor literal: ${value}`} className={cn(voteClass(value),className)}>{value}</Badge>}
