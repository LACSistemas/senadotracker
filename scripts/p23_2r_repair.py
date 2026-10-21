import hashlib
import json
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import Json

DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
OLD = "p23.2:SP:2026:7ec3dd63dea8bb8db1041157a46c8267"
NEW = "p23.2r:SP:2026:actor-classification-1222-" + hashlib.sha256(OLD.encode()).hexdigest()[:16]

def main():
    c = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    c.autocommit = False
    cur = c.cursor()
    cur.execute("select current_database()")
    if cur.fetchone()[0] != DB:
        raise RuntimeError("database guard failed")
    cur.execute("select revision_id from civica_state_budget.active_publications where house='SP' and fiscal_year=2026 and domain='state_budget_amendments'")
    if cur.fetchone()[0] != OLD:
        raise RuntimeError("unexpected active SP revision")
    cur.execute("select count(*) from civica_state_budget.authors where revision_id=%s and actor_type='BENCH' and canonical_person_id='1222'", [OLD])
    affected = cur.fetchone()[0]
    if affected != 65:
        raise RuntimeError(f"expected 65 Paula rows, got {affected}")
    cur.execute("select revision_id from civica_state_budget.revisions where revision_id=%s", [NEW])
    exists = cur.fetchone() is not None
    if not exists:
        cur.execute("select provider,semantic_hash,data_through,source_updated_at,raw_hashes,coverage,created_at from civica_state_budget.revisions where revision_id=%s", [OLD])
        provider, old_sem, data_through, source_updated_at, raw_hashes, coverage, created_at = cur.fetchone()
        new_sem = hashlib.sha256((old_sem + ":actor_type:INDIVIDUAL_DEPUTY:1222").encode()).hexdigest()
        cur.execute("insert into civica_state_budget.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,source_updated_at,raw_hashes,coverage,created_at,activated_at) values(%s,'SP',2026,%s,'active',%s,%s,%s,%s,%s,%s,%s)", [NEW, provider, new_sem, data_through, source_updated_at, Json(raw_hashes), Json(dict(coverage, actorClassificationRepair={"rows": 65, "from": "BENCH", "to": "INDIVIDUAL_DEPUTY", "canonicalPersonId": "1222"})), NOW, NOW])
        cur.execute("insert into civica_state_budget.amendments select %s as revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance from civica_state_budget.amendments where revision_id=%s", [NEW, OLD])
        cur.execute("insert into civica_state_budget.authors select %s as revision_id,house,fiscal_year,source_amendment_key,author_key,case when actor_type='BENCH' and canonical_person_id='1222' then 'INDIVIDUAL_DEPUTY' else actor_type end,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method from civica_state_budget.authors where revision_id=%s", [NEW, OLD])
        cur.execute("insert into civica_state_budget.destinations select %s as revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality from civica_state_budget.destinations where revision_id=%s", [NEW, OLD])
        cur.execute("insert into civica_state_budget.execution_items select %s as revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance from civica_state_budget.execution_items where revision_id=%s", [NEW, OLD])
        cur.execute("update civica_state_budget.active_publications set revision_id=%s,activated_at=%s where house='SP' and fiscal_year=2026 and domain='state_budget_amendments'", [NEW, NOW])
        cur.execute("update civica_state_budget.revisions set status='rejected' where revision_id=%s", [OLD])
    c.commit()
    cur.execute("select count(*) from civica_state_budget.authors where revision_id=%s and actor_type='INDIVIDUAL_DEPUTY' and canonical_person_id='1222'", [NEW])
    corrected = cur.fetchone()[0]
    cur.execute("select count(*) from civica_state_budget.amendments where revision_id=%s", [NEW]); amendments = cur.fetchone()[0]
    cur.execute("select count(*) from civica_state_budget.execution_items where revision_id=%s", [NEW]); execution = cur.fetchone()[0]
    print(json.dumps({"oldRevision": OLD, "newRevision": NEW, "newRevisionCreated": not exists, "affectedRows": affected, "correctedRows": corrected, "amendments": amendments, "executionItems": execution}, indent=2))
    c.close()

if __name__ == "__main__":
    main()
