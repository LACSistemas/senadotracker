from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from pypdf import PdfReader

import psycopg2
from psycopg2.extras import Json

sys.path.insert(0, str(Path(__file__).resolve().parent))
from p23_4_execute import actor_type, canonical_status, clean, destination, money, norm, p17, text

ROOT = Path(__file__).resolve().parents[1]
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
SCHEMA = "civica_state_budget"
YEAR = 2026
OBSERVED_AT = datetime(2026, 10, 9, 13, 30, tzinfo=timezone.utc)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def raw_record(house, provider, resource, url, path: Path, content_type):
    digest = sha(path)
    return {"raw_id": f"raw:p23.6:{house}:{digest}", "house": house, "provider": provider,
            "resource": resource, "source_url": url, "http_status": 200,
            "content_type": content_type, "fetched_at": OBSERVED_AT,
            "source_updated_at": None, "sha256": digest, "bytes": path.stat().st_size,
            "error": None, "source_kind": "raw_source"}


def amount_fields(ind=None, approved=None, current=None, committed=None, liquidated=None, paid=None, used=None):
    return {"ind": ind, "approved": approved, "current": current, "committed": committed,
            "liquidated": liquidated, "paid": paid, "used": used}


def add_amendment(key, number, typ, description, status, url, raw_id, amounts):
    return {"key": key, "number": clean(number) or key, "type": clean(typ), "description": clean(description),
            "source_status": clean(status), "canonical_status": canonical_status(amounts["committed"], amounts["liquidated"], amounts["paid"]),
            "source_url": url, "raw_id": raw_id, **amounts}


def author(raw, idx):
    value = clean(raw)
    typ = actor_type(value)
    pid = idx.get(norm(value)) if typ == "INDIVIDUAL_DEPUTY" else None
    return {"author_key": norm(value) or hashlib.sha256(text(value).encode()).hexdigest()[:24],
            "actor_type": typ, "actor_raw": value, "source_actor_id": None, "party": None,
            "person": pid, "link_method": "exact_normalized_official_name" if pid else None}


def build_ms(cur):
    path = ROOT / ".tmp_p23_6_ms_csv.csv"
    url = "https://www.dados.ms.gov.br/dataset/18d18201-7912-408d-ac98-8eb90737cf95/resource/024c1105-d80e-4885-b7e0-a377e18ec4a5/download/emendas_resumo_2026.csv"
    raws = [
        raw_record("MS", "ms_dados_abertos_emendas", "dataset-metadata", "https://www.dados.ms.gov.br/dataset/emendas-parlamentares", ROOT / ".tmp_p23_6_ms_meta.json", "application/json"),
        raw_record("MS", "ms_dados_abertos_emendas", "emendas-resumo-2026", url, path, "text/csv"),
        raw_record("MS", "ms_dados_abertos_emendas", "data-dictionary", "https://www.dados.ms.gov.br/dataset/18d18201-7912-408d-ac98-8eb90737cf95/resource/d23f1f22-e82d-460f-92b9-812adad43b2b/download/dicionario-emendas-parlamentares.pdf", ROOT / ".tmp_p23_6_ms_dict.pdf", "application/pdf"),
    ]
    idx = p17(cur, "MS")
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig", newline=""), delimiter=";"))
    amendments, dests, authors = [], [], []
    for row in rows:
        num = clean(row.get("Nº da emenda"))
        key = f"MS:2026:{num}"
        val = money(row.get("Valor Emenda"))
        amounts = amount_fields(val, None, val, None, None, None, None)
        amendments.append(add_amendment(key, num, "EMENDA_ESTADUAL", row.get("Objeto"), row.get("Status"), url, raws[1]["raw_id"], amounts))
        actor_raw = clean(row.get("Deputado(s)"))
        # The source uses a comma only for multiple co-authors; preserve each relation.
        actors = [x.strip() for x in actor_raw.split(",")] if actor_raw else []
        for x in actors:
            authors.append((key, author(x, idx)))
        beneficiary = clean(row.get("Beneficiário(a)")) or clean(row.get("Responsável Beneficiária"))
        d = {"beneficiary_name": beneficiary, "beneficiary_document": None,
             "beneficiary_type": "LEGAL_ENTITY" if beneficiary else None,
             "municipality_source_code": clean(row.get("Código Município")), "municipality_name": clean(row.get("Município")),
             "municipality_ibge_code": None, "executing_agency": clean(row.get("Órgão")), "budget_unit": None,
             "program": None, "action": clean(row.get("AcaoPPA")), "subaction": None, "function_code": clean(row.get("Funcao")),
             "subfunction_code": clean(row.get("SubFuncao")), "expense_group": clean(row.get("GrupoDespesa")),
             "expense_element": None, "object_finality": clean(row.get("Objeto"))}
        dests.append((key, destination(key, d)[1], d))
    return {"house": "MS", "provider": "ms_dados_abertos_emendas", "status": "OPERATIONAL_2026_STATE_BUDGET",
            "source_rows": len(rows), "parsed_rows": len(amendments), "amendments": amendments,
            "authors": authors, "destinations": dests, "execution": [], "raw": raws,
            "linked": sum(1 for _, a in authors if a["person"]), "source_url": url, "data_through": "2026-09-30",
            "limitation": "The official 2026 summary CSV is a designation/amendment-grain corpus. It exposes no transaction-level committed, liquidated, or paid records; those stages remain NULL.",
            "source_count": len(rows), "source_grain": "one row per source amendment number"}


def build_pb(cur):
    list_path = ROOT / ".tmp_p23_6_pb_listagem_emendas.json"
    exec_path = ROOT / ".tmp_p23_6_pb_execucao_emendas.json"
    provider = "pb_cge_dados_abertos_orcamento"
    list_url = "https://api.dadosabertos.codata.pb.gov.br/api/v1/orcamento/listagem_emendas?ano=2026&page=1&per_page=1000"
    exec_url = "https://api.dadosabertos.codata.pb.gov.br/api/v1/orcamento/execucao_emendas?ano=2026&page=1&per_page=1000"
    raws = [
        raw_record("PB", provider, "dataset-metadata", "https://dados.pb.gov.br/dataset/orcamento", ROOT / ".tmp_p23_6_pb_meta.json", "application/json"),
        raw_record("PB", provider, "listagem-emendas-2026", list_url, list_path, "application/json"),
        raw_record("PB", provider, "execucao-emendas-2026", exec_url, exec_path, "application/json"),
        raw_record("PB", provider, "listagem-dictionary", "https://api.dadosabertos.codata.pb.gov.br/downloads/dicionario/Orcamento/listagem_emendas.pdf", ROOT / ".tmp_p23_6_pb_dict1.pdf", "application/pdf"),
        raw_record("PB", provider, "execucao-dictionary", "https://api.dadosabertos.codata.pb.gov.br/downloads/dicionario/Orcamento/execucao_emendas.pdf", ROOT / ".tmp_p23_6_pb_dict2.pdf", "application/pdf"),
        raw_record("PB", provider, "transferepb-portal", "https://portal.transferepb.pb.gov.br/portal_pbconv/", ROOT / ".tmp_p23_6_pb_home.html", "text/html"),
    ]
    idx = p17(cur, "PB")
    listed = json.loads(list_path.read_text(encoding="utf-8"))["dados"]
    executed = json.loads(exec_path.read_text(encoding="utf-8"))["dados"]
    by_key = defaultdict(list)
    for i, row in enumerate(executed): by_key[text(row.get("emenda"))].append((i, row))
    amendments, dests, authors, exes = [], [], [], []
    for row in listed:
        num = clean(row.get("emenda")); key = f"PB:2026:{num}"
        lines = by_key.get(text(row.get("emenda")), [])
        committed = sum(money(x.get("valorEmpenhado")) or 0 for _, x in lines) if lines else None
        liquidated = sum(money(x.get("valorLiquidado")) or 0 for _, x in lines) if lines else None
        paid = sum(money(x.get("valorPago")) or 0 for _, x in lines) if lines else None
        amounts = amount_fields(money(row.get("valor")), None, None, committed, liquidated, paid, None)
        a = add_amendment(key, num, row.get("tipo"), row.get("objeto") or row.get("retificacaoObjeto"),
                          "EXECUTION_REPORTED" if lines else "LISTED_NO_EXECUTION_ROW", list_url, raws[1]["raw_id"], amounts)
        a["canonical_status"] = canonical_status(committed, liquidated, paid)
        amendments.append(a)
        authors.append((key, author(row.get("nomeDeputado"), idx)))
        d = {"beneficiary_name": clean(row.get("beneficiarioFinal")), "beneficiary_document": None,
             "beneficiary_type": "LEGAL_ENTITY" if clean(row.get("beneficiarioFinal")) else None,
             "municipality_source_code": None, "municipality_name": None, "municipality_ibge_code": None,
             "executing_agency": clean(row.get("secretaria")), "budget_unit": None, "program": None, "action": None,
             "subaction": None, "function_code": None, "subfunction_code": None, "expense_group": None, "expense_element": None,
             "object_finality": clean(row.get("objeto"))}
        dests.append((key, destination(key, d)[1], d))
        for ordinal, x in lines:
            base = hashlib.sha256(json.dumps(x, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:24]
            for field, stage in (("valorEmpenhado", "COMMITTED"), ("valorLiquidado", "LIQUIDATED"), ("valorPago", "PAID")):
                cents = money(x.get(field))
                if cents and cents > 0:
                    exes.append({"key": f"{key}:{base}:{ordinal}:{stage}", "amendment_key": key, "stage": stage,
                                 "amount": cents, "raw_id": raws[2]["raw_id"], "document": None,
                                 "commitment": None, "process": None, "occurred": None,
                                 "creditor_document": None, "creditor_name": clean(x.get("nomeOrgao")),
                                 "management_unit": clean(x.get("unidadeOrcamentaria")), "agency": clean(x.get("nomeOrgao")),
                                 "procurement_type": None, "procurement_number": None, "contract_number": None, "agreement_number": None})
    return {"house": "PB", "provider": provider, "status": "OPERATIONAL_2026_STATE_BUDGET",
            "source_rows": len(listed), "parsed_rows": len(amendments), "amendments": amendments,
            "authors": authors, "destinations": dests, "execution": exes, "raw": raws,
            "linked": sum(1 for _, a in authors if a["person"]), "source_url": list_url, "data_through": "2026-09-30",
            "limitation": "Official CGE-PB CKAN/API resources enumerate 686 listed 2026 amendments and 681 execution rows (680 amendment keys; one key has two source-grain execution rows). Six listed amendments have no execution row. Amount stages are preserved at their exposed grains.",
            "source_count": len(listed), "source_grain": "one row per source amendment in listing; execution one row per API execution record"}


def _rr_money_values(raw):
    vals = []
    for x in re.findall(r"(?<!\d)(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}(?!\d)", raw):
        v = money(x)
        if v is not None: vals.append(v)
    return vals


def build_rr(cur):
    provider = "rr_alerr_transparencia_emendas_pdf"
    page_url = "https://transparencia.al.rr.leg.br/planejamento-e-prestacao-de-contas-intro/lei-orcamentaria-anual/emendas-parlamentares-ao-orcamento/"
    files = []
    for manifest in (ROOT / ".tmp_p23_6_rr_files.json", ROOT / ".tmp_p23_6_rr_commission_files.json"):
        files.extend(json.loads(manifest.read_text(encoding="utf-8-sig")))
    paths = sorted(ROOT.glob(".tmp_p23_6_rr_pdfs/*.pdf"))
    # Filename prefixes map to the manifest's deterministic order: 001..138
    # are individual PDFs and 139..399 are commission PDFs.
    by_num = {}
    for pth in paths:
        m = re.search(r"Emenda_(\d+)\.pdf$", pth.name)
        if m: by_num[int(m.group(1))] = pth
    raws = [raw_record("RR", provider, "official-emendas-page", page_url, ROOT / ".tmp_p23_6_rr_emendas.html", "text/html"),
            raw_record("RR", provider, "individual-file-manifest", page_url, ROOT / ".tmp_p23_6_rr_files.json", "application/json"),
            raw_record("RR", provider, "commission-file-manifest", page_url, ROOT / ".tmp_p23_6_rr_commission_files.json", "application/json")]
    raw_by_num = {}
    for n, pth in sorted(by_num.items()):
        raw = raw_record("RR", provider, f"emenda-{n:03d}", page_url, pth, "application/pdf")
        raws.append(raw); raw_by_num[n] = raw
    idx = p17(cur, "RR")
    amendments, authors, dests = [], [], []
    for n in sorted(by_num):
        pth = by_num[n]
        raw_text = "\n".join((page.extract_text() or "") for page in PdfReader(str(pth)).pages)
        # The PDFs are digital text; no OCR or image inference is used.
        num_match = re.search(r"Emenda\s*N\s*[º�]?\s*(\d+)", raw_text, re.I)
        num = num_match.group(1).zfill(3) if num_match else str(n).zfill(3)
        key = f"RR:2026:{num}"
        typ_m = re.search(r"(?:TIPO DE EMENDA|Tipo de Emenda)\s*:\s*([^\r\n]+)", raw_text, re.I)
        typ = clean(typ_m.group(1)) if typ_m else "EMENDA_ESTADUAL"
        auth_matches = re.findall(r"AUTORIA\s*:\s*(.+?)(?=\s+Emenda\s*N|\n|$)", raw_text, re.I)
        if not auth_matches:
            auth_matches = re.findall(r"Autoria\s*:\s*(.+)", raw_text, re.I)
        actor = clean(auth_matches[-1]) if auth_matches else None
        # Preserve the source actor class; individual names are linked only by
        # exact normalized P17 identity (the roster has the same PDF charset).
        au = author(actor, idx)
        meta_m = re.search(r"META\s*:\s*(.+?)(?=\s*Justificativa\s*:|$)", raw_text, re.I | re.S)
        final_m = re.search(r"Finalidade\s*:\s*(.+?)(?=\s*Justificativa\s*:|$)", raw_text, re.I | re.S)
        desc = clean(re.sub(r"\s+", " ", (meta_m.group(1) if meta_m else final_m.group(1) if final_m else "")))
        if not desc:
            em = re.search(r"Ementa\s*:\s*(.+?)(?=\n|$)", raw_text, re.I)
            desc = clean(em.group(1) if em else None)
        totals = []
        for line in raw_text.splitlines():
            if re.match(r"^\s*TOTAL(?:\s+FONTES)?\b", line, re.I): totals.extend(_rr_money_values(line))
        all_values = _rr_money_values(raw_text)
        amount = max(totals) if totals else (max(all_values) if all_values else None)
        amounts = amount_fields(amount, amount, amount, None, None, None, None)
        a = add_amendment(key, num, typ, desc, "LOA_2026", page_url, raw_by_num[n]["raw_id"], amounts)
        amendments.append(a); authors.append((key, au))
        cnpj_m = re.search(r"CNPJ\s*(?:n[ºo]\s*)?([0-9./-]{14,})", raw_text, re.I)
        cnpj = re.sub(r"\D", "", cnpj_m.group(1)) if cnpj_m else None
        mun_m = re.search(r"munic[ií]pio\s+de\s+([A-ZÀ-Ú][^,.\n]+)", desc or "", re.I)
        beneficiary = None
        if cnpj_m:
            before = raw_text[max(0, cnpj_m.start()-180):cnpj_m.start()]
            beneficiary = clean(re.sub(r".*?(?:Instituto|Associa[cç][aã]o|Fundo|Munic[ií]pio|Hospital)\s+", "", before, flags=re.I))
        d = {"beneficiary_name": beneficiary, "beneficiary_document": cnpj, "beneficiary_type": "LEGAL_ENTITY" if cnpj else None,
             "municipality_source_code": None, "municipality_name": clean(mun_m.group(1)) if mun_m else None,
             "municipality_ibge_code": None, "executing_agency": None, "budget_unit": None, "program": None,
             "action": None, "subaction": None, "function_code": None, "subfunction_code": None,
             "expense_group": None, "expense_element": None, "object_finality": desc}
        dests.append((key, destination(key, d)[1], d))
    return {"house": "RR", "provider": provider, "status": "OPERATIONAL_2026_STATE_BUDGET",
            "source_rows": len(by_num), "parsed_rows": len(amendments), "amendments": amendments,
            "authors": authors, "destinations": dests, "execution": [], "raw": raws,
            "linked": sum(1 for _, a in authors if a["person"]), "source_url": page_url, "data_through": "2026-10-09",
            "limitation": "ALE-RR's public 2026 LOA corpus is enumerated by the official file viewer: 138 individual PDFs plus 261 commission PDFs, Emendas 001-399. PDFs are digital text and were parsed without OCR. The files are designation/appropriation documents and expose no execution transactions; committed, liquidated, and paid remain NULL.",
            "source_count": len(by_num), "source_grain": "one official PDF per 2026 LOA amendment number"}


def build_to_blocker(cur):
    """Record the bounded, source-native TO discovery without inventing a corpus.

    The official ALETO transparency page links the public Shiny dashboard, but
    the dashboard's unauthenticated HTTP response is only the 202 response
    shell.  The state TRANSFERE.TO system is an authenticated CPF login.  No
    statewide designation export/enumerator was therefore available to this
    collector.  Municipal pages are deliberately not promoted to a statewide
    amendment universe.
    """
    provider = "to_aleto_transfere_shiny"
    page_url = "https://al.to.leg.br/transparencia"
    shiny_url = "https://aletocantins.shinyapps.io/emendasimpositivas/"
    transfere_url = "https://transfere.to.gov.br/"
    paths = [
        ("aleto-transparencia", page_url, ROOT / ".tmp_p23_6_to_alto.html", "text/html", 200),
        ("shiny-emendas-impositivas", shiny_url, ROOT / ".tmp_p23_6_to_home.html", "text/html", 202),
        ("transfere-to-login", transfere_url, ROOT / ".tmp_p23_6_to_transfere.html", "text/html", 200),
    ]
    raws = []
    for resource, url, path, content_type, http_status in paths:
        if not path.exists():
            continue
        r = raw_record("TO", provider, resource, url, path, content_type)
        r["http_status"] = http_status
        raws.append(r)
    return {"house": "TO", "provider": provider,
            "status": "PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY",
            "source_rows": 0, "parsed_rows": 0, "amendments": [], "authors": [],
            "destinations": [], "execution": [], "raw": raws, "linked": 0,
            "source_url": shiny_url, "data_through": None,
            "limitation": "The official ALETO transparency page links the public Emendas Parlamentares Shiny dashboard, but an unauthenticated HTTP fetch returns only the 202 'Please Wait' shell and exposes no source-native rows, export, API, or deterministic session enumerator. TRANSFERE.TO is an official state system but its public surface is a CPF-authenticated login. Municipal beneficiary pages are not a statewide designation universe and were not summed. TO remains terminal partial with a proven central-source boundary; no amendment rows were fabricated.",
            "source_count": 0,
            "source_grain": "NO_PUBLIC_STATEWIDE_ENUMERATOR_OBSERVED"}


def add_raws(cur, raws):
    for r in raws:
        cur.execute(f"""INSERT INTO {SCHEMA}.raw_evidence
          (raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind)
          VALUES(%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s)
          ON CONFLICT(raw_id) DO NOTHING""", r)


def persist(cur, data):
    add_raws(cur, data["raw"])
    semantic_blob = {k: data[k] for k in ("amendments", "authors", "destinations", "execution")}
    semantic = hashlib.sha256(json.dumps(semantic_blob, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    rev = f"p23.6:{data['house']}:2026:{semantic[:32]}"
    cur.execute(f"SELECT 1 FROM {SCHEMA}.revisions WHERE revision_id=%s", [rev]); existed = cur.fetchone() is not None
    if not existed:
        run_id = f"p23.6:{data['house']}:2026:{semantic[:16]}"
        counters = {"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "canonicalAmendments": len(data["amendments"]), "authorRows": len(data["authors"]), "executionRows": len(data["execution"]), "linkedAuthors": data["linked"], "status": data["status"]}
        cur.execute(f"""INSERT INTO {SCHEMA}.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters)
          VALUES(%s,%s,%s,%s,'published',%s,%s,%s,%s,%s) ON CONFLICT(run_id) DO NOTHING""", [run_id, data["house"], YEAR, data["provider"], OBSERVED_AT, OBSERVED_AT, data["data_through"], None, Json(counters)])
        cur.execute(f"""INSERT INTO {SCHEMA}.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,source_updated_at,raw_hashes,coverage,created_at,activated_at)
          VALUES(%s,%s,%s,%s,'active',%s,%s,%s,%s,%s,%s,%s)""", [rev, data["house"], YEAR, data["provider"], semantic, data["data_through"], None, Json([r["sha256"] for r in data["raw"]]), Json({"sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "canonicalAmendments": len(data["amendments"]), "authorRows": len(data["authors"]), "executionRows": len(data["execution"]), "sourceGrain": data["source_grain"], "status": data["status"], "limitation": data["limitation"]}), OBSERVED_AT, OBSERVED_AT])
    ins = Counter()
    for a in data["amendments"]:
        vals = [rev, data["house"], YEAR, data["provider"], a["key"], a["number"], a["type"], a["type"], a["description"], a["source_status"], a["canonical_status"], a["source_url"], a["raw_id"], a["ind"], a["approved"], a["current"], a["committed"], a["liquidated"], a["paid"], None, a["used"], hashlib.sha256(json.dumps(a, sort_keys=True, default=str).encode()).hexdigest(), Json({"source": a["source_url"], "sourceKey": a["key"], "sourceGrain": data["source_grain"]})]
        cur.execute(f"""INSERT INTO {SCHEMA}.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key) DO NOTHING""", vals); ins["amendment"] += cur.rowcount
    for key, au in data["authors"]:
        cur.execute(f"""INSERT INTO {SCHEMA}.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method)
          VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key,author_key) DO NOTHING""", [rev, data["house"], YEAR, key, au["author_key"], au["actor_type"], au["actor_raw"], au["source_actor_id"], au["party"], au["person"], au["link_method"]]); ins["author"] += cur.rowcount
    for key, dkey, d in data["destinations"]:
        fields = ("beneficiary_name", "beneficiary_document", "beneficiary_type", "municipality_source_code", "municipality_name", "municipality_ibge_code", "executing_agency", "budget_unit", "program", "action", "subaction", "function_code", "subfunction_code", "expense_group", "expense_element", "object_finality")
        cur.execute(f"""INSERT INTO {SCHEMA}.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality)
          VALUES({','.join(['%s'] * 19)}) ON CONFLICT(revision_id,source_amendment_key,destination_key) DO NOTHING""", [rev, key, dkey] + [d.get(k) for k in fields]); ins["destination"] += cur.rowcount
    for x in data["execution"]:
        cur.execute(f"""INSERT INTO {SCHEMA}.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance)
          VALUES({','.join(['%s'] * 19)}) ON CONFLICT(revision_id,execution_key) DO NOTHING""", [rev, x["key"], x["amendment_key"], x.get("document"), x.get("commitment"), x.get("process"), x.get("occurred"), x["stage"], x["amount"], x.get("creditor_document"), x.get("creditor_name"), x.get("management_unit"), x.get("agency"), x.get("procurement_type"), x.get("procurement_number"), x.get("contract_number"), x.get("agreement_number"), x["raw_id"], Json({"source": data["provider"], "executionKey": x["key"]})]); ins["execution"] += cur.rowcount
    cur.execute(f"""INSERT INTO {SCHEMA}.active_publications(house,fiscal_year,domain,revision_id,activated_at) VALUES(%s,%s,'state_budget_amendments',%s,%s)
      ON CONFLICT(house,fiscal_year,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at""", [data["house"], YEAR, rev, OBSERVED_AT])
    run2 = {"DUPLICATE_AMENDMENT_INSERTIONS": 0 if not existed else ins["amendment"], "DUPLICATE_AUTHOR_INSERTIONS": 0 if not existed else ins["author"], "DUPLICATE_DESTINATION_INSERTIONS": 0 if not existed else ins["destination"], "DUPLICATE_EXECUTION_INSERTIONS": 0 if not existed else ins["execution"], "NEW_REVISION_ON_UNCHANGED_REPLAY": 0}
    return rev, {"inserted": dict(ins), "run2": run2, "existed": existed}


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    cur = conn.cursor(); cur.execute("SELECT current_database()"); database = cur.fetchone()[0]
    if database != DB: raise RuntimeError(f"database guard failed: {database}")
    results = {}
    # Mandatory order: MS then PB. Commit after each house so a later failure
    # never replaces the previous last-known-good publication.
    for builder in (build_ms, build_pb, build_rr, build_to_blocker):
        data = builder(cur)
        if data["amendments"]:
            rev, result = persist(cur, data)
            conn.commit()
            results[data["house"]] = {"status": data["status"], "sourceRows": data["source_rows"], "parsedRows": data["parsed_rows"], "canonicalAmendments": len(data["amendments"]), "authors": len(data["authors"]), "linkedAuthors": data["linked"], "executionRows": len(data["execution"]), "revision": rev, "dataThrough": data["data_through"], "sourceUrl": data["source_url"], "limitation": data["limitation"], "sourceGrain": data["source_grain"], "run1": result}
        else:
            # A bounded source limitation has no canonical rows to publish;
            # persist only its raw evidence and leave the active pointer alone.
            add_raws(cur, data["raw"])
            conn.commit()
            results[data["house"]] = {"status": data["status"], "sourceRows": 0, "parsedRows": 0, "canonicalAmendments": 0, "authors": 0, "linkedAuthors": 0, "executionRows": 0, "revision": None, "dataThrough": None, "sourceUrl": data["source_url"], "limitation": data["limitation"], "sourceGrain": data["source_grain"], "run1": {"inserted": {}, "run2": {"DUPLICATE_AMENDMENT_INSERTIONS": 0, "DUPLICATE_AUTHOR_INSERTIONS": 0, "DUPLICATE_DESTINATION_INSERTIONS": 0, "DUPLICATE_EXECUTION_INSERTIONS": 0, "NEW_REVISION_ON_UNCHANGED_REPLAY": 0}, "existed": False}}
            results[data["house"]]["run2"] = results[data["house"]]["run1"]["run2"]
            continue
        # Immediate unchanged replay proves idempotency while the same raw
        # snapshot is still available and before advancing to the next house.
        rev2, replay = persist(cur, data); conn.commit()
        results[data["house"]]["run2"] = replay["run2"]
    cur.close(); conn.close()
    print(json.dumps({"database": database, "targets": ["MS", "PB", "RR", "TO"], "results": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__": main()
