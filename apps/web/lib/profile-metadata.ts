import type { Metadata } from 'next';
import type { Source } from '@senadotracker/domain';
import { profileIdentity } from '@/lib/data';

export async function profileMetadata(source: Source, id: string, canonical: string): Promise<Metadata> {
  if (!/^\d+$/.test(id)) return { title: 'Perfil não encontrado' };
  const result = await profileIdentity(source, id);
  if (result.status !== 'available' || !result.data) return { title: 'Perfil não encontrado' };
  const person = result.data as any;
  return {
    title: person.name,
    description: `Perfil de ${person.name}, ${person.party ?? ''}/${person.uf ?? ''}, com dados oficiais do ${source === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados'}.`,
    alternates: { canonical },
  };
}
