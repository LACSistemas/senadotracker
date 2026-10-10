import { NextResponse } from 'next/server';
import { getStateLegislatorProfile } from '@/lib/state-product';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: Promise<{ house: string; id: string }> }) { const { house, id } = await params; try { const result = await getStateLegislatorProfile(house, id); if (!result) return NextResponse.json({ error: 'state parliamentarian not found' }, { status: 404 }); return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'state profile query failed' }, { status: 503 }); } }
