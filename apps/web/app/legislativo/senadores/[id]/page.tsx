import type { Metadata } from 'next';import { ParliamentarianProfilePage } from '@/components/parliamentarian-profile-page';import { profileMetadata } from '@/lib/profile-metadata';
export const dynamic='force-dynamic';export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return profileMetadata('senado',id,`/legislativo/senadores/${id}`)}
export default async function SenatorProfile({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ParliamentarianProfilePage source="senado" id={id}/>}
