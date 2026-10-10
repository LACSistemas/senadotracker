import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStateLegislatorActivity } from '@/lib/state-product';
import { getCachedStateProfile } from '@/lib/state-profile-cache';
import { getStateHouseStory } from '@/lib/state-house-story';
import { StateProfileStory } from '@/components/state-profile-story';
import { DomainCoverageGrid, StateProfileHeader, stateHouseName } from '@/components/state-profile-ui';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ house: string; id: string }> }): Promise<Metadata> {
  const { house, id } = await params; const profile = await getCachedStateProfile(house, id).catch(() => null);
  const district = profile?.identity.house === 'DF'; const role = district ? 'Deputado distrital' : 'Deputado estadual'; return { title: profile ? `${profile.identity.name} · ${role} · Cívica` : `${role} · Cívica`, description: profile ? `Perfil público de ${profile.identity.name}, ${role.toLocaleLowerCase('pt-BR')} de ${stateHouseName(profile.identity.house)}.` : `Perfil público de ${role.toLocaleLowerCase('pt-BR')}.` };
}

export default async function StateDeputyProfile({ params }: { params: Promise<{ house: string; id: string }> }) {
  const { house, id } = await params; const profile = await getCachedStateProfile(house, id); if (!profile) notFound();
  const [activity, story] = await Promise.all([getStateLegislatorActivity(house, id, 2026).catch(() => null), getStateHouseStory(profile.identity.house)]);
  const district = profile.identity.house === 'DF';
  return <><StateProfileHeader profile={profile} active="overview" /><main id="conteudo" className="page-shell space-y-12 py-10">
    <section><p className="eyebrow">Visão geral</p><h2 className="display-title mt-2 text-3xl sm:text-5xl">Um mandato acompanhado por fonte</h2><p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">Este perfil reúne produção legislativa, gastos publicados e emendas estaduais quando a Assembleia publica a dimensão, sempre em comparação com os colegas da mesma Casa. O que a Casa não publica fica explícito e não é apresentado como zero.</p></section>
    <StateProfileStory id={profile.identity.id} party={profile.identity.party} houseLabel={district ? 'deputados distritais' : 'deputados estaduais'} story={story} extra={{ amendments: activity?.budget.amendments.length ?? null, timelineEvents: activity?.timeline.eventCount ?? null }} />
    <DomainCoverageGrid profile={profile} />
  </main></>;
}
