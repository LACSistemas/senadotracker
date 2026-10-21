from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import Json, execute_values

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / ".p23_1r_raw"
ART = ROOT / "artifacts"
DB = "civica_postgres_lab"
SCHEMA = "civica_state_budget"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
OBSERVED_AT = datetime(2026, 10, 9, 2, 35, tzinfo=timezone.utc)

URLS = {
    "ES_DESIGNATION": "https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/1cd9b722-b712-4b2d-8001-d1687698f5eb/download/emendas-estaduais-2026.csv",
    "ES_EXECUTION": "https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/549173e4-68ab-49c2-beba-71d2a5e90fe5/download/emendas-estaduais-execucao-2026.csv",
    "MG_CSV": "https://mediaserver.almg.gov.br/acervo/497/469/2497469.csv",
    "MG_PAGE": "https://www.almg.gov.br/atividade-parlamentar/emendas-parlamentares/inicial/index.html",
    "RS_PANEL": "https://www.transparencia.rs.gov.br/emendas-parlamentares/emendas-parlamentares-estaduais/dados/",
    "RS_QUERY_DEST": "https://WABI-BRAZIL-SOUTH-redirect.analysis.windows.net/explore/querydata?synchronous=true (model 11412182; official embed)",
    "RS_QUERY_EXEC": "https://WABI-BRAZIL-SOUTH-redirect.analysis.windows.net/explore/querydata?synchronous=true (model 11412182; official embed)",
}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def repair_text(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    s = str(v).strip()
    # ALES/ALMG/PowerBI occasionally contain a replacement character in an
    # otherwise usable UTF-8 response.  Keep it as evidence; identity matching
    # removes it deterministically below.
    return s


def norm_name(v: str) -> str:
    s = repair_text(v).upper()
    if "Ã" in s or "Â" in s:
        try:
            s = s.encode("latin1").decode("utf8").upper()
        except UnicodeError:
            pass
    # Strip only explicit leading titles; word boundaries prevent accidentally
    # turning DELEGADO/PROFESSOR into EGADO/ESSOR.
    title = re.compile(r"^(?:DEP\.?|DEPUTADO[A]?|DR\.?|DOUTOR|DRA\.?|DEL\.?|DELEGADO[A]?|PROF\.?|PROFESSOR|ENGENHEIRO)\s+")
    while title.search(s):
        s = title.sub("", s, count=1)
    s = s.replace("FABRICIO GANDINI", "GANDINI")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace("�", "")
    return re.sub(r"[^A-Z0-9]", "", s)


def amount(v) -> int | None:
    s = repair_text(v)
    if not s or s in {"-", "N/A", "nan", "None"}:
        return None
    s = s.replace("R$", "").replace(" ", "").replace("\u00a0", "")
    # Brazilian decimal/currency notation and PowerBI numeric values.
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return int((Decimal(s) * 100).quantize(Decimal("1")))
    except (InvalidOperation, ValueError):
        return None


def parse_date(v) -> str | None:
    s = repair_text(v)
    if not s:
        return None
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19], fmt).date().isoformat()
        except ValueError:
            pass
    try:
        # Power BI serial milliseconds.
        return datetime.fromtimestamp(float(s) / 1000, tz=timezone.utc).date().isoformat()
    except Exception:
        return None


def load_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep=";", encoding="utf-8-sig", encoding_errors="replace", dtype=str, low_memory=False).fillna("")


def load_powerbi(path: Path):
    s = path.read_bytes().decode("utf-8", errors="replace")
    if [ord(c) for c in s[:3]] == [239, 187, 191]:
        s = s[3:]
    j = json.loads(s)
    d = j["results"][0]["result"]["data"]
    ds = d["dsr"]["DS"][0]
    dm = ds["PH"][0]["DM0"]
    desc = dm[0]["S"]
    dictionaries = ds.get("ValueDicts", {})
    first = dm[0]["C"]
    prev = []
    for i, spec in enumerate(desc):
        val = first[i] if i < len(first) else None
        dn = spec.get("DN")
        if dn and isinstance(val, int):
            val = dictionaries[dn][val] if 0 <= val < len(dictionaries.get(dn, [])) else val
        prev.append(val)
    rows = [prev.copy()]
    for row in dm[1:]:
        repeat = row.get("R", 0)
        cells = row.get("C", [])
        ci = 0
        vals = []
        for i, spec in enumerate(desc):
            if repeat & (1 << i):
                val = prev[i]
            else:
                val = cells[ci] if ci < len(cells) else None
                ci += 1
                dn = spec.get("DN")
                if dn and isinstance(val, int):
                    val = dictionaries[dn][val] if 0 <= val < len(dictionaries.get(dn, [])) else val
            vals.append(val)
        prev = vals
        rows.append(vals)
    return rows, d


def raw_file(path: Path, house: str, provider: str, resource: str, url: str, content_type: str):
    return {
        "raw_id": f"raw:p23.1r:{house}:{provider}:{sha(path)}",
        "house": house,
        "provider": provider,
        "resource": resource,
        "source_url": url,
        "http_status": 200,
        "content_type": content_type,
        "fetched_at": OBSERVED_AT,
        "source_updated_at": None,
        "sha256": sha(path),
        "bytes": path.stat().st_size,
        "error": None,
    }


def p17_index(cur):
    cur.execute("select house,external_id,name from civica_state.current_state_parliamentarians where house in ('ES','MG','RS')")
    out = defaultdict(list)
    for house, external_id, name in cur.fetchall():
        out[house].append((str(external_id), str(name), norm_name(name)))
    return out


def link_person(index, house: str, raw: str, source_id: str | None = None):
    n = norm_name(raw)
    candidates = [x for x in index[house] if x[2] == n and n]
    if len(candidates) == 1:
        return candidates[0][0], "exact_normalized_official_name"
    return None, None


def actor_type(raw: str, source_type: str = "") -> str:
    s = norm_name(raw)
    t = norm_name(source_type)
    if "BLOCO" in s or "BANCADA" in s or "BLOCO" in t or "BANCADA" in t:
        return "BLOC" if "BLOCO" in s or "BLOC" in t else "BENCH"
    if any(x in s for x in ("PODEREXECUTIVO", "PODERJUDICIARIO", "TRIBUNAL", "DEFENSORIA", "MINISTERIOPUBLICO", "COMISSAO")):
        return "EXECUTIVE_OR_OTHER"
    return "INDIVIDUAL_DEPUTY"


def canonical_status(indicated, committed, liquidated, paid, raw_status=""):
    if raw_status and "REPROV" in norm_name(raw_status):
        return "BLOCKED_OR_IMPEDED"
    if paid and paid > 0 and indicated and paid >= indicated:
        return "PAID"
    if paid and paid > 0:
        return "PARTIALLY_PAID"
    if liquidated and liquidated > 0:
        return "LIQUIDATED"
    if committed and committed > 0:
        return "COMMITTED"
    return "NOT_STARTED"


def build_data(cur):
    idx = p17_index(cur)
    # ES official CSVs
    esd = load_csv(RAW / "es_designation.csv")
    ese = load_csv(RAW / "es_execution.csv")
    es_raw = {"designation": raw_file(RAW / "es_designation.csv", "ES", "dados_es", "Emendas-Estaduais-2026.csv", URLS["ES_DESIGNATION"], "text/csv"),
              "execution": raw_file(RAW / "es_execution.csv", "ES", "dados_es", "Emendas-Estaduais-Execucao-2026.csv", URLS["ES_EXECUTION"], "text/csv")}
    es_keys = {}
    amendments = []
    for _, r in esd.iterrows():
        key0 = repair_text(r.get("Id")) or repair_text(r.get("NumeroEmenda"))
        key = f"ES:2026:{key0}"
        es_keys[repair_text(r.get("NumeroEmenda"))] = key
        name = repair_text(r.get("NomeAutor"))
        person, method = link_person(idx, "ES", name, repair_text(r.get("CodAutor")))
        ind, com, liq, paid = (amount(r.get(c)) for c in ("ValorPrevisto", "ValorEmpenho", "ValorLiquidado", "ValorPago"))
        amendments.append({"key": key, "number": repair_text(r.get("NumeroEmenda")), "type": repair_text(r.get("TipoEmenda")), "description": repair_text(r.get("ObjetoFinalidade")), "source_status": "2026", "canonical_status": canonical_status(ind, com, liq, paid), "source_url": URLS["ES_DESIGNATION"], "raw_id": es_raw["designation"]["raw_id"], "ind": ind, "approved": None, "current": ind, "committed": com, "liquidated": liq, "paid": paid, "used": amount(r.get("ValorRap")), "author_raw": name, "author_id": repair_text(r.get("CodAutor")), "actor_type": actor_type(name), "person": person, "link_method": method, "party": None, "destination": {"beneficiary_name": repair_text(r.get("Favorecido")), "beneficiary_document": repair_text(r.get("CpfCnpjNis")), "beneficiary_type": None, "municipality_source_code": repair_text(r.get("CodigoMunicipio")), "municipality_name": repair_text(r.get("Municipio")), "municipality_ibge_code": None, "executing_agency": repair_text(r.get("DescricaoOrgaoExecutor")) or repair_text(r.get("OrgaoExecutor")), "budget_unit": None, "program": None, "action": repair_text(r.get("DescricaoAcaoPPA")) or repair_text(r.get("AcaoPPA")), "subaction": None, "function_code": repair_text(r.get("CodigoFuncao")), "function": repair_text(r.get("Funcao")), "subfunction_code": repair_text(r.get("CodigoSubFuncao")), "subfunction": repair_text(r.get("SubFuncao")), "expense_group": repair_text(r.get("GrupoDespesa")), "expense_element": repair_text(r.get("NomeElemento")), "object_finality": repair_text(r.get("ObjetoFinalidade"))}})
    es_exec_items = []
    es_unmatched = 0
    for _, r in ese.iterrows():
        emenda = repair_text(r.get("Emenda")); key = es_keys.get(emenda)
        if not key:
            es_unmatched += 1
            continue
        eid = repair_text(r.get("Id"))
        stages = [("COMMITTED", amount(r.get("ValorEmpenho"))), ("LIQUIDATED", amount(r.get("ValorLiquidado"))), ("PAID", amount(r.get("ValorPago"))), ("OUTSTANDING_PAYABLE", amount(r.get("ValorRap")))]
        for stage, val in stages:
            if val is not None and val != 0:
                es_exec_items.append({"key": f"ES:2026:{eid}:{stage}", "amendment_key": key, "stage": stage, "amount": val, "document": repair_text(r.get("Documento")), "commitment": repair_text(r.get("DocumentoEmpenho")), "process": repair_text(r.get("Processo")) or repair_text(r.get("NumeroProcesso")), "occurred": parse_date(r.get("Data")), "creditor_document": repair_text(r.get("CpfCnpjNis")), "creditor_name": repair_text(r.get("Favorecido")), "management_unit": repair_text(r.get("UnidadeGestora")), "agency": repair_text(r.get("Orgao")), "procurement_type": repair_text(r.get("TipoLicitacao")), "procurement_number": repair_text(r.get("NumeroLicitacao")), "contract_number": repair_text(r.get("Contrato")), "agreement_number": repair_text(r.get("CodigoConvenioRecebido")) or repair_text(r.get("CodigoConvenioConcedido")), "raw_id": es_raw["execution"]["raw_id"]})
    es = {"house": "ES", "provider": "dados_es", "amendments": amendments, "execution": es_exec_items, "source_rows": len(esd), "execution_source_rows": len(ese), "execution_unmatched": es_unmatched, "raw": list(es_raw.values()), "data_through": max((parse_date(x) for x in ese["Data"] if parse_date(x)), default=None), "notes": {"execution_rows_for_legacy_emendas": es_unmatched}}

    # MG official ALMG CSV (all historical rows, filtered by official exercise field)
    mgall = load_csv(RAW / "mg_csv.csv")
    mg = mgall[mgall.iloc[:, 0].astype(str).eq("2026")].copy()
    mg_raw = raw_file(RAW / "mg_csv.csv", "MG", "almg_emendas", "ALMG CSV", URLS["MG_CSV"], "text/csv")
    mgs = []
    for _, r in mg.iterrows():
        key0 = repair_text(r.iloc[1]); key = f"MG:2026:{key0}"
        name, typ = repair_text(r.iloc[5]), repair_text(r.iloc[45]); at = actor_type(name, typ)
        person, method = link_person(idx, "MG", name) if at == "INDIVIDUAL_DEPUTY" else (None, None)
        ind, used, com, paid = (amount(r.iloc[i]) for i in (29, 30, 31, 32))
        # The CSV has no separate liquidated column; leave it NULL rather than
        # equating a different stage.
        mgs.append({"key": key, "number": key0, "type": repair_text(r.iloc[3]), "description": repair_text(r.iloc[28]), "source_status": repair_text(r.iloc[4]), "canonical_status": canonical_status(ind, com, None, paid, repair_text(r.iloc[34]) or repair_text(r.iloc[35])), "source_url": URLS["MG_CSV"], "raw_id": mg_raw["raw_id"], "ind": ind, "approved": None, "current": ind, "committed": com, "liquidated": None, "paid": paid, "used": used, "author_raw": name, "author_id": None, "actor_type": at, "person": person, "link_method": method, "party": None, "destination": {"beneficiary_name": repair_text(r.iloc[24]), "beneficiary_document": repair_text(r.iloc[25]), "beneficiary_type": repair_text(r.iloc[23]), "municipality_source_code": None, "municipality_name": repair_text(r.iloc[19]), "municipality_ibge_code": None, "executing_agency": repair_text(r.iloc[12]), "budget_unit": repair_text(r.iloc[11]), "program": None, "action": repair_text(r.iloc[16]), "subaction": None, "function_code": repair_text(r.iloc[13]), "function": repair_text(r.iloc[14]), "subfunction_code": None, "subfunction": None, "expense_group": repair_text(r.iloc[18]), "expense_element": None, "object_finality": repair_text(r.iloc[28])}})
    mgdata = {"house": "MG", "provider": "almg_emendas", "amendments": mgs, "execution": [], "source_rows": len(mgall), "filtered_rows": len(mg), "execution_source_rows": 0, "execution_unmatched": 0, "raw": [mg_raw, raw_file(RAW / "mg_page.html", "MG", "almg_emendas", "official_page", URLS["MG_PAGE"], "text/html")], "data_through": None, "notes": {"filter": "Ano da Indicação = 2026", "historical_rows_observed": len(mgall)}}

    # RS official Power BI 2026 queries.  Destination and execution are kept
    # separate; Chave is the source-native key for both entities.
    rd, rdmeta = load_powerbi(RAW / "rs_query_2026_response.json")
    re_, remeta = load_powerbi(RAW / "rs_query_exec_response.json")
    rs_raw = [raw_file(RAW / "rs_query_2026_response.json", "RS", "transparencia_rs_powerbi", "destination_query_2026", URLS["RS_QUERY_DEST"], "application/json"), raw_file(RAW / "rs_query_exec_response.json", "RS", "transparencia_rs_powerbi", "execution_query_2026", URLS["RS_QUERY_EXEC"], "application/json"), raw_file(RAW / "rs_panel.html", "RS", "transparencia_rs_powerbi", "official_panel", URLS["RS_PANEL"], "text/html")]
    dest_by_key = {}
    for row in rd:
        vals = [repair_text(x) for x in row]
        key = vals[0]
        if not key: continue
        # query columns: Chave,Ano,Deputado,Partido,Municipio,Orgao,NomeProjeto,Subtitulo,Valor,CodMunicipio,CodProjeto
        name = vals[2]; person, method = link_person(idx, "RS", name)
        ind = amount(vals[8])
        dest_by_key[key] = {"key": f"RS:2026:{key}", "number": key, "type": "EMENDA_ESTADUAL", "description": vals[6] or vals[7], "source_status": "2026", "canonical_status": canonical_status(ind, None, None, None), "source_url": URLS["RS_PANEL"], "raw_id": rs_raw[0]["raw_id"], "ind": ind, "approved": None, "current": ind, "committed": None, "liquidated": None, "paid": None, "used": None, "author_raw": name, "author_id": None, "actor_type": actor_type(name), "person": person, "link_method": method, "party": vals[3], "destination": {"beneficiary_name": None, "beneficiary_document": None, "beneficiary_type": None, "municipality_source_code": vals[9], "municipality_name": vals[4], "municipality_ibge_code": None, "executing_agency": vals[5], "budget_unit": None, "program": vals[6], "action": vals[6], "subaction": vals[7], "function_code": None, "function": None, "subfunction_code": None, "subfunction": None, "expense_group": None, "expense_element": None, "object_finality": vals[7]}}
    rs_exec = []
    stage_map = {"EMPENHADO": "COMMITTED", "LIQUIDADO": "LIQUIDATED", "VALOR PAGO": "PAID", "PAGO": "PAID"}
    rs_unmatched = 0
    for row in re_:
        vals = [repair_text(x) for x in row]
        key0 = vals[0]; stage = stage_map.get(norm_name(vals[3]), norm_name(vals[3]) or "OBSERVED")
        if key0 not in dest_by_key:
            rs_unmatched += 1
        rs_exec.append({"key": f"RS:2026:{key0}:{repair_text(vals[2])}:{stage}:{repair_text(vals[11])}:{repair_text(vals[12])}", "amendment_key": f"RS:2026:{key0}", "stage": stage, "amount": amount(vals[4]), "document": None, "commitment": vals[11], "process": vals[12], "occurred": parse_date(vals[2]), "creditor_document": vals[10], "creditor_name": None, "management_unit": None, "agency": vals[8], "procurement_type": None, "procurement_number": None, "contract_number": None, "agreement_number": vals[18], "raw_id": rs_raw[1]["raw_id"]})
    rs = {"house": "RS", "provider": "transparencia_rs_powerbi", "amendments": list(dest_by_key.values()), "execution": rs_exec, "source_rows": len(rd), "execution_source_rows": len(re_), "execution_unmatched": rs_unmatched, "raw": rs_raw, "data_through": max((x["occurred"] for x in rs_exec if x["occurred"]), default=None), "notes": {"query_rows": {"destination": len(rd), "execution": len(re_)}, "model_id": 11412182, "source_panel": URLS["RS_PANEL"]}}
    return {"ES": es, "MG": mgdata, "RS": rs}


def semantic_hash(data):
    rows = []
    for a in sorted(data["amendments"], key=lambda x: x["key"]):
        rows.append(json.dumps({k: a.get(k) for k in ("key", "number", "type", "description", "source_status", "canonical_status", "ind", "approved", "current", "committed", "liquidated", "paid", "used", "author_raw", "author_id", "actor_type", "person", "link_method", "party", "destination")}, ensure_ascii=False, sort_keys=True))
    for x in sorted(data["execution"], key=lambda x: x["key"]): rows.append(json.dumps(x, ensure_ascii=False, sort_keys=True))
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()


def persist_house(cur, data, run_label):
    house, provider = data["house"], data["provider"]
    revision_id = f"p23.1r:{house}:2026:{semantic_hash(data)[:32]}"
    raw_hashes = [x["sha256"] for x in data["raw"]]
    cur.execute("insert into civica_state_budget.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,counters) values(%s,%s,2026,%s,'published',%s,%s,%s,%s) on conflict(run_id) do nothing", [f"p23.1r:{run_label}:{house}", house, provider, OBSERVED_AT, OBSERVED_AT, data["data_through"], Json({"sourceRows": data["source_rows"], "executionRows": data["execution_source_rows"]})])
    for raw in data["raw"]:
        cur.execute("insert into civica_state_budget.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error) values(%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s) on conflict(raw_id) do nothing", raw)
    sem = semantic_hash(data)
    cur.execute("insert into civica_state_budget.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,raw_hashes,coverage,created_at,activated_at) values(%s,%s,2026,%s,'active',%s,%s,%s,%s,%s,%s) on conflict(revision_id) do nothing", [revision_id, house, provider, sem, data["data_through"], Json(raw_hashes), Json({"sourceRows": data["source_rows"], "executionRows": data["execution_source_rows"], "executionUnmatched": data["execution_unmatched"]}), OBSERVED_AT, OBSERVED_AT])
    amend_inserted = auth_inserted = dest_inserted = exec_inserted = 0
    for a in data["amendments"]:
        cur.execute("insert into civica_state_budget.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance) values(%s,%s,2026,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key) do nothing", [revision_id, house, provider, a["key"], a["number"], a["type"], a["type"], a["description"], a["source_status"], a["canonical_status"], a["source_url"], a["raw_id"], a["ind"], a["approved"], a["current"], a["committed"], a["liquidated"], a["paid"], None, a["used"], hashlib.sha256(json.dumps(a,ensure_ascii=False,sort_keys=True).encode()).hexdigest(), Json({"source": a["source_url"], "sourceKey": a["key"]})])
        amend_inserted += cur.rowcount
        cur.execute("insert into civica_state_budget.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method) values(%s,%s,2026,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,author_key) do nothing", [revision_id, house, a["key"], a["author_id"] or norm_name(a["author_raw"]) or a["key"], a["actor_type"], a["author_raw"], a["author_id"], a["party"], a["person"], a["link_method"]])
        auth_inserted += cur.rowcount
        d = a["destination"]
        cur.execute("insert into civica_state_budget.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality) values(%s,%s,'primary',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,destination_key) do nothing", [revision_id, a["key"], d["beneficiary_name"], d["beneficiary_document"], d["beneficiary_type"], d["municipality_source_code"], d["municipality_name"], d["municipality_ibge_code"], d["executing_agency"], d["budget_unit"], d["program"], d["action"], d["subaction"], d["function_code"], d["subfunction_code"], d["expense_group"], d["expense_element"], d["object_finality"]])
        dest_inserted += cur.rowcount
    for x in data["execution"]:
        cur.execute("insert into civica_state_budget.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,execution_key) do nothing", [revision_id, x["key"], x["amendment_key"], x["document"], x["commitment"], x["process"], x["occurred"], x["stage"], x["amount"], x["creditor_document"], x["creditor_name"], x["management_unit"], x["agency"], x["procurement_type"], x["procurement_number"], x["contract_number"], x["agreement_number"], x["raw_id"], Json({"source": provider, "executionKey": x["key"]})])
        exec_inserted += cur.rowcount
    cur.execute("insert into civica_state_budget.active_publications(house,fiscal_year,domain,revision_id,activated_at) values(%s,2026,'state_budget_amendments',%s,%s) on conflict(house,fiscal_year,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at", [house, revision_id, OBSERVED_AT])
    cur.execute("update civica_state_budget.revisions set status='rejected' where house=%s and fiscal_year=2026 and provider=%s and revision_id<>%s and status='active'", [house, provider, revision_id])
    return revision_id, {"amendment": amend_inserted, "author": auth_inserted, "destination": dest_inserted, "execution": exec_inserted}


def main():
    conn = psycopg2.connect(host="localhost", port=5432, database=DB, user=USER, password=PASSWORD)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("select current_database()")
    if cur.fetchone()[0] != DB: raise RuntimeError("database guard")
    cur.execute("alter table civica_state_budget.raw_evidence add column if not exists source_kind text not null default 'raw_source'")
    cur.execute("update civica_state_budget.raw_evidence set source_kind='transport_attempt' where http_status=0 and bytes=0")
    data = build_data(cur)
    first = {}; second = {}
    for house in ("ES", "MG", "RS"):
        first[house] = persist_house(cur, data[house], "run1")
    conn.commit()
    # Mandatory unchanged replay in a fresh transaction.
    for house in ("ES", "MG", "RS"):
        second[house] = persist_house(cur, data[house], "run2")
    conn.commit()
    report = {"data": data, "first": first, "second": second}
    out = ROOT / ".p23_1r_runtime.json"
    out.write_text(json.dumps(report, ensure_ascii=False, default=str), encoding="utf-8")
    print(json.dumps({h: {"source": data[h]["source_rows"], "amendments": len(data[h]["amendments"]), "execution_source": data[h]["execution_source_rows"], "execution_items": len(data[h]["execution"]), "unmatched": data[h]["execution_unmatched"], "linked": sum(1 for x in data[h]["amendments"] if x["person"]), "first": first[h][1], "second": second[h][1]} for h in data}, ensure_ascii=False, indent=2))
    cur.close(); conn.close()


if __name__ == "__main__":
    main()
