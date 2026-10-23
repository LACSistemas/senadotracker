import { NextResponse } from 'next/server';
import { listSecurityContracts } from '@/lib/security/load';
import { webPostgresPool } from '@/lib/postgres-pool';
export const dynamic = 'force-dynamic';
/** Contratos do PNCP ligados a segurança para o ente (só pessoa jurídica; valor contratado, não pago). Paginado. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams; const entity = Number(sp.get('entity')); const year = sp.get('year') ? Number(sp.get('year')) : undefined; const offset = Number(sp.get('offset') ?? 0); const limit = Math.min(Number(sp.get('limit') ?? 15), 50);
  if (!Number.isInteger(entity) || entity <= 0) return NextResponse.json({ error: 'entidade inválida' }, { status: 400 });
  return NextResponse.json(await listSecurityContracts(webPostgresPool(), { entityId: entity, ...(year ? { year } : {}), limit, offset }), { headers: { 'Cache-Control': 'private, max-age=300' } });
}
