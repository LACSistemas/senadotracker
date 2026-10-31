import { notFound } from 'next/navigation';
import { WorkDetail } from '@/components/infrastructure/work-detail';
import { scopeOf } from '@/lib/infrastructure/load';
import { loadWorkDetail } from '@/lib/infrastructure/works';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ projectId: string }>; searchParams: Promise<{ from?: string; commPage?: string }> };

/** Rota global (não aninhada em território): uma obra pode ser multimunicipal, então não pertence a um único
 * estado ou município. A listagem por território linka para aqui preservando o contexto de origem em `?from=`. */
async function resolveBack(from: string | undefined): Promise<{ href: string; label: string } | null> {
  if (!from) return null;
  const [kind, code] = from.split(':');
  if (kind === 'uf' && code) { const s = await scopeOf('uf', code); return s ? { href: `/estados/${s.uf}/infraestrutura/obras`, label: `Infraestrutura em ${s.name}` } : null; }
  if (kind === 'municipio' && code) { const s = await scopeOf('municipio', code); return s ? { href: `/municipios/${s.entityId}/infraestrutura/obras`, label: `Infraestrutura em ${s.name}` } : null; }
  return null;
}

export async function generateMetadata({ params }: Props) {
  const { projectId } = await params; const id = Number(projectId);
  if (!Number.isInteger(id)) return { title: 'Obra pública · Cívica' };
  const work = await loadWorkDetail(id);
  return { title: work ? `${work.header.name} · Obra pública · Cívica` : 'Obra pública · Cívica' };
}

export default async function ObraDetailPage({ params, searchParams }: Props) {
  const { projectId } = await params; const sp = await searchParams;
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const commPage = Math.max(1, Number(sp.commPage ?? '1') || 1);
  const [work, back] = await Promise.all([loadWorkDetail(id, commPage), resolveBack(sp.from)]);
  if (!work) notFound();
  return (
    <main className="page-shell py-6 sm:py-10">
      <WorkDetail work={work} backHref={back?.href ?? null} backLabel={back?.label ?? 'Infraestrutura'} />
    </main>
  );
}
