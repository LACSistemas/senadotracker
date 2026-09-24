export const migrations = [
  { version: 1, sql: `
    CREATE TABLE people (id TEXT PRIMARY KEY, created_at TEXT NOT NULL) STRICT;
    CREATE TABLE external_identifiers (
      source TEXT NOT NULL CHECK(source IN ('senado','camara')), external_id TEXT NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id), PRIMARY KEY(source,external_id)
    ) STRICT;
    CREATE TABLE identity_links (
      id TEXT PRIMARY KEY, person_a TEXT NOT NULL REFERENCES people(id), person_b TEXT NOT NULL REFERENCES people(id),
      status TEXT NOT NULL CHECK(status IN ('candidate','confirmed','rejected','ambiguous')),
      evidence TEXT NOT NULL, CHECK(person_a <> person_b)
    ) STRICT;
  ` },
  { version: 2, sql: `
    CREATE TABLE sources (id TEXT PRIMARY KEY, base_url TEXT NOT NULL) STRICT;
    INSERT INTO sources VALUES ('senado','https://legis.senado.leg.br/dadosabertos/'),('camara','https://dadosabertos.camara.leg.br/api/v2/');
    CREATE TABLE ingestion_runs (
      id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES sources(id), started_at TEXT NOT NULL, finished_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('running','validated','published','failed')),
      parser_version TEXT NOT NULL, expected_count INTEGER, roster_complete INTEGER NOT NULL DEFAULT 0 CHECK(roster_complete IN (0,1)),
      reconciliation_json TEXT, error TEXT
    ) STRICT;
    CREATE TABLE job_locks (source TEXT PRIMARY KEY REFERENCES sources(id), run_id TEXT NOT NULL REFERENCES ingestion_runs(id), expires_at INTEGER NOT NULL) STRICT;
    CREATE TABLE raw_objects (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ingestion_runs(id), url TEXT NOT NULL, fetched_at TEXT NOT NULL,
      status INTEGER NOT NULL, content_type TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64), path TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>=0)
    ) STRICT;
    CREATE TABLE validation_issues (
      id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ingestion_runs(id), external_id TEXT,
      raw_id TEXT REFERENCES raw_objects(id), severity TEXT NOT NULL CHECK(severity IN ('error','warning')), code TEXT NOT NULL, message TEXT NOT NULL
    ) STRICT;
    CREATE TABLE staged_profiles (
      run_id TEXT NOT NULL REFERENCES ingestion_runs(id), external_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
      PRIMARY KEY(run_id,external_id)
    ) STRICT;
    CREATE TABLE publication_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id), source TEXT NOT NULL REFERENCES sources(id), published_at TEXT NOT NULL) STRICT;
    CREATE TABLE active_publications (source TEXT PRIMARY KEY REFERENCES sources(id), batch_id TEXT NOT NULL REFERENCES publication_batches(id)) STRICT;
    CREATE TABLE profiles (
      batch_id TEXT NOT NULL REFERENCES publication_batches(id), person_id TEXT NOT NULL REFERENCES people(id),
      external_id TEXT NOT NULL, name TEXT NOT NULL, search_name TEXT NOT NULL, uf TEXT NOT NULL, party TEXT NOT NULL,
      raw_id TEXT NOT NULL REFERENCES raw_objects(id), payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(batch_id,person_id), UNIQUE(batch_id,external_id)
    ) STRICT;
    CREATE TABLE mandates (
      batch_id TEXT NOT NULL, person_id TEXT NOT NULL, key TEXT NOT NULL, raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(batch_id,person_id,key),
      FOREIGN KEY(batch_id,person_id) REFERENCES profiles(batch_id,person_id)
    ) STRICT;
    CREATE TABLE exercise_periods (
      batch_id TEXT NOT NULL, person_id TEXT NOT NULL, key TEXT NOT NULL, mandate_key TEXT NOT NULL,
      start TEXT NOT NULL, end TEXT, raw_id TEXT NOT NULL REFERENCES raw_objects(id), payload TEXT NOT NULL CHECK(json_valid(payload)),
      PRIMARY KEY(batch_id,person_id,key), FOREIGN KEY(batch_id,person_id,mandate_key) REFERENCES mandates(batch_id,person_id,key), CHECK(end IS NULL OR end>=start)
    ) STRICT;
    CREATE TABLE party_memberships (
      batch_id TEXT NOT NULL, person_id TEXT NOT NULL, key TEXT NOT NULL, start TEXT NOT NULL, end TEXT,
      raw_id TEXT NOT NULL REFERENCES raw_objects(id), payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(batch_id,person_id,key),
      FOREIGN KEY(batch_id,person_id) REFERENCES profiles(batch_id,person_id), CHECK(end IS NULL OR end>=start)
    ) STRICT;
    CREATE TABLE history_events (
      batch_id TEXT NOT NULL, person_id TEXT NOT NULL, key TEXT NOT NULL, raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(batch_id,person_id,key), FOREIGN KEY(batch_id,person_id) REFERENCES profiles(batch_id,person_id)
    ) STRICT;
    CREATE INDEX profiles_filters ON profiles(batch_id,uf,party,search_name);
    CREATE INDEX raw_run ON raw_objects(run_id);
  ` },
  { version: 3, sql: `
    CREATE TABLE expense_batches (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id), source TEXT NOT NULL REFERENCES sources(id), year INTEGER NOT NULL CHECK(year BETWEEN 2008 AND 2100),
      published_at TEXT NOT NULL, record_count INTEGER NOT NULL CHECK(record_count>=0), net_cents INTEGER NOT NULL,
      UNIQUE(source,year,id)
    ) STRICT;
    CREATE TABLE active_expense_publications (
      source TEXT NOT NULL REFERENCES sources(id), year INTEGER NOT NULL, batch_id TEXT NOT NULL REFERENCES expense_batches(id),
      PRIMARY KEY(source,year)
    ) STRICT;
    CREATE TABLE expenses (
      batch_id TEXT NOT NULL REFERENCES expense_batches(id), source TEXT NOT NULL, external_id TEXT NOT NULL,
      year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), record_key TEXT NOT NULL,
      category_code TEXT NOT NULL, category TEXT NOT NULL, supplier TEXT, supplier_document TEXT,
      document_number TEXT, document_id TEXT, document_url TEXT, issued_at TEXT,
      gross_cents INTEGER, deduction_cents INTEGER NOT NULL, net_cents INTEGER NOT NULL, refund_cents INTEGER NOT NULL,
      installment INTEGER, detail TEXT, raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      PRIMARY KEY(batch_id,record_key), FOREIGN KEY(source,external_id) REFERENCES external_identifiers(source,external_id)
    ) STRICT;
    CREATE INDEX expenses_profile_period ON expenses(source,external_id,year,month);
    CREATE INDEX expenses_category ON expenses(batch_id,category_code);
  ` },
  { version: 4, sql: `
    CREATE TABLE legislative_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),year INTEGER NOT NULL,published_at TEXT NOT NULL,deliberation_count INTEGER NOT NULL,vote_count INTEGER NOT NULL) STRICT;
    CREATE TABLE active_legislative_publications (source TEXT NOT NULL,year INTEGER NOT NULL,batch_id TEXT NOT NULL REFERENCES legislative_batches(id),PRIMARY KEY(source,year)) STRICT;
    CREATE TABLE deliberations (batch_id TEXT NOT NULL REFERENCES legislative_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,year INTEGER NOT NULL,date TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id)) STRICT;
    CREATE TABLE legislative_votes (batch_id TEXT NOT NULL,source TEXT NOT NULL,deliberation_id TEXT NOT NULL,external_id TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,deliberation_id,external_id),FOREIGN KEY(batch_id,deliberation_id) REFERENCES deliberations(batch_id,external_id),FOREIGN KEY(source,external_id) REFERENCES external_identifiers(source,external_id)) STRICT;
    CREATE INDEX legislative_votes_profile ON legislative_votes(source,external_id,batch_id);
  ` },
  { version: 5, sql: `
    CREATE TABLE activity_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),scope TEXT NOT NULL,published_at TEXT NOT NULL,proposal_count INTEGER NOT NULL,author_count INTEGER NOT NULL,appointment_count INTEGER NOT NULL,law_count INTEGER NOT NULL) STRICT;
    CREATE TABLE active_activity_publications (source TEXT NOT NULL,scope TEXT NOT NULL,batch_id TEXT NOT NULL REFERENCES activity_batches(id),PRIMARY KEY(source,scope)) STRICT;
    CREATE TABLE proposals (batch_id TEXT NOT NULL REFERENCES activity_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id)) STRICT;
    CREATE TABLE proposal_authors (batch_id TEXT NOT NULL,proposal_id TEXT NOT NULL,author_key TEXT NOT NULL,person_external_id TEXT,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,proposal_id,author_key),FOREIGN KEY(batch_id,proposal_id) REFERENCES proposals(batch_id,external_id)) STRICT;
    CREATE TABLE legislative_appointments (batch_id TEXT NOT NULL REFERENCES activity_batches(id),external_id TEXT NOT NULL,source TEXT NOT NULL,person_external_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('rapporteurship','commission','office')),raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id)) STRICT;
    CREATE TABLE law_links (batch_id TEXT NOT NULL,proposal_id TEXT NOT NULL,law_id TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,proposal_id,law_id),FOREIGN KEY(batch_id,proposal_id) REFERENCES proposals(batch_id,external_id)) STRICT;
    CREATE INDEX proposal_authors_person ON proposal_authors(person_external_id,batch_id);
    CREATE INDEX appointments_person ON legislative_appointments(source,person_external_id,batch_id);
  ` },
  { version: 6, sql: `
    CREATE TABLE presence_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),year INTEGER NOT NULL,published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),session_count INTEGER NOT NULL,attendance_count INTEGER NOT NULL,note TEXT NOT NULL) STRICT;
    CREATE TABLE active_presence_publications (source TEXT NOT NULL,year INTEGER NOT NULL,batch_id TEXT NOT NULL REFERENCES presence_batches(id),PRIMARY KEY(source,year)) STRICT;
    CREATE TABLE legislative_sessions (batch_id TEXT NOT NULL REFERENCES presence_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,date TEXT NOT NULL,eligible INTEGER NOT NULL CHECK(eligible IN (0,1)),raw_id TEXT REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id)) STRICT;
    CREATE TABLE attendance (batch_id TEXT NOT NULL,source TEXT NOT NULL,session_id TEXT NOT NULL,external_id TEXT NOT NULL,state TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,session_id,external_id),FOREIGN KEY(batch_id,session_id) REFERENCES legislative_sessions(batch_id,external_id),FOREIGN KEY(source,external_id) REFERENCES external_identifiers(source,external_id)) STRICT;
    CREATE INDEX attendance_profile ON attendance(source,external_id,batch_id);
  ` },
  { version: 7, sql: `
    CREATE TABLE complement_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),scope TEXT NOT NULL,published_at TEXT NOT NULL,record_count INTEGER NOT NULL,reconciliation_json TEXT NOT NULL CHECK(json_valid(reconciliation_json))) STRICT;
    CREATE TABLE active_complement_publications (source TEXT NOT NULL,scope TEXT NOT NULL,batch_id TEXT NOT NULL REFERENCES complement_batches(id),PRIMARY KEY(source,scope)) STRICT;
    CREATE TABLE legislative_complements (batch_id TEXT NOT NULL REFERENCES complement_batches(id),source TEXT NOT NULL,external_key TEXT NOT NULL,kind TEXT NOT NULL,person_external_id TEXT,proposal_id TEXT,deliberation_id TEXT,body_id TEXT,occurred_at TEXT,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_key)) STRICT;
    CREATE INDEX complements_profile ON legislative_complements(source,person_external_id,batch_id,kind);
    CREATE INDEX complements_proposal ON legislative_complements(source,proposal_id,batch_id,kind);
  ` },
  { version: 8, sql: `
    INSERT OR IGNORE INTO sources VALUES ('tse','https://dadosabertos.tse.jus.br/');
    CREATE TABLE elections (id TEXT PRIMARY KEY,year INTEGER NOT NULL,round INTEGER NOT NULL,scope TEXT NOT NULL,official_url TEXT NOT NULL,UNIQUE(year,round,scope)) STRICT;
    CREATE TABLE electoral_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),election_id TEXT NOT NULL REFERENCES elections(id),published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),candidate_count INTEGER NOT NULL,asset_count INTEGER NOT NULL,revenue_count INTEGER NOT NULL,expense_count INTEGER NOT NULL,note TEXT NOT NULL) STRICT;
    CREATE TABLE active_electoral_publications (election_id TEXT PRIMARY KEY REFERENCES elections(id),batch_id TEXT NOT NULL REFERENCES electoral_batches(id)) STRICT;
    CREATE TABLE candidacies (batch_id TEXT NOT NULL REFERENCES electoral_batches(id),sequence_id TEXT NOT NULL,person_id TEXT REFERENCES people(id),match_status TEXT NOT NULL CHECK(match_status IN ('pending','confirmed','ambiguous','rejected')),year INTEGER NOT NULL,uf TEXT NOT NULL,office TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,sequence_id)) STRICT;
    CREATE TABLE electoral_assets (batch_id TEXT NOT NULL,sequence_id TEXT NOT NULL,asset_id TEXT NOT NULL,version TEXT NOT NULL,value_cents INTEGER NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,sequence_id,asset_id,version),FOREIGN KEY(batch_id,sequence_id) REFERENCES candidacies(batch_id,sequence_id)) STRICT;
    CREATE TABLE campaign_transactions (batch_id TEXT NOT NULL,sequence_id TEXT NOT NULL,transaction_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('revenue','expense')),version TEXT NOT NULL,value_cents INTEGER NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,sequence_id,transaction_id,kind,version),FOREIGN KEY(batch_id,sequence_id) REFERENCES candidacies(batch_id,sequence_id)) STRICT;
    CREATE INDEX candidacies_person ON candidacies(person_id,year);
  ` },
  { version: 9, sql: `
    CREATE TABLE expanded_cost_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),year INTEGER NOT NULL,published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),note TEXT NOT NULL,record_count INTEGER NOT NULL) STRICT;
    CREATE TABLE active_expanded_cost_publications (source TEXT NOT NULL,year INTEGER NOT NULL,batch_id TEXT NOT NULL REFERENCES expanded_cost_batches(id),PRIMARY KEY(source,year)) STRICT;
    CREATE TABLE expanded_costs (batch_id TEXT NOT NULL REFERENCES expanded_cost_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,competence TEXT NOT NULL,rubric TEXT NOT NULL,nature TEXT NOT NULL CHECK(nature IN ('expense','budget','occupancy','headcount')),value_cents INTEGER,overlap_group TEXT,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id,competence,rubric)) STRICT;
    CREATE TABLE cabinet_offices (batch_id TEXT NOT NULL REFERENCES expanded_cost_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,office_id TEXT NOT NULL,location TEXT,observed_at TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id,office_id)) STRICT;
    CREATE TABLE cabinet_staff (batch_id TEXT NOT NULL REFERENCES expanded_cost_batches(id),source TEXT NOT NULL,external_id TEXT NOT NULL,staff_key TEXT NOT NULL,office_id TEXT,role TEXT,started_at TEXT,ended_at TEXT,observed_at TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id,staff_key)) STRICT;
  ` },
  { version: 10, sql: `
    CREATE TABLE staff_snapshot_batches (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL REFERENCES sources(id),observed_at TEXT NOT NULL,
      published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),
      note TEXT NOT NULL,record_count INTEGER NOT NULL CHECK(record_count>=0)
    ) STRICT;
    CREATE TABLE active_staff_snapshot_publications (
      source TEXT PRIMARY KEY REFERENCES sources(id),batch_id TEXT NOT NULL REFERENCES staff_snapshot_batches(id)
    ) STRICT;
    CREATE TABLE functional_staff_assignments (
      batch_id TEXT NOT NULL REFERENCES staff_snapshot_batches(id),source TEXT NOT NULL,staff_key TEXT NOT NULL,functional_id TEXT,
      name TEXT NOT NULL,relationship TEXT NOT NULL,position TEXT,role TEXT,unit_id TEXT,unit_label TEXT NOT NULL,
      appointed_at TEXT,started_at TEXT,ended_at TEXT,observed_at TEXT NOT NULL,external_id TEXT,
      match_status TEXT NOT NULL CHECK(match_status IN ('confirmed','pending','ambiguous','rejected')),
      raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,staff_key),
      FOREIGN KEY(source,external_id) REFERENCES external_identifiers(source,external_id),CHECK(ended_at IS NULL OR started_at IS NULL OR ended_at>=started_at),
      CHECK((match_status='confirmed' AND external_id IS NOT NULL) OR (match_status<>'confirmed' AND external_id IS NULL))
    ) STRICT;
    CREATE INDEX functional_staff_office ON functional_staff_assignments(source,external_id,batch_id,relationship);
    CREATE TABLE cabinet_budget_batches (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),source TEXT NOT NULL CHECK(source='camara'),year INTEGER NOT NULL CHECK(year BETWEEN 2008 AND 2100),
      published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),
      note TEXT NOT NULL,record_count INTEGER NOT NULL CHECK(record_count>=0),UNIQUE(source,year,id)
    ) STRICT;
    CREATE TABLE active_cabinet_budget_publications (
      source TEXT NOT NULL CHECK(source='camara'),year INTEGER NOT NULL,batch_id TEXT NOT NULL REFERENCES cabinet_budget_batches(id),PRIMARY KEY(source,year)
    ) STRICT;
    CREATE TABLE cabinet_monthly_budgets (
      batch_id TEXT NOT NULL REFERENCES cabinet_budget_batches(id),source TEXT NOT NULL CHECK(source='camara'),external_id TEXT NOT NULL,
      year INTEGER NOT NULL CHECK(year BETWEEN 2008 AND 2100),month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      available_cents INTEGER CHECK(available_cents>=0),spent_cents INTEGER CHECK(spent_cents>=0),raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_id,month),
      FOREIGN KEY(source,external_id) REFERENCES external_identifiers(source,external_id)
    ) STRICT;
    CREATE INDEX cabinet_budget_profile ON cabinet_monthly_budgets(source,external_id,year,month);
  ` },
  { version: 11, sql: `
    CREATE INDEX proposals_listing ON proposals(source,json_extract(payload,'$.type'),CAST(json_extract(payload,'$.year') AS INTEGER),batch_id);
    CREATE INDEX deliberations_proposal ON deliberations(source,json_extract(payload,'$.proposalId'),batch_id);
  ` },
  { version: 12, sql: `
    CREATE TABLE normative_values (
      key TEXT PRIMARY KEY,kind TEXT NOT NULL,applies_to TEXT NOT NULL,valid_from TEXT NOT NULL,valid_to TEXT,
      value_cents INTEGER NOT NULL CHECK(value_cents>=0),unit TEXT NOT NULL,legal_basis TEXT NOT NULL,
      official_url TEXT NOT NULL,published_at TEXT NOT NULL,note TEXT NOT NULL,CHECK(valid_to IS NULL OR valid_to>=valid_from)
    ) STRICT;
    INSERT INTO normative_values VALUES
      ('congress-subsidy-2023-01','parliamentary_subsidy','congress','2023-01-01','2023-03-31',3929332,'month','Decreto Legislativo nº 172/2022','https://www2.camara.leg.br/legin/fed/decleg/2022/decretolegislativo-172-21-dezembro-2022-793529-norma-pl.html','2022-12-22','Valor bruto normativo mensal dos membros do Congresso Nacional.'),
      ('congress-subsidy-2023-04','parliamentary_subsidy','congress','2023-04-01','2024-01-31',4165092,'month','Decreto Legislativo nº 172/2022','https://www2.camara.leg.br/legin/fed/decleg/2022/decretolegislativo-172-21-dezembro-2022-793529-norma-pl.html','2022-12-22','Valor bruto normativo mensal dos membros do Congresso Nacional.'),
      ('congress-subsidy-2024-02','parliamentary_subsidy','congress','2024-02-01','2025-01-31',4400852,'month','Decreto Legislativo nº 172/2022','https://www2.camara.leg.br/legin/fed/decleg/2022/decretolegislativo-172-21-dezembro-2022-793529-norma-pl.html','2022-12-22','Valor bruto normativo mensal dos membros do Congresso Nacional.'),
      ('congress-subsidy-2025-02','parliamentary_subsidy','congress','2025-02-01',NULL,4636619,'month','Decreto Legislativo nº 172/2022','https://www2.camara.leg.br/legin/fed/decleg/2022/decretolegislativo-172-21-dezembro-2022-793529-norma-pl.html','2022-12-22','Valor bruto normativo mensal; descontos e pagamentos eventuais não estão incluídos.');
    CREATE INDEX normative_values_period ON normative_values(kind,applies_to,valid_from,valid_to);
  ` },
  { version: 13, sql: `
    CREATE TABLE chamber_official_presence (
      external_id TEXT NOT NULL,year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2100),
      session_count INTEGER NOT NULL CHECK(session_count>=0),days_total INTEGER NOT NULL CHECK(days_total>=0),
      days_present INTEGER NOT NULL CHECK(days_present>=0),days_justified INTEGER NOT NULL CHECK(days_justified>=0),
      days_unjustified INTEGER NOT NULL CHECK(days_unjustified>=0),days_json TEXT NOT NULL CHECK(json_valid(days_json)),
      official_url TEXT NOT NULL,fetched_at TEXT NOT NULL,sha256 TEXT NOT NULL,
      PRIMARY KEY(external_id,year)
    ) STRICT;
    CREATE INDEX chamber_official_presence_year ON chamber_official_presence(year,external_id);
  ` },
  { version: 14, sql: `
    CREATE INDEX complements_deliberation ON legislative_complements(source,deliberation_id,batch_id,kind);
    CREATE INDEX proposal_authors_proposal ON proposal_authors(proposal_id,batch_id,person_external_id);
    CREATE INDEX legislative_votes_deliberation ON legislative_votes(deliberation_id,batch_id,external_id);
    CREATE INDEX legislative_votes_choice ON legislative_votes(batch_id,search_text(json_extract(payload,'$.vote')),deliberation_id,external_id);
    CREATE INDEX expanded_costs_listing ON expanded_costs(batch_id,external_id,competence,nature);
    CREATE INDEX cabinet_budget_batch_profile ON cabinet_monthly_budgets(batch_id,external_id);
    CREATE INDEX functional_staff_batch_profile ON functional_staff_assignments(batch_id,source,external_id,match_status);
  ` },
  { version: 15, sql: `
    CREATE TABLE nominal_deliberations (
      batch_id TEXT NOT NULL,deliberation_id TEXT NOT NULL,
      PRIMARY KEY(batch_id,deliberation_id),
      FOREIGN KEY(batch_id,deliberation_id) REFERENCES deliberations(batch_id,external_id)
    ) STRICT;
    INSERT INTO nominal_deliberations
    SELECT DISTINCT batch_id,deliberation_id FROM legislative_votes
    WHERE search_text(json_extract(payload,'$.vote')) IN ('sim','nao','abstencao','votou','secreto')
       OR (source='camara' AND search_text(json_extract(payload,'$.vote'))='obstrucao');
  ` },
  { version: 16, sql: `
    CREATE INDEX deliberations_proposal_label ON deliberations(upper(trim(json_extract(payload,'$.proposalLabel'))),batch_id);
  ` },
  { version: 17, sql: `
    CREATE TABLE proposal_enrichment_items (
      batch_id TEXT NOT NULL REFERENCES complement_batches(id),source TEXT NOT NULL REFERENCES sources(id),
      proposal_id TEXT NOT NULL,kind TEXT NOT NULL,external_key TEXT NOT NULL,
      related_proposal_id TEXT,deliberation_id TEXT,person_external_id TEXT,body_id TEXT,occurred_at TEXT,
      code TEXT,label TEXT NOT NULL,description TEXT,official_url TEXT NOT NULL,
      inherited_from_proposal_id TEXT,raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(batch_id,external_key)
    ) STRICT;
    CREATE INDEX proposal_enrichment_lookup ON proposal_enrichment_items(source,proposal_id,kind,batch_id);
    CREATE INDEX proposal_enrichment_relation ON proposal_enrichment_items(source,related_proposal_id,kind,batch_id);
    CREATE INDEX proposal_enrichment_vote ON proposal_enrichment_items(source,deliberation_id,kind,batch_id);
    CREATE INDEX proposal_enrichment_search ON proposal_enrichment_items(kind,search_text(label),source,proposal_id);
  ` },
  { version: 18, sql: `
    CREATE TABLE active_proposal_enrichment_publications (
      source TEXT NOT NULL REFERENCES sources(id),proposal_id TEXT NOT NULL,kind TEXT NOT NULL,
      batch_id TEXT NOT NULL REFERENCES complement_batches(id),published_at TEXT NOT NULL,
      PRIMARY KEY(source,proposal_id,kind)
    ) STRICT;
    CREATE INDEX active_proposal_enrichment_batch ON active_proposal_enrichment_publications(batch_id,source,proposal_id);
  ` },
  { version: 19, sql: `
    CREATE INDEX expenses_batch_period ON expenses(batch_id,year,month,external_id);
    CREATE INDEX proposals_batch_presented ON proposals(batch_id,substr(json_extract(payload,'$.presentedAt'),1,4));
    CREATE INDEX proposals_batch_status ON proposals(batch_id,search_text(COALESCE(json_extract(payload,'$.status'),'')));
    CREATE INDEX deliberations_batch_date_proposal ON deliberations(batch_id,date,json_extract(payload,'$.proposalId'));
  ` },
  { version: 20, sql: `
    ALTER TABLE proposals ADD COLUMN grupo_atribuido TEXT NOT NULL DEFAULT 'atos_documentos_especiais'
      CHECK(grupo_atribuido IN (
        'proposicoes_legislativas_principais','requerimentos','emendas_substitutivos','pareceres_relatorios',
        'instrumentos_votacao_tramitacao','indicacoes_sugestoes','mensagens_comunicacoes_institucionais',
        'oficios_documentos','recursos_representacoes_peticoes','atos_documentos_especiais'
      ));
    UPDATE proposals SET grupo_atribuido=CASE
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('PL','PLP','PEC','PDL','PLN','MPV','PRC','PRS','PLS','PDS','PLC','PLV') THEN 'proposicoes_legislativas_principais'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('REQ','RIC','RQS','RQI','RQE','RQN') THEN 'requerimentos'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('EMC','EMA','EMS','EMR','EMP','EMC-A','SBT','SBT-A','SBR','SBE-A','ESB') THEN 'emendas_substitutivos'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('PRL','PAR','PARF','REL','REL-A','RLP','PRLP','PRLE') THEN 'pareceres_relatorios'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('DTQ','RPD','RPDR','VTS') THEN 'instrumentos_votacao_tramitacao'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('INC','SUG') THEN 'indicacoes_sugestoes'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('MSC','MSG','MSF','MCN') THEN 'mensagens_comunicacoes_institucionais'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('DOC','OF','OFN','OFS','OFTFC') THEN 'oficios_documentos'
      WHEN upper(trim(json_extract(payload,'$.type'))) IN ('REC','REP','PET') THEN 'recursos_representacoes_peticoes'
      ELSE 'atos_documentos_especiais' END;
    UPDATE proposals SET payload=json_set(payload,'$.functionalGroup',grupo_atribuido);
    CREATE INDEX proposals_functional_group ON proposals(source,grupo_atribuido,batch_id);
  ` },
  { version: 21, sql: `
    CREATE INDEX expenses_batch_person_month_category ON expenses(batch_id,external_id,month,category_code);
  ` },
  { version: 22, sql: `
    CREATE INDEX proposals_batch_presented_day ON proposals(batch_id,substr(json_extract(payload,'$.presentedAt'),1,10));
    CREATE INDEX appointments_batch_kind_start ON legislative_appointments(batch_id,kind,substr(json_extract(payload,'$.start'),1,10));
    CREATE INDEX complements_batch_kind_occurred ON legislative_complements(batch_id,kind,occurred_at,proposal_id);
  ` },
  { version: 23, sql: `
    CREATE INDEX proposals_batch_effective_year ON proposals(batch_id,COALESCE(json_extract(payload,'$.year'),CAST(substr(json_extract(payload,'$.presentedAt'),1,4) AS INTEGER)));
  ` },
  { version: 24, sql: `
    CREATE INDEX proposals_batch_type_number ON proposals(batch_id,json_extract(payload,'$.type'),CAST(json_extract(payload,'$.number') AS INTEGER));
  ` },
  // Índice de preços em tabela própria: um número-índice é adimensional e não tem base legal, então não
  // cabe em normative_values, que modela valor monetário com vigência. Guardado como inteiro escalado
  // por 10.000 para manter a disciplina de não usar ponto flutuante em dado publicado.
  { version: 25, sql: `
    INSERT OR IGNORE INTO sources VALUES ('ibge','https://servicodados.ibge.gov.br/');
    CREATE TABLE price_index_batches (id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),index_code TEXT NOT NULL,published_at TEXT NOT NULL,availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable')),first_month TEXT NOT NULL,last_month TEXT NOT NULL,record_count INTEGER NOT NULL,official_url TEXT NOT NULL,note TEXT NOT NULL) STRICT;
    CREATE TABLE active_price_index_publications (index_code TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES price_index_batches(id)) STRICT;
    CREATE TABLE price_index_values (batch_id TEXT NOT NULL REFERENCES price_index_batches(id),index_code TEXT NOT NULL,reference_month TEXT NOT NULL,index_scaled INTEGER NOT NULL CHECK(index_scaled>0),raw_id TEXT NOT NULL REFERENCES raw_objects(id),PRIMARY KEY(batch_id,index_code,reference_month)) STRICT;
    CREATE INDEX price_index_values_month ON price_index_values(index_code,reference_month,batch_id);
  ` },
  // Salário mínimo: valor monetário com vigência e base legal, então cabe em normative_values pelo mesmo
  // critério que manteve o número-índice do IPCA fora dela. Cada período cita o ato que o fixou; ano sem
  // ato confirmado não é semeado, e a leitura devolve null em vez de estimar.
  { version: 26, sql: `
    INSERT INTO normative_values VALUES
      ('minimum-wage-2023-01','minimum_wage','brasil','2023-01-01','2023-04-30',130200,'month','Medida Provisória nº 1.143, de 12 de dezembro de 2022','https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/mpv/mpv1143.htm','2022-12-12','Salário mínimo nacional mensal.'),
      ('minimum-wage-2023-05','minimum_wage','brasil','2023-05-01','2023-12-31',132000,'month','Lei nº 14.663, de 28 de agosto de 2023','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14663.htm','2023-08-28','Salário mínimo nacional mensal, com efeitos a partir de 1º de maio de 2023.'),
      ('minimum-wage-2024-01','minimum_wage','brasil','2024-01-01','2024-12-31',141200,'month','Decreto nº 11.864, de 27 de dezembro de 2023','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11864.htm','2023-12-27','Salário mínimo nacional mensal.'),
      ('minimum-wage-2025-01','minimum_wage','brasil','2025-01-01','2025-12-31',151800,'month','Decreto nº 12.342, de 30 de dezembro de 2024','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/d12342.htm','2024-12-30','Salário mínimo nacional mensal.'),
      ('minimum-wage-2026-01','minimum_wage','brasil','2026-01-01',NULL,162100,'month','Decreto nº 12.797, de 23 de dezembro de 2025','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm','2025-12-23','Salário mínimo nacional mensal.');
  ` },
  { version: 27, sql: `
    CREATE INDEX deliberations_actual_object ON deliberations(source,json_extract(payload,'$.actualVotedProposalId'),batch_id);
    CREATE INDEX deliberations_anchor ON deliberations(source,json_extract(payload,'$.anchorProposalId'),batch_id);
    CREATE INDEX deliberations_association_status ON deliberations(batch_id,json_extract(payload,'$.associationStatus'));
  ` },
  { version: 28, sql: `
    CREATE TABLE principal_proposal_dependencies (
      source TEXT NOT NULL CHECK(source='camara'),child_id TEXT NOT NULL,parent_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending','resolved','failed')),depth INTEGER NOT NULL CHECK(depth>=1),
      attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,discovered_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      PRIMARY KEY(source,child_id,parent_id)
    ) STRICT;
    CREATE INDEX principal_dependencies_queue ON principal_proposal_dependencies(source,state,attempts,parent_id);
    CREATE TABLE principal_proposal_support (
      source TEXT NOT NULL CHECK(source='camara'),external_id TEXT NOT NULL,raw_id TEXT NOT NULL REFERENCES raw_objects(id),
      payload TEXT NOT NULL CHECK(json_valid(payload)),resolved_at TEXT NOT NULL,
      PRIMARY KEY(source,external_id)
    ) STRICT;
    CREATE TABLE principal_proposal_support_themes (
      source TEXT NOT NULL CHECK(source='camara'),proposal_id TEXT NOT NULL,theme_key TEXT NOT NULL,
      raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),
      PRIMARY KEY(source,proposal_id,theme_key),
      FOREIGN KEY(source,proposal_id) REFERENCES principal_proposal_support(source,external_id) ON DELETE CASCADE
    ) STRICT;
  ` },
  { version: 29, sql: `
    INSERT OR IGNORE INTO sources VALUES ('pncp','https://pncp.gov.br/'),('siafi','https://www.tesourotransparente.gov.br/'),('civica','https://civica.local/');
    CREATE TABLE supplier_identity_batches (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),published_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('validated','published','failed')),
      normalization_version TEXT NOT NULL,record_count INTEGER NOT NULL CHECK(record_count>=0),
      reconciliation_json TEXT NOT NULL CHECK(json_valid(reconciliation_json))
    ) STRICT;
    CREATE TABLE active_supplier_identity_publication (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),batch_id TEXT NOT NULL REFERENCES supplier_identity_batches(id)
    ) STRICT;
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,canonical_name TEXT,
      entity_kind TEXT NOT NULL CHECK(entity_kind IN ('company','individual','public_body','foreign_entity','other','unknown')),
      identity_status TEXT NOT NULL CHECK(identity_status IN ('confirmed','provisional','ambiguous','rejected')),
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE supplier_identifiers (
      id TEXT PRIMARY KEY,supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      identifier_type TEXT NOT NULL CHECK(identifier_type IN ('cnpj','cpf','foreign_tax_id','other')),
      raw_value TEXT NOT NULL,normalized_value TEXT NOT NULL,country_code TEXT,
      is_masked INTEGER NOT NULL CHECK(is_masked IN (0,1)),
      validation_status TEXT NOT NULL CHECK(validation_status IN ('valid','invalid','masked','not_validated','sentinel')),
      normalization_version TEXT NOT NULL,valid_from TEXT,valid_to TEXT,
      source TEXT NOT NULL,source_record_id TEXT NOT NULL,created_at TEXT NOT NULL,
      CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from),
      UNIQUE(supplier_id,identifier_type,raw_value,source,source_record_id)
    ) STRICT;
    CREATE UNIQUE INDEX supplier_identifier_strong_identity ON supplier_identifiers(identifier_type,normalized_value,country_code)
      WHERE is_masked=0 AND validation_status='valid' AND identifier_type IN ('cnpj','cpf','foreign_tax_id');
    CREATE INDEX supplier_identifiers_supplier ON supplier_identifiers(supplier_id,identifier_type);
    CREATE INDEX supplier_identifiers_lookup ON supplier_identifiers(normalized_value,identifier_type,validation_status);
    CREATE TABLE supplier_identifier_observations (
      supplier_identifier_id TEXT NOT NULL REFERENCES supplier_identifiers(id),raw_value TEXT NOT NULL,
      source TEXT NOT NULL,source_record_id TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,
      PRIMARY KEY(supplier_identifier_id,source,source_record_id)
    ) STRICT;
    CREATE TABLE supplier_names (
      id TEXT PRIMARY KEY,supplier_id TEXT NOT NULL REFERENCES suppliers(id),name TEXT NOT NULL,search_name TEXT NOT NULL,
      is_canonical INTEGER NOT NULL CHECK(is_canonical IN (0,1)),valid_from TEXT,valid_to TEXT,
      source TEXT NOT NULL,source_record_id TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,
      CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from),
      UNIQUE(supplier_id,name,source,source_record_id)
    ) STRICT;
    CREATE INDEX supplier_names_search ON supplier_names(search_name,supplier_id);
    CREATE INDEX supplier_names_supplier ON supplier_names(supplier_id,is_canonical,last_seen_at);
    CREATE TABLE supplier_roles (
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      role TEXT NOT NULL CHECK(role IN ('PARLIAMENTARY_EXPENSE','INSTITUTIONAL_TENDER','INSTITUTIONAL_CONTRACT','INSTITUTIONAL_PAYMENT')),
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),
      first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,source TEXT NOT NULL,source_record_id TEXT NOT NULL,
      PRIMARY KEY(supplier_id,role,institution,source,source_record_id)
    ) STRICT;
    CREATE INDEX supplier_roles_filter ON supplier_roles(role,institution,supplier_id);
    CREATE TABLE expense_supplier_links (
      batch_id TEXT NOT NULL,record_key TEXT NOT NULL,supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      supplier_identifier_id TEXT REFERENCES supplier_identifiers(id),
      match_method TEXT NOT NULL CHECK(match_method IN ('strong_identifier','manual','source_asserted')),
      match_status TEXT NOT NULL CHECK(match_status IN ('confirmed','ambiguous','rejected')),
      matched_at TEXT NOT NULL,resolver_version TEXT NOT NULL,evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),
      PRIMARY KEY(batch_id,record_key),
      FOREIGN KEY(batch_id,record_key) REFERENCES expenses(batch_id,record_key)
    ) STRICT;
    CREATE INDEX expense_supplier_links_supplier ON expense_supplier_links(supplier_id,batch_id);
  ` },
  { version: 30, sql: `
    CREATE TABLE institutional_collection_batches (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),
      source_system TEXT NOT NULL,dataset TEXT NOT NULL,period_from TEXT,period_to TEXT,published_at TEXT NOT NULL,
      availability TEXT NOT NULL CHECK(availability IN ('available','partial','unavailable','stale')),
      record_count INTEGER NOT NULL CHECK(record_count>=0),reconciliation_json TEXT NOT NULL CHECK(json_valid(reconciliation_json)),
      UNIQUE(institution,source_system,dataset,id)
    ) STRICT;
    CREATE TABLE active_institutional_publications (
      institution TEXT NOT NULL,source_system TEXT NOT NULL,dataset TEXT NOT NULL,
      batch_id TEXT NOT NULL REFERENCES institutional_collection_batches(id),
      PRIMARY KEY(institution,source_system,dataset)
    ) STRICT;
    CREATE TABLE institutional_source_records (
      id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES institutional_collection_batches(id),
      source_system TEXT NOT NULL,entity_type TEXT NOT NULL,external_key TEXT NOT NULL,
      payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),source_updated_at TEXT,fetched_at TEXT NOT NULL,
      raw_id TEXT NOT NULL REFERENCES raw_objects(id),payload TEXT NOT NULL CHECK(json_valid(payload)),
      UNIQUE(batch_id,entity_type,external_key)
    ) STRICT;
    CREATE INDEX institutional_source_records_lookup ON institutional_source_records(source_system,entity_type,external_key,fetched_at);
    CREATE TABLE procurement_processes (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),
      source_system TEXT NOT NULL,source_process_id TEXT NOT NULL,process_number TEXT,object TEXT,status TEXT,
      opened_at TEXT,source_updated_at TEXT,fetched_at TEXT NOT NULL,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_process_id)
    ) STRICT;
    CREATE TABLE procurement_requests (
      id TEXT PRIMARY KEY,process_id TEXT REFERENCES procurement_processes(id),source_system TEXT NOT NULL,
      source_request_id TEXT NOT NULL,requesting_unit TEXT,object TEXT,requested_at TEXT,
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_request_id)
    ) STRICT;
    CREATE TABLE tenders (
      id TEXT PRIMARY KEY,process_id TEXT REFERENCES procurement_processes(id),institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),
      source_system TEXT NOT NULL,source_tender_id TEXT NOT NULL,tender_number TEXT,tender_year INTEGER,modality TEXT,status TEXT,object TEXT,
      published_at TEXT,opening_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',estimated_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      source_updated_at TEXT,fetched_at TEXT NOT NULL,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_tender_id)
    ) STRICT;
    CREATE INDEX tenders_period ON tenders(institution,tender_year,status);
    CREATE TABLE tender_items (
      id TEXT PRIMARY KEY,tender_id TEXT NOT NULL REFERENCES tenders(id),source_system TEXT NOT NULL,source_item_id TEXT NOT NULL,
      item_number TEXT,description TEXT,quantity_scaled INTEGER,quantity_scale INTEGER NOT NULL DEFAULT 0 CHECK(quantity_scale BETWEEN 0 AND 6),unit TEXT,
      estimated_unit_value_scaled INTEGER,estimated_total_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      status TEXT,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_item_id)
    ) STRICT;
    CREATE INDEX tender_items_tender ON tender_items(tender_id,item_number);
    CREATE TABLE supplier_proposals (
      id TEXT PRIMARY KEY,tender_id TEXT NOT NULL REFERENCES tenders(id),tender_item_id TEXT REFERENCES tender_items(id),
      supplier_id TEXT REFERENCES suppliers(id),source_system TEXT NOT NULL,source_proposal_id TEXT NOT NULL,
      proposed_unit_value_scaled INTEGER,proposed_total_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      status TEXT,submitted_at TEXT,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_proposal_id)
    ) STRICT;
    CREATE INDEX supplier_proposals_supplier ON supplier_proposals(supplier_id,tender_id);
    CREATE TABLE item_awards (
      id TEXT PRIMARY KEY,tender_item_id TEXT NOT NULL REFERENCES tender_items(id),supplier_id TEXT REFERENCES suppliers(id),
      source_system TEXT NOT NULL,source_award_id TEXT NOT NULL,awarded_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      awarded_at TEXT,status TEXT,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_award_id)
    ) STRICT;
    CREATE TABLE institutional_contracts (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),source_system TEXT NOT NULL,
      source_contract_id TEXT NOT NULL,pncp_control_number TEXT,tender_id TEXT REFERENCES tenders(id),supplier_id TEXT REFERENCES suppliers(id),
      contract_number TEXT,contract_year INTEGER,instrument_type TEXT,status TEXT,object TEXT,process_number TEXT,
      signed_at TEXT,published_at TEXT,start_at TEXT,original_end_at TEXT,current_end_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',
      original_value_scaled INTEGER,current_published_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      current_value_semantics TEXT,source_updated_at TEXT,fetched_at TEXT NOT NULL,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_contract_id)
    ) STRICT;
    CREATE INDEX institutional_contracts_supplier ON institutional_contracts(supplier_id,institution,contract_year);
    CREATE INDEX institutional_contracts_process ON institutional_contracts(process_number,institution);
    CREATE TABLE contract_items (
      id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES institutional_contracts(id),tender_item_id TEXT REFERENCES tender_items(id),
      source_system TEXT NOT NULL,source_item_id TEXT NOT NULL,description TEXT,quantity_scaled INTEGER,quantity_scale INTEGER NOT NULL DEFAULT 0 CHECK(quantity_scale BETWEEN 0 AND 6),
      unit_value_scaled INTEGER,total_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_item_id)
    ) STRICT;
    CREATE TABLE contract_amendments (
      id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES institutional_contracts(id),source_system TEXT NOT NULL,source_amendment_id TEXT NOT NULL,
      amendment_number TEXT,kind TEXT,description TEXT,signed_at TEXT,published_at TEXT,start_at TEXT,end_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',
      added_value_scaled INTEGER,suppressed_value_scaled INTEGER,resulting_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_amendment_id)
    ) STRICT;
    CREATE INDEX contract_amendments_contract ON contract_amendments(contract_id,signed_at);
    CREATE TABLE commitments (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),source_system TEXT NOT NULL,
      source_commitment_id TEXT NOT NULL,contract_id TEXT REFERENCES institutional_contracts(id),supplier_id TEXT REFERENCES suppliers(id),
      commitment_number TEXT,commitment_year INTEGER,issued_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',committed_value_scaled INTEGER,
      value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),status TEXT,link_evidence TEXT,
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_commitment_id)
    ) STRICT;
    CREATE INDEX commitments_contract ON commitments(contract_id,commitment_year);
    CREATE TABLE financial_movements (
      id TEXT PRIMARY KEY,commitment_id TEXT NOT NULL REFERENCES commitments(id),source_system TEXT NOT NULL,source_movement_id TEXT NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('commitment','liquidation','payment')),movement_kind TEXT NOT NULL,
      movement_year INTEGER NOT NULL,occurred_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',amount_signed_scaled INTEGER NOT NULL,
      value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),restos_a_pagar INTEGER NOT NULL DEFAULT 0 CHECK(restos_a_pagar IN (0,1)),
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_movement_id)
    ) STRICT;
    CREATE INDEX financial_movements_commitment ON financial_movements(commitment_id,phase,movement_year);
    CREATE TABLE contract_billings (
      id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES institutional_contracts(id),source_system TEXT NOT NULL,source_billing_id TEXT NOT NULL,
      reference_period TEXT,billed_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',billed_value_scaled INTEGER,penalty_value_scaled INTEGER,
      withheld_value_scaled INTEGER,gloss_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),status TEXT,
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_billing_id)
    ) STRICT;
    CREATE TABLE fiscal_documents (
      id TEXT PRIMARY KEY,billing_id TEXT REFERENCES contract_billings(id),contract_id TEXT REFERENCES institutional_contracts(id),
      source_system TEXT NOT NULL,source_document_id TEXT NOT NULL,document_type TEXT,document_number TEXT,issued_at TEXT,
      currency TEXT NOT NULL DEFAULT 'BRL',document_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      official_url TEXT,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_document_id)
    ) STRICT;
    CREATE TABLE price_registration_atas (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),source_system TEXT NOT NULL,source_ata_id TEXT NOT NULL,
      tender_id TEXT REFERENCES tenders(id),supplier_id TEXT REFERENCES suppliers(id),ata_number TEXT,status TEXT,signed_at TEXT,start_at TEXT,end_at TEXT,
      currency TEXT NOT NULL DEFAULT 'BRL',total_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_ata_id)
    ) STRICT;
    CREATE TABLE ata_items (
      id TEXT PRIMARY KEY,ata_id TEXT NOT NULL REFERENCES price_registration_atas(id),source_system TEXT NOT NULL,source_item_id TEXT NOT NULL,
      description TEXT,quantity_scaled INTEGER,quantity_scale INTEGER NOT NULL DEFAULT 0 CHECK(quantity_scale BETWEEN 0 AND 6),
      unit_value_scaled INTEGER,total_value_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_item_id)
    ) STRICT;
    CREATE TABLE ata_activations (
      id TEXT PRIMARY KEY,ata_id TEXT NOT NULL REFERENCES price_registration_atas(id),source_system TEXT NOT NULL,source_activation_id TEXT NOT NULL,
      activated_at TEXT,requesting_unit TEXT,currency TEXT NOT NULL DEFAULT 'BRL',activated_value_scaled INTEGER,
      value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_activation_id)
    ) STRICT;
    CREATE TABLE supplier_sanctions (
      id TEXT PRIMARY KEY,supplier_id TEXT REFERENCES suppliers(id),institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),
      source_system TEXT NOT NULL,source_sanction_id TEXT NOT NULL,kind TEXT,reason TEXT,start_at TEXT,end_at TEXT,status TEXT,
      source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),UNIQUE(source_system,source_sanction_id)
    ) STRICT;
    CREATE TABLE procurement_plans (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),source_system TEXT NOT NULL,source_plan_id TEXT NOT NULL,
      plan_year INTEGER NOT NULL,status TEXT,published_at TEXT,source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_plan_id)
    ) STRICT;
    CREATE TABLE procurement_plan_items (
      id TEXT PRIMARY KEY,plan_id TEXT NOT NULL REFERENCES procurement_plans(id),source_system TEXT NOT NULL,source_item_id TEXT NOT NULL,
      category TEXT,description TEXT,planned_at TEXT,currency TEXT NOT NULL DEFAULT 'BRL',estimated_value_scaled INTEGER,
      value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),source_record_id TEXT NOT NULL REFERENCES institutional_source_records(id),
      UNIQUE(source_system,source_item_id)
    ) STRICT;
  ` },
  { version: 31, sql: `
    CREATE TABLE institutional_collector_checkpoints (
      collector TEXT NOT NULL,scope TEXT NOT NULL,cursor TEXT,updated_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','running','complete','failed')),
      attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
      PRIMARY KEY(collector,scope)
    ) STRICT;
    CREATE TABLE institutional_collector_metrics (
      run_id TEXT NOT NULL REFERENCES ingestion_runs(id),collector TEXT NOT NULL,scope TEXT NOT NULL,
      records_fetched INTEGER NOT NULL DEFAULT 0,records_inserted INTEGER NOT NULL DEFAULT 0,records_updated INTEGER NOT NULL DEFAULT 0,records_unchanged INTEGER NOT NULL DEFAULT 0,
      suppliers_created INTEGER NOT NULL DEFAULT 0,suppliers_matched INTEGER NOT NULL DEFAULT 0,invalid_identifiers INTEGER NOT NULL DEFAULT 0,masked_identifiers INTEGER NOT NULL DEFAULT 0,
      contracts_without_supplier INTEGER NOT NULL DEFAULT 0,contracts_without_tender INTEGER NOT NULL DEFAULT 0,orphan_items INTEGER NOT NULL DEFAULT 0,orphan_commitments INTEGER NOT NULL DEFAULT 0,
      duplicate_external_keys INTEGER NOT NULL DEFAULT 0,api_empty_responses INTEGER NOT NULL DEFAULT 0,portal_fallbacks INTEGER NOT NULL DEFAULT 0,value_conflicts INTEGER NOT NULL DEFAULT 0,
      requests INTEGER NOT NULL DEFAULT 0,retries INTEGER NOT NULL DEFAULT 0,bytes INTEGER NOT NULL DEFAULT 0,oldest_record TEXT,newest_record TEXT,
      started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL CHECK(status IN ('running','complete','failed')),error TEXT,
      PRIMARY KEY(run_id,collector,scope)
    ) STRICT;
    CREATE INDEX institutional_metrics_collector ON institutional_collector_metrics(collector,started_at,status);
  ` },
  { version: 32, sql: `
    CREATE TABLE supplier_identity_review_queue (
      id TEXT PRIMARY KEY,source TEXT NOT NULL,source_record_id TEXT NOT NULL,raw_identifier TEXT,normalized_identifier TEXT,
      validation_status TEXT NOT NULL CHECK(validation_status IN ('invalid','masked','sentinel','not_validated','conflict')),
      reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
      evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),created_at TEXT NOT NULL,resolved_at TEXT,
      UNIQUE(source,source_record_id,validation_status)
    ) STRICT;
    CREATE INDEX supplier_identity_review_status ON supplier_identity_review_queue(status,validation_status,created_at);
    CREATE TABLE financial_reconciliation_issues (
      id TEXT PRIMARY KEY,institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),contract_id TEXT REFERENCES institutional_contracts(id),
      commitment_id TEXT REFERENCES commitments(id),source_system TEXT NOT NULL,issue_kind TEXT NOT NULL,
      expected_scaled INTEGER,observed_scaled INTEGER,value_scale INTEGER NOT NULL DEFAULT 2 CHECK(value_scale BETWEEN 0 AND 6),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','accepted_limitation')),
      evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),observed_at TEXT NOT NULL,
      UNIQUE(source_system,issue_kind,commitment_id)
    ) STRICT;
    CREATE INDEX financial_reconciliation_open ON financial_reconciliation_issues(status,institution,issue_kind);
  ` },
  { version: 33, sql: `
    CREATE TABLE supplier_aggregate_revisions (
      id TEXT PRIMARY KEY REFERENCES ingestion_runs(id),published_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('validated','published','failed')),
      reconciliation_json TEXT NOT NULL CHECK(json_valid(reconciliation_json))
    ) STRICT;
    CREATE TABLE active_supplier_aggregate_revision(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id)) STRICT;
    CREATE TABLE supplier_parliamentary_yearly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),net_value_scaled INTEGER NOT NULL,value_scale INTEGER NOT NULL DEFAULT 2,
      records INTEGER NOT NULL,parliamentarians INTEGER NOT NULL,ufs INTEGER NOT NULL,parties INTEGER NOT NULL,first_observed_at TEXT,last_observed_at TEXT,
      PRIMARY KEY(revision_id,supplier_id,year,institution)
    ) STRICT;
    CREATE INDEX supplier_parliamentary_yearly_filter ON supplier_parliamentary_yearly(revision_id,year,institution,net_value_scaled DESC,supplier_id);
    CREATE TABLE supplier_parliamentary_monthly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),net_value_scaled INTEGER NOT NULL,value_scale INTEGER NOT NULL DEFAULT 2,records INTEGER NOT NULL,
      PRIMARY KEY(revision_id,supplier_id,year,month,institution)
    ) STRICT;
    CREATE INDEX supplier_parliamentary_monthly_filter ON supplier_parliamentary_monthly(revision_id,year,institution,month);
    CREATE TABLE supplier_parliamentary_categories (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),category TEXT NOT NULL,net_value_scaled INTEGER NOT NULL,value_scale INTEGER NOT NULL DEFAULT 2,records INTEGER NOT NULL,
      PRIMARY KEY(revision_id,supplier_id,year,institution,category)
    ) STRICT;
    CREATE INDEX supplier_parliamentary_categories_filter ON supplier_parliamentary_categories(revision_id,year,institution,net_value_scaled DESC);
    CREATE TABLE supplier_institutional_yearly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),committed_scaled INTEGER,liquidated_scaled INTEGER,paid_scaled INTEGER,
      value_scale INTEGER NOT NULL DEFAULT 2,contracts INTEGER NOT NULL,commitments INTEGER NOT NULL,period_semantics TEXT NOT NULL,
      PRIMARY KEY(revision_id,supplier_id,year,institution)
    ) STRICT;
    CREATE INDEX supplier_institutional_yearly_filter ON supplier_institutional_yearly(revision_id,year,institution,paid_scaled DESC,supplier_id);
  ` },
  { version: 34, sql: `
    CREATE TABLE supplier_parliamentary_congress_yearly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      net_value_scaled INTEGER NOT NULL,value_scale INTEGER NOT NULL DEFAULT 2,records INTEGER NOT NULL,parliamentarians INTEGER NOT NULL,
      ufs INTEGER NOT NULL,parties INTEGER NOT NULL,houses INTEGER NOT NULL,first_observed_at TEXT,last_observed_at TEXT,
      PRIMARY KEY(revision_id,supplier_id,year)
    ) STRICT;
    CREATE INDEX supplier_parliamentary_congress_filter ON supplier_parliamentary_congress_yearly(revision_id,year,net_value_scaled DESC,supplier_id);
  ` },
  { version: 35, sql: `
    CREATE TABLE supplier_global_yearly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      parliamentary_net_scaled INTEGER,parliamentary_records INTEGER,parliamentarians INTEGER,ufs INTEGER,parties INTEGER,parliamentary_houses INTEGER,
      institutional_paid_scaled INTEGER,institutional_contracts INTEGER,institutional_commitments INTEGER,institutional_houses INTEGER,
      first_observed_at TEXT,last_observed_at TEXT,PRIMARY KEY(revision_id,supplier_id,year)
    ) STRICT;
    CREATE INDEX supplier_global_parliamentary ON supplier_global_yearly(revision_id,year,parliamentary_net_scaled DESC,supplier_id);
    CREATE INDEX supplier_global_institutional ON supplier_global_yearly(revision_id,year,institutional_paid_scaled DESC,supplier_id);
    CREATE TABLE supplier_global_house_yearly (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),parliamentary_net_scaled INTEGER,parliamentary_records INTEGER,
      parliamentarians INTEGER,ufs INTEGER,parties INTEGER,institutional_paid_scaled INTEGER,institutional_contracts INTEGER,institutional_commitments INTEGER,
      first_observed_at TEXT,last_observed_at TEXT,PRIMARY KEY(revision_id,supplier_id,year,institution)
    ) STRICT;
    CREATE INDEX supplier_global_house_parliamentary ON supplier_global_house_yearly(revision_id,year,institution,parliamentary_net_scaled DESC,supplier_id);
    CREATE INDEX supplier_global_house_institutional ON supplier_global_house_yearly(revision_id,year,institution,institutional_paid_scaled DESC,supplier_id);
  ` },
  { version: 36, sql: `
    CREATE INDEX IF NOT EXISTS expense_supplier_links_supplier_lookup ON expense_supplier_links(supplier_id,match_status,batch_id,record_key);
    CREATE INDEX IF NOT EXISTS expenses_market_lookup ON expenses(year,source,batch_id,record_key,external_id);
    CREATE INDEX IF NOT EXISTS supplier_names_search_lookup ON supplier_names(search_name,supplier_id);
  ` },
  { version: 37, sql: `
    CREATE TABLE supplier_parliamentary_clients (
      revision_id TEXT NOT NULL REFERENCES supplier_aggregate_revisions(id),supplier_id TEXT NOT NULL REFERENCES suppliers(id),year INTEGER NOT NULL,
      institution TEXT NOT NULL CHECK(institution IN ('CAMARA','SENADO')),client_source TEXT NOT NULL,client_external_id TEXT NOT NULL,
      net_value_scaled INTEGER NOT NULL,value_scale INTEGER NOT NULL DEFAULT 2,records INTEGER NOT NULL,
      PRIMARY KEY(revision_id,supplier_id,year,institution,client_source,client_external_id)
    ) STRICT;
    CREATE INDEX supplier_parliamentary_clients_lookup ON supplier_parliamentary_clients(revision_id,year,institution,supplier_id,net_value_scaled DESC);
  ` },

];
