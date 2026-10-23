import { NextResponse } from 'next/server';
import { loadExplorerIndex } from '@/lib/security/load';
export const dynamic = 'force-dynamic';
/** Índice do modo "Explorar os dados": todos os indicadores de Segurança com valor para o território (uma consulta indexada). */
export async function GET(request: Request) {
  const entity = Number(new URL(request.url).searchParams.get('entity')); if (!Number.isInteger(entity) || entity <= 0) return NextResponse.json({ error: 'entidade inválida' }, { status: 400 });
  return NextResponse.json(await loadExplorerIndex(entity), { headers: { 'Cache-Control': 'private, max-age=300' } });
}
