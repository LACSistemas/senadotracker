import StateHousePage from '@/components/state-house-page';
export const dynamic = 'force-dynamic';
export default async function StateDeputiesIndex({ params, searchParams }: { params: Promise<{ house: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) { const { house } = await params; return <StateHousePage house={house} searchParams={await searchParams} />; }
