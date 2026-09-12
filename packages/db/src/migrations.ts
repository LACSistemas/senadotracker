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
];
