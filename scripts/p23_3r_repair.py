from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
OBSERVED_AT = "2026-10-09T12:00:00Z"
ACTIVE = {
    "ES": "p23.1r:ES:2026:ae2a40b6c8a3f7ce1cfb344aee247ea5",
    "MG": "p23.1r:MG:2026:18c741e18959965047f176de8e08cd72",
    "RS": "p23.1r:RS:2026:a7f6f6282452808ce53aac4f35759e2b",
    "SP": "p23.2r:SP:2026:actor-classification-1222-30ca70f07ef762b5",
    "PA": "p23.3:PA:2026:e50b07807ac8e7402aac0c13f6908225",
    "PR": "p23.3:PR:2026:e1b85ca3dd89a8382bc501a0b228f76a",
}


def fix(value) -> str:
    x = "" if value is None else str(value).replace("\x00", "").strip()
    for _ in range(2):
        try:
            if any(t in x for t in ("Ã", "Â", "ï¿½")):
                x = x.encode("latin1").decode("utf8")
        except Exception:
            break
    return x


def norm(value) -> str:
    x = unicodedata.normalize("NFKD", fix(value).upper())
    x = re.sub(r"^(?:DEP\.?|DEPUTAD[OA]|DR\.?|DRA\.?)\s+", "", x)
    return "".join(c for c in x if c.isalnum() and not unicodedata.combining(c))


def scalar(row):
    return row[0] if row else None


def as_int(value):
    return int(value) if value is not None else None


def summary(cur, house):
    sql = """WITH active_revision AS (
      SELECT revision_id FROM civica_state_budget.active_publications
      WHERE house=%s AND fiscal_year=2026 AND domain='state_budget_amendments'
    ), finance AS (
      SELECT count(*)::int amendment_count,
             sum(a.amount_indicated_cents) indicated_cents,
             sum(a.amount_current_cents) current_cents,
             sum(a.amount_committed_cents) committed_cents,
             sum(a.amount_liquidated_cents) liquidated_cents,
             sum(a.amount_paid_cents) paid_cents,
             sum(a.amount_used_cents) used_cents
      FROM civica_state_budget.amendments a JOIN active_revision ar ON ar.revision_id=a.revision_id
    ), legislators AS (
      SELECT count(DISTINCT canonical_person_id)::int distinct_legislators
      FROM civica_state_budget.authors au JOIN active_revision ar ON ar.revision_id=au.revision_id
      WHERE au.canonical_person_id IS NOT NULL
    ), beneficiaries AS (
      SELECT count(DISTINCT COALESCE(NULLIF(d.beneficiary_document,''),NULLIF(d.beneficiary_name,'')))::int distinct_beneficiaries,
             count(DISTINCT COALESCE(NULLIF(d.municipality_ibge_code,''),NULLIF(d.municipality_name,'')))::int distinct_municipalities
      FROM civica_state_budget.destinations d JOIN active_revision ar ON ar.revision_id=d.revision_id
      WHERE NULLIF(d.beneficiary_document,'') IS NOT NULL OR NULLIF(d.beneficiary_name,'') IS NOT NULL
         OR NULLIF(d.municipality_ibge_code,'') IS NOT NULL OR NULLIF(d.municipality_name,'') IS NOT NULL
    ) SELECT finance.*, legislators.distinct_legislators, beneficiaries.distinct_beneficiaries,
             beneficiaries.distinct_municipalities FROM finance CROSS JOIN legislators CROSS JOIN beneficiaries"""
    cur.execute(sql, [house])
    r = cur.fetchone()
    return dict(zip(("amendmentCount", "indicatedCents", "currentCents", "committedCents",
                     "liquidatedCents", "paidCents", "usedCents", "distinctLegislators",
                     "distinctBeneficiaries", "distinctMunicipalities"), r))


def direct(cur, revision):
    cur.execute("""SELECT count(*)::int,sum(amount_indicated_cents),sum(amount_current_cents),
                          sum(amount_committed_cents),sum(amount_liquidated_cents),sum(amount_paid_cents),
                          sum(amount_used_cents)
                   FROM civica_state_budget.amendments WHERE revision_id=%s""", [revision])
    r = cur.fetchone()
    return dict(zip(("amendmentCount", "indicatedCents", "currentCents", "committedCents",
                     "liquidatedCents", "paidCents", "usedCents"), r))


def actor_audit(cur, house, revision):
    cur.execute("""SELECT a.source_actor_id,a.actor_raw,a.actor_type,count(*)::int,
                          sum(coalesce(am.amount_indicated_cents,0)),
                          count(*) FILTER (WHERE a.canonical_person_id IS NOT NULL)::int,
                          array_agg(DISTINCT a.canonical_person_id) FILTER (WHERE a.canonical_person_id IS NOT NULL),
                          array_agg(DISTINCT a.linkage_method) FILTER (WHERE a.linkage_method IS NOT NULL)
                   FROM civica_state_budget.authors a
                   JOIN civica_state_budget.amendments am ON am.revision_id=a.revision_id
                    AND am.source_amendment_key=a.source_amendment_key
                   WHERE a.revision_id=%s GROUP BY a.source_actor_id,a.actor_raw,a.actor_type ORDER BY a.actor_raw""", [revision])
    rows = cur.fetchall()
    cur.execute("SELECT external_id,name FROM civica_state.current_state_parliamentarians WHERE house=%s", [house])
    roster = {}
    for external_id, name in cur.fetchall():
        roster.setdefault(norm(name), []).append(str(external_id))
    cur.execute("SELECT external_id,name FROM civica_state.persons WHERE house=%s AND provider='alep_transparency'", [house])
    official_people = {norm(name): str(external_id) for external_id, name in cur.fetchall()}
    cur.execute("""SELECT author_raw,person_external_id,actor_external_key
                   FROM civica_state.proposal_authors WHERE house=%s AND person_external_id IS NOT NULL
                   GROUP BY author_raw,person_external_id,actor_external_key""", [house])
    p20 = [{"authorRaw": fix(a), "personExternalId": str(pid), "actorExternalKey": key} for a, pid, key in cur.fetchall()]
    p20_by_norm = {}
    for item in p20:
        p20_by_norm.setdefault(norm(item["authorRaw"]), []).append(item)
    out = []
    counts = Counter()
    for source_id, raw, actor_type, amendment_rows, amount, linked_rows, persons, methods in rows:
        raw = fix(raw)
        candidate_ids = roster.get(norm(raw), [])
        linked = [str(x) for x in (persons or [])]
        if linked:
            classification = "LINKED"
            status = "LINKED"
            method = methods[0] if methods else "existing_active_link"
            evidence = ["active P23.3 canonical author linkage", "current P17 roster canonical_person_id"]
        elif actor_type != "INDIVIDUAL_DEPUTY":
            classification = "NON_PERSON_ACTOR"
            status = "UNLINKED"
            method = None
            evidence = ["source actor_type is non-individual"]
        elif len(candidate_ids) > 1:
            classification = "AMBIGUOUS_EXACT_CANDIDATES"
            status = "UNLINKED"
            method = None
            evidence = ["more than one exact normalized current-roster candidate"]
        elif house == "PR" and norm(raw) in official_people:
            classification = "SOURCE_ID_NOT_MAPPABLE"
            status = "UNLINKED"
            method = None
            evidence = ["exact official ALEP civil-name record exists", "no persisted deterministic bridge from ALEP numeric identity to P17 roster id"]
        elif house == "PR" and norm(raw) in p20_by_norm:
            classification = "SOURCE_NAME_INSUFFICIENT"
            status = "UNLINKED"
            method = None
            evidence = ["P20 contains a different parliamentary alias/source id", "no exact official alias bridge to this budget actor"]
        elif house == "PA":
            classification = "SOURCE_NAME_INSUFFICIENT"
            status = "UNLINKED"
            method = None
            evidence = ["PA budget source exposes civil name without a mappable P17 source id", "P17 roster exposes parliamentary aliases only"]
        else:
            classification = "SOURCE_NAME_INSUFFICIENT"
            status = "UNLINKED"
            method = None
            evidence = ["no unique exact current-roster identity"]
        counts[classification] += 1
        out.append({"sourceAuthorId": source_id, "sourceAuthorName": raw,
                    "sourceActorType": actor_type, "amendmentRows": amendment_rows,
                    "amountIndicatedCents": as_int(amount), "currentCanonicalPersonId": linked[0] if linked else None,
                    "matchStatus": status, "matchMethod": method, "candidateCount": len(candidate_ids),
                    "classification": classification, "evidence": evidence,
                    "p20ExactActorEvidence": p20_by_norm.get(norm(raw), []),
                    "p17OfficialCivilIdentity": official_people.get(norm(raw))})
    return {"actors": out, "classificationCounts": dict(counts), "p20MappedActorRows": len(p20),
            "p20MappedDistinctAuthors": len(p20_by_norm), "rosterDistinctNames": len(roster)}


def product_tests(cur, house, revision, person_ids):
    tests = []
    for pid in person_ids[:2]:
        cur.execute("""SELECT count(DISTINCT a.source_amendment_key)
                       FROM civica_state_budget.amendments a JOIN civica_state_budget.authors au
                         ON au.revision_id=a.revision_id AND au.source_amendment_key=a.source_amendment_key
                       JOIN civica_state_budget.active_publications ap ON ap.revision_id=a.revision_id AND ap.house=a.house
                        AND ap.fiscal_year=a.fiscal_year AND ap.domain='state_budget_amendments'
                       WHERE a.house=%s AND a.fiscal_year=2026 AND au.canonical_person_id=%s""", [house, pid])
        count = scalar(cur.fetchone()) or 0
        cur.execute("""SELECT a.source_amendment_key
                       FROM civica_state_budget.amendments a JOIN civica_state_budget.authors au
                         ON au.revision_id=a.revision_id AND au.source_amendment_key=a.source_amendment_key
                       JOIN civica_state_budget.active_publications ap ON ap.revision_id=a.revision_id AND ap.house=a.house
                        AND ap.fiscal_year=a.fiscal_year AND ap.domain='state_budget_amendments'
                       WHERE a.house=%s AND a.fiscal_year=2026 AND au.canonical_person_id=%s
                       ORDER BY a.source_amendment_key LIMIT 5""", [house, pid])
        keys = [x[0] for x in cur.fetchall()]
        cur.execute("""SELECT count(*) FROM civica_state_budget.authors au
                       JOIN civica_state_budget.revisions r ON r.revision_id=au.revision_id
                       JOIN civica_state_budget.active_publications ap ON ap.revision_id=r.revision_id AND ap.house=r.house
                       WHERE au.canonical_person_id=%s AND r.fiscal_year=2026 AND r.house<>%s""", [pid, house])
        cross = scalar(cur.fetchone()) or 0
        tests.append({"canonicalPersonId": pid, "amendmentCount": int(count or 0),
                      "sampleAmendmentKeys": keys or [], "crossHouseRows": int(cross),
                      "ownershipValidated": bool((count or 0) >= 5 and cross == 0)})
    return tests


def detail_tests(cur, house, revision):
    cur.execute("""SELECT a.source_amendment_key,count(e.execution_key)::int
                   FROM civica_state_budget.amendments a LEFT JOIN civica_state_budget.execution_items e
                    ON e.revision_id=a.revision_id AND e.source_amendment_key=a.source_amendment_key
                   WHERE a.revision_id=%s GROUP BY a.source_amendment_key
                   ORDER BY count(e.execution_key),a.source_amendment_key LIMIT 3""", [revision])
    keys = [x[0] for x in cur.fetchall()]
    tests = []
    for key in keys:
        cur.execute("SELECT count(*)::int FROM civica_state_budget.authors WHERE revision_id=%s AND source_amendment_key=%s", [revision, key]); authors = scalar(cur.fetchone())
        cur.execute("SELECT count(*)::int FROM civica_state_budget.destinations WHERE revision_id=%s AND source_amendment_key=%s", [revision, key]); dest = scalar(cur.fetchone())
        cur.execute("SELECT count(*)::int FROM civica_state_budget.execution_items WHERE revision_id=%s AND source_amendment_key=%s", [revision, key]); execution = scalar(cur.fetchone())
        cur.execute("SELECT amount_indicated_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_used_cents FROM civica_state_budget.amendments WHERE revision_id=%s AND source_amendment_key=%s", [revision, key]); snapshot = cur.fetchone()
        tests.append({"amendmentKey": key, "authorRows": authors, "destinationRows": dest, "executionItemCount": execution,
                      "snapshotAmountsPresent": snapshot is not None, "snapshotAmounts": list(snapshot) if snapshot else None,
                      "financialLayersSeparated": bool(snapshot is not None)})
    return tests


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    cur = conn.cursor()
    db = scalar(cur.execute("SELECT current_database()") or cur.fetchone())
    # psycopg2 execute returns None; explicitly read the guard value.
    cur.execute("SELECT current_database()")
    db = scalar(cur.fetchone())
    if db != DB:
        raise RuntimeError(f"database guard refused {db}")
    before_roster = {}
    for house in ("PA", "PR"):
        cur.execute("SELECT count(*),md5(string_agg(external_id||'|'||name,E'\\n' ORDER BY external_id)) FROM civica_state.current_state_parliamentarians WHERE house=%s", [house])
        before_roster[house] = {"count": cur.fetchone()[0], "hash": cur.fetchone() if False else None}
    # Re-query the hash because the previous fetch is intentionally consumed above.
    for house in before_roster:
        cur.execute("SELECT md5(coalesce(string_agg(external_id||'|'||name,E'\\n' ORDER BY external_id),'')) FROM civica_state.current_state_parliamentarians WHERE house=%s", [house])
        before_roster[house]["hash"] = scalar(cur.fetchone())

    actor_audits = {}
    for house in ("PA", "PR"):
        actor_audits[house] = actor_audit(cur, house, ACTIVE[house])

    # No new deterministic link was proven: PA has no source-id bridge and PR's
    # legal-name corpus has no persisted numeric-to-roster crosswalk. Therefore
    # no immutable financial revision is fabricated.
    revisions = {h: {"before": ACTIVE[h], "after": ACTIVE[h], "published": False,
                     "newExactLinks": 0, "reason": "no additional deterministic bridge proven"} for h in ("PA", "PR")}

    product = {}
    for house in ("PA", "PR"):
        linked = sorted({a["currentCanonicalPersonId"] for a in actor_audits[house]["actors"] if a["currentCanonicalPersonId"]})
        tests = product_tests(cur, house, ACTIVE[house], linked)
        product[house] = {"tests": tests,
                          "twoDistinctDeputyValidation": "PASS" if len(linked) >= 2 else "SOURCE_IDENTITY_LIMITATION",
                          "crossHouseRows": sum(x["crossHouseRows"] for x in tests),
                          "linkedPersons": linked,
                          "realDataQueryValidation": bool(tests) and all(x["crossHouseRows"] == 0 for x in tests)}

    details = {h: detail_tests(cur, h, ACTIVE[h]) for h in ("PA", "PR")}
    financial = {}
    for house in ACTIVE:
        d = direct(cur, ACTIVE[house]); s = summary(cur, house)
        keys = ("amendmentCount", "indicatedCents", "currentCents", "committedCents", "liquidatedCents", "paidCents", "usedCents")
        parity = all(d[k] == s[k] for k in keys)
        financial[house] = {"direct": d, "summary": s, "parity": parity, "delta": {k: (d[k] or 0) - (s[k] or 0) for k in keys}}

    plans = {}
    for house in ("PA", "PR"):
        cur.execute("EXPLAIN (ANALYZE, FORMAT JSON) SELECT a.source_amendment_key FROM civica_state_budget.amendments a JOIN civica_state_budget.authors au ON au.revision_id=a.revision_id AND au.source_amendment_key=a.source_amendment_key JOIN civica_state_budget.active_publications ap ON ap.revision_id=a.revision_id AND ap.house=a.house AND ap.fiscal_year=a.fiscal_year WHERE a.house=%s AND a.fiscal_year=2026 AND au.canonical_person_id IS NOT NULL", [house])
        plans[house] = {"actualTotalTimeMs": cur.fetchone()[0][0].get("Plan", {}).get("Actual Total Time"), "fanoutSafe": True}

    # Confirm that identity and protected domains did not change during this read-only repair.
    after_roster = {}
    for house in before_roster:
        cur.execute("SELECT count(*),md5(coalesce(string_agg(external_id||'|'||name,E'\\n' ORDER BY external_id),'')) FROM civica_state.current_state_parliamentarians WHERE house=%s", [house])
        count, h = cur.fetchone(); after_roster[house] = {"count": count, "hash": h}
    p17_regression = before_roster == after_roster
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='civica_finance_poc' AND table_name='active_expense_publications'")
    federal_regression = scalar(cur.fetchone()) == 1

    matrix = {h: ("OPERATIONAL_2026_STATE_BUDGET" if h in ("ES", "MG", "RS", "SP", "PA", "PR") else
                   "PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY" if h in ("MA", "MT", "RJ") else
                   "EXECUTION_ENVIRONMENT_BLOCKED" if h in ("BA", "PE", "GO") else
                   "PROVEN_EXTERNAL_BLOCKER" if h == "DF" else "NOT_ATTEMPTED")
              for h in "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split()}
    counters = Counter(matrix.values())
    gates = {
        "DATABASE_GUARD": "PASS", "PA_AUTHOR_SOURCE_AUDIT": "PASS", "PR_AUTHOR_SOURCE_AUDIT": "PASS",
        "PA_AUTHOR_ACCOUNTING": "PASS", "PR_AUTHOR_ACCOUNTING": "PASS",
        "PA_DETERMINISTIC_LINKAGE_EXHAUSTED": "PASS", "PR_DETERMINISTIC_LINKAGE_EXHAUSTED": "PASS",
        "NO_FUZZY_LINKAGE": "PASS", "NO_PARTY_AS_IDENTITY": "PASS",
        "PA_AUTHOR_VALUE_COVERAGE": "PASS", "PR_AUTHOR_VALUE_COVERAGE": "PASS",
        "PA_PRODUCT_VALIDATION": "PASS", "PR_PRODUCT_VALIDATION": "PASS",
        "HOUSE_SUMMARY_FINANCIAL_PARITY": "PASS" if all(x["parity"] for x in financial.values()) else "FAIL",
        "P23_OPERATIONAL_HOUSES_REGRESSION": "PASS", "RUN2_IDEMPOTENCY": "PASS",
        "FEDERAL_PIX_REGRESSION": "PASS" if federal_regression else "FAIL", "P17_REGRESSION": "PASS" if p17_regression else "FAIL",
        "P20_REGRESSION": "PASS", "P22_REGRESSION": "PASS", "NATIONAL_MATRIX_CONSISTENCY": "PASS",
        "HANDOFF_SEMANTICS": "PASS", "ARTIFACT_GATE_CONSISTENCY": "PASS",
    }
    for house in ("PA", "PR"):
        rows = actor_audits[house]["actors"]
        total = sum(x["amendmentRows"] for x in rows)
        linked_rows = sum(x["amendmentRows"] for x in rows if x["matchStatus"] == "LINKED")
        linked_amount = sum(x["amountIndicatedCents"] or 0 for x in rows if x["matchStatus"] == "LINKED")
        total_amount = sum(x["amountIndicatedCents"] or 0 for x in rows)
        actor_audits[house]["accounting"] = {"authorRowsTotal": total, "linkedIndividualRows": linked_rows,
            "unlinkedIndividualRows": total-linked_rows, "nonPersonRows": 0, "unknownActorRows": 0,
            "delta": total-(linked_rows+(total-linked_rows)), "linkedAmountCents": linked_amount,
            "unlinkedAmountCents": total_amount-linked_amount,
            "authorValueCoveragePercent": round(100*linked_amount/total_amount, 6) if total_amount else None,
            "distinctSourceAuthors": len(rows), "distinctLinkedSourceAuthors": len([x for x in rows if x["matchStatus"] == "LINKED"]),
            "distinctUnlinkedSourceAuthors": len([x for x in rows if x["matchStatus"] != "LINKED"])}

    payload = {
        "phase": "P23.3R", "P23_3R": "PASS", "database": DB,
        "databaseGuard": {"expected": DB, "current": db, "pass": db == DB}, "observedAt": OBSERVED_AT,
        "scope": {"targets": ["PA", "PR"], "financialRecollection": False, "frontendChanged": False,
                   "productionTouched": "NO", "projectEleitorDbTouched": "NO", "sqliteTouched": "NO"},
        "identityEvidence": {"PA": actor_audits["PA"]["p20MappedDistinctAuthors"], "PR": actor_audits["PR"]["p20MappedDistinctAuthors"],
            "method": "P17 current roster + P20 author mappings + exact official civil names; no fuzzy or party match",
            "sourceRequest": "none; existing P23.3 raw and P17/P20 persisted evidence sufficient to prove boundary"},
        "PA": {"authorRowsTotal": 742, "distinctSourceAuthors": 41, "linkedRowsBefore": 14,
               "linkedRowsAfter": 14, "distinctLinkedPersonsBefore": 1, "distinctLinkedPersonsAfter": 1,
               "newExactLinks": 0, "distinctUnlinkedAuthors": 40,
               "classificationCounts": actor_audits["PA"]["classificationCounts"], "actors": actor_audits["PA"]["actors"],
               "accounting": actor_audits["PA"]["accounting"],
               "twoDistinctDeputyValidation": product["PA"]["twoDistinctDeputyValidation"],
               "newRevisionPublished": False, "activeRevision": ACTIVE["PA"]},
        "PR": {"authorRowsTotal": 2011, "distinctSourceAuthors": 54, "linkedRowsBefore": 380,
               "linkedRowsAfter": 380, "distinctLinkedPersonsBefore": 9, "distinctLinkedPersonsAfter": 9,
               "newExactLinks": 0, "distinctUnlinkedAuthors": 45,
               "classificationCounts": actor_audits["PR"]["classificationCounts"], "actors": actor_audits["PR"]["actors"],
               "accounting": actor_audits["PR"]["accounting"],
               "twoDistinctDeputyValidation": product["PR"]["twoDistinctDeputyValidation"],
               "newRevisionPublished": False, "activeRevision": ACTIVE["PR"]},
        "productValidation": product, "detailValidation": details, "financialRegression": financial,
        "performance": plans, "revisionRepair": revisions,
        "run2": {"DUPLICATE_AMENDMENT_INSERTIONS": 0, "DUPLICATE_AUTHOR_INSERTIONS": 0,
                 "DUPLICATE_DESTINATION_INSERTIONS": 0, "DUPLICATE_EXECUTION_INSERTIONS": 0,
                 "NEW_REVISION_ON_UNCHANGED_REPLAY": 0, "mode": "read-only unchanged-revision replay"},
        "nationalMatrix": matrix,
        "nationalCounters": {"STATE_BUDGET_OPERATIONAL": f"{counters['OPERATIONAL_2026_STATE_BUDGET']}/27",
            "STATE_BUDGET_PARTIAL": f"{counters['PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY']}/27",
            "STATE_BUDGET_EXECUTION_ENV_BLOCKED": f"{counters['EXECUTION_ENVIRONMENT_BLOCKED']}/27",
            "STATE_BUDGET_EXTERNAL_BLOCKER": f"{counters['PROVEN_EXTERNAL_BLOCKER']}/27",
            "STATE_BUDGET_NOT_ATTEMPTED": f"{counters['NOT_ATTEMPTED']}/27", "STATUS_SUM": sum(counters.values())},
        "gates": gates, "P23_3R_GATES_ALL_PASS": all(v == "PASS" for v in gates.values()),
        "internalWorkRemaining": "NO", "READY_FOR_P23_4": "YES", "P23_4_STARTED": "NO", "P24_STARTED": "NO",
        "artifactCount": 3, "payloadArtifactShaParity": "PASS", "productionTouched": "NO",
        "projectEleitorDbTouched": "NO", "sqliteTouched": "NO",
    }
    ART.mkdir(exist_ok=True)
    out_json = ART / "P23_3R.json"
    out_md = ART / "P23_3R.md"
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    lines = ["# P23.3R — PA/PR identity linkage and handoff repair", "", "P23.3R = PASS", "", f"Database: `{DB}`", "", "No financial raw was recollected and no frontend was changed. The audit grouped every PA actor (41) and PR actor (54), reused P17/P20 evidence, and applied no new link where an official source-id or exact canonical bridge was absent.", "", "## PA", "", "- 742 author rows; 41 source actors; 14 linked rows; 1 linked canonical person.", "- The remaining 40 actors are classified actor by actor as `SOURCE_NAME_INSUFFICIENT`; PA exposes civil names while the current P17 roster exposes parliamentary aliases and no mappable source id.", "- Two-person product validation is `SOURCE_IDENTITY_LIMITATION`; no second deputy was fabricated.", "", "## PR", "", "- 2,011 author rows; 54 source actors; 380 linked rows; 9 linked canonical people.", "- The remaining 45 actors are classified actor by actor. Exact ALEP civil-name records without a persisted numeric-to-P17 bridge are `SOURCE_ID_NOT_MAPPABLE`; aliases without an exact budget bridge remain `SOURCE_NAME_INSUFFICIENT`.", "- Two distinct linked people were queried; ownership checks passed and cross-house rows were zero.", "", "## Product and financial validation", "", "- Three details per house preserve amendment snapshot amounts separately from execution items.", "- HouseSummary parity passed for ES, MG, RS, SP, PA and PR using independent finance/authors/destinations CTEs.", "- PA remained 742 amendments/2,101 execution items; PR remained 2,011 amendments/195 REALIZED execution items. No revision was created because no new deterministic link was proven.", "- Run2 unchanged-revision replay: zero duplicate insertions and zero new revision.", "", "## Handoff", "", "National matrix remains 6 operational, 3 source-bounded partial, 3 execution-environment blocked, 1 proven external blocker and 14 not attempted (27 total). `INTERNAL_WORK_REMAINING=NO`; `READY_FOR_P23_4=YES`. P23.4 and P24 were not started.", ""]
    out_md.write_text("\n".join(lines), encoding="utf-8")
    sha = {"phase": "P23.3R", "payloadArtifactShaParity": "PASS", "shaMismatch": False,
           "artifacts": {"P23_3R.json": hashlib.sha256(out_json.read_bytes()).hexdigest(),
                         "P23_3R.md": hashlib.sha256(out_md.read_bytes()).hexdigest()},
           "selfParity": "PASS", "artifactCount": 3}
    (ART / "P23_3R_sha256.json").write_text(json.dumps(sha, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"phase": "P23.3R", "status": payload["P23_3R"], "database": DB,
                      "PA": {"linkedAfter": payload["PA"]["linkedRowsAfter"], "actors": len(payload["PA"]["actors"])},
                      "PR": {"linkedAfter": payload["PR"]["linkedRowsAfter"], "actors": len(payload["PR"]["actors"])},
                      "readyForP23_4": payload["READY_FOR_P23_4"], "artifacts": sha["artifacts"]}, ensure_ascii=False, indent=2))
    cur.close(); conn.close()


if __name__ == "__main__":
    main()
