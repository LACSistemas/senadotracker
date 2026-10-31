// P13.6: read-serving views and compact editorial metadata.
export const EXEC_DDL_V36 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_infra_editorial_catalog (
  indicator_id smallint PRIMARY KEY REFERENCES civica_exec.exec_ind_def(indicator_id),
  source_family text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('STOCK','PERFORMANCE','INVESTMENT','CONTEXT')),
  editorial_title text NOT NULL,
  short_description text NOT NULL,
  priority smallint NOT NULL DEFAULT 99,
  comparison_eligible boolean NOT NULL DEFAULT false,
  interpretation_direction text,
  methodology_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO civica_exec.exec_infra_editorial_catalog(indicator_id,source_family,dimension,editorial_title,short_description,priority,comparison_eligible,interpretation_direction)
SELECT indicator_id,
  CASE
    WHEN code LIKE 'INF-ENTORNO-%' THEN 'ENTORNO_IBGE'
    WHEN code LIKE 'INF-INTERNET-%' THEN 'INTERNET_DOMICILIAR'
    WHEN code LIKE 'INF-FAVELAS-%' THEN 'FAVELAS'
    WHEN code LIKE 'INF-FJP-%' THEN 'FJP'
    WHEN code LIKE 'IAG%' OR code LIKE 'IES%' OR code LIKE 'IRS%' OR code LIKE 'OGM%' THEN 'SINISA'
    WHEN code LIKE 'IAP%' OR code LIKE 'IGR%' THEN 'MUNIC_URBANA'
    WHEN code LIKE 'IND-MOB-PEMOB-%' THEN 'PEMOB'
    WHEN code LIKE 'IND-MOB-MUNIC-%' THEN 'MUNIC_TRANSPORTE'
    WHEN code LIKE 'INF-DAMS-SNISB-%' THEN 'SNISB'
    WHEN code LIKE 'INF-DAMS-ANM-%' THEN 'ANM'
    WHEN code LIKE 'INF-ATLAS-%' THEN 'ATLAS_AGUAS'
    ELSE 'INFRAESTRUTURA'
  END,
  CASE
    WHEN code LIKE 'IAG%' OR code LIKE 'IES%' OR code LIKE 'IRS%' OR code LIKE 'IAP%' OR code LIKE 'IGR%' OR code LIKE 'OGM%' OR code LIKE 'IND-MOB-%' THEN 'PERFORMANCE'
    WHEN code LIKE 'INF-FJP-%' THEN 'INVESTMENT'
    ELSE 'STOCK'
  END,
  label,
  'Indicador oficial publicado no catalogo de infraestrutura; consulte a metodologia e a cobertura antes de comparar.',
  CASE WHEN code LIKE 'INF-ENTORNO-HOUSEHOLD-%' OR code='INF-INTERNET-DOMICILIOS' THEN 1
       WHEN code LIKE 'IAG%' OR code LIKE 'IES%' THEN 2
       WHEN code LIKE 'INF-DAMS-%' THEN 3 ELSE 90 END,
  aggregation_allowed,
  direction
FROM civica_exec.exec_ind_def WHERE domain=5
ON CONFLICT (indicator_id) DO UPDATE SET source_family=EXCLUDED.source_family,dimension=EXCLUDED.dimension,editorial_title=EXCLUDED.editorial_title,short_description=EXCLUDED.short_description,priority=EXCLUDED.priority,comparison_eligible=EXCLUDED.comparison_eligible,interpretation_direction=EXCLUDED.interpretation_direction,updated_at=now();
CREATE INDEX IF NOT EXISTS exec_infra_editorial_family_idx ON civica_exec.exec_infra_editorial_catalog(source_family,priority);
CREATE INDEX IF NOT EXISTS exec_work_location_ibge_project_idx ON civica_exec.exec_work_c_location(ibge7,project_id) WHERE ibge7 IS NOT NULL;
CREATE INDEX IF NOT EXISTS exec_work_contract_project_idx ON civica_exec.exec_work_c_contract(project_id);
CREATE INDEX IF NOT EXISTS exec_work_commitment_project_idx ON civica_exec.exec_work_c_commitment(project_id);
CREATE INDEX IF NOT EXISTS exec_work_physical_project_updated_idx ON civica_exec.exec_work_c_physical(project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS exec_work_history_project_date_idx ON civica_exec.exec_work_c_history(project_id,status_date DESC);
CREATE INDEX IF NOT EXISTS exec_ind_def_domain_idx ON civica_exec.exec_ind_def(domain,sort_order,indicator_id);
CREATE OR REPLACE VIEW civica_exec.exec_work_project_territory_overview_v AS
WITH loc AS (
  SELECT project_id,ibge7::int ibge7,count(*)::int location_rows FROM civica_exec.exec_work_c_location WHERE ibge7 IS NOT NULL GROUP BY project_id,ibge7
), loc2 AS (
  SELECT l.project_id,l.ibge7,l.location_rows,count(*) OVER (PARTITION BY l.project_id)::int territory_count FROM loc l
), ctr AS (
  SELECT project_id,count(*)::int contract_count,sum(amount_global)::bigint contract_amount_global,sum(amount_accumulated)::bigint contract_amount_accumulated FROM civica_exec.exec_work_c_contract GROUP BY project_id
), com AS (
  SELECT project_id,count(*)::int commitment_count,sum(value_cents)::numeric committed_cents,sum(CASE WHEN liquidation>0 THEN liquidation ELSE 0 END)::numeric liquidated,sum(CASE WHEN paid>0 THEN paid ELSE 0 END)::numeric paid FROM civica_exec.exec_work_c_commitment GROUP BY project_id
), phy AS (
  SELECT project_id,count(*)::int physical_fact_rows,count(*) FILTER (WHERE percent IS NOT NULL)::int valid_physical_rows,max(percent)::numeric latest_physical_percent,max(updated_at) physical_updated_at FROM civica_exec.exec_work_c_physical GROUP BY project_id
), hist AS (
  SELECT project_id,count(*)::int history_event_count,max(status_date) latest_status_date FROM civica_exec.exec_work_c_history GROUP BY project_id
)
SELECT p.project_id,p.source_project_id,p.name,p.situation_code,p.uf,p.planned_amount,l.ibge7,l.location_rows,l.territory_count,
  CASE WHEN l.territory_count=1 THEN 'SINGLE_MUNICIPALITY_PROJECT_VALUE' ELSE 'MULTI_TERRITORY_PROJECT_TOTAL_UNALLOCATED' END allocation_class,
  CASE WHEN l.territory_count=1 THEN p.planned_amount END allocated_planned_amount,
  CASE WHEN l.territory_count=1 THEN ctr.contract_amount_global END allocated_contract_amount_global,
  CASE WHEN l.territory_count=1 THEN com.committed_cents END allocated_committed_cents,
  CASE WHEN l.territory_count=1 THEN com.liquidated END allocated_liquidated,
  CASE WHEN l.territory_count=1 THEN com.paid END allocated_paid,
  ctr.contract_count,ctr.contract_amount_global,ctr.contract_amount_accumulated,com.commitment_count,com.committed_cents,com.liquidated,com.paid,
  phy.physical_fact_rows,phy.valid_physical_rows,phy.latest_physical_percent,phy.physical_updated_at,hist.history_event_count,hist.latest_status_date
FROM civica_exec.exec_work_c_project p JOIN loc2 l USING(project_id) LEFT JOIN ctr USING(project_id) LEFT JOIN com USING(project_id) LEFT JOIN phy USING(project_id) LEFT JOIN hist USING(project_id);
CREATE OR REPLACE VIEW civica_exec.exec_infra_indicator_coverage_v AS
SELECT d.indicator_id,d.code,d.label,d.unit,d.grain,d.domain,d.ranking_allowed,d.aggregation_allowed,c.source_family,c.dimension,
  min(v.period_start) first_period,max(v.period_start) last_period,count(*)::int observation_count,count(DISTINCT v.entity_id)::int entity_count,
  count(*) FILTER (WHERE e.kind=4)::int municipality_observation_count,count(*) FILTER (WHERE e.kind=3)::int uf_observation_count,count(*) FILTER (WHERE e.kind=1)::int brazil_observation_count,
  count(*) FILTER (WHERE v.value IS NOT NULL)::int non_null_count,count(*) FILTER (WHERE (v.flags & 256) <> 0)::int unavailable_count
FROM civica_exec.exec_ind_def d JOIN civica_exec.exec_infra_editorial_catalog c USING(indicator_id) LEFT JOIN civica_exec.exec_ind_value v USING(indicator_id) LEFT JOIN civica_exec.exec_entity e USING(entity_id)
WHERE d.domain=5 GROUP BY d.indicator_id,d.code,d.label,d.unit,d.grain,d.domain,d.ranking_allowed,d.aggregation_allowed,c.source_family,c.dimension;
`;
