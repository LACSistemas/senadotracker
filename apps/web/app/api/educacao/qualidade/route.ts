import { NextResponse } from 'next/server';
import { latestQualityYear, searchQuality } from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { scopeFromEntity } from '@/lib/security/load';
import { keyFor } from '@/lib/education/load';

export const dynamic = 'force-dynamic';

/** Busca paginada de cursos com Conceito Enade no território: carrega sob demanda. Nunca ordena por nota (não é ranking). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const entity = Number(sp.get('entity'));
  const text = sp.get('q')?.trim() || undefined;
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') ?? '20')));
  const scope = await scopeFromEntity(entity);
  if (!scope) return NextResponse.json({ error: 'território não encontrado' }, { status: 404 });
  const pool = webPostgresPool();
  const year = (await latestQualityYear(pool, 'ENADE')) ?? undefined;
  const ibge7 = scope.kind === 'municipio' ? (await keyFor(scope)).ibge7 : undefined;
  const territory = scope.kind === 'uf' ? { uf: scope.uf } : ibge7 ? { ibge7 } : {};
  const result = await searchQuality(pool, { ...territory, indicator: 'ENADE', ...(year ? { year } : {}), ...(text ? { text } : {}), page, pageSize }).catch(() => null);
  if (!result) return NextResponse.json({ error: 'busca falhou' }, { status: 500 });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
