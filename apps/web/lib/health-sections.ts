import { cache } from 'react';
import { getEvolutionSeries, getHospitalShare, getResidentSummary, readBenchSeries } from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { EVOLUTION_TABS, buildEvolutionTab, buildHospitalStory, buildResidentStory, type EvoTab, type HospitalStory, type ResidentStory } from '@/lib/health-story';

const pool = () => webPostgresPool();
const benchSeries = cache(() => readBenchSeries(pool()));

export interface HealthSections { tabs: EvoTab[]; residents: ResidentStory | null; hospitals: { story: HospitalStory; from: number; to: number } | null }
/** Tudo que as seções "Evolução", "Moradores" e "Quem atende" precisam, em 4 leituras paralelas e fixas (série do território, comparativos prontos, residentes, hospitais). */
export async function loadHealthSections(o: { entityId: number; ufCode: number; ufName: string; scope: string; kind: 'uf' | 'municipio' }): Promise<HealthSections> {
  const [series, bench, summary, share] = await Promise.all([
    getEvolutionSeries(pool(), o.entityId), benchSeries(),
    getResidentSummary(pool(), o.kind === 'uf' ? { entityId: o.entityId, ufCode: o.ufCode } : { entityId: o.entityId }),
    getHospitalShare(pool(), o.kind === 'uf' ? { ufCode: o.ufCode } : { municipalityId: o.entityId }),
  ]);
  const tabs = EVOLUTION_TABS.map(spec => buildEvolutionTab({ spec, series, scope: o.scope, kind: o.kind, ufName: o.ufName, ufCode: o.ufCode, bench })).filter(t => t.points.some(p => p.v !== null));
  const residents = buildResidentStory({ summary, scope: o.scope, kind: o.kind, ufName: o.ufName, ufCode: o.ufCode, bench });
  const story = buildHospitalStory({ hs: share, scope: o.scope, kind: o.kind });
  return { tabs, residents, hospitals: story ? { story, from: share.from, to: share.to } : null };
}
