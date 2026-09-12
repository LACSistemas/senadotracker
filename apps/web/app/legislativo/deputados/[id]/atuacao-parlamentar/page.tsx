import type { Metadata } from 'next';
import { ParliamentarianProfilePage } from '@/components/parliamentarian-profile-page';
import { profileMetadata } from '@/lib/profile-metadata';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return profileMetadata('camara',id,`/legislativo/deputados/${id}/atuacao-parlamentar`)}
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{paginaVotos?:string}>}){const {id}=await params;const query=await searchParams;const raw=Number(query.paginaVotos??1);const votePage=Number.isSafeInteger(raw)&&raw>0?raw:1;return <ParliamentarianProfilePage source="camara" id={id} section="activity" votePage={votePage}/>}
