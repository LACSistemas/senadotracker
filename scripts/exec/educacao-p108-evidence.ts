import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EDUCATION_FAMILY_COUNTS, EDUCATION_INDICATORS, getEducationAnalyticalRelations, getEducationMunicipalityBenchmarks, getEducationMunicipalityProfile, getEducationNationalProfile, getEducationSchoolProfile, getEducationStateProfile } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

const root = resolve(process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p108-execucao');
const csv = (rows: Array<Record<string, unknown>>) => {
  const cols = Object.keys(rows[0] ?? {}); const esc = (v: unknown) => `"${(Array.isArray(v) ? v.join('|') : v ?? '').toString().replaceAll('"', '""')}"`;
  return [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
};
const pool = openPool(8);
try {
  await mkdir(resolve(root, 'evidencias'), { recursive: true }); await mkdir(resolve(root, 'reproducibilidade'), { recursive: true });
  await writeFile(resolve(root, 'CATALOGO_UNIFICADO_INDICADORES.csv'), csv(EDUCATION_INDICATORS.map(x => ({ ...x, granularities: x.granularities.join('|') }))));
  const grains = ['ESCOLA', 'MUNICIPIO', 'UF', 'BRASIL'] as const;
  const matrix = EDUCATION_INDICATORS.flatMap(x => grains.map(grain => {
    const status = !x.granularities.includes(grain) ? (x.id.includes('saeb_') && grain === 'ESCOLA' ? 'NOT_PUBLISHED_BY_SOURCE' : 'NOT_APPLICABLE')
      : ['PROGRAMAS_TRANSFERENCIAS', 'CONTRATACOES', 'OBRAS'].includes(x.family) ? 'PARTIAL' : 'AVAILABLE';
    return { indicator_id: x.id, family: x.family, grain, coverage: status, editions: x.editions, comparability: x.comparability, publication: x.publication, limitation: x.limitation };
  }));
  await writeFile(resolve(root, 'MATRIZ_COBERTURA_COMPARABILIDADE.csv'), csv(matrix));
  const municipalities = ['3205309', '3205002', '3200359', '3550308', '3304557', '3106200', '2611606', '4314902'];
  const states = [32, 35, 33, 31, 26, 14, 53];
  const [national, municipalityProfiles, stateProfiles, schoolIds] = await Promise.all([
    getEducationNationalProfile(pool), Promise.all(municipalities.map(x => getEducationMunicipalityProfile(pool, x))), Promise.all(states.map(x => getEducationStateProfile(pool, x))),
    pool.query(`(SELECT 'complete' kind,y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year=2025
      AND (SELECT count(*) FROM civica_exec.exec_edu_school_year h WHERE h.inep=y.inep) >= 10
      AND EXISTS(SELECT 1 FROM civica_exec.exec_edu_offer_year o WHERE o.inep=y.inep AND o.year=2025)
      AND EXISTS(SELECT 1 FROM civica_exec.exec_edu_infra_year f WHERE f.inep=y.inep AND f.year=2025)
      AND EXISTS(SELECT 1 FROM civica_exec.exec_edu_ind_school d WHERE d.inep=y.inep AND d.year=2025)
      AND EXISTS(SELECT 1 FROM civica_exec.exec_edu_ideb_school i WHERE i.inep=y.inep) ORDER BY y.inep LIMIT 1)
      UNION ALL (SELECT 'without_ideb',y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year=2025 AND NOT EXISTS(SELECT 1 FROM civica_exec.exec_edu_ideb_school i WHERE i.inep=y.inep) ORDER BY y.inep LIMIT 1)
      UNION ALL (SELECT 'without_resources',y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year=2025 AND NOT EXISTS(SELECT 1 FROM civica_exec.exec_edu_program_fact p WHERE p.school_inep=y.inep) ORDER BY y.inep LIMIT 1)`),
  ]);
  const schoolProfiles = Object.fromEntries(await Promise.all(schoolIds.rows.map(async x => [String(x.kind), await getEducationSchoolProfile(pool, Number(x.inep))] as const)));
  const [benchmark, relations] = await Promise.all([getEducationMunicipalityBenchmarks(pool, '3205309'), getEducationAnalyticalRelations(pool, '3205309')]);
  const coverageCounts = await pool.query(`WITH municipalities AS (
      SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4
    ), family_presence AS (
      SELECT m.entity_id,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_school_year y WHERE y.entity_id=m.entity_id AND y.year=2025) schools,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) WHERE y.entity_id=m.entity_id AND o.year=2025) offer,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_infra_year i JOIN civica_exec.exec_edu_school_year y USING(inep,year) WHERE y.entity_id=m.entity_id AND i.year=2025) infrastructure,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_ind_terr t WHERE t.entity_id=m.entity_id AND t.year=2025) indicators,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_doc_terr t WHERE t.entity_id=m.entity_id AND t.year=2025) teachers,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_ideb_terr t WHERE t.entity_id=m.entity_id AND t.year=2025) ideb,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_saeb_terr t WHERE t.entity_id=m.entity_id AND t.year=2025) saeb,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_flow_terr t WHERE t.entity_id=m.entity_id AND t.year=2025) flow,
        EXISTS(SELECT 1 FROM civica_exec.exec_fin_fact f WHERE f.entity_id=m.entity_id AND f.exercicio=2025) siconfi,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_siope_fact f WHERE f.entity_id=m.entity_id AND f.exercicio=2025) siope,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_program_fact f WHERE f.entity_id=m.entity_id AND f.year=2025) programs,
        EXISTS(SELECT 1 FROM civica_exec.exec_edu_contract c WHERE c.entity_id=m.entity_id AND c.best_confidence<=2) contracts
      FROM municipalities m
    ) SELECT
    (SELECT count(*) FROM civica_exec.exec_entity WHERE kind=4) municipalities,
    (SELECT count(*) FROM civica_exec.exec_edu_school_year WHERE year=2025) school_records_2025,
    count(*) FILTER (WHERE schools) school_municipalities_2025,
    count(*) FILTER (WHERE offer) offer_municipalities_2025,
    count(*) FILTER (WHERE infrastructure) infrastructure_municipalities_2025,
    count(*) FILTER (WHERE indicators) indicators_municipalities_2025,
    count(*) FILTER (WHERE teachers) teachers_municipalities_2025,
    count(*) FILTER (WHERE ideb) ideb_municipalities_2025,
    count(*) FILTER (WHERE saeb) saeb_municipalities_2025,
    count(*) FILTER (WHERE flow) flow_municipalities_2025,
    count(*) FILTER (WHERE siconfi) siconfi_municipalities_2025,
    count(*) FILTER (WHERE siope) siope_municipalities_2025,
    count(*) FILTER (WHERE programs) programs_municipalities_2025,
    count(*) FILTER (WHERE contracts) contracts_municipalities_any,
    count(*) FILTER (WHERE schools AND offer AND infrastructure AND indicators AND teachers AND ideb AND saeb AND flow) core_education_complete_2025,
    count(*) FILTER (WHERE siconfi AND siope) finance_both_sources_2025
    FROM family_presence`);
  const result = { generatedAt: new Date().toISOString(), familyCounts: EDUCATION_FAMILY_COUNTS, indicatorCount: EDUCATION_INDICATORS.length, coverageCounts: coverageCounts.rows[0], checks: { national: national != null, municipalities: municipalityProfiles.map((x, i) => ({ ibge7: municipalities[i], ok: x != null })), states: stateProfiles.map((x, i) => ({ uf: states[i], ok: x != null })), schools: Object.fromEntries(Object.entries(schoolProfiles).map(([k, v]) => [k, v != null])), benchmark: benchmark != null, relations: relations != null } };
  await writeFile(resolve(root, 'evidencias', 'contratos_reais_p108.json'), JSON.stringify({ national, municipalityProfiles, stateProfiles, schoolProfiles, benchmark, relations }, null, 2));
  await writeFile(resolve(root, 'results.partial.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await pool.end(); }
