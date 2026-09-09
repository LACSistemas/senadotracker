import { notFound,permanentRedirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function LegacyProfile({params}:{params:Promise<{source:string;id:string}>}){const {source,id}=await params;if((source!=='senado'&&source!=='camara')||!/^\d+$/.test(id))notFound();permanentRedirect(`/legislativo/${source==='senado'?'senadores':'deputados'}/${id}`)}
