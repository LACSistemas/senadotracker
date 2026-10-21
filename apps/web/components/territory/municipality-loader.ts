import { notFound } from 'next/navigation';
import { loadBenchmarks, loadCoverage, loadFacilities, loadIndicators, loadMunicipality, loadPanelValues, loadVaccinePanel } from '@/lib/exec-territory';

/** Carrega o município e, se pedido, o pacote de saúde. Código inválido ou inexistente resulta em 404. */
export async function loadMunicipalityPage(code: string, withHealth: boolean) {
  const m = await loadMunicipality(code);
  if (!m) notFound();
  const ufCode = m.ufCode!;
  const [indicators, coverage, values, vaccines, bench] = await Promise.all([loadIndicators(m.entityId), loadCoverage(ufCode), loadPanelValues(m.entityId), loadVaccinePanel(m.entityId), loadBenchmarks()]);
  if (!withHealth) return { m, indicators, coverage, values, vaccines, bench };
  const facilities = await loadFacilities({ municipalityId: m.entityId });
  return { m, indicators, coverage, values, vaccines, bench, facilities };
}
