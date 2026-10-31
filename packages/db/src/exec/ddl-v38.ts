// P13.6: compact serving rollups, rebuilt from published facts during migration.
export const EXEC_DDL_V38 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_infra_coverage_snapshot (
  indicator_id smallint PRIMARY KEY REFERENCES civica_exec.exec_ind_def(indicator_id),
  source_family text NOT NULL,
  dimension text NOT NULL,
  first_period date,
  last_period date,
  observation_count integer NOT NULL,
  entity_count integer NOT NULL,
  municipality_observation_count integer NOT NULL,
  uf_observation_count integer NOT NULL,
  brazil_observation_count integer NOT NULL,
  non_null_count integer NOT NULL,
  unavailable_count integer NOT NULL,
  source_fingerprint text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO civica_exec.exec_infra_coverage_snapshot(indicator_id,source_family,dimension,first_period,last_period,observation_count,entity_count,municipality_observation_count,uf_observation_count,brazil_observation_count,non_null_count,unavailable_count,source_fingerprint)
SELECT indicator_id,source_family,dimension,first_period,last_period,observation_count,entity_count,municipality_observation_count,uf_observation_count,brazil_observation_count,non_null_count,unavailable_count,md5(concat_ws('|',indicator_id,observation_count,entity_count,first_period,last_period))
FROM civica_exec.exec_infra_indicator_coverage_v
ON CONFLICT(indicator_id) DO UPDATE SET source_family=EXCLUDED.source_family,dimension=EXCLUDED.dimension,first_period=EXCLUDED.first_period,last_period=EXCLUDED.last_period,observation_count=EXCLUDED.observation_count,entity_count=EXCLUDED.entity_count,municipality_observation_count=EXCLUDED.municipality_observation_count,uf_observation_count=EXCLUDED.uf_observation_count,brazil_observation_count=EXCLUDED.brazil_observation_count,non_null_count=EXCLUDED.non_null_count,unavailable_count=EXCLUDED.unavailable_count,source_fingerprint=EXCLUDED.source_fingerprint,refreshed_at=now();
CREATE INDEX IF NOT EXISTS exec_infra_coverage_family_idx ON civica_exec.exec_infra_coverage_snapshot(source_family,indicator_id);

CREATE TABLE IF NOT EXISTS civica_exec.exec_work_territory_rollup (
  territory_level text NOT NULL CHECK (territory_level IN ('BRASIL','UF','MUNICIPIO')),
  territory_key text NOT NULL,
  project_count integer NOT NULL,
  single_municipality_projects integer NOT NULL,
  multi_territory_projects integer NOT NULL,
  allocated_planned numeric,
  allocated_contracted numeric,
  allocated_committed numeric,
  allocated_liquidated numeric,
  allocated_paid numeric,
  projects_without_valid_location integer NOT NULL DEFAULT 0,
  source_fingerprint text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (territory_level,territory_key)
);
TRUNCATE civica_exec.exec_work_territory_rollup;
WITH loc AS (SELECT DISTINCT project_id,ibge7::int ibge7 FROM civica_exec.exec_work_c_location WHERE ibge7 IS NOT NULL), tc AS (SELECT project_id,count(*)::int territory_count FROM loc GROUP BY project_id), ctr AS (SELECT project_id,sum(amount_global)::numeric contracted FROM civica_exec.exec_work_c_contract GROUP BY project_id), com AS (SELECT project_id,sum(value_cents)::numeric committed,sum(CASE WHEN liquidation>0 THEN liquidation ELSE 0 END)::numeric liquidated,sum(CASE WHEN paid>0 THEN paid ELSE 0 END)::numeric paid FROM civica_exec.exec_work_c_commitment GROUP BY project_id), base AS (SELECT l.ibge7,l.project_id,tc.territory_count,CASE WHEN tc.territory_count=1 THEN p.planned_amount END planned,CASE WHEN tc.territory_count=1 THEN ctr.contracted END contracted,CASE WHEN tc.territory_count=1 THEN com.committed END committed,CASE WHEN tc.territory_count=1 THEN com.liquidated END liquidated,CASE WHEN tc.territory_count=1 THEN com.paid END paid FROM loc l JOIN tc USING(project_id) JOIN civica_exec.exec_work_c_project p USING(project_id) LEFT JOIN ctr USING(project_id) LEFT JOIN com USING(project_id)), muni AS (SELECT ibge7,count(DISTINCT project_id)::int projects,count(DISTINCT project_id) FILTER(WHERE territory_count=1)::int single,count(DISTINCT project_id) FILTER(WHERE territory_count>1)::int multi,sum(planned) planned,sum(contracted) contracted,sum(committed) committed,sum(liquidated) liquidated,sum(paid) paid FROM base GROUP BY ibge7)
INSERT INTO civica_exec.exec_work_territory_rollup(territory_level,territory_key,project_count,single_municipality_projects,multi_territory_projects,allocated_planned,allocated_contracted,allocated_committed,allocated_liquidated,allocated_paid,source_fingerprint)
SELECT 'MUNICIPIO',ibge7::text,projects,single,multi,planned,contracted,committed,liquidated,paid,md5(concat_ws('|',ibge7,projects,single,multi,planned,contracted,committed,liquidated,paid)) FROM muni;
WITH x AS (SELECT m.uf_code, r.* FROM civica_exec.exec_work_territory_rollup r JOIN civica_exec.exec_entity m ON m.kind=4 AND m.ibge7::text=r.territory_key WHERE r.territory_level='MUNICIPIO')
INSERT INTO civica_exec.exec_work_territory_rollup(territory_level,territory_key,project_count,single_municipality_projects,multi_territory_projects,allocated_planned,allocated_contracted,allocated_committed,allocated_liquidated,allocated_paid,source_fingerprint)
SELECT 'UF',uf_code::text,sum(project_count)::int,count(*) FILTER(WHERE single_municipality_projects>0)::int,sum(multi_territory_projects)::int,sum(allocated_planned),sum(allocated_contracted),sum(allocated_committed),sum(allocated_liquidated),sum(allocated_paid),md5(string_agg(territory_key||':'||project_count,',' order by territory_key)) FROM x GROUP BY uf_code;
WITH no_loc AS (SELECT count(*)::int n FROM civica_exec.exec_work_c_project p WHERE NOT EXISTS(SELECT 1 FROM civica_exec.exec_work_c_location l WHERE l.project_id=p.project_id AND l.ibge7 IS NOT NULL)), x AS (SELECT * FROM civica_exec.exec_work_territory_rollup WHERE territory_level='MUNICIPIO')
INSERT INTO civica_exec.exec_work_territory_rollup(territory_level,territory_key,project_count,single_municipality_projects,multi_territory_projects,allocated_planned,allocated_contracted,allocated_committed,allocated_liquidated,allocated_paid,projects_without_valid_location,source_fingerprint)
SELECT 'BRASIL',(SELECT count(*)::text FROM civica_exec.exec_work_c_project),sum(project_count)::int,sum(single_municipality_projects)::int,sum(multi_territory_projects)::int,sum(allocated_planned),sum(allocated_contracted),sum(allocated_committed),sum(allocated_liquidated),sum(allocated_paid),(SELECT n FROM no_loc),md5(concat_ws('|',(SELECT count(*) FROM civica_exec.exec_work_c_project),sum(project_count),(SELECT n FROM no_loc))) FROM x;
`;
