// P13.5.5: camada compacta de evidências relacionais e read models set-based.
export const EXEC_DDL_V35 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_work_integration_edge (
  edge_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project(project_id),
  target_system text NOT NULL,
  target_entity_type text NOT NULL,
  target_source_id text NOT NULL,
  relation_type text NOT NULL,
  evidence_type text NOT NULL,
  evidence_source text NOT NULL,
  evidence_reference text,
  evidence_timestamp timestamptz,
  valid_from date,
  valid_to date,
  validation_status text NOT NULL,
  publication_revision bigint,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exec_work_edge_evidence_check CHECK (evidence_type IN ('SOURCE_NATIVE_RELATION','EXPLICIT_EXTERNAL_REFERENCE','DOCUMENT_VERIFIED_RELATION','TERRITORIAL_CONTEXT','TEMPORAL_CONTEXT','UNVERIFIED_CANDIDATE','NO_EVIDENCE')),
  CONSTRAINT exec_work_edge_status_check CHECK (validation_status IN ('VERIFIED','CONTEXT_ONLY','CANDIDATE','REJECTED')),
  CONSTRAINT exec_work_edge_unique UNIQUE (project_id,target_system,target_entity_type,target_source_id,relation_type,evidence_type)
);
CREATE INDEX IF NOT EXISTS exec_work_edge_project_idx ON civica_exec.exec_work_integration_edge(project_id);
CREATE INDEX IF NOT EXISTS exec_work_edge_target_idx ON civica_exec.exec_work_integration_edge(target_system,target_entity_type,target_source_id);

CREATE TABLE IF NOT EXISTS civica_exec.exec_work_integration_snapshot (
  snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_hash bytea NOT NULL UNIQUE,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source_projects integer NOT NULL DEFAULT 0,
  source_contracts integer NOT NULL DEFAULT 0,
  source_commitments integer NOT NULL DEFAULT 0,
  source_physical integer NOT NULL DEFAULT 0,
  edge_rows integer NOT NULL DEFAULT 0,
  verified_pncp_links integer NOT NULL DEFAULT 0,
  verified_payment_links integer NOT NULL DEFAULT 0,
  verified_asset_links integer NOT NULL DEFAULT 0,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE VIEW civica_exec.exec_work_project_overview_v AS
WITH loc AS (
  SELECT project_id,count(*)::int AS location_count,count(DISTINCT ibge7)::int AS municipality_count,
         min(ibge7)::int AS first_ibge7
  FROM civica_exec.exec_work_c_location GROUP BY project_id
), ctr AS (
  SELECT project_id,count(*)::int AS contract_count,
         sum(amount_global)::bigint AS contract_amount_global,
         sum(amount_accumulated)::bigint AS contract_amount_accumulated
  FROM civica_exec.exec_work_c_contract GROUP BY project_id
), com AS (
  SELECT project_id,count(*)::int AS commitment_count,
         sum(value_cents)::bigint AS committed_cents,
         sum(CASE WHEN liquidation>0 THEN liquidation ELSE 0 END)::numeric AS liquidated,
         sum(CASE WHEN paid>0 THEN paid ELSE 0 END)::numeric AS paid
  FROM civica_exec.exec_work_c_commitment GROUP BY project_id
), phy AS (
  SELECT project_id,count(*)::int AS physical_measurement_count,
         max(percent)::numeric AS latest_physical_percent,
         max(updated_at) AS physical_updated_at
  FROM civica_exec.exec_work_c_physical GROUP BY project_id
), hist AS (
  SELECT project_id,count(*)::int AS history_event_count,max(status_date) AS latest_status_date
  FROM civica_exec.exec_work_c_history GROUP BY project_id
)
SELECT p.project_id,p.source_project_id,p.name,p.situation_code,p.uf,p.planned_amount,
       coalesce(loc.location_count,0) location_count,coalesce(loc.municipality_count,0) municipality_count,loc.first_ibge7,
       coalesce(ctr.contract_count,0) contract_count,ctr.contract_amount_global,ctr.contract_amount_accumulated,
       coalesce(com.commitment_count,0) commitment_count,com.committed_cents,com.liquidated,com.paid,
       coalesce(phy.physical_measurement_count,0) physical_measurement_count,phy.latest_physical_percent,phy.physical_updated_at,
       coalesce(hist.history_event_count,0) history_event_count,hist.latest_status_date
FROM civica_exec.exec_work_c_project p
LEFT JOIN loc USING(project_id)
LEFT JOIN ctr USING(project_id)
LEFT JOIN com USING(project_id)
LEFT JOIN phy USING(project_id)
LEFT JOIN hist USING(project_id);

CREATE OR REPLACE VIEW civica_exec.exec_work_verified_links_v AS
SELECT * FROM civica_exec.exec_work_integration_edge WHERE validation_status='VERIFIED';
`;
