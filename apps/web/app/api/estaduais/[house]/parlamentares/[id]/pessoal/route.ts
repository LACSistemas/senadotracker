import { NextResponse } from 'next/server';
import { getStateLegislatorPersonnel } from '@/lib/state-product';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: Promise<{ house: string; id: string }> }) { const { house, id } = await params; try { return NextResponse.json(await getStateLegislatorPersonnel(house, id), { headers: { 'cache-control': 'no-store' } }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'state personnel query failed' }, { status: 503 }); } }
