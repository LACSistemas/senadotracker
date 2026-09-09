import { ParliamentaryHousePage } from '@/components/parliamentary-house-page';
export const dynamic='force-dynamic';export const metadata={title:'Deputados federais'};
export default async function DeputiesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <ParliamentaryHousePage source="camara" searchParams={await searchParams}/>}
