from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[1]
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
OBSERVED_AT = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
SP_URL = "https://www.transparencia.sp.gov.br/Dados%20Abertos/Emendas/emendas.zip"
SP_PAGE = "https://www.transparencia.sp.gov.br/EmendasParlamentares/Concedidas"

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()

def text(v) -> str:
    if v is None:
        return ""
    return str(v).replace("\x00", "").strip()

def norm_name(v: str) -> str:
    s = text(v).upper()
    for _ in range(2):
        try:
            if any(x in s for x in ("Ãƒ", "Ã‚", "ï¿½")):
                s = s.encode("latin1", errors="ignore").decode("utf8", errors="ignore").upper()
        except Exception:
            break
    s = re.sub(r"^(?:DEP\.?|DEPUTADO[A]?|DR\.?|DRA\.?|PROF\.?|PROFESSOR[A]?)\s+", "", s)
    s = unicodedata.normalize("NFKD", s)
    return re.sub(r"[^A-Z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)))

def money(v) -> int | None:
    s = text(v).replace("R$", "").replace(" ", "")
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return int((Decimal(s) * 100).quantize(Decimal("1")))
    except (InvalidOperation, ValueError):
        return None

def actor_type(name: str) -> str:
    n = norm_name(name)
    if not n:
        return "UNKNOWN_SOURCE_ACTOR"
    if any(x in n for x in ("BANCADA", "BLOCO", "COMISSAO", "MESA")):
        return "BENCH" if "BANCADA" in n else "BLOC"
    if any(x in n for x in ("PODEREXECUTIVO", "SECRETARIA", "GOVERNO")):
        return "EXECUTIVE_OR_OTHER"
    return "INDIVIDUAL_DEPUTY"

def canonical_status(committed: int | None, liquidated: int | None, paid: int | None) -> str:
    if paid and paid > 0:
        return "PARTIALLY_PAID"
    if liquidated and liquidated > 0:
        return "LIQUIDATED"
    if committed and committed > 0:
        return "COMMITTED"
    return "NOT_STARTED"

def parse_sp(path: Path):
    # The official CSV is semicolon-delimited but its object column contains
    # unquoted semicolons.  Reassemble records at the published 14-column
    # boundary; this is source-format repair, not a guessed row split.
    buf = ""
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        buf += ("\n" if buf else "") + line
        if buf.count(";") >= 13:
            p = buf.split(";")
            rows.append(p[:7] + [";".join(p[7:-6])] + p[-6:])
            buf = ""
    if buf:
        raise RuntimeError("SP source ended with an incomplete record")
    header, all_rows = rows[0], rows[1:]
    rows_2026 = [r for r in all_rows if text(r[2]).startswith("2026.")]
    c = Counter(tuple(r) for r in rows_2026)
    unique = [list(k) for k in c]
    return header, rows_2026, unique, sum(v - 1 for v in c.values() if v > 1)

def p17_index(cur, house):
    cur.execute("select external_id,name from civica_state.current_state_parliamentarians where house=%s", [house])
    return [(str(i), text(n), norm_name(n)) for i, n in cur.fetchall()]

def link(index, raw):
    n = norm_name(raw)
    hits = [i for i, _, nn in index if n and nn == n]
    return (hits[0], "exact_normalized_official_name") if len(hits) == 1 else (None, None)

def raw_record(path: Path):
    return {
        "raw_id": f"raw:p23.2:SP:sp_transparencia:{sha(path)}",
        "house": "SP", "provider": "sp_transparencia_emendas_concedidas",
        "resource": "emenda.csv", "source_url": SP_URL, "http_status": 200,
        "content_type": "text/csv", "fetched_at": OBSERVED_AT,
        "source_updated_at": None, "sha256": sha(path), "bytes": path.stat().st_size,
        "error": None, "source_kind": "raw_source",
    }

def build_sp(cur):
    path = ROOT / ".p23_2_sp" / "emenda.csv"
    header, raw_rows, rows, duplicate_rows = parse_sp(path)
    idx = p17_index(cur, "SP")
    groups = defaultdict(list)
    for r in rows:
        groups[text(r[2])].append(r)
    amendments, destinations, execution = [], [], []
    linked = 0
    source_totals = {"committed": 0, "liquidated": 0, "paid": 0}
    canonical_totals = {"committed": 0, "liquidated": 0, "paid": 0}
    for code, rs in sorted(groups.items()):
        key = f"SP:2026:{code}"
        name, party = text(rs[0][3]), text(rs[0][4])
        person, method = link(idx, name)
        if person:
            linked += 1
        sums = {stage: sum((money(r[col]) or 0) for r in rs) for stage, col in (("committed", 11), ("liquidated", 12), ("paid", 13))}
        for r in raw_rows:
            if text(r[2]) == code:
                for stage, col in (("committed", 11), ("liquidated", 12), ("paid", 13)):
                    source_totals[stage] += money(r[col]) or 0
        for stage in canonical_totals:
            canonical_totals[stage] += sums[stage]
        amendments.append({
            "key": key, "number": code, "type": text(rs[0][8]) or text(rs[0][1]),
            "description": text(rs[0][7]), "source_status": "2026",
            "canonical_status": canonical_status(sums["committed"], sums["liquidated"], sums["paid"]),
            "source_url": SP_PAGE, "raw_id": None, "ind": None, "approved": None, "current": None,
            "committed": sums["committed"] or None, "liquidated": sums["liquidated"] or None,
            "paid": sums["paid"] or None, "used": None, "author_raw": name,
            "author_id": None, "actor_type": actor_type(name), "person": person, "link_method": method,
            "party": party or None,
        })
        for r in rs:
            dkey = hashlib.sha256("|".join(text(x) for x in r).encode("utf-8")).hexdigest()[:32]
            destinations.append((key, dkey, {
                "beneficiary_name": text(r[6]), "beneficiary_document": None, "beneficiary_type": None,
                "municipality_source_code": None, "municipality_name": text(r[10]), "municipality_ibge_code": None,
                "executing_agency": text(r[0]), "budget_unit": None, "program": None, "action": text(r[9]),
                "subaction": None, "function_code": None, "subfunction_code": None, "expense_group": None,
                "expense_element": None, "object_finality": text(r[7]),
            }))
            for stage, col in (("COMMITTED", 11), ("LIQUIDATED", 12), ("PAID", 13)):
                value = money(r[col])
                if value is not None and value != 0:
                    execution.append({
                        "key": f"SP:2026:{code}:{dkey}:{stage}:{value}", "amendment_key": key,
                        "stage": stage, "amount": value, "document": text(r[5]) or None,
                        "commitment": None, "process": None, "occurred": None, "creditor_document": None,
                        "creditor_name": text(r[6]) or None, "management_unit": None, "agency": text(r[0]) or None,
                        "procurement_type": None, "procurement_number": None, "contract_number": text(r[5]) or None,
                        "agreement_number": None, "raw_id": None,
                    })
    raw = raw_record(path)
    for a in amendments:
        a["raw_id"] = raw["raw_id"]
    for x in execution:
        x["raw_id"] = raw["raw_id"]
    return {
        "house": "SP", "provider": "sp_transparencia_emendas_concedidas", "source_rows": len(raw_rows),
        "parsed_rows": len(rows), "duplicate_rows": duplicate_rows, "amendments": amendments,
        "destinations": destinations, "execution": execution, "raw": [raw], "linked": linked,
        "source_totals": source_totals, "canonical_totals": canonical_totals,
        "header": header, "data_through": "2026-10-09",
    }

def persist_sp(cur, data):
    semantic = hashlib.sha256(json.dumps({k: data[k] for k in ("amendments", "destinations", "execution")}, sort_keys=True, default=str).encode()).hexdigest()
    revision = f"p23.2:SP:2026:{semantic[:32]}"
    cur.execute("select revision_id,status from civica_state_budget.revisions where revision_id=%s", [revision])
    existed = cur.fetchone() is not None
    for r in data["raw"]:
        cur.execute("insert into civica_state_budget.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind) values(%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s) on conflict(raw_id) do nothing", r)
    if not existed:
        cur.execute("insert into civica_state_budget.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters) values(%s,'SP',2026,%s,'published',%s,%s,%s,%s,%s) on conflict(run_id) do nothing", [f"p23.2:SP:2026:{semantic[:16]}", data["provider"], OBSERVED_AT, OBSERVED_AT, data["data_through"], OBSERVED_AT, Json({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "duplicateRows": data["duplicate_rows"]})])
        cur.execute("insert into civica_state_budget.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,raw_hashes,coverage,created_at,activated_at) values(%s,'SP',2026,%s,'active',%s,%s,%s,%s,%s,%s) on conflict(revision_id) do nothing", [revision, data["provider"], semantic, data["data_through"], Json([r["sha256"] for r in data["raw"]]), Json({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "duplicateRows": data["duplicate_rows"], "canonicalAmendments": len(data["amendments"]), "executionRows": len(data["execution"])}), OBSERVED_AT, OBSERVED_AT])
    a_ins = d_ins = e_ins = au_ins = 0
    for a in data["amendments"]:
        cur.execute("insert into civica_state_budget.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance) values(%s,'SP',2026,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key) do nothing", [revision, data["provider"], a["key"], a["number"], a["type"], a["type"], a["description"], a["source_status"], a["canonical_status"], a["source_url"], a["raw_id"], a["ind"], a["approved"], a["current"], a["committed"], a["liquidated"], a["paid"], None, a["used"], hashlib.sha256(json.dumps(a, sort_keys=True, default=str).encode()).hexdigest(), Json({"source": a["source_url"], "sourceKey": a["key"]})]); a_ins += cur.rowcount
        cur.execute("insert into civica_state_budget.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method) values(%s,'SP',2026,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,author_key) do nothing", [revision, a["key"], a["author_id"] or norm_name(a["author_raw"]) or a["key"], a["actor_type"], a["author_raw"] or None, a["author_id"], a["party"], a["person"], a["link_method"]]); au_ins += cur.rowcount
    for key, dkey, d in data["destinations"]:
        cur.execute("insert into civica_state_budget.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,destination_key) do nothing", [revision, key, dkey] + [d.get(k) for k in ("beneficiary_name","beneficiary_document","beneficiary_type","municipality_source_code","municipality_name","municipality_ibge_code","executing_agency","budget_unit","program","action","subaction","function_code","subfunction_code","expense_group","expense_element","object_finality")]); d_ins += cur.rowcount
    for x in data["execution"]:
        cur.execute("insert into civica_state_budget.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,execution_key) do nothing", [revision, x["key"], x["amendment_key"], x["document"], x["commitment"], x["process"], x["occurred"], x["stage"], x["amount"], x["creditor_document"], x["creditor_name"], x["management_unit"], x["agency"], x["procurement_type"], x["procurement_number"], x["contract_number"], x["agreement_number"], x["raw_id"], Json({"source": data["provider"], "executionKey": x["key"]})]); e_ins += cur.rowcount
    if not existed:
        cur.execute("insert into civica_state_budget.active_publications(house,fiscal_year,domain,revision_id,activated_at) values('SP',2026,'state_budget_amendments',%s,%s) on conflict(house,fiscal_year,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at", [revision, OBSERVED_AT])
    return revision, {"amendment": a_ins, "author": au_ins, "destination": d_ins, "execution": e_ins, "newRevision": int(not existed)}

def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("select current_database()")
    if cur.fetchone()[0] != DB:
        raise RuntimeError("database guard failed")
    data = build_sp(cur)
    first = persist_sp(cur, data)
    conn.commit()
    second = persist_sp(cur, data)
    conn.commit()
    print(json.dumps({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "duplicateRows": data["duplicate_rows"], "canonicalAmendments": len(data["amendments"]), "destinations": len(data["destinations"]), "execution": len(data["execution"]), "linkedAuthors": data["linked"], "sourceTotals": data["source_totals"], "canonicalTotals": data["canonical_totals"], "revision": first[0], "run1": first[1], "run2": second[1]}, ensure_ascii=False, indent=2))
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
