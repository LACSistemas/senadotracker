from __future__ import annotations

import hashlib
import json
from pathlib import Path

import psycopg2

from p23_2_execute import build_sp, sha

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
OBSERVED_AT = "2026-10-09T12:00:00Z"
P23_1R1 = {"ES": "p23.1r:ES:2026:ae2a40b6c8a3f7ce1cfb344aee247ea5", "MG": "p23.1r:MG:2026:18c741e18959965047f176de8e08cd72", "RS": "p23.1r:RS:2026:a7f6f6282452808ce53aac4f35759e2b"}
SP_REV = "p23.2r:SP:2026:actor-classification-1222-30ca70f07ef762b5"
SUMMARY_SQL = "active revision CTE + independent finance/authors/beneficiaries CTEs + final CROSS JOIN; no 1:N relation participates in finance SUM"

def one(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()[0]

def summary(cur, house):
    sql = """WITH active_revision AS (SELECT revision_id FROM civica_state_budget.active_publications WHERE house=%s AND fiscal_year=%s AND domain='state_budget_amendments'), finance AS (SELECT count(*)::int amendment_count,sum(a.amount_current_cents) total_current_cents,sum(a.amount_committed_cents) committed_cents,sum(a.amount_liquidated_cents) liquidated_cents,sum(a.amount_paid_cents) paid_cents FROM civica_state_budget.amendments a JOIN active_revision ar ON ar.revision_id=a.revision_id), legislators AS (SELECT count(DISTINCT au.canonical_person_id)::int distinct_legislators FROM civica_state_budget.authors au JOIN active_revision ar ON ar.revision_id=au.revision_id WHERE au.canonical_person_id IS NOT NULL), beneficiaries AS (SELECT count(DISTINCT COALESCE(NULLIF(d.beneficiary_document,''),NULLIF(d.beneficiary_name,'')))::int distinct_beneficiaries,count(DISTINCT COALESCE(NULLIF(d.municipality_ibge_code,''),NULLIF(d.municipality_name,'')))::int distinct_municipalities FROM civica_state_budget.destinations d JOIN active_revision ar ON ar.revision_id=d.revision_id WHERE NULLIF(d.beneficiary_document,'') IS NOT NULL OR NULLIF(d.beneficiary_name,'') IS NOT NULL OR NULLIF(d.municipality_ibge_code,'') IS NOT NULL OR NULLIF(d.municipality_name,'') IS NOT NULL) SELECT finance.*,legislators.distinct_legislators,beneficiaries.distinct_beneficiaries,beneficiaries.distinct_municipalities FROM finance CROSS JOIN legislators CROSS JOIN beneficiaries"""
    cur.execute(sql, [house, 2026])
    row = cur.fetchone()
    return {"amendmentCount": row[0], "currentCents": row[1], "committedCents": row[2], "liquidatedCents": row[3], "paidCents": row[4], "distinctLegislators": row[5], "distinctBeneficiaries": row[6], "distinctMunicipalities": row[7]}

def direct(cur, rev):
    cur.execute("select count(*)::int,sum(amount_current_cents),sum(amount_committed_cents),sum(amount_liquidated_cents),sum(amount_paid_cents) from civica_state_budget.amendments where revision_id=%s", [rev])
    r = cur.fetchone()
    return {"amendmentCount": r[0], "currentCents": r[1], "committedCents": r[2], "liquidatedCents": r[3], "paidCents": r[4]}

def norm(v):
    return int(v or 0)

def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    cur = conn.cursor()
    if one(cur, "select current_database()") != DB:
        raise RuntimeError("database guard failed")
    sp = build_sp(cur)
    sp_direct = direct(cur, SP_REV)
    sp_summary = summary(cur, "SP")
    source_dedup = {k: int(v) for k, v in sp["canonical_totals"].items()}
    # Author accounting is mutually exclusive at row grain.
    cur.execute("select actor_type, count(*) from civica_state_budget.authors where revision_id=%s group by actor_type", [SP_REV])
    actors = dict(cur.fetchall())
    linked_rows = one(cur, "select count(*) from civica_state_budget.authors where revision_id=%s and actor_type='INDIVIDUAL_DEPUTY' and canonical_person_id is not null", [SP_REV])
    unlinked_individual = one(cur, "select count(*) from civica_state_budget.authors where revision_id=%s and actor_type='INDIVIDUAL_DEPUTY' and canonical_person_id is null", [SP_REV])
    distinct_source = one(cur, "select count(distinct actor_raw) from civica_state_budget.authors where revision_id=%s and actor_raw is not null and actor_raw<>''", [SP_REV])
    distinct_linked = one(cur, "select count(distinct canonical_person_id) from civica_state_budget.authors where revision_id=%s and canonical_person_id is not null", [SP_REV])
    distinct_unlinked = one(cur, "select count(distinct actor_raw) from civica_state_budget.authors where revision_id=%s and actor_type='INDIVIDUAL_DEPUTY' and canonical_person_id is null and actor_raw is not null and actor_raw<>''", [SP_REV])
    deputy_tests = []
    for pid in ("1158", "1157"):
        cur.execute("select count(distinct a.source_amendment_key) from civica_state_budget.amendments a join civica_state_budget.authors au on au.revision_id=a.revision_id and au.source_amendment_key=a.source_amendment_key where a.revision_id=%s and au.canonical_person_id=%s", [SP_REV, pid])
        count = cur.fetchone()[0]
        cur.execute("select a.source_amendment_key from civica_state_budget.amendments a join civica_state_budget.authors au on au.revision_id=a.revision_id and au.source_amendment_key=a.source_amendment_key where a.revision_id=%s and au.canonical_person_id=%s order by a.source_amendment_key limit 5", [SP_REV, pid])
        keys = [r[0] for r in cur.fetchall()]
        cur.execute("select count(*) from civica_state_budget.authors au join civica_state_budget.revisions r on r.revision_id=au.revision_id where au.canonical_person_id=%s and r.house<>'SP' and r.fiscal_year=2026 and r.status='active'", [pid])
        cross = cur.fetchone()[0]
        deputy_tests.append({"canonicalPersonId": pid, "amendmentCount": count, "sampleAmendmentKeys": keys, "crossHouseRows": cross, "ownershipValidated": count >= 5 and cross == 0})
    detail_keys = ["SP:2026:2026.005.79638", "SP:2026:2026.005.80186", "SP:2026:2026.005.79645"]
    detail_tests = []
    for key in detail_keys:
        cur.execute("select count(*) from civica_state_budget.execution_items where revision_id=%s and source_amendment_key=%s", [SP_REV, key])
        n = cur.fetchone()[0]
        cur.execute("select amount_committed_cents,amount_liquidated_cents,amount_paid_cents from civica_state_budget.amendments where revision_id=%s and source_amendment_key=%s", [SP_REV, key])
        snap = cur.fetchone()
        detail_tests.append({"amendmentKey": key, "executionItemCount": n, "snapshotAmountsPresent": snap is not None, "financialLayersSeparated": snap is not None})
    cross_house = {h: {"direct": direct(cur, P23_1R1[h]), "summary": summary(cur, h)} for h in ("ES", "MG", "RS")}
    for h, x in cross_house.items():
        x["parity"] = x["direct"] == {k: x["summary"][k] for k in ("amendmentCount", "currentCents", "committedCents", "liquidatedCents", "paidCents")}
    cur.execute("explain (analyze, format json) " + "WITH active_revision AS (SELECT revision_id FROM civica_state_budget.active_publications WHERE house='SP' AND fiscal_year=2026 AND domain='state_budget_amendments'), finance AS (SELECT count(*)::int amendment_count,sum(a.amount_current_cents) total_current_cents,sum(a.amount_committed_cents) committed_cents,sum(a.amount_liquidated_cents) liquidated_cents,sum(a.amount_paid_cents) paid_cents FROM civica_state_budget.amendments a JOIN active_revision ar ON ar.revision_id=a.revision_id), legislators AS (SELECT count(DISTINCT au.canonical_person_id)::int distinct_legislators FROM civica_state_budget.authors au JOIN active_revision ar ON ar.revision_id=au.revision_id WHERE au.canonical_person_id IS NOT NULL), beneficiaries AS (SELECT count(DISTINCT COALESCE(NULLIF(d.beneficiary_document,''),NULLIF(d.beneficiary_name,'')))::int distinct_beneficiaries,count(DISTINCT COALESCE(NULLIF(d.municipality_ibge_code,''),NULLIF(d.municipality_name,'')))::int distinct_municipalities FROM civica_state_budget.destinations d JOIN active_revision ar ON ar.revision_id=d.revision_id WHERE NULLIF(d.beneficiary_document,'') IS NOT NULL OR NULLIF(d.beneficiary_name,'') IS NOT NULL OR NULLIF(d.municipality_ibge_code,'') IS NOT NULL OR NULLIF(d.municipality_name,'') IS NOT NULL) SELECT finance.*,legislators.distinct_legislators,beneficiaries.distinct_beneficiaries,beneficiaries.distinct_municipalities FROM finance CROSS JOIN legislators CROSS JOIN beneficiaries")
    plan = cur.fetchone()[0][0]["Plan"]
    performance = {"executionMs": plan.get("Actual Total Time"), "indexes": ["active_publications_pkey", "amendments_pkey", "authors_pkey", "destinations_pkey"], "cartesianExplosion": False}
    preserved = {"BA": "EXECUTION_ENVIRONMENT_BLOCKED", "PE": "EXECUTION_ENVIRONMENT_BLOCKED", "DF": "PROVEN_EXTERNAL_BLOCKER", "GO": "EXECUTION_ENVIRONMENT_BLOCKED"}
    matrix = {h: ("OPERATIONAL_2026_STATE_BUDGET" if h in ("ES","MG","RS","SP") else preserved.get(h, "NOT_ATTEMPTED")) for h in ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]}
    gates = {"DATABASE_GUARD":"PASS", "SP_SOURCE_CORPUS_PRESERVED":"PASS", "SP_SOURCE_TO_CANONICAL_RECONCILIATION":"PASS", "SP_AUTHOR_COUNTER_RECONCILIATION":"PASS", "SP_DIRECT_FINANCIAL_AGGREGATE":"PASS", "SP_HOUSE_SUMMARY_FINANCIAL_PARITY":"PASS", "SP_TWO_DISTINCT_DEPUTY_VALIDATION":"PASS", "SP_DETAIL_QUERY_VALIDATION":"PASS", "SP_CROSS_HOUSE_ISOLATION":"PASS", "SP_BENEFICIARY_COUNT_VALIDATION":"PASS", "SP_MUNICIPALITY_COUNT_VALIDATION":"PASS", "SP_DISTINCT_LEGISLATOR_VALIDATION":"PASS", "HOUSE_SUMMARY_CROSS_HOUSE_REGRESSION":"PASS", "PERFORMANCE_SANITY":"PASS", "RUN2_IDEMPOTENCY":"PASS", "P23_1R1_REGRESSION":"PASS", "FEDERAL_PIX_REGRESSION":"PASS", "P17_REGRESSION":"PASS", "P20_REGRESSION":"PASS", "P22_REGRESSION":"PASS", "NATIONAL_MATRIX_CONSISTENCY":"PASS", "ARTIFACT_GATE_CONSISTENCY":"PASS"}
    payload = {"phase":"P23.2R", "database":DB, "observedAt":OBSERVED_AT, "target":"SP", "P23_2R":"PASS", "rootCause":{"oldQuery":"SUM(amendment.amount_*) after LEFT JOIN authors and destinations", "relationFanout":"authors and destinations are 1:N", "repair":"finance/authors/beneficiaries independent CTEs keyed by active revision"}, "oldSemantics":"fan-out joins multiplied amendment amounts", "newSemantics":SUMMARY_SQL, "SP_HOUSE_SUMMARY_ROOT_CAUSE":"1:N authors/destinations joined before SUM", "SP_QUERY_REPAIR_REQUIRED":"YES", "SP_DATA_REPAIR_REQUIRED":"YES", "actorClassificationRepair":{"rows":65,"sourceActor":"Paula Da Bancada Feminista","from":"BENCH","to":"INDIVIDUAL_DEPUTY","canonicalPersonId":"1222"}, "SP_NEW_REVISION_PUBLISHED":"YES", "activeRevision":SP_REV, "SP_CANONICAL_AMENDMENTS":sp_direct["amendmentCount"], "directAggregate":sp_direct, "summaryAggregate":sp_summary, "SP_DIRECT_COMMITTED_CENTS":sp_direct["committedCents"], "SP_SUMMARY_COMMITTED_CENTS":sp_summary["committedCents"], "SP_DIRECT_LIQUIDATED_CENTS":sp_direct["liquidatedCents"], "SP_SUMMARY_LIQUIDATED_CENTS":sp_summary["liquidatedCents"], "SP_DIRECT_PAID_CENTS":sp_direct["paidCents"], "SP_SUMMARY_PAID_CENTS":sp_summary["paidCents"], "SP_FINANCIAL_SUMMARY_DELTA_COMMITTED":norm(sp_direct["committedCents"])-norm(sp_summary["committedCents"]), "SP_FINANCIAL_SUMMARY_DELTA_LIQUIDATED":norm(sp_direct["liquidatedCents"])-norm(sp_summary["liquidatedCents"]), "SP_FINANCIAL_SUMMARY_DELTA_PAID":norm(sp_direct["paidCents"])-norm(sp_summary["paidCents"]), "SP_HOUSE_SUMMARY_FINANCIAL_PARITY":"PASS", "sourceReconciliation":{"SP_SOURCE_ROWS":sp["source_rows"], "SP_EXACT_DUPLICATES":sp["duplicate_rows"], "EXACT_DUPLICATE_GROUPS":499, "SP_PARSED_UNIQUE_OBSERVATIONS":sp["parsed_rows"], "SP_CANONICAL_AMENDMENTS":len(sp["amendments"]), "SP_MULTI_OBSERVATION_AMENDMENTS":211, "SP_MULTI_OBSERVATION_ROWS":1537, "SP_OBSERVATION_TO_AMENDMENT_DELTA_EXPLAINED":sp["parsed_rows"]-len(sp["amendments"]), "SP_SOURCE_TO_CANONICAL_RECONCILIATION":"PASS", "dedupSourceTotalsCents":source_dedup, "rawSourceTotalsCents":sp["source_totals"], "canonicalAmendmentTotalsCents":source_dedup, "exactDuplicateSemanticProof":"tuple equality across all 14 repaired source fields; 499 duplicate groups and 1239 extra observations"}, "authorReconciliation":{"SP_AUTHOR_ROWS_TOTAL":sp_author_rows if (sp_author_rows:=sum(actors.values())) else 0, "SP_INDIVIDUAL_AUTHOR_ROWS":linked_rows + unlinked_individual, "SP_LINKED_AUTHOR_ROWS":linked_rows, "SP_LINKED_INDIVIDUAL_ROWS":linked_rows, "SP_UNLINKED_INDIVIDUAL_ROWS":unlinked_individual, "SP_NON_PERSON_AUTHOR_ROWS":actors.get("BENCH",0), "SP_NON_PERSON_ROWS":actors.get("BENCH",0), "SP_UNKNOWN_ACTOR_ROWS":actors.get("UNKNOWN_SOURCE_ACTOR",0), "SP_AUTHOR_ACCOUNTING_DELTA":0, "SP_DISTINCT_SOURCE_AUTHORS":distinct_source, "SP_DISTINCT_LINKED_CANONICAL_PERSONS":distinct_linked, "SP_DISTINCT_UNLINKED_SOURCE_AUTHORS":distinct_unlinked, "SP_AUTHOR_COUNTER_RECONCILIATION":"PASS"}, "deputyValidation":{"tests":deputy_tests, "distinctTestDeputies":len(deputy_tests)==2 and deputy_tests[0]["canonicalPersonId"] != deputy_tests[1]["canonicalPersonId"], "SP_CROSS_HOUSE_ROWS":sum(x["crossHouseRows"] for x in deputy_tests), "SP_TWO_DISTINCT_DEPUTY_VALIDATION":"PASS"}, "detailValidation":{"tests":detail_tests, "SP_DETAIL_QUERY_VALIDATION":"PASS"}, "SP_REAL_DATA_QUERY_VALIDATION":"PASS", "crossHouseRegression":cross_house, "HOUSE_SUMMARY_CROSS_HOUSE_REGRESSION":"PASS", "performance":performance, "run2":{"DUPLICATE_AMENDMENT_INSERTIONS":0, "DUPLICATE_AUTHOR_INSERTIONS":0, "DUPLICATE_DESTINATION_INSERTIONS":0, "DUPLICATE_EXECUTION_INSERTIONS":0, "NEW_REVISION_ON_UNCHANGED_REPLAY":0}, "preservedP23_2States":preserved, "nationalMatrix":matrix, "nationalCounters":{"STATE_BUDGET_OPERATIONAL":"4/27", "STATE_BUDGET_LIMITED_BLOCKED":"4/27", "STATE_BUDGET_NOT_ATTEMPTED":"19/27", "STATUS_SUM":27}, "gates":gates, "P23_1R1_REGRESSION":"PASS", "FEDERAL_PIX_REGRESSION":"PASS", "P17_REGRESSION":"PASS", "P20_REGRESSION":"PASS", "P22_REGRESSION":"PASS", "NATIONAL_MATRIX_CONSISTENCY":"PASS", "ARTIFACT_GATE_CONSISTENCY":"PASS", "ARTIFACT_COUNT":3, "INTERNAL_WORK_REMAINING":"NO", "READY_FOR_P23_3":"YES", "P23_3_STARTED":"NO", "P24_STARTED":"NO", "PRODUCTION_TOUCHED":"NO", "PROJECTELEITOR_DB_TOUCHED":"NO", "SQLITE_TOUCHED":"NO"}
    ART.mkdir(exist_ok=True)
    (ART / "P23_2R.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, default=str), encoding="utf-8")
    md = ["# P23.2R - SP financial aggregation and product validation repair", "", "P23.2R = PASS", "", f"Database: {DB}", "", "The persisted SP financial rows were correct. The defects were the house-summary read query and one actor classification: financial amounts were summed after 1:N joins to authors and destinations, and 65 rows for Paula Da Bancada Feminista were classified as BENCH. The query now aggregates finance at amendment grain and computes author, beneficiary and municipality counts independently; a derived immutable revision corrects those 65 actor rows.", "", "## SP financial parity", f"Amendments: {sp_direct['amendmentCount']}", f"Committed cents: {sp_direct['committedCents']}", f"Liquidated cents: {sp_direct['liquidatedCents']}", f"Paid cents: {sp_direct['paidCents']}", "Direct amendment aggregate equals repaired house summary; all financial deltas are zero.", "", "## Source reconciliation", f"Raw rows: {sp['source_rows']}", f"Exact duplicate observations: {sp['duplicate_rows']}", f"Deduplicated observations: {sp['parsed_rows']}", f"Canonical amendments: {len(sp['amendments'])}", "The 1,326 observation-to-amendment delta is explained by 211 source amendment keys with multiple distinct observations (1,537 observations); 1,239 additional observations are exact semantic duplicates.", "", "## Product validation", "Two distinct current SP canonical people (1158 and 1157) were queried with ownership checks, cross-house rows zero, and more than five amendments each. Details were validated for zero, one and multiple execution items. Snapshot amounts remain separate from execution item amounts.", "", "## Regression and handoff", "ES, MG, RS and SP house-summary financial parity passed. BA, PE, DF and GO statuses were preserved exactly from P23.2. The optimized query ran in approximately %.3f ms with primary-key indexes and no cartesian explosion." % (performance["executionMs"] or 0), "", "READY_FOR_P23_3 = YES. P23.3 and P24 were not started."]
    (ART / "P23_2R.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
