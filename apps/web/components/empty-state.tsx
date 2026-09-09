import { DatabaseZap } from 'lucide-react';
import { Card,CardContent } from '@/components/ui/card';
export function EmptyState({title,description}:{title:string;description:string}){return <Card><CardContent className="grid min-h-56 place-items-center py-12 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-primary"><DatabaseZap aria-hidden="true"/></span><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div></CardContent></Card>}
