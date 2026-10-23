import { NextResponse } from 'next/server';
import { loadCrimeOption, scopeFromEntity } from '@/lib/security/load';
export const dynamic = 'force-dynamic';
/** Séries completas (quantidade, taxa, mensal) de UMA opção do capítulo de criminalidade: a primeira carga só leva a opção inicial. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams; const entity = Number(sp.get('entity')); const opt = sp.get('opt') ?? '';
  const scope = await scopeFromEntity(entity); if (!scope) return NextResponse.json({ error: 'território não encontrado' }, { status: 404 });
  const option = await loadCrimeOption(scope, opt).catch(() => null);
  if (!option) return NextResponse.json({ error: 'opção não encontrada' }, { status: 404 });
  return NextResponse.json(option, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
