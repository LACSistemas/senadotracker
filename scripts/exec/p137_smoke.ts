import { openPool } from './db.ts';
import { getInfrastructureOverview, getInfrastructureWorksList, getInfrastructureWorkDetail, getInfrastructureWorksBySituation, getInfrastructureIndicators, getInfrastructureUrbanConditions, getInfrastructureHousing, getInfrastructureWaterSecurity, getInfrastructureEnergy, getInfrastructureLogistics } from '../../packages/db/src/exec/index.ts';

const pool = openPool(2);
async function run(name: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`OK  ${name} (${Date.now() - t0}ms)`, JSON.stringify(r).slice(0, 300));
  } catch (e) {
    console.log(`ERR ${name}:`, e instanceof Error ? e.message : e);
  }
}

try {
  await run('overview_brasil', () => getInfrastructureOverview(pool, { level: 'BRASIL' }));
  await run('overview_es_uf', () => getInfrastructureOverview(pool, { level: 'UF', ufCode: 32 }));
  await run('overview_vitoria', () => getInfrastructureOverview(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
  await run('overview_sao_paulo', () => getInfrastructureOverview(pool, { level: 'MUNICIPIO', ibge7: '3550308' }));
  await run('overview_municipio_pequeno', () => getInfrastructureOverview(pool, { level: 'MUNICIPIO', ibge7: '3200706' })); // Alto Rio Novo/ES
  await run('urban_conditions_vitoria', () => getInfrastructureUrbanConditions(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
  await run('housing_vitoria', () => getInfrastructureHousing(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
  await run('water_security_vitoria', () => getInfrastructureWaterSecurity(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
  await run('energy_vitoria', () => getInfrastructureEnergy(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
  await run('logistics_es', () => getInfrastructureLogistics(pool, { level: 'UF', ufCode: 32 }));
  await run('indicators_sinisa_vitoria', () => getInfrastructureIndicators(pool, { level: 'MUNICIPIO', ibge7: '3205309' }, { family: 'SINISA' }));
  await run('indicators_pemob_es', () => getInfrastructureIndicators(pool, { level: 'UF', ufCode: 32 }, { family: 'PEMOB' }));

  // obras: filtros novos
  await run('works_list_status', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, status: 3 }));
  await run('works_list_category', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, category: 12 }));
  await run('works_list_agency', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, agency: 'SAUDE' }));
  await run('works_list_has_physical', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, hasPhysicalMeasurement: true }));
  await run('works_list_has_contracts', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, hasContracts: true }));
  await run('works_list_has_payment', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, hasPayment: true }));
  await run('works_list_multi', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, territorialScope: 'MULTI' }));
  await run('works_list_single', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, territorialScope: 'SINGLE' }));
  await run('works_list_period', () => getInfrastructureWorksList(pool, { level: 'BRASIL' }, { page: 1, pageSize: 5, periodFrom: '2020-01-01', periodTo: '2022-12-31' }));
  await run('works_list_es_uf', () => getInfrastructureWorksList(pool, { level: 'UF', ufCode: 32 }, { page: 1, pageSize: 5 }));
  await run('works_list_vitoria', () => getInfrastructureWorksList(pool, { level: 'MUNICIPIO', ibge7: '3205309' }, { page: 1, pageSize: 5 }));

  // detalhe de obra enriquecido (labels)
  await run('work_detail_contracts', () => getInfrastructureWorkDetail(pool, 89442));
  await run('work_detail_multiterritory', () => getInfrastructureWorkDetail(pool, 1963));
  await run('works_by_situation_vitoria', () => getInfrastructureWorksBySituation(pool, { level: 'MUNICIPIO', ibge7: '3205309' }));
} finally {
  await pool.end();
}
