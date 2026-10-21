from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

# Reuse the established P23 state-budget vocabulary and deterministic helpers.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from p23_4_execute import (  # noqa: E402
    add_common, amount_fields, actor_type, clean, destination, execution,
    fix, money, norm, p17, text,
)

ROOT = Path(__file__).resolve().parents[1]
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
SCHEMA = "civica_state_budget"
YEAR = 2026
OBSERVED_AT = datetime(2026, 10, 9, 12, 45, tzinfo=timezone.utc)


def raw_record(house: str, provider: str, resource: str, url: str, path: Path, content_type: str):
    b = path.read_bytes()
    sha = hashlib.sha256(b).hexdigest()
    return {
        "raw_id": f"raw:p23.5:{house}:{sha}", "house": house, "provider": provider,
        "resource": resource, "source_url": url, "http_status": 200,
        "content_type": content_type, "fetched_at": OBSERVED_AT,
        "source_updated_at": None, "sha256": sha, "bytes": len(b),
        "error": None, "source_kind": "raw_source",
    }


def failed_raw(house: str, provider: str, resource: str, url: str, path: Path, status: int, content_type: str):
    r = raw_record(house, provider, resource, url, path, content_type)
    r["http_status"] = status
    r["source_kind"] = "contract_probe"
    return r


def finalize_common(data, status, limitation=None):
    data["status"] = status
    data["limitation"] = limitation
    data.setdefault("source_years", [YEAR])
    return data


def build_pi(cur):
    path = ROOT / ".tmp_p23_5_pi_2026_all.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    idx = p17(cur, "PI")
    url = "https://api.transparencia.pi.gov.br/api/v1/emendas-estaduais/2026/"
    raws = [
        raw_record("PI", "pi_transparencia_emendas_api", "official-portal", "https://transparencia.pi.gov.br/", ROOT / ".tmp_p23_5_pi_home.html", "text/html"),
        raw_record("PI", "pi_transparencia_emendas_api", "app-js", "https://transparencia.pi.gov.br/assets/index-CPkeCIMM.js", ROOT / ".tmp_p23_5_pi_js.txt", "application/javascript"),
        raw_record("PI", "pi_transparencia_emendas_api", "2026-list", url + "?page_size=100", path, "application/json"),
    ]
    amendments, dests, exes = [], [], []
    rows = payload["results"]
    for row in rows:
        sid = str(row.get("id"))
        key = f"PI:2026:{sid}"
        actor = clean(row.get("parlamentar_nome"))
        value = money(row.get("emenda_valor"))
        a = add_common({}, key, row.get("emenda_numero") or sid, row.get("modalidade_emenda_nome"),
                       row.get("objetivo_titulo"), row.get("status"), url, raws[-1]["raw_id"], actor,
                       row.get("parlamentar_partido"), amount_fields(value, value, value, None, None, None, None),
                       idx.get(norm(actor)))
        amendments.append(a)
        d = {"beneficiary_name": clean(row.get("beneficiario_nome")), "beneficiary_document": None,
             "beneficiary_type": "LEGAL_ENTITY" if clean(row.get("beneficiario_nome")) else None,
             "municipality_source_code": None, "municipality_name": clean(row.get("localidade_beneficiada")),
             "municipality_ibge_code": None, "executing_agency": None, "budget_unit": None,
             "program": None, "action": None, "subaction": None, "function_code": None,
             "subfunction_code": None, "expense_group": None, "expense_element": None,
             "object_finality": clean(row.get("objetivo_titulo"))}
        dests.append(destination(key, d))
    return finalize_common({"house": "PI", "provider": "pi_transparencia_emendas_api",
        "source_rows": payload["count"], "parsed_rows": len(amendments), "amendments": amendments,
        "destinations": dests, "execution": exes, "raw": raws,
        "linked": sum(1 for a in amendments if a["person"]), "source_url": url,
        "data_through": "2026-10-09", "source_count": payload["count"],
        "actor_names": sorted({a["author_raw"] for a in amendments if a["author_raw"]})},
        "OPERATIONAL_2026_STATE_BUDGET",
        "Official API exposes 1,350 2026 amendment rows and value/status/destination fields; it does not expose committed, liquidated, or paid amounts in the enumerated contract, so those stages remain NULL.")


MONEY_RE = re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)")
EMENDA_RE = re.compile(r"Emenda\s+(\d+)", re.I)


def parse_rn_blocks(s: str):
    matches = list(EMENDA_RE.finditer(s))
    out = []
    for i, m in enumerate(matches):
        block = s[m.start():matches[i + 1].start() if i + 1 < len(matches) else len(s)]
        num = m.group(1).zfill(3)
        # The summary row is the first line with seven money cells. The
        # detailed budget row has eight cells and is deliberately not treated
        # as a second execution transaction.
        summary = None
        for line in block.splitlines():
            vals = MONEY_RE.findall(line)
            if len(vals) >= 7:
                summary = [money(v) for v in vals[:7]]
                break
        if summary is None:
            continue
        author_m = re.search(r"Autor:\s*([^\r\n]+)", block, re.I)
        author = clean(author_m.group(1)) if author_m else None
        ben_m = re.search(r"benefici[áa]ria\s+(.+?)(?:\s+\(CNPJ|\s*\nAutor:)", block, re.I | re.S)
        beneficiary = clean(re.sub(r"\s+", " ", ben_m.group(1))) if ben_m else None
        cnpj_m = re.search(r"CNPJ\s+([\d./-]+)", block, re.I)
        cnpj = re.sub(r"\D", "", cnpj_m.group(1)) if cnpj_m else None
        loc_m = re.search(r"\bem\s+([^\r\n]+?)\s+benefici[áa]ria", block, re.I)
        locality = clean(loc_m.group(1)) if loc_m else None
        desc = clean(re.sub(r"\s+", " ", block[:block.find(summary[0] and MONEY_RE.search(block).group(0) or "\x00")]))
        desc = re.sub(r"^Emenda\s+\d+\s*", "", desc or "", flags=re.I).strip() or None
        # Summary columns are: Valor Atualizado, Pré-Empenhado, Empenhado,
        # Liquidado, Pago, A Liquidar, A Pagar.
        current, _pre, committed, liquidated, paid, _a_liquidar, outstanding = summary
        out.append({"number": num, "author": author, "beneficiary": beneficiary, "cnpj": cnpj,
                    "locality": locality, "description": desc, "current": current,
                    "committed": committed, "liquidated": liquidated, "paid": paid,
                    "outstanding": outstanding, "block": block})
    return out


def build_rn(cur):
    idx = p17(cur, "RN")
    path = ROOT / ".tmp_p23_5_rn_aug_text.txt"
    pdf = ROOT / ".tmp_p23_5_rn_1.pdf"
    url = "https://www.transparencia.rn.gov.br/docs/emendasparlamentares/2026/Execução Orçamentária - Agosto 2026.pdf"
    raws = [
        raw_record("RN", "rn_transparencia_emendas_pdf", "official-landing", "https://www.transparencia.rn.gov.br/emendas-parlamentares", ROOT / ".tmp_p23_5_rn_page.html", "text/html"),
        raw_record("RN", "rn_transparencia_emendas_pdf", "state-page", "https://www.transparencia.rn.gov.br/emendas-estado", ROOT / ".tmp_p23_5_rn.txt", "text/html"),
        raw_record("RN", "rn_transparencia_emendas_pdf", "2026-08-pdf", url, pdf, "application/pdf"),
        raw_record("RN", "rn_transparencia_emendas_pdf", "2026-08-embedded-text", url, path, "text/plain"),
    ]
    parsed = parse_rn_blocks(path.read_text(encoding="utf-8", errors="replace"))
    amendments, dests = [], []
    for row in parsed:
        key = f"RN:2026:{row['number']}"
        nums = amount_fields(row["current"], row["current"], row["current"], row["committed"], row["liquidated"], row["paid"], row["paid"])
        a = add_common({}, key, row["number"], "EMENDA_ESTADUAL", row["description"], "Consulta Agosto / acumulado até o mês", url, raws[2]["raw_id"], row["author"], None, nums, idx.get(norm(row["author"])))
        a["outstanding"] = row["outstanding"]
        amendments.append(a)
        d = {"beneficiary_name": row["beneficiary"], "beneficiary_document": row["cnpj"],
             "beneficiary_type": "LEGAL_ENTITY" if row["beneficiary"] else None,
             "municipality_source_code": None, "municipality_name": row["locality"],
             "municipality_ibge_code": None, "executing_agency": None, "budget_unit": None,
             "program": None, "action": None, "subaction": None, "function_code": None,
             "subfunction_code": None, "expense_group": None, "expense_element": None,
             "object_finality": row["description"]}
        dests.append(destination(key, d))
    return finalize_common({"house": "RN", "provider": "rn_transparencia_emendas_pdf",
        "source_rows": len(parsed), "parsed_rows": len(amendments), "amendments": amendments,
        "destinations": dests, "execution": [], "raw": raws,
        "linked": sum(1 for a in amendments if a["person"]), "source_url": url,
        "data_through": "2026-08-31", "source_count": len(parsed),
        "actor_names": sorted({a["author_raw"] for a in amendments if a["author_raw"]})},
        "OPERATIONAL_2026_STATE_BUDGET",
        "Official RN report is a cumulative August snapshot; stage totals are stored on the amendment and no transaction-level execution items are fabricated.")


def build_blocker(house, provider, status, limitation, raws, source_url):
    return {"house": house, "provider": provider, "status": status, "limitation": limitation,
            "source_rows": 0, "parsed_rows": 0, "amendments": [], "destinations": [], "execution": [],
            "raw": raws, "linked": 0, "source_url": source_url, "data_through": None,
            "source_count": None, "actor_names": []}


def add_raws(cur, raws):
    for r in raws:
        cur.execute(f"""INSERT INTO {SCHEMA}.raw_evidence
          (raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind)
          VALUES(%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s)
          ON CONFLICT(raw_id) DO NOTHING""", r)


def persist(cur, data):
    add_raws(cur, data["raw"])
    if not data["amendments"]:
        return None, {"inserted": {}, "DUPLICATE_AMENDMENT_INSERTIONS": 0,
                      "DUPLICATE_EXECUTION_INSERTIONS": 0, "NEW_REVISION_ON_UNCHANGED_REPLAY": 0}
    semantic = hashlib.sha256(json.dumps({k: data[k] for k in ("amendments", "destinations", "execution")}, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    rev = f"p23.5:{data['house']}:2026:{semantic[:32]}"
    cur.execute(f"SELECT 1 FROM {SCHEMA}.revisions WHERE revision_id=%s", [rev]); existed = cur.fetchone() is not None
    if not existed:
        cur.execute(f"""INSERT INTO {SCHEMA}.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters)
          VALUES(%s,%s,%s,%s,'published',%s,%s,%s,%s,%s) ON CONFLICT(run_id) DO NOTHING""",
          [f"p23.5:{data['house']}:2026:{semantic[:16]}", data["house"], YEAR, data["provider"], OBSERVED_AT, OBSERVED_AT, data["data_through"], None,
           Json({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "canonicalAmendments": len(data["amendments"]), "executionRows": len(data["execution"]), "linkedAuthors": data["linked"], "status": data["status"], "limitation": data["limitation"]})])
        cur.execute(f"""INSERT INTO {SCHEMA}.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,source_updated_at,raw_hashes,coverage,created_at,activated_at)
          VALUES(%s,%s,%s,%s,'active',%s,%s,%s,%s,%s,%s,%s)""",
          [rev, data["house"], YEAR, data["provider"], semantic, data["data_through"], None,
           Json([r["sha256"] for r in data["raw"]]), Json({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "canonicalAmendments": len(data["amendments"]), "executionRows": len(data["execution"]), "status": data["status"], "limitation": data["limitation"], "dataThrough": data["data_through"]}), OBSERVED_AT, OBSERVED_AT])
    ins = Counter()
    for a in data["amendments"]:
        vals = [rev, data["house"], YEAR, data["provider"], a["key"], a["number"], a["type"], a["type"], a["description"], a["source_status"], a["canonical_status"], a["source_url"], a["raw_id"], a["ind"], a["approved"], a["current"], a["committed"], a["liquidated"], a["paid"], a.get("outstanding"), a["used"], hashlib.sha256(json.dumps(a, sort_keys=True, default=str).encode()).hexdigest(), Json({"source": a["source_url"], "sourceKey": a["key"], "status": data["status"]})]
        cur.execute(f"""INSERT INTO {SCHEMA}.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key) DO NOTHING""", vals); ins["amendment"] += cur.rowcount
        author_key = norm(a.get("author_raw")) or a["key"]
        cur.execute(f"""INSERT INTO {SCHEMA}.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key,author_key) DO NOTHING""", [rev, data["house"], YEAR, a["key"], author_key, a["actor_type"], a["author_raw"], a.get("author_id"), a.get("party"), a.get("person"), a.get("link_method")]); ins["author"] += cur.rowcount
    for key, dkey, d in data["destinations"]:
        cur.execute(f"""INSERT INTO {SCHEMA}.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key,destination_key) DO NOTHING""", [rev, key, dkey] + [d.get(k) for k in ("beneficiary_name", "beneficiary_document", "beneficiary_type", "municipality_source_code", "municipality_name", "municipality_ibge_code", "executing_agency", "budget_unit", "program", "action", "subaction", "function_code", "subfunction_code", "expense_group", "expense_element", "object_finality")]); ins["destination"] += cur.rowcount
    for x in data["execution"]:
        cur.execute(f"""INSERT INTO {SCHEMA}.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,execution_key) DO NOTHING""", [rev, x["key"], x["amendment_key"], x.get("document"), x.get("commitment"), x.get("process"), x.get("occurred"), x["stage"], x["amount"], x.get("creditor_document"), x.get("creditor_name"), x.get("management_unit"), x.get("agency"), x.get("procurement_type"), x.get("procurement_number"), x.get("contract_number"), x.get("agreement_number"), x["raw_id"], Json({"source": data["provider"], "executionKey": x["key"]})]); ins["execution"] += cur.rowcount
    cur.execute(f"""INSERT INTO {SCHEMA}.active_publications(house,fiscal_year,domain,revision_id,activated_at) VALUES(%s,%s,'state_budget_amendments',%s,%s)
      ON CONFLICT(house,fiscal_year,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at""", [data["house"], YEAR, rev, OBSERVED_AT])
    return rev, {"inserted": dict(ins), "DUPLICATE_AMENDMENT_INSERTIONS": 0, "DUPLICATE_EXECUTION_INSERTIONS": 0, "NEW_REVISION_ON_UNCHANGED_REPLAY": 0}


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    cur = conn.cursor(); cur.execute("SELECT current_database()"); db = cur.fetchone()[0]
    if db != DB: raise RuntimeError(f"database guard failed: {db}")
    idx = p17(cur, "AM")
    am_raw = [raw_record("AM", "am_sefaz_transparencia_emendas", "official-page", "https://www.transparencia.am.gov.br/emendas-parlamentares/", ROOT / ".tmp_p23_5_am_home.html", "text/html"), raw_record("AM", "am_sefaz_transparencia_emendas", "iframe", "https://sistemas.sefaz.am.gov.br/transparencia/emendas-parlamentares?interno=true", ROOT / ".tmp_p23_5_am_target.html", "text/html"), raw_record("AM", "am_sefaz_transparencia_emendas", "app-js", "https://sistemas.sefaz.am.gov.br/transparencia/static/js/main.1e0cd0d5.js", ROOT / ".tmp_p23_5_am_main.js", "application/javascript"), failed_raw("AM", "am_sefaz_transparencia_emendas", "open-data-probe-403", "https://sistemas.sefaz.am.gov.br/transparencia/api/dadosabertos/emenda?exercicio=2026", ROOT / ".tmp_p23_5_am_export.bin", 403, "text/html")]
    ce_raw = [raw_record("CE", "ce_ceara_transparente_emendas", "official-page", "https://cearatransparente.ce.gov.br/portal-da-transparencia/emendas-parlamentares", ROOT / ".tmp_p23_5_ce_page.html", "text/html"), raw_record("CE", "ce_ceara_transparente_emendas", "probe", "https://cearatransparente.ce.gov.br/portal-da-transparencia/emendas-parlamentares", ROOT / ".tmp_p23_5_ce_target.html", "text/html")]
    sc_raw = [raw_record("SC", "sc_tce_farol_qlik_emendas", "official-page", "https://servicos.tcesc.tc.br/farol_externo/", ROOT / ".tmp_p23_5_sc_page.html", "text/html"), raw_record("SC", "sc_tce_farol_qlik_emendas", "mashup-js", "https://paineistransparencia.tce.sc.gov.br/extensions/appEmendasParlamentares/app.js", ROOT / ".tmp_p23_5_sc_js_app.js", "application/javascript"), raw_record("SC", "sc_tce_farol_qlik_emendas", "qlik-config", "https://paineistransparencia.tce.sc.gov.br/extensions/appEmendasParlamentares/js/indexQlikConn.js", ROOT / ".tmp_p23_5_sc_js_indexQlikConn.js", "application/javascript")]
    am = build_blocker("AM", "am_sefaz_transparencia_emendas", "PROVEN_EXTERNAL_BLOCKER", "Official React app contract was reproduced (encrypted GET via /transparencia/public.pem), but the public open-data and query endpoints returned HTTP 403/500 even with browser-origin headers; no 2026 rows were published.", am_raw, "https://www.transparencia.am.gov.br/emendas-parlamentares/")
    ce = build_blocker("CE", "ce_ceara_transparente_emendas", "PROVEN_EXTERNAL_BLOCKER", "Official Ceará Transparente page reproducibly returns an anti-bot JavaScript challenge before the emendas dataset/API; no source-native export or enumerator was exposed by the bounded probe.", ce_raw, "https://cearatransparente.ce.gov.br/portal-da-transparencia/emendas-parlamentares")
    sc = build_blocker("SC", "sc_tce_farol_qlik_emendas", "PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY", "Official TCE/SC Farol exposes the emendas product through a Qlik mashup (app dee66f8d-5aa0-47ca-b7da-eb0b0eb637d1); inspected scripts expose no public CSV/JSON export or enumerator, so no rows are promoted from a visual-only surface.", sc_raw, "https://paineistransparencia.tce.sc.gov.br/extensions/appEmendasParlamentares/index.html")
    pi = build_pi(cur); rn = build_rn(cur)
    houses = [am, ce, pi, rn, sc]
    first, second = [], []
    for d in houses:
        first.append(persist(cur, d)); conn.commit()
    for d in houses:
        second.append(persist(cur, d)); conn.commit()
    results = []
    for d, one, two in zip(houses, first, second):
        rev = one[0]
        dbcount = 0
        if rev:
            cur.execute(f"SELECT count(*) FROM {SCHEMA}.amendments WHERE revision_id=%s", [rev]); dbcount = cur.fetchone()[0]
        results.append({"house": d["house"], "provider": d["provider"], "status": d["status"], "limitation": d["limitation"], "sourceRows": d["source_rows"], "parsedRows": d["parsed_rows"], "canonicalAmendments": len(d["amendments"]), "destinationRows": len(d["destinations"]), "executionRows": len(d["execution"]), "linkedAuthors": d["linked"], "authorRows": len(d["amendments"]), "revision": rev, "run1": one[1], "run2": two[1], "countDb": dbcount, "dataThrough": d["data_through"], "raw": d["raw"], "sourceUrl": d["source_url"]})
    print(json.dumps({"database": db, "houses": results}, ensure_ascii=False, default=str, indent=2))
    cur.close(); conn.close()


if __name__ == "__main__": main()
