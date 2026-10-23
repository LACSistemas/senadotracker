import type { Metadata } from 'next';
import type { Source } from '@senadotracker/domain';
import { profileIdentity } from '@/lib/data';

export async function profileMetadata(source: Source, id: string, canonical: string): Promise<Metadata> {
  if (!/^\d+$/.test(id)) return { title: 'Perfil não encontrado' };
  const result = await profileIdentity(source, id);
  if (result.status !== 'available' || !result.data) return { title: 'Perfil não encontrado' };
  const person = result.data as any;
  const role = source === 'senado' ? 'Senador' : 'Deputado federal';
  const house = source === 'senado' ? 'do Senado Federal' : 'da Câmara dos Deputados';
  const where = [person.party, person.uf].filter(Boolean).join(' · ');
  const description = `${role}${where ? ` (${where})` : ''}: quanto custa, se trabalha e como votou, com dados oficiais ${house}.`;
  const photo = typeof person.photoUrl === 'string' && /^https:\/\//.test(person.photoUrl) ? [{ url: person.photoUrl, alt: `Foto oficial de ${person.name}` }] : undefined;
  return {
    title: person.name,
    description,
    alternates: { canonical },
    openGraph: { type: 'profile', title: `${person.name} · Cívica`, description, ...(photo ? { images: photo } : {}) },
    twitter: { card: photo ? 'summary_large_image' : 'summary', title: `${person.name} · Cívica`, description },
  };
}
