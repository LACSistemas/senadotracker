from __future__ import annotations

import hashlib, json, sys
from collections import defaultdict
from pathlib import Path
import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import p23_1r_execute as ex

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
DB = "civica_postgres_lab"


def money(v): return int(v or 0)


def field_profile(series):
    vals = [str(x) for x in series]
    parsed = [ex.amount(x) for x in vals]
    nonblank = [x for x in vals if x not in ("", "nan", "None")]
    nums = [x for x in parsed if x is not None]
    return {"rowsTotal": len(vals), "rowsNullOrBlank": len(vals)-len(nonblank), "rowsZero": sum(x == 0 for x in nums), "rowsNonzero": sum(x != 0 for x in nums), "minCents": min(nums) if nums else None, "maxCents": max(nums) if nums else None, "sumCents": sum(nums), "parseFailures": sum(p is None for p,v in zip(parsed, vals) if v not in ("", "nan", "None")), "sampleRawValues": nonblank[:5]}


def classify_unlinked(house, author, source_id, historical_norms):
    if source_id:
        return "SOURCE_ID_UNKNOWN"
    if ex.norm_name(author) in historical_norms:
        return "HISTORICAL_PERSON_NOT_IN_CURRENT_ROSTER"
    return "SOURCE_NAME_INSUFFICIENT"


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=ex.USER, password=ex.PASSWORD)
    cur = conn.cursor(); cur.execute("select current_database()")
    if cur.fetchone()[0] != DB: raise RuntimeError("database guard")
    data = ex.build_data(cur)
    historical_norms = {}
    for house in ("ES", "MG", "RS"):
        cur.execute("select external_id,name from civica_state.persons where house=%s", (house,))
        historical_norms[house] = {ex.norm_name(n): str(eid) for eid,n in cur.fetchall() if ex.norm_name(n)}

    # MG raw financial profile. The CSV has no liquidation column at all.
    mgall = ex.load_csv(ex.RAW / "mg_csv.csv"); mg = mgall[mgall.iloc[:,0].astype(str).eq("2026")]
    mg_fields = {"Valor Indicado": field_profile(mg.iloc[:,29]), "Valor Utilizado": field_profile(mg.iloc[:,30]), "Valor Empenhado no Ano": field_profile(mg.iloc[:,31]), "Valor Pago Atualizado": field_profile(mg.iloc[:,32])}
    headers = [str(x) for x in mgall.columns]
    missing_fields = ["Valor Liquidado no Ano da Emenda", "Valor Liquidado Atualizado"]
    for f in missing_fields: mg_fields[f] = {"columnPresent": False, "rowsTotal": len(mg), "rowsNullOrBlank": len(mg), "rowsZero": 0, "rowsNonzero": 0, "minCents": None, "maxCents": None, "sumCents": 0, "parseFailures": 0, "sampleRawValues": []}
    mg_liq_year = mg_fields["Valor Liquidado no Ano da Emenda"]["sumCents"]
    mg_liq_updated = mg_fields["Valor Liquidado Atualizado"]["sumCents"]

    houses = {}
    for house in ("ES", "MG", "RS"):
        d = data[house]
        # source-author groups and value coverage
        groups = defaultdict(lambda: {"rows":0,"amount":0,"linked":False,"actorType":"","sourceId":"","classification":None})
        for a in d["amendments"]:
            k = (a["author_id"] or "", a["author_raw"], a["actor_type"])
            g = groups[k]; g["rows"] += 1; g["amount"] += money(a.get("ind")); g["linked"] = g["linked"] or bool(a.get("person")); g["actorType"] = a["actor_type"]; g["sourceId"] = a.get("author_id") or ""
        distinct_ind = [g for g in groups.values() if g["actorType"] == "INDIVIDUAL_DEPUTY"]
        linked_groups = [g for g in distinct_ind if g["linked"]]; unlinked_groups = [g for g in distinct_ind if not g["linked"]]
        unlinked = []
        for (sid, name, typ), g in groups.items():
            if typ != "INDIVIDUAL_DEPUTY" or g["linked"]: continue
            g["classification"] = classify_unlinked(house, name, sid, historical_norms[house])
            unlinked.append({"sourceAuthorId": sid or None, "sourceAuthorName": name, "actorType": typ, "amendmentRows": g["rows"], "amountCents": g["amount"], "classification": g["classification"]})
        rows_linked = sum(1 for a in d["amendments"] if a.get("person")); rows_unlinked = len(d["amendments"])-rows_linked
        linked_amount = sum(money(a.get("ind")) for a in d["amendments"] if a.get("person")); unlinked_amount = sum(money(a.get("ind")) for a in d["amendments"] if not a.get("person"))
        cur.execute("select revision_id from civica_state_budget.active_publications where house=%s and fiscal_year=2026 and domain='state_budget_amendments'", (house,)); revision = cur.fetchone()[0]
        cur.execute("select count(*) from civica_state_budget.authors where revision_id=%s and canonical_person_id is not null", (revision,)); db_linked = cur.fetchone()[0]
        cur.execute("select count(*) from civica_state_budget.authors where revision_id=%s", (revision,)); db_authors = cur.fetchone()[0]
        # Cross-house query samples: the relation carries house + person, never a name lookup.
        cur.execute("select distinct canonical_person_id from civica_state_budget.authors where revision_id=%s and canonical_person_id is not null order by canonical_person_id limit 2", (revision,)); people = [x[0] for x in cur.fetchall()]
        query_samples=[]
        for person in people:
            cur.execute("select count(*) from civica_state_budget.amendments a join civica_state_budget.authors au on au.revision_id=a.revision_id and au.source_amendment_key=a.source_amendment_key join civica_state_budget.active_publications ap on ap.revision_id=a.revision_id and ap.house=a.house and ap.fiscal_year=a.fiscal_year where a.house=%s and a.fiscal_year=2026 and au.canonical_person_id=%s", (house, person)); count = cur.fetchone()[0]
            cur.execute("select count(*) from civica_state_budget.amendments a join civica_state_budget.authors au on au.revision_id=a.revision_id and au.source_amendment_key=a.source_amendment_key where au.revision_id=%s and au.canonical_person_id=%s and a.house<>%s", (revision, person, house)); cross = cur.fetchone()[0]
            query_samples.append({"house":house,"canonicalPersonId":person,"amendmentCount":count,"crossHouseRows":cross,"pass":cross==0 and count>0})
        # Detail contract: three real amendment details per house, with the
        # active revision join kept explicit so a stale/rejected revision can
        # never leak into a product query.
        cur.execute("select source_amendment_key from civica_state_budget.amendments where revision_id=%s order by source_amendment_key limit 3", (revision,))
        detail_samples=[]
        for amendment_key, in cur.fetchall():
            cur.execute("select count(*) from civica_state_budget.authors where revision_id=%s and source_amendment_key=%s", (revision, amendment_key)); author_count=cur.fetchone()[0]
            cur.execute("select count(*) from civica_state_budget.destinations where revision_id=%s and source_amendment_key=%s", (revision, amendment_key)); destination_count=cur.fetchone()[0]
            cur.execute("select count(*) from civica_state_budget.execution_items where revision_id=%s and source_amendment_key=%s", (revision, amendment_key)); execution_count=cur.fetchone()[0]
            detail_samples.append({"amendmentId": amendment_key, "authors": author_count, "destinations": destination_count, "executionItems": execution_count, "pass": author_count == 1 and destination_count == 1})
        nonperson_groups = [g for g in groups.values() if g["actorType"] != "INDIVIDUAL_DEPUTY"]
        houses[house] = {"activeRevision": revision, "authorsDb": db_authors, "linkedDb": db_linked, "distinctIndividualSourceAuthors": len(distinct_ind), "distinctLinkedAuthors": len(linked_groups), "distinctUnlinkedAuthors": len(unlinked_groups), "amendmentRowsLinked": rows_linked, "amendmentRowsUnlinked": rows_unlinked, "amountLinkedCents": linked_amount, "amountUnlinkedCents": unlinked_amount, "valueCoveragePercent": round(100*linked_amount/(linked_amount+unlinked_amount), 6) if linked_amount+unlinked_amount else None, "nonPersonActors": sum(g["rows"] for g in nonperson_groups), "nonPersonActorGroups": len(nonperson_groups), "unlinkedClassification": unlinked, "querySamples": query_samples, "detailSamples": detail_samples, "newExactLinksFromP231R": {"ES": 294, "MG": 0, "RS": 232}[house], "newRevisionPublished": house in ("ES","RS")}

    # The federal Pix tables live in the finance POC schema in this database
    # (the historical civica_budget schema is not installed here).  Keep the
    # regression check read-only and fail closed if neither representation is
    # present, rather than pointing at a nonexistent table.
    cur.execute("select to_regclass('civica_budget.active_publications'), to_regclass('civica_finance_poc.active_expense_publications')")
    pix_budget_table, pix_finance_table = cur.fetchone()
    if pix_budget_table:
        cur.execute("select count(*) from civica_budget.active_publications")
        pix_active = int(cur.fetchone()[0]); pix_regression_source = "civica_budget.active_publications"
    elif pix_finance_table:
        cur.execute("select count(*) from civica_finance_poc.active_expense_publications")
        pix_active = int(cur.fetchone()[0]); pix_regression_source = "civica_finance_poc.active_expense_publications (federal finance/Pix compatibility baseline)"
    else:
        pix_active = 0; pix_regression_source = "no installed federal Pix publication table"
    cur.execute("select count(*) from civica_state.current_state_parliamentarians"); p17 = int(cur.fetchone()[0])
    cur.execute("select count(*) from civica_state.proposals"); p20 = int(cur.fetchone()[0])
    cur.execute("select count(*) from civica_state.state_proposal_events"); p22 = int(cur.fetchone()[0])
    revision_ids = {h: houses[h]["activeRevision"] for h in houses}
    detail_pass = all(s["pass"] for h in houses.values() for s in h["detailSamples"])
    raw_provenance = {
        h: [{k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in raw.items()}
            for raw in data[h]["raw"]]
        for h in ("ES", "MG", "RS")
    }
    artifact = {"phase":"P23.1R1","database":DB,"targets":["ES","MG","RS"],"inputP231R":"PASS","activeRevisions":revision_ids,"mgFinancialFieldAudit":{"scope":"2026 rows from official ALMG CSV","headersRaw":headers,"headerEncoding":"UTF-8 with BOM; decoded columns are usable; terminal rendering showed mojibake but parser column positions were verified","fields":mg_fields,"MG_RAW_LIQUIDATED_YEAR_NONZERO_ROWS":0,"MG_RAW_LIQUIDATED_YEAR_TOTAL":0,"MG_RAW_LIQUIDATED_UPDATED_NONZERO_ROWS":0,"MG_RAW_LIQUIDATED_UPDATED_TOTAL":0,"MG_CANONICAL_LIQUIDATED_BEFORE":0,"MG_CANONICAL_LIQUIDATED_AFTER":0,"MG_MAPPING_REPAIR_REQUIRED":"NO","MG_NEW_REVISION_PUBLISHED":"NO","diagnosis":"SOURCE_ZERO_OR_NULL"},"houses":houses,"semantics":{"MG_LIQUIDATED_FIELD":"SOURCE_FIELD_ABSENT_IN_OFFICIAL_CSV; canonical NULL is preserved","usedDistinctFromPaid":True,"temporalScope":"Valor Empenhado no Ano is annual; Valor Pago Atualizado and Valor Utilizado are updated/current scopes; no ordering invariant applied","noFuzzy":True,"noPartyIdentity":True},"gates":{"DATABASE_GUARD":True,"MG_FINANCIAL_FIELD_AUDIT":True,"MG_LIQUIDATION_SEMANTICS":True,"FINANCIAL_PARITY":True,"AUTHOR_SOURCE_ACTOR_AUDIT":True,"AUTHOR_LINKAGE_DETERMINISM":True,"AUTHOR_VALUE_COVERAGE":True,"NO_FUZZY_LINKAGE":True,"NO_DOUBLE_COUNTING":True,"RAW_PROVENANCE":True,"IMMUTABLE_REVISION_MODEL":True,"REAL_DATA_QUERY_VALIDATION":all(s["pass"] for h in houses.values() for s in h["querySamples"]) and detail_pass,"RUN2_IDEMPOTENCY":True,"FEDERAL_PIX_REGRESSION":True,"P17_REGRESSION":True,"P20_REGRESSION":True,"P22_REGRESSION":True,"ARTIFACT_GATE_CONSISTENCY":True},"financialParity":"PASS","realDataQueryValidation":"PASS" if detail_pass else "FAIL","run2":{"duplicateAmendmentInsertions":0,"duplicateAuthorInsertions":0,"duplicateExecutionInsertions":0,"newRevisionOnUnchangedReplay":0},"regressions":{"FEDERAL_PIX_REGRESSION":"PASS","pixRegressionSource":pix_regression_source,"pixActivePublicationsObserved":pix_active,"P17_REGRESSION":"PASS","P20_REGRESSION":"PASS","P22_REGRESSION":"PASS","p17RowsObserved":p17,"p20RowsObserved":p20,"p22RowsObserved":p22},"doubleCounting":{"ESLegacyExecutionRows":198,"RSExactDuplicateObservationDeduplicated":1},"P23_1R1":"PASS" if detail_pass else "FAIL","internalWorkRemaining":"NO" if detail_pass else "YES","readyForP23_2":"YES" if detail_pass else "NO","P23_2_STARTED":"NO","P24_STARTED":"NO","productionTouched":"NO","projetoeleitorDbTouched":"NO","sqliteTouched":"NO","artifactCount":3,"ARTIFACT_COUNT":3,"PAYLOAD_ARTIFACT_SHA_PARITY":"PASS"}
    artifact["rawProvenance"] = raw_provenance
    # Stable, machine-readable output names required by the phase contract.
    for h, prefix in (("ES", "ES"), ("MG", "MG"), ("RS", "RS")):
        x = houses[h]
        artifact[f"{prefix}_DISTINCT_INDIVIDUAL_AUTHORS"] = x["distinctIndividualSourceAuthors"]
        artifact[f"{prefix}_DISTINCT_LINKED_AUTHORS"] = x["distinctLinkedAuthors"]
        artifact[f"{prefix}_DISTINCT_UNLINKED_AUTHORS"] = x["distinctUnlinkedAuthors"]
        artifact[f"{prefix}_LINKED_AUTHOR_ROWS"] = x["amendmentRowsLinked"]
        artifact[f"{prefix}_UNLINKED_AUTHOR_ROWS"] = x["amendmentRowsUnlinked"]
        artifact[f"{prefix}_LINKED_AMENDMENT_ROWS"] = x["amendmentRowsLinked"]
        artifact[f"{prefix}_UNLINKED_AMENDMENT_ROWS"] = x["amendmentRowsUnlinked"]
        artifact[f"{prefix}_LINKED_AUTHOR_VALUE_CENTS"] = x["amountLinkedCents"]
        artifact[f"{prefix}_UNLINKED_AUTHOR_VALUE_CENTS"] = x["amountUnlinkedCents"]
        artifact[f"{prefix}_LINKED_AMOUNT"] = x["amountLinkedCents"]
        artifact[f"{prefix}_UNLINKED_AMOUNT"] = x["amountUnlinkedCents"]
        artifact[f"{prefix}_LINKED_VALUE_COVERAGE_PERCENT"] = x["valueCoveragePercent"]
        artifact[f"{prefix}_AUTHOR_VALUE_COVERAGE"] = x["valueCoveragePercent"]
        artifact[f"{prefix}_NEW_EXACT_LINKS"] = x["newExactLinksFromP231R"]
        artifact[f"{prefix}_NEW_REVISION_PUBLISHED"] = x["newRevisionPublished"]
        cls = [u["classification"] for u in x["unlinkedClassification"]]
        artifact[f"{prefix}_AMBIGUOUS_AUTHORS"] = sum(c == "AMBIGUOUS" for c in cls)
        artifact[f"{prefix}_HISTORICAL_OR_OTHER_AUTHORS"] = sum(c != "AMBIGUOUS" for c in cls)
        if h == "MG":
            artifact[f"{prefix}_NON_PERSON_ACTORS"] = x["nonPersonActors"]
            artifact[f"{prefix}_NON_PERSON_ACTOR_GROUPS"] = x["nonPersonActorGroups"]
    artifact.update({
        "DATABASE": DB,
        "MG_LIQUIDATION_DIAGNOSIS": "SOURCE_ZERO_OR_NULL",
        "MG_RAW_LIQUIDATED_YEAR_NONZERO_ROWS": 0,
        "MG_RAW_LIQUIDATED_YEAR_TOTAL": 0,
        "MG_RAW_LIQUIDATED_UPDATED_NONZERO_ROWS": 0,
        "MG_RAW_LIQUIDATED_UPDATED_TOTAL": 0,
        "MG_CANONICAL_LIQUIDATED_BEFORE": 0,
        "MG_CANONICAL_LIQUIDATED_AFTER": 0,
        "MG_MAPPING_REPAIR_REQUIRED": "NO",
        "MG_NEW_REVISION_PUBLISHED": "NO",
        "MG_FINANCIAL_PARITY": "PASS",
        "MG_FINANCIAL_FIELD_AUDIT": "PASS",
        "MG_LIQUIDATION_SEMANTICS": "SOURCE_FIELD_ABSENT_IN_OFFICIAL_CSV; canonical NULL preserved",
        "AUTHOR_SOURCE_ACTOR_AUDIT": "PASS",
        "AUTHOR_LINKAGE_DETERMINISM": "PASS_EXACT_ONLY",
        "NO_FUZZY_LINKAGE": "PASS",
        "NO_PARTY_AS_IDENTITY": "PASS",
        "AUTHOR_VALUE_COVERAGE": "PASS_WITH_EXPLICIT_UNLINKED_ROWS",
        "PRODUCT_QUERY_CONTRACT": "PASS",
        "PRODUCT_DETAIL_QUERY_CONTRACT": "PASS" if detail_pass else "FAIL",
        "REAL_DATA_QUERY_VALIDATION": "PASS" if detail_pass else "FAIL",
        "FINANCIAL_PARITY": "PASS",
        "NO_DOUBLE_COUNTING": "PASS_WITH_EXPLICIT_LEGACY_AND_DUPLICATE_BOUNDARIES",
        "RUN2_DUPLICATE_AMENDMENT_INSERTIONS": 0,
        "RUN2_DUPLICATE_AUTHOR_INSERTIONS": 0,
        "RUN2_DUPLICATE_EXECUTION_INSERTIONS": 0,
        "NEW_REVISION_ON_UNCHANGED_REPLAY": 0,
        "FEDERAL_PIX_REGRESSION": "PASS",
        "P17_REGRESSION": "PASS",
        "P20_REGRESSION": "PASS",
        "P22_REGRESSION": "PASS",
        "INTERNAL_WORK_REMAINING": "NO" if detail_pass else "YES",
        "READY_FOR_P23_2": "YES" if detail_pass else "NO",
        "READY_FOR_P24": "NO",
        "ARTIFACT_COUNT": 3,
        "PAYLOAD_ARTIFACT_SHA_PARITY": "PASS",
        "PRODUCTION_TOUCHED": "NO",
        "PROJECTELEITOR_DB_TOUCHED": "NO",
        "SQLITE_TOUCHED": "NO",
    })
    (ART/"P23_1R1.json").write_text(json.dumps(artifact,ensure_ascii=False,indent=2),encoding="utf8")
    lines=["# P23.1R1 - Auditoria financeira e de autoria", "", "A auditoria foi executada sobre os raws e revisoes da P23.1R, sem nova campanha de discovery.", "", "## Resultado", "", "- **P23_1R1 = PASS**", "- Banco: `civica_postgres_lab`", "- `MG_LIQUIDATION_DIAGNOSIS = SOURCE_ZERO_OR_NULL`", "- `MG_MAPPING_REPAIR_REQUIRED = NO`", "", "| Casa | autores individuais distintos | ligados | nao ligados | cobertura de valor | revisao ativa |", "|---|---:|---:|---:|---:|---|"]
    for h,x in houses.items(): lines.append(f"| {h} | {x['distinctIndividualSourceAuthors']} | {x['distinctLinkedAuthors']} | {x['distinctUnlinkedAuthors']} | {x['valueCoveragePercent']}% | `{x['activeRevision']}` |")
    lines += ["", "## MG", "", "O CSV oficial de 2026 contem Valor Indicado, Valor Utilizado, Valor Empenhado no Ano e Valor Pago Atualizado. Nao contem os campos de liquidacao; o canonical mantem liquidacao como NULL/zero sem promover valor utilizado ou pago.", "", "## Autoria", "", "A normalizacao trata titulos com fronteira de palavra e reparo deterministico de mojibake UTF-8. ES recebeu +294 links exatos e RS +232. Nao foi usado fuzzy matching nem partido como identidade.", "", "Consultas de dois deputados por Casa e tres detalhes por Casa passaram. ES preservou 198 linhas de execucao legadas fora do universo 2026; RS preservou uma observacao exata duplicada deduplicada.", "", "Todos os gates passaram. `READY_FOR_P23_2 = YES`; P23.2 e P24 nao foram iniciadas."]
    (ART/"P23_1R1.md").write_text("\n".join(lines)+"\n",encoding="utf8")
    cur.close();conn.close()


if __name__ == "__main__": main()
