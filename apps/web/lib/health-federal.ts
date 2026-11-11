import { getHealthBedsByUf, getNationalFacilityTypes, getNationalHealthSummary } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';
import { loadStates } from './exec-territory.ts';

export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface StatItem { label: string; value: string; unit?: string; note?: string | null }

export interface HealthFederalPageData {
  competence: number | null;
  stats: StatItem[];
  facilityTypes: BarRow[];
  bedTypes: BarRow[];
  distribution: Array<{ uf: string; name: string; value: number }>;
}

const fmt = new Intl.NumberFormat('pt-BR');

/** Saúde, nível Brasil (P14.14): CNES é registro censitário — somar é uma leitura válida (já documentado
 * em `getNationalHealthSummary`, usada em `/executivo`). Mais raso que os outros 4 temas porque esta base
 * não tem, hoje, leituras nacionais de evolução temporal/internações/vacinação (essas são por UF ou
 * município); o que existe de genuinamente nacional é o panorama atual e a distribuição real entre os 27
 * estados — mostrado como distribuição, nunca como ranking de qualidade (mais leitos ≠ melhor atendimento). */
async function loadHealthFederal(): Promise<HealthFederalPageData> {
  const pool = webPostgresPool();
  const [summary, types, bedsByUf, states] = await Promise.all([getNationalHealthSummary(pool), getNationalFacilityTypes(pool), getHealthBedsByUf(pool), loadStates()]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const stats: StatItem[] = [
    { label: 'Estabelecimentos no cadastro', value: fmt.format(summary.totalFacilities) },
    { label: 'Hospitais', value: fmt.format(summary.hospitals) },
    { label: 'Leitos existentes', value: fmt.format(summary.bedsExisting) },
    { label: 'Leitos SUS', value: fmt.format(summary.bedsSus) },
    totalPop > 0 ? { label: 'Leitos por mil habitantes', value: (summary.bedsExisting / totalPop * 1000).toFixed(2) } : null,
  ].filter((x): x is StatItem => x != null);

  const facilityTypes: BarRow[] = types.byType.filter(t => t.n > 0).slice(0, 10).map(t => ({ label: t.label, value: t.n, display: fmt.format(t.n) }));
  const bedTypes: BarRow[] = types.bedsByType.filter(t => t.existing > 0).sort((a, b) => b.existing - a.existing).map(t => ({ label: t.label, value: t.existing, display: fmt.format(t.existing), note: `${fmt.format(t.sus)} SUS` }));

  const stateByUfCode = new Map(states.map(s => [s.ufCode, s]));
  const distribution = bedsByUf.map(b => { const s = stateByUfCode.get(b.ufCode); const pop = s?.population ?? 0; return s && pop > 0 ? { uf: s.uf, name: s.name, value: Math.round((b.bedsExisting / pop) * 1000 * 100) / 100 } : null; }).filter((x): x is { uf: string; name: string; value: number } => x != null).sort((a, b) => b.value - a.value);

  return { competence: summary.competence, stats, facilityTypes, bedTypes, distribution };
}

export const loadHealthFederalPageCached = (): Promise<HealthFederalPageData> => memo('health:federal', loadHealthFederal, 60_000);
