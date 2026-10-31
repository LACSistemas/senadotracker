// P13.6: ownership for infrastructure indicators stored outside domain 5.
export const EXEC_DDL_V37 = `
ALTER TABLE civica_exec.exec_infra_editorial_catalog ADD COLUMN IF NOT EXISTS domain smallint;
UPDATE civica_exec.exec_infra_editorial_catalog c SET domain=d.domain FROM civica_exec.exec_ind_def d WHERE d.indicator_id=c.indicator_id AND c.domain IS NULL;
INSERT INTO civica_exec.exec_infra_editorial_catalog(indicator_id,domain,source_family,dimension,editorial_title,short_description,priority,comparison_eligible,interpretation_direction)
SELECT d.indicator_id,d.domain,
  CASE WHEN d.code LIKE 'energy_indger_%' THEN 'ANEEL_INDGER' WHEN d.code LIKE 'ENERGY-MMGD-%' THEN 'MMGD' WHEN d.code LIKE 'ANP-%' THEN 'ANP' WHEN d.code LIKE 'LOG-%' THEN 'LOGISTICA' ELSE 'INFRAESTRUTURA' END,
  CASE WHEN d.code LIKE 'LOG-%' THEN 'PERFORMANCE' WHEN d.code LIKE 'ANP-%' OR d.code LIKE 'ENERGY-MMGD-%' THEN 'STOCK' ELSE 'PERFORMANCE' END,
  d.label,'Indicador oficial de infraestrutura mantido no dominio source-native.',90,d.aggregation_allowed,d.direction
FROM civica_exec.exec_ind_def d WHERE d.domain IN (6,13)
ON CONFLICT (indicator_id) DO UPDATE SET domain=EXCLUDED.domain,source_family=EXCLUDED.source_family,dimension=EXCLUDED.dimension,editorial_title=EXCLUDED.editorial_title,short_description=EXCLUDED.short_description,comparison_eligible=EXCLUDED.comparison_eligible,interpretation_direction=EXCLUDED.interpretation_direction,updated_at=now();
ALTER TABLE civica_exec.exec_infra_editorial_catalog ALTER COLUMN domain SET NOT NULL;
CREATE OR REPLACE VIEW civica_exec.exec_infra_indicator_coverage_v AS
SELECT d.indicator_id,d.code,d.label,d.unit,d.grain,d.domain,d.ranking_allowed,d.aggregation_allowed,c.source_family,c.dimension,
  min(v.period_start) first_period,max(v.period_start) last_period,count(*)::int observation_count,count(DISTINCT v.entity_id)::int entity_count,
  count(*) FILTER (WHERE e.kind=4)::int municipality_observation_count,count(*) FILTER (WHERE e.kind=3)::int uf_observation_count,count(*) FILTER (WHERE e.kind=1)::int brazil_observation_count,
  count(*) FILTER (WHERE v.value IS NOT NULL)::int non_null_count,count(*) FILTER (WHERE (v.flags & 256) <> 0)::int unavailable_count
FROM civica_exec.exec_ind_def d JOIN civica_exec.exec_infra_editorial_catalog c USING(indicator_id) LEFT JOIN civica_exec.exec_ind_value v USING(indicator_id) LEFT JOIN civica_exec.exec_entity e USING(entity_id)
WHERE d.domain IN (5,6,13) GROUP BY d.indicator_id,d.code,d.label,d.unit,d.grain,d.domain,d.ranking_allowed,d.aggregation_allowed,c.source_family,c.dimension;
`;
