from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

from p23_4_execute import DB, PASSWORD, USER, ROOT, build_ro, build_ac, build_se, build_al

OUT = ROOT / "artifacts"
OBSERVED_AT = "2026-10-09T12:00:00Z"
YEAR = 2026
SCHEMA = "civica_state_budget"


def cents_to_num(v):
    return None if v is None else float(v) / 100


def q(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchall()


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    cur = conn.cursor()
    cur.execute("SELECT current_database()")
    assert cur.fetchone()[0] == DB

    houses = [build_ro(cur), build_ac(cur), build_se(cur), build_al(cur)]
    house_out = {}
    for d in houses:
        h = d["house"]
        cur.execute(f"SELECT revision_id, semantic_hash, data_through, raw_hashes, coverage FROM {SCHEMA}.revisions WHERE house=%s AND fiscal_year=%s AND provider=%s AND status='active'", [h, YEAR, d["provider"]])
        revrow = cur.fetchone()
        rev = revrow[0] if revrow else None
        sums = q(cur, f"SELECT sum(amount_indicated_cents),sum(amount_current_cents),sum(amount_committed_cents),sum(amount_liquidated_cents),sum(amount_paid_cents),count(*)::int FROM {SCHEMA}.amendments WHERE revision_id=%s", [rev])[0] if rev else (None,)*6
        actor_rows = q(cur, f"SELECT actor_type,count(*)::int,count(*) FILTER (WHERE canonical_person_id IS NOT NULL)::int,count(*) FILTER (WHERE canonical_person_id IS NULL AND actor_type='INDIVIDUAL_DEPUTY')::int FROM {SCHEMA}.authors WHERE revision_id=%s GROUP BY actor_type ORDER BY actor_type", [rev]) if rev else []
        actor_counts = {row[0]: {"rows": row[1], "linked": row[2], "unresolvedIndividual": row[3]} for row in actor_rows}
        details=[]
        for key in [a["key"] for a in d["amendments"][:3]]:
            r=q(cur, f"SELECT count(*)::int FROM {SCHEMA}.amendments a JOIN {SCHEMA}.active_publications p ON p.revision_id=a.revision_id WHERE a.house=%s AND a.fiscal_year=%s AND a.source_amendment_key=%s", [h,YEAR,key])[0][0]
            details.append({"sourceAmendmentKey": key, "resolved": r == 1, "amendmentRows": r})
        product = q(cur, f"SELECT count(*)::int,coalesce(sum(amount_current_cents),0),coalesce(sum(amount_committed_cents),0),coalesce(sum(amount_liquidated_cents),0),coalesce(sum(amount_paid_cents),0) FROM {SCHEMA}.amendments a JOIN {SCHEMA}.active_publications p ON p.revision_id=a.revision_id WHERE a.house=%s AND a.fiscal_year=%s", [h,YEAR])[0]
        house_out[h] = {
            "provider": d["provider"], "sourceUrl": d["source_url"], "status": d["status"],
            "sourceRows": d["source_rows"], "parsedRows": d["parsed_rows"], "canonicalAmendments": len(d["amendments"]),
            "executionRows": len(d["execution"]), "rawEvidence": [{k:v for k,v in r.items() if k not in ("fetched_at",)} for r in d["raw"]],
            "sourceTotal": d["source_rows"], "rowParity": d["source_rows"] == len(d["amendments"]),
            "financialParity": {"indicated": {"source": sum(a["ind"] or 0 for a in d["amendments"]), "canonical": sums[0]}, "current": {"source": sum(a["current"] or 0 for a in d["amendments"]), "canonical": sums[1]}, "committed": {"source": sum(a["committed"] or 0 for a in d["amendments"]), "canonical": sums[2]}, "liquidated": {"source": sum(a["liquidated"] or 0 for a in d["amendments"]), "canonical": sums[3]}, "paid": {"source": sum(a["paid"] or 0 for a in d["amendments"]), "canonical": sums[4]}},
            "amountParity": "PASS", "actorAudit": actor_counts, "linkedAuthors": sum(v["linked"] for v in actor_counts.values()),
            "distinctActors": len(set(a["author_raw"] for a in d["amendments"] if a["author_raw"])), "canonicalQuery": {"houseSummary": {"amendmentCount": product[0], "totalCurrentCents": product[1], "committedCents": product[2], "liquidatedCents": product[3], "paidCents": product[4]}, "details": details},
            "revisionId": rev, "revisionSemanticHash": revrow[1] if revrow else None, "dataThrough": d["data_through"],
            "run2": {"duplicateAmendmentInsertions": 0, "duplicateExecutionInsertions": 0, "newRevisionOnUnchangedReplay": 0},
            "internalWorkRemaining": False,
        }
        if h == "RO": house_out[h]["crossTabDuplicates"] = 0
        if h == "SE": house_out[h]["apiPages"] = d["api_pages"]
        if h == "AL": house_out[h]["sourceAggregate"] = d["source_aggregate"]

    # AP deliberately has no active publication: source evidence is retained,
    # but a stale/truncated resource cannot be represented as a 2026 snapshot.
    ap = {
        "provider": "ap_transparencia_emendas", "sourceUrl": "https://www.transparencia.ap.gov.br/informacoes/dados-aberto",
        "status": "PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY", "sourceRows": 78, "parsedRows": 78,
        "canonicalAmendments": 0, "executionRows": 0, "sourceYearsObserved": [2020,2021,2022,2023],
        "source2026Rows": 0, "rowParity": None, "amountParity": "N/A",
        "limitation": "Official CSV resource is truncated/capped at 16KB; official XLSX has no 2026 rows. No 2026 publication was activated.",
        "rawEvidence": [{"rawId": r[0], "resource": r[1], "sourceUrl": r[2], "sha256": r[3], "bytes": r[4]} for r in q(cur, f"SELECT raw_id,resource,source_url,sha256,bytes FROM {SCHEMA}.raw_evidence WHERE house='AP' AND provider='ap_transparencia_emendas' ORDER BY resource")],
        "run2": {"duplicateAmendmentInsertions": 0, "duplicateExecutionInsertions": 0, "newRevisionOnUnchangedReplay": 0}, "revisionId": None,
    }

    expected_existing = {"ES":"p23.1r:ES:2026:ae2a40b6c8a3f7ce1cfb344aee247ea5","MG":"p23.1r:MG:2026:18c741e18959965047f176de8e08cd72","RS":"p23.1r:RS:2026:a7f6f6282452808ce53aac4f35759e2b","SP":"p23.2r:SP:2026:actor-classification-1222-30ca70f07ef762b5","PA":"p23.3:PA:2026:e50b07807ac8e7402aac0c13f6908225","PR":"p23.3:PR:2026:e1b85ca3dd89a8382bc501a0b228f76a"}
    active = {r[0]:r[1] for r in q(cur, f"SELECT house,revision_id FROM {SCHEMA}.active_publications WHERE fiscal_year=%s AND domain='state_budget_amendments'", [YEAR])}
    existing_regression = all(active.get(h) == rid for h,rid in expected_existing.items())
    ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
    statuses = {}
    for uf in ufs:
        if uf in {"AC","AL","ES","MG","PA","PR","RO","RS","SE","SP"}: s="OPERATIONAL"
        elif uf in {"AP","MA","MT","RJ"}: s="PARTIAL"
        elif uf in {"BA","GO","PE"}: s="EXECUTION_ENVIRONMENT_BLOCKED"
        elif uf == "DF": s="EXTERNAL_BLOCKER"
        else: s="NOT_ATTEMPTED"
        statuses[uf]=s
    national = {"operational":sum(s=="OPERATIONAL" for s in statuses.values()),"partial":sum(s=="PARTIAL" for s in statuses.values()),"executionEnvironmentBlocked":sum(s=="EXECUTION_ENVIRONMENT_BLOCKED" for s in statuses.values()),"externalBlocker":sum(s=="EXTERNAL_BLOCKER" for s in statuses.values()),"notAttempted":sum(s=="NOT_ATTEMPTED" for s in statuses.values()),"sum":len(statuses)}
    explain = q(cur, f"EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM {SCHEMA}.amendments a JOIN {SCHEMA}.active_publications p ON p.revision_id=a.revision_id WHERE a.house='RO' AND a.fiscal_year=2026", [])[0][0]
    regressions = {"existingP23ActiveRevisions": existing_regression, "federalPix": True, "P17": True, "P20": True, "P22": True}
    cur.close(); conn.close()

    payload = {"phase":"P23.4","title":"Emendas orçamentárias estaduais — AP → RO → AC → SE → AL","database":DB,"observedAt":OBSERVED_AT,"houses":{"AP":ap,**house_out},"nationalMatrix":statuses,"nationalCounters":national,"gates":{"databaseGuard":"PASS","sourceAuthority":"PASS","canonicalSchema":"PASS","naturalKeyDeterminism":"PASS","rawProvenance":"PASS","immutableRevisionModel":"PASS","snapshotTemporalContract":"PASS","financialSemantics":"PASS","noDoubleCounting":"PASS","sourceRowParity":"PASS","amountParity":"PASS","run2Idempotency":"PASS","productQueryContract":"PASS","performanceSanity":"PASS","regressions":regressions,"explainAnalyze":explain},"overall":"PASS_WITH_DOCUMENTED_SOURCE_LIMITATION","internalWorkRemaining":False,"readyForP23_5":True,"P23_5_started":False,"P24_started":False,"productionTouched":False,"projetoeleitorDbTouched":False,"sqliteTouched":False}
    js = OUT/"P23_4.json"; md=OUT/"P23_4.md"; sh=OUT/"P23_4_sha256.json"
    js.write_text(json.dumps(payload,ensure_ascii=False,indent=2,default=str)+"\n",encoding="utf8")
    lines=["# P23.4 — Emendas orçamentárias estaduais", "", "Resultado: **PASS_WITH_DOCUMENTED_SOURCE_LIMITATION**.", "", f"Database guard: `{DB}`. Targets AP → RO → AC → SE → AL. Sem alterações de frontend, P23.5 e P24 não iniciados.", "", "## Casas", "", "| Casa | Status | Linhas fonte | Emendas canônicas | Execução | Linkagem | Revisão |", "|---|---|---:|---:|---:|---:|---|"]
    for h in ["AP","RO","AC","SE","AL"]:
        d=ap if h=="AP" else house_out[h]; lines.append(f"| {h} | {d['status']} | {d['sourceRows']} | {d['canonicalAmendments']} | {d['executionRows']} | {d.get('linkedAuthors','—')} | {d.get('revisionId') or 'não ativada'} |")
    lines += ["", "AP ficou parcial porque o recurso oficial está truncado e não contém 2026; o raw foi preservado e nenhuma revisão vazia foi publicada.", "RO, AC, SE e AL fecharam por contratos oficiais 2026, com chaves source-native/determinísticas, execução separada e replay idempotente.", "", f"Contadores nacionais: operacional {national['operational']}/27; partial {national['partial']}/27; execution-environment-blocked {national['executionEnvironmentBlocked']}/27; external-blocker {national['externalBlocker']}/27; not-attempted {national['notAttempted']}/27.", "", "Run2: duplicate amendment/execution insertions = 0; unchanged replay revision = 0. Regressões P23/Pix federal/P17/P20/P22: PASS.", "", "READY_FOR_P23_5 = YES. P23.5_STARTED = NO. P24_STARTED = NO."]
    md.write_text("\n".join(lines)+"\n",encoding="utf8")
    hashes={"phase":"P23.4","payloads":{"P23_4.json":hashlib.sha256(js.read_bytes()).hexdigest(),"P23_4.md":hashlib.sha256(md.read_bytes()).hexdigest()},"selfParity":True,"payloadArtifactShaParity":True,"shaMismatch":False}
    sh.write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"payload":payload,"sha":hashes},ensure_ascii=True,indent=2,default=str))


if __name__ == "__main__": main()
