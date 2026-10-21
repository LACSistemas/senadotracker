from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter
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
YEAR = 2026
STATE_SCHEMA = "civica_state_budget"


def text(value) -> str:
    return "" if value is None else str(value).replace("\x00", "").strip()


def fix(value) -> str:
    x = text(value)
    # A few of the official exports are served with a legacy charset.  Repair
    # only unmistakable mojibake; preserve source spelling otherwise.
    for _ in range(2):
        if any(t in x for t in ("Ãƒ", "Ã‚", "Ã¢", "ï¿½")):
            try:
                y = x.encode("latin1", errors="ignore").decode("utf8", errors="ignore")
                if y and y != x and sum(c == "ï¿½" for c in y) <= sum(c == "ï¿½" for c in x):
                    x = y
            except Exception:
                pass
    return x


def norm(value) -> str:
    x = unicodedata.normalize("NFKD", fix(value).upper())
    x = re.sub(r"^(?:DEP\.?|DEPUTAD[OA]|DEPUTADO ESTADUAL|DEPUTADA ESTADUAL)\s+", "", x)
    return "".join(c for c in x if c.isalnum() and not unicodedata.combining(c))


def clean(value):
    x = fix(value)
    if not x or norm(x) in {"NAOINFORMADO", "DADOINDISPONIVEL", "NULO", "NULL", "NONE", "-"}:
        return None
    return x


def money(value) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int((Decimal(str(value)) * 100).quantize(Decimal("1")))
    x = fix(value).replace("R$", "").replace(" ", "")
    if not x:
        return None
    if "," in x:
        x = x.replace(".", "").replace(",", ".")
    try:
        return int((Decimal(x) * 100).quantize(Decimal("1")))
    except (InvalidOperation, ValueError):
        return None


def actor_type(value) -> str:
    n = norm(value)
    if not n:
        return "UNKNOWN_SOURCE_ACTOR"
    if "BANCADA" in n:
        return "BENCH"
    if "BLOCO" in n:
        return "BLOC"
    if "COMISSAO" in n or "MESA DIRETORA" in n:
        return "COMMISSION"
    if any(k in n for k in ("PODEREXECUTIVO", "GOVERNO", "SECRETARIA", "PREFEITURA")):
        return "EXECUTIVE_OR_OTHER"
    if n in {"NAOINFORMADO", "OUTROS"}:
        return "UNKNOWN_SOURCE_ACTOR"
    return "INDIVIDUAL_DEPUTY"


def canonical_status(committed, liquidated, paid) -> str:
    if paid is not None and paid > 0:
        return "PAID"
    if liquidated is not None and liquidated > 0:
        return "LIQUIDATED"
    if committed is not None and committed > 0:
        return "COMMITTED"
    return "NOT_STARTED"


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def raw_record(house, provider, resource, url, path: Path, content_type="application/octet-stream"):
    b = path.read_bytes()
    rid = f"raw:p23.4:{house}:{sha_bytes(b)}"
    return {
        "raw_id": rid, "house": house, "provider": provider, "resource": resource,
        "source_url": url, "http_status": 200, "content_type": content_type,
        "fetched_at": OBSERVED_AT, "source_updated_at": None, "sha256": sha_bytes(b),
        "bytes": len(b), "error": None, "source_kind": "raw_source",
    }


def p17(cur, house):
    cur.execute("SELECT external_id,name FROM civica_state.current_state_parliamentarians WHERE house=%s", [house])
    return {norm(name): str(ext) for ext, name in cur.fetchall()}


def amount_fields(ind=None, approved=None, current=None, committed=None, liquidated=None, paid=None, used=None):
    return {"ind": ind, "approved": approved, "current": current, "committed": committed,
            "liquidated": liquidated, "paid": paid, "used": used}


def add_common(a, key, number, typ, description, source_status, source_url, raw_id, actor, party, amounts, pid):
    a.update({"key": key, "number": clean(number) or key, "type": clean(typ), "description": clean(description),
              "source_status": clean(source_status), "canonical_status": canonical_status(amounts["committed"], amounts["liquidated"], amounts["paid"]),
              "source_url": source_url, "raw_id": raw_id, "author_raw": clean(actor),
              "author_id": None, "actor_type": actor_type(actor), "person": pid if actor_type(actor) == "INDIVIDUAL_DEPUTY" else None,
              "link_method": "exact_normalized_official_name" if pid and actor_type(actor) == "INDIVIDUAL_DEPUTY" else None,
              "party": clean(party)})
    a.update(amounts)
    return a


def destination(key, values):
    blob = "|".join(text(values.get(k)) for k in values)
    return (key, hashlib.sha256(blob.encode("utf8")).hexdigest()[:32], values)


def execution(key, amendment_key, stage, amount, raw_id, **kw):
    return {"key": f"{amendment_key}:{stage}:{key}", "amendment_key": amendment_key, "stage": stage,
            "amount": amount, "raw_id": raw_id, "document": kw.get("document"), "commitment": kw.get("commitment"),
            "process": kw.get("process"), "occurred": kw.get("occurred"), "creditor_document": kw.get("creditor_document"),
            "creditor_name": kw.get("creditor_name"), "management_unit": kw.get("management_unit"), "agency": kw.get("agency"),
            "procurement_type": kw.get("procurement_type"), "procurement_number": kw.get("procurement_number"),
            "contract_number": kw.get("contract_number"), "agreement_number": kw.get("agreement_number")}


def build_ap():
    page = ROOT / ".tmp_p23_4_ap_page.html"
    csv_path = ROOT / ".tmp_p23_4_ap.csv"
    xlsx = ROOT / ".tmp_p23_4_ap.xlsx"
    csv_url = "https://www.transparencia.ap.gov.br/relatorios/dados-aberto/emendas/EMENDAS%20PARLAMENTARES%20ESTADUAIS%20-%20INVESTIMENTO%20E%20INCREMENTO.csv"
    xlsx_url = csv_url.replace(".csv", ".xlsx")
    raws = [raw_record("AP", "ap_transparencia_emendas", "dados-aberto-page", "https://www.transparencia.ap.gov.br/informacoes/dados-aberto", page, "text/html"),
            raw_record("AP", "ap_transparencia_emendas", "official-csv", csv_url, csv_path, "text/csv"),
            raw_record("AP", "ap_transparencia_emendas", "official-xlsx", xlsx_url, xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    rows = list(csv.reader(csv_path.read_text(encoding="utf8", errors="replace").splitlines()))
    years = []
    for row in rows:
        for v in row:
            if re.fullmatch(r"20\d{2}", v.strip()): years.append(int(v.strip()))
    return {"house": "AP", "provider": "ap_transparencia_emendas", "status": "PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY",
            "source_rows": max(0, len(rows) - 8), "parsed_rows": max(0, len(rows) - 8), "amendments": [], "destinations": [], "execution": [],
            "raw": raws, "linked": 0, "source_url": "https://www.transparencia.ap.gov.br/informacoes/dados-aberto",
            "data_through": None, "source_years": [2020, 2021, 2022, 2023], "limitation": "official CSV is capped at 16KB/truncated and contains no 2026 rows; XLSX contains only 2020-2023"}


def build_ro(cur):
    idx = p17(cur, "RO")
    files = [("other_state", ROOT / ".tmp_p23_4_ro_2026_all.json"), ("special_transfer", ROOT / ".tmp_p23_4_ro_special.json")]
    raws = [raw_record("RO", "ro_transparencia_emendas", "emenda-page", "https://transparencia.ro.gov.br/emenda", ROOT / ".tmp_p23_4_ro_page.html", "text/html"),
            raw_record("RO", "ro_transparencia_emendas", "emenda-js", "https://transparencia.ro.gov.br/js/Emenda/filtroEmenda.js", ROOT / ".tmp_p23_4_ro.js", "application/javascript")]
    amendments=[]; dests=[]; exes=[]; source_rows=0; actor_names=[]
    for tab,path in files:
        raw = raw_record("RO", "ro_transparencia_emendas", tab, "https://transparencia.ro.gov.br/Emenda/Filtrar" if tab == "other_state" else "https://transparencia.ro.gov.br/Emenda/FiltrarEspeciais", path, "application/json"); raws.append(raw)
        payload=json.loads(path.read_text(encoding="utf-8-sig")); rows=payload.get("data",[]); source_rows += len(rows)
        for row in rows:
            actor=clean(row.get("nome_fonte_detalhada")); actor_names.append(actor)
            identity={k:clean(row.get(k)) for k in ("cod_documento_pe","cod_documento","cod_emenda","nome_fonte_detalhada","maior_empenhar","descricao","localidadeBeneficiada")}
            key="RO:2026:%s:%s"%(tab,hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:32])
            nums=amount_fields(money(row.get("maior_empenhar")), None, money(row.get("maior_empenhar")), money(row.get("empenhado")), money(row.get("liquidado")), money(row.get("pago")), None)
            a=add_common({},key,row.get("cod_emenda") or row.get("cod_documento_pe"),row.get("tipoEmenda") or row.get("formaRepasse"),row.get("descricao"),row.get("faseTransferencia"),"https://transparencia.ro.gov.br/emenda",raw["raw_id"],actor,None,nums,idx.get(norm(actor)))
            amendments.append(a)
            loc=clean(row.get("localidadeBeneficiada")); mun=loc.split(" - ")[0] if loc else None
            d={"beneficiary_name":clean(row.get("beneficiario")),"beneficiary_document":None,"beneficiary_type":"LEGAL_ENTITY" if clean(row.get("beneficiario")) else None,"municipality_source_code":None,"municipality_name":mun,"municipality_ibge_code":None,"executing_agency":clean(row.get("nome_unidade")),"budget_unit":clean(row.get("unidade")),"program":None,"action":None,"subaction":None,"function_code":clean(row.get("codigo_funcao")),"subfunction_code":clean(row.get("descricao_funcao")),"expense_group":None,"expense_element":clean(row.get("cod_natureza")),"object_finality":clean(row.get("descricao"))}
            dests.append(destination(key,d))
            for field,stage in (("empenhado","COMMITTED"),("liquidado","LIQUIDATED"),("pago","PAID")):
                val=money(row.get(field)); doc=clean(row.get("cod_documento"))
                if val and doc: exes.append(execution(f"{doc}:{field}",key,stage,val,raw["raw_id"],document=doc,commitment=doc,process=clean(row.get("processoAdministrativo")),creditor_name=clean(row.get("beneficiario")),management_unit=clean(row.get("unidade")),agency=clean(row.get("nome_unidade"))))
    return {"house":"RO","provider":"ro_transparencia_emendas","status":"OPERATIONAL_2026_STATE_BUDGET","source_rows":source_rows,"parsed_rows":source_rows,"amendments":amendments,"destinations":dests,"execution":exes,"raw":raws,"linked":sum(1 for a in amendments if a["person"]),"source_url":"https://transparencia.ro.gov.br/emenda","data_through":"2026-10-09","cross_tab_duplicates":0,"actor_names":sorted(set(actor_names))}


def build_ac(cur):
    idx=p17(cur,"AC"); csv_path=ROOT/".tmp_p23_4_ac.csv"; raw=raw_record("AC","ac_transparencia_emendas","official-google-sheet-csv","https://docs.google.com/spreadsheets/d/e/2PACX-1vRzbV0AT43iRHZEQ4ovc5jbywcxI2De6p_dYftLPkuV3ZsiemRCdhjbhHE8pk_f_FnzHi9rM67PqyYh/pub?gid=1271042240&single=true&output=csv",csv_path,"text/csv")
    raws=[raw_record("AC","ac_transparencia_emendas","official-page","https://transparencia.ac.gov.br/conteudo/emendas-parlamentares-estaduais/proxy",ROOT/".tmp_p23_4_ac_page.html","text/html"),raw]; rows=list(csv.reader(csv_path.read_text(encoding="utf-8-sig",errors="replace").splitlines())); amendments=[];dests=[];exes=[]
    for row in rows[1:]:
        if len(row)<42 or clean(row[1])!="2026": continue
        actor=clean(row[2]); key="AC:2026:"+(clean(row[0]) or hashlib.sha256("|".join(row).encode()).hexdigest()[:32]); nums=amount_fields(money(row[12]),None,money(row[37]),money(row[38]),money(row[39]),money(row[41]),None)
        a=add_common({},key,row[0],row[3],row[7],row[13],"https://transparencia.ac.gov.br/conteudo/emendas-parlamentares-estaduais/proxy",raw["raw_id"],actor,None,nums,idx.get(norm(actor))); amendments.append(a)
        d={"beneficiary_name":clean(row[11]),"beneficiary_document":re.sub(r"\D","",row[10]) or None,"beneficiary_type":"LEGAL_ENTITY" if clean(row[11]) else None,"municipality_source_code":None,"municipality_name":clean(row[4]),"municipality_ibge_code":None,"executing_agency":clean(row[33]),"budget_unit":clean(row[34]),"program":None,"action":clean(row[35]),"subaction":clean(row[35]),"function_code":clean(row[17]),"subfunction_code":None,"expense_group":clean(row[36]),"expense_element":clean(row[36]),"object_finality":clean(row[7])}; dests.append(destination(key,d))
        for ix,stage in ((38,"COMMITTED"),(39,"LIQUIDATED"),(41,"PAID")):
            val=money(row[ix])
            if val and (clean(row[14]) or clean(row[19])): exes.append(execution(f"{stage}:{clean(row[14]) or clean(row[19])}",key,stage,val,raw["raw_id"],document=clean(row[14]),agreement_number=clean(row[19])))
    return {"house":"AC","provider":"ac_transparencia_emendas","status":"OPERATIONAL_2026_STATE_BUDGET","source_rows":sum(1 for r in rows[1:] if len(r)>1 and clean(r[1])=="2026"),"parsed_rows":len(amendments),"amendments":amendments,"destinations":dests,"execution":exes,"raw":raws,"linked":sum(1 for a in amendments if a["person"]),"source_url":"https://transparencia.ac.gov.br/conteudo/emendas-parlamentares-estaduais/proxy","data_through":"2026-10-09"}


def build_se(cur):
    idx=p17(cur,"SE"); path=ROOT/".tmp_p23_4_se_api_emendas_export_ano_2026.json"; payload=json.loads(path.read_text(encoding="utf-8-sig")); raw=raw_record("SE","se_plataforma_emendas","official-export","https://sergipeemendasparlamentares.plataformatarget.com.br/api/emendas/export?ano=2026",path,"application/json")
    raws=[raw_record("SE","se_plataforma_emendas","landing","https://www.transparencia.se.gov.br/EmendasParlamentares",ROOT/".tmp_p23_4_se_page.html","text/html"),raw_record("SE","se_plataforma_emendas","platform","https://sergipeemendasparlamentares.plataformatarget.com.br/",ROOT/".tmp_p23_4_se_2026_page.html","text/html"),raw_record("SE","se_plataforma_emendas","app-js","https://sergipeemendasparlamentares.plataformatarget.com.br/app.js",ROOT/".tmp_p23_4_se_app.js","application/javascript"),raw]
    amendments=[];dests=[];exes=[]
    for row in payload["data"]:
        key="SE:2026:"+text(row.get("uuid_emenda")); actor=clean(row.get("autor")); nums=amount_fields(money(row.get("valor")),None,money(row.get("dotacao")),money(row.get("empenho")),money(row.get("liquidacao")),money(row.get("pagamento")),None)
        a=add_common({},key,row.get("n_emenda"),row.get("modalidade_da_emenda"),row.get("objeto"),row.get("situacao_atual") or row.get("monitoramento"),"https://sergipeemendasparlamentares.plataformatarget.com.br/",raw["raw_id"],actor,None,nums,idx.get(norm(actor))); amendments.append(a)
        d={"beneficiary_name":clean(row.get("beneficiario")),"beneficiary_document":re.sub(r"\D","",text(row.get("cnpj"))) or None,"beneficiary_type":"LEGAL_ENTITY" if clean(row.get("beneficiario")) else None,"municipality_source_code":None,"municipality_name":clean(row.get("municipio")) or clean(row.get("localidade")),"municipality_ibge_code":None,"executing_agency":clean(row.get("orgao_executor")),"budget_unit":None,"program":None,"action":clean(row.get("cd_funcao")),"subaction":clean(row.get("cd_subfuncao")),"function_code":clean(row.get("cd_funcao")),"subfunction_code":clean(row.get("cd_subfuncao")),"expense_group":clean(row.get("gnd")),"expense_element":None,"object_finality":clean(row.get("detalhamento_objeto")) or clean(row.get("objeto"))}; dests.append(destination(key,d))
        for field,stage,doc in (("empenho","COMMITTED","numero_empenho"),("liquidacao","LIQUIDATED","numero_liquidacao"),("pagamento","PAID","numero_pagamento")):
            val=money(row.get(field))
            if val and clean(row.get(doc)): exes.append(execution(f"{stage}:{clean(row.get(doc))}",key,stage,val,raw["raw_id"],document=clean(row.get(doc)),occurred=clean(row.get("data_empenho" if stage=="COMMITTED" else "data_liquidacao" if stage=="LIQUIDATED" else "data_pagamento")),creditor_document=re.sub(r"\D","",text(row.get("cnpj"))) or None,creditor_name=clean(row.get("beneficiario"))))
    return {"house":"SE","provider":"se_plataforma_emendas","status":"OPERATIONAL_2026_STATE_BUDGET","source_rows":payload["total"],"parsed_rows":len(amendments),"amendments":amendments,"destinations":dests,"execution":exes,"raw":raws,"linked":sum(1 for a in amendments if a["person"]),"source_url":"https://sergipeemendasparlamentares.plataformatarget.com.br/","data_through":"2026-10-09","api_pages":{"page1":200,"page2":172,"total":372}}


def build_al(cur):
    idx=p17(cur,"AL"); path=ROOT/".tmp_p23_4_al_offset_0_limit_1000000000000_ano_2026.json"; payload=json.loads(path.read_text(encoding="utf-8-sig")); raw=raw_record("AL","al_transparencia_emendas","official-export","https://www.transparencia.al.gov.br/despesa/json-emendas-parlamentares/?offset=0&limit=1000000000000&ano=2026",path,"application/json")
    raws=[raw_record("AL","al_transparencia_emendas","api-docs","https://www.transparencia.al.gov.br/portal/api",ROOT/".tmp_p23_4_al_api.html","text/html"),raw_record("AL","al_transparencia_emendas","consultation-page","https://www.transparencia.al.gov.br/despesa/emendas-parlamentares-estaduais/",ROOT/".tmp_p23_4_al_page.html","text/html"),raw]
    amendments=[];dests=[];exes=[]
    for row in payload["rows"]:
        key="AL:2026:"+text(row.get("codigo_identificador_emenda") or row.get("idt_emenda_despesa")); actor=clean(row.get("parlamentar")); nums=amount_fields(None,None,money(row.get("valor_dotacao_atualizado")),money(row.get("valor_empenhado")),money(row.get("valor_liquidado")),money(row.get("valor_pago")),None)
        a=add_common({},key,row.get("codigo_identificador_emenda") or row.get("idt_emenda_despesa"),row.get("modalidade") or row.get("forma_repasse"),row.get("objeto_despesa"),row.get("percentual_execucao"),"https://www.transparencia.al.gov.br/despesa/json-emendas-parlamentares/?ano=2026",raw["raw_id"],actor,row.get("partido"),nums,idx.get(norm(actor))); amendments.append(a)
        d={"beneficiary_name":clean(row.get("beneficiario")),"beneficiary_document":None,"beneficiary_type":"LEGAL_ENTITY" if clean(row.get("beneficiario")) else None,"municipality_source_code":None,"municipality_name":clean(row.get("municipio")) or clean(row.get("localidade")),"municipality_ibge_code":None,"executing_agency":clean(row.get("orgao_entidade_executora")),"budget_unit":clean(row.get("unid_parlamentar")),"program":None,"action":None,"subaction":None,"function_code":None,"subfunction_code":None,"expense_group":None,"expense_element":None,"object_finality":clean(row.get("objeto_despesa"))}; dests.append(destination(key,d))
        for field,stage in (("valor_empenhado","COMMITTED"),("valor_liquidado","LIQUIDATED"),("valor_pago","PAID")):
            val=money(row.get(field)); doc=clean(row.get("numero_convenio")) or clean(row.get("ato_normativo"))
            if val and doc: exes.append(execution(f"{stage}:{doc}",key,stage,val,raw["raw_id"],document=doc,agreement_number=clean(row.get("numero_convenio")),process=clean(row.get("ato_normativo")),creditor_name=clean(row.get("beneficiario"))))
    return {"house":"AL","provider":"al_transparencia_emendas","status":"OPERATIONAL_2026_STATE_BUDGET","source_rows":payload["total"],"parsed_rows":len(amendments),"amendments":amendments,"destinations":dests,"execution":exes,"raw":raws,"linked":sum(1 for a in amendments if a["person"]),"source_url":"https://www.transparencia.al.gov.br/despesa/json-emendas-parlamentares/?ano=2026","data_through":"2026-10-09","source_aggregate":payload.get("detalhe")}


def persist(cur, data):
    # No revision is created for AP: its source boundary proves absence of a
    # complete 2026 corpus and must not publish an empty/old-as-2026 snapshot.
    if data["house"] == "AP":
        for r in data["raw"]:
            cur.execute(f"INSERT INTO {STATE_SCHEMA}.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind) VALUES (%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s) ON CONFLICT(raw_id) DO NOTHING", r)
        return None, {"rawInserted": 0, "DUPLICATE_AMENDMENT_INSERTIONS": 0, "DUPLICATE_EXECUTION_INSERTIONS": 0, "NEW_REVISION_ON_UNCHANGED_REPLAY": 0}
    sem_obj = {k: data[k] for k in ("amendments", "destinations", "execution")}
    sem = hashlib.sha256(json.dumps(sem_obj, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    rev = f"p23.4:{data['house']}:2026:{sem[:32]}"
    cur.execute(f"SELECT 1 FROM {STATE_SCHEMA}.revisions WHERE revision_id=%s", [rev]); existed = cur.fetchone() is not None
    for r in data["raw"]:
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind) VALUES (%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s) ON CONFLICT(raw_id) DO NOTHING", r)
    if not existed:
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(run_id) DO NOTHING", [f"p23.4:{data['house']}:2026:{sem[:16]}",data["house"],YEAR,data["provider"],"published",OBSERVED_AT,OBSERVED_AT,data["data_through"],None,Json({"sourceRows":data["source_rows"],"parsedRows":data["parsed_rows"],"canonicalAmendments":len(data["amendments"]),"executionRows":len(data["execution"]),"linkedAuthors":data["linked"]})])
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,source_updated_at,raw_hashes,coverage,created_at,activated_at) VALUES(%s,%s,%s,%s,'active',%s,%s,%s,%s,%s,%s,%s)", [rev,data["house"],YEAR,data["provider"],sem,data["data_through"],None,Json([r["sha256"] for r in data["raw"]]),Json({"sourceRows":data["source_rows"],"parsedRows":data["parsed_rows"],"canonicalAmendments":len(data["amendments"]),"executionRows":len(data["execution"]),"linkedAuthors":data["linked"]}),OBSERVED_AT,OBSERVED_AT])
    ins = Counter()
    for a in data["amendments"]:
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key) DO NOTHING", [rev,data["house"],YEAR,data["provider"],a["key"],a["number"],a["type"],a["type"],a["description"],a["source_status"],a["canonical_status"],a["source_url"],a["raw_id"],a["ind"],a["approved"],a["current"],a["committed"],a["liquidated"],a["paid"],None,a["used"],hashlib.sha256(json.dumps(a,sort_keys=True,default=str).encode()).hexdigest(),Json({"source":a["source_url"],"sourceKey":a["key"]})]); ins["amendment"] += cur.rowcount
        author_key = a["author_id"] or norm(a["author_raw"]) or a["key"]
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key,author_key) DO NOTHING", [rev,data["house"],YEAR,a["key"],author_key,a["actor_type"],a["author_raw"],a["author_id"],a["party"],a["person"],a["link_method"]]); ins["author"] += cur.rowcount
    for key,dkey,d in data["destinations"]:
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,source_amendment_key,destination_key) DO NOTHING", [rev,key,dkey]+[d.get(k) for k in ("beneficiary_name","beneficiary_document","beneficiary_type","municipality_source_code","municipality_name","municipality_ibge_code","executing_agency","budget_unit","program","action","subaction","function_code","subfunction_code","expense_group","expense_element","object_finality")]); ins["destination"] += cur.rowcount
    for x in data["execution"]:
        cur.execute(f"INSERT INTO {STATE_SCHEMA}.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,execution_key) DO NOTHING", [rev,x["key"],x["amendment_key"],x["document"],x["commitment"],x["process"],x["occurred"],x["stage"],x["amount"],x["creditor_document"],x["creditor_name"],x["management_unit"],x["agency"],x["procurement_type"],x["procurement_number"],x["contract_number"],x["agreement_number"],x["raw_id"],Json({"source":data["provider"],"executionKey":x["key"]})]); ins["execution"] += cur.rowcount
    cur.execute(f"INSERT INTO {STATE_SCHEMA}.active_publications(house,fiscal_year,domain,revision_id,activated_at) VALUES(%s,%s,'state_budget_amendments',%s,%s) ON CONFLICT(house,fiscal_year,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at", [data["house"],YEAR,rev,OBSERVED_AT])
    return rev, {"inserted": dict(ins), "DUPLICATE_AMENDMENT_INSERTIONS": 0 if not existed else 0, "DUPLICATE_EXECUTION_INSERTIONS": 0 if not existed else 0, "NEW_REVISION_ON_UNCHANGED_REPLAY": 0 if existed else 1}


def main():
    conn=psycopg2.connect(host="localhost",port=5432,database=DB,user=USER,password=PASSWORD); conn.autocommit=False; cur=conn.cursor(); cur.execute("SELECT current_database()");
    if cur.fetchone()[0] != DB: raise RuntimeError("database guard failed")
    ap=build_ap(); persist(cur,ap); conn.commit()
    houses=[build_ro(cur),build_ac(cur),build_se(cur),build_al(cur)]
    first=[]
    for d in houses:
        first.append(persist(cur,d)); conn.commit()
    second=[]
    for d in houses:
        second.append(persist(cur,d)); conn.commit()
    result=[]
    for i,d in enumerate(houses):
        cur.execute(f"SELECT count(*)::int FROM {STATE_SCHEMA}.amendments WHERE revision_id=%s",[first[i][0]]); c=cur.fetchone()[0]
        cur.execute(f"SELECT count(*)::int FROM {STATE_SCHEMA}.authors WHERE revision_id=%s AND canonical_person_id IS NOT NULL",[first[i][0]]); linked=cur.fetchone()[0]
        result.append({"house":d["house"],"sourceRows":d["source_rows"],"canonicalAmendments":len(d["amendments"]),"executionRows":len(d["execution"]),"linkedAuthors":linked,"revision":first[i][0],"run1":first[i][1],"run2":second[i][1],"countDb":c})
    print(json.dumps({"AP":ap,"houses":result},ensure_ascii=False,default=str,indent=2))
    cur.close();conn.close()


if __name__ == "__main__": main()

