import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  try {
    const hits = await searchAll(q);
    return NextResponse.json({ hits }, { headers: { 'cache-control': 'private, max-age=30' } });
  } catch {
    return NextResponse.json({ hits: [], error: 'busca_indisponivel' }, { status: 503 });
  }
}
