CREATE SCHEMA IF NOT EXISTS civica_poc;
CREATE TABLE IF NOT EXISTS civica_poc.proposition_batches (
  id text PRIMARY KEY, source text NOT NULL, scope text NOT NULL, published_at timestamptz NOT NULL,
  proposal_count integer NOT NULL, author_count integer NOT NULL, theme_count integer NOT NULL, active boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS civica_poc.proposals (
  batch_id text NOT NULL REFERENCES civica_poc.proposition_batches(id), source text NOT NULL, external_id text NOT NULL,
  type text NOT NULL, number bigint, year integer, functional_group text, label text, summary text,
  presented_at timestamptz, status text, principal_id text, payload jsonb, raw_id text,
  search_vector tsvector,
  PRIMARY KEY(batch_id, external_id)
);
CREATE TABLE IF NOT EXISTS civica_poc.proposal_authors (
  batch_id text NOT NULL, source text NOT NULL, proposal_id text NOT NULL, author_key text NOT NULL,
  person_external_id text, name text NOT NULL, party text, uf text,
  PRIMARY KEY(batch_id, proposal_id, author_key), FOREIGN KEY(batch_id, proposal_id) REFERENCES civica_poc.proposals(batch_id, external_id)
);
CREATE TABLE IF NOT EXISTS civica_poc.proposal_themes (
  batch_id text NOT NULL, source text NOT NULL, proposal_id text NOT NULL, theme_key text NOT NULL, label text NOT NULL,
  PRIMARY KEY(batch_id, proposal_id, theme_key), FOREIGN KEY(batch_id, proposal_id) REFERENCES civica_poc.proposals(batch_id, external_id)
);
CREATE TABLE IF NOT EXISTS civica_poc.active_publications (source text PRIMARY KEY, scope text NOT NULL, batch_id text NOT NULL REFERENCES civica_poc.proposition_batches(id));
CREATE INDEX IF NOT EXISTS proposals_identifier_idx ON civica_poc.proposals(source,type,number,year);
CREATE INDEX IF NOT EXISTS proposals_filters_idx ON civica_poc.proposals(source,year,functional_group,type);
CREATE INDEX IF NOT EXISTS proposals_search_idx ON civica_poc.proposals USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS authors_lookup_idx ON civica_poc.proposal_authors(source,person_external_id,name);
CREATE INDEX IF NOT EXISTS authors_proposal_idx ON civica_poc.proposal_authors(source,proposal_id);
CREATE INDEX IF NOT EXISTS themes_lookup_idx ON civica_poc.proposal_themes(source,label,proposal_id);
