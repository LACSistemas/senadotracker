import type { Metadata } from 'next';
import { ParliamentarianProfilePage } from '@/components/parliamentarian-profile-page';
import { profileMetadata } from '@/lib/profile-metadata';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return profileMetadata('camara',id,`/legislativo/deputados/${id}/gastos-equipe`)}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ParliamentarianProfilePage source="camara" id={id} section="costs"/>}
