import { NextResponse } from 'next/server';
import { loadOptionBench } from '@/lib/security/load';
export const dynamic = 'force-dynamic';
/** Benchmark sob demanda para a opção escolhida: mesmo contrato do herói (fonte, indicador, unidade, ano e cobertura iguais). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams; const entity = Number(sp.get('entity')); const opt = sp.get('opt') ?? '';
  const bench = await loadOptionBench(entity, opt).catch(() => null);
  if (!bench) return NextResponse.json({ error: 'benchmark indisponível para esta opção' }, { status: 404 });
  return NextResponse.json(bench, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
