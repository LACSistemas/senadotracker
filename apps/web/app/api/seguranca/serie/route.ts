import { NextResponse } from 'next/server';
import { loadExplorerSeries } from '@/lib/security/load';
export const dynamic = 'force-dynamic';
/** Série bruta de um indicador (valor, numerador, denominador, flags) para o modo "Explorar os dados" e para exportação. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams; const entity = Number(sp.get('entity')), ind = Number(sp.get('ind'));
  if (!Number.isInteger(entity) || !Number.isInteger(ind) || ind < 3001 || ind > 9999) return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  const s = await loadExplorerSeries(entity, ind); if (!s) return NextResponse.json({ error: 'indicador não encontrado' }, { status: 404 });
  return NextResponse.json(s, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
