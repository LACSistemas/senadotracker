import NationalLegislatorExplorer from '@/components/national-legislator-explorer';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parlamentares do Brasil · Cívica', description: 'Explore parlamentares federais, estaduais e distritais.' };
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <NationalLegislatorExplorer searchParams={searchParams} />; }
