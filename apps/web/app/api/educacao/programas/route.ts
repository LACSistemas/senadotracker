import { NextResponse } from 'next/server';
import { latestCapesYear, searchGraduatePrograms } from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { scopeFromEntity } from '@/lib/security/load';

export const dynamic = 'force-dynamic';

/** Busca paginada de programas de pós-graduação CAPES no território: carrega sob demanda. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const entity = Number(sp.get('entity'));
  const text = sp.get('q')?.trim() || undefined;
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') ?? '20')));
  const scope = await scopeFromEntity(entity);
  if (!scope) return NextResponse.json({ error: 'território não encontrado' }, { status: 404 });
  const pool = webPostgresPool();
  const year = (await latestCapesYear(pool)) ?? undefined;
  const result = await searchGraduatePrograms(pool, { uf: scope.uf, ...(scope.kind === 'municipio' ? { municipalityName: scope.name } : {}), ...(year ? { year } : {}), ...(text ? { text } : {}), page, pageSize }).catch(() => null);
  if (!result) return NextResponse.json({ error: 'busca falhou' }, { status: 500 });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
