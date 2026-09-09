import { ParliamentaryHousePage } from '@/components/parliamentary-house-page';
export const dynamic='force-dynamic';export const metadata={title:'Senadores'};
export default async function SenatorsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <ParliamentaryHousePage source="senado" searchParams={await searchParams}/>}
