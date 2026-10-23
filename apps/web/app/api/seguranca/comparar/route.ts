import { NextResponse } from 'next/server';
import { compareCandidates, compareMunicipalities } from '@/lib/security/load';
export const dynamic = 'force-dynamic';
/** Série de taxa do OUTRO município na mesma opção, só quando os dois são comparáveis (mesma UF, fonte e indicador; população ≥ 20 mil). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams; const entity = Number(sp.get('entity')), other = Number(sp.get('other')); const opt = sp.get('opt') ?? '';
  if (!sp.get('other')) return NextResponse.json({ candidates: await compareCandidates(entity) }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  const r = await compareMunicipalities(entity, other, opt).catch(() => ({ ok: false as const, reason: 'comparação indisponível' }));
  return NextResponse.json(r, { status: r.ok ? 200 : 422, headers: { 'Cache-Control': 'private, max-age=300' } });
}
