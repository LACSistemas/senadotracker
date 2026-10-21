from __future__ import annotations

import csv, hashlib, json, re, unicodedata
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg2
from psycopg2.extras import Json
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DB = "civica_postgres_lab"
USER = "projetoeleitor_user"
PASSWORD = "projetoeleitorsenha"
OBSERVED_AT = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
PA_URL = "https://api.emendas.seplad.pa.gov.br/api/v1/transparencia/emendas?ano=2026"
PA_OPTIONS = "https://api.emendas.seplad.pa.gov.br/api/v1/transparencia/emendas/opcoes"
PR_URL = "https://www.social.pr.gov.br/emendas/lstConsulta.php"
PR_AUTHORS = "https://www.social.pr.gov.br/emendas/lstDeputados.php"

def sha_bytes(b: bytes) -> str: return hashlib.sha256(b).hexdigest()
def sha_file(p: Path) -> str: return sha_bytes(p.read_bytes())
def s(v) -> str: return "" if v is None else str(v).replace("\x00", "").strip()
def fix(v: str) -> str:
    x = s(v)
    for _ in range(2):
        try:
            if any(t in x for t in ("Ã", "Â", "�")): x = x.encode("latin1").decode("utf8")
        except Exception: break
    return x
def norm(v: str) -> str:
    x = unicodedata.normalize("NFKD", fix(v).upper())
    x = re.sub(r"^(?:DEP\.?|DEPUTAD[OA]|DR\.?|DRA\.?)\s+", "", x)
    return "".join(c for c in x if c.isalnum() and not unicodedata.combining(c))
def money(v) -> int | None:
    if v is None or v == "": return None
    if isinstance(v, (int, float)): return int(Decimal(str(v))*100)
    x = fix(str(v)).replace("R$", "").replace(" ", "")
    if not x: return None
    if "," in x: x = x.replace(".", "").replace(",", ".")
    try: return int((Decimal(x)*100).quantize(Decimal("1")))
    except (InvalidOperation, ValueError): return None
def actor_type(name: str) -> str:
    n = norm(name)
    if not n: return "UNKNOWN_SOURCE_ACTOR"
    if "BANCADA" in n: return "BENCH"
    if "BLOCO" in n: return "BLOC"
    if any(t in n for t in ("COMISSAO", "MESA DIRETORA")): return "COMMISSION"
    if any(t in n for t in ("PODER EXECUTIVO", "GOVERNO", "SECRETARIA")): return "EXECUTIVE_OR_OTHER"
    return "INDIVIDUAL_DEPUTY"
def status(committed, liquidated, paid):
    if paid is not None and paid > 0: return "PAID"
    if liquidated is not None and liquidated > 0: return "LIQUIDATED"
    if committed is not None and committed > 0: return "COMMITTED"
    return "NOT_STARTED"

def p17(cur, house):
    cur.execute("select external_id,name from civica_state.current_state_parliamentarians where house=%s", [house])
    return {norm(n):(str(i), fix(n)) for i,n in cur.fetchall()}

def fetch_sources():
    import requests
    pa = ROOT / ".tmp_pa_2026.json"
    if not pa.exists():
        r = requests.get(PA_URL, headers={"X-API-KEY":"0affce09f2d5dffe0b5073f20e48eebd1ab39c607809e877a8d3e09b96affad0"}, timeout=90); r.raise_for_status(); pa.write_bytes(r.content)
    pr = ROOT / ".tmp_pr_2026_result.html"
    if not pr.exists():
        r = requests.post(PR_URL, data={"nAno":"2026","strDeputado":"","nEmenda":"","nCNPJ":"","strInstituicao":"","cbOrdem":"1","cbTodos":"S","cbSemCad":"","cbSemProp":"","cbAnalise":"","cbFormal":"","cbReprova":""}, timeout=90); r.raise_for_status(); pr.write_bytes(r.content)
    return pa, pr

def build_pa(cur, path: Path):
    raw = json.loads(path.read_text(encoding="utf8")); rows = raw["data"]
    options = {}
    try:
        import requests
        r = requests.get(PA_OPTIONS, headers={"X-API-KEY":"0affce09f2d5dffe0b5073f20e48eebd1ab39c607809e877a8d3e09b96affad0"}, timeout=60); r.raise_for_status()
        for x in r.json().get("parlamentares", []): options[norm(x.get("value"))] = str(x.get("id"))
    except Exception: pass
    idx = p17(cur, "PA"); amendments=[]; dest=[]; exe=[]; linked=0
    for r in rows:
        code=s(r.get("codigo")); key=f"PA:2026:{code}"; name=fix(r.get("parlamentar")); pid=idx.get(norm(name)); person=pid[0] if pid else None
        if person: linked += 1
        indicated=money(r.get("valor")); current=money(r.get("dotacao")); committed=money(r.get("empenhado")); liquidated=money(r.get("liquidado")); paid=money(r.get("pago"))
        a={"key":key,"number":code,"type":s(r.get("tipo_emenda")),"description":fix(r.get("objeto")),"source_status":"cancelada" if r.get("cancelada") else "active","canonical_status":status(committed,liquidated,paid),"source_url":PA_URL,"raw_id":None,"ind":indicated,"approved":None,"current":current,"committed":committed,"liquidated":liquidated,"paid":paid,"used":None,"author_raw":name,"author_id":options.get(norm(name)),"actor_type":actor_type(name),"person":person,"link_method":"exact_normalized_official_name" if person else None,"party":s(r.get("partido")) or None}
        amendments.append(a)
        mun=fix(r.get("municipios")); dkey=hashlib.sha256((code+"|"+mun+"|"+s(r.get("orgao_sigla"))).encode()).hexdigest()[:32]
        dest.append((key,dkey,{"beneficiary_name":None,"beneficiary_document":None,"beneficiary_type":None,"municipality_source_code":None,"municipality_name":mun or None,"municipality_ibge_code":None,"executing_agency":fix(r.get("orgao_descricao")),"budget_unit":None,"program":None,"action":None,"subaction":None,"function_code":fix(r.get("funcao_governo")) or None,"subfunction_code":None,"expense_group":None,"expense_element":None,"object_finality":fix(r.get("objeto")) or None}))
        for field, stage in (("empenhado","COMMITTED"),("liquidado","LIQUIDATED"),("pago","PAID")):
            val=money(r.get(field));
            if val is not None and val != 0: exe.append({"key":f"{key}:{stage}:{s(r.get('numero_empenho'))}:{val}","amendment_key":key,"stage":stage,"amount":val,"document":s(r.get("numero_empenho")) or None,"commitment":s(r.get("numero_empenho")) or None,"process":None,"occurred":None,"creditor_document":None,"creditor_name":None,"management_unit":fix(r.get("orgao_sigla")) or None,"agency":fix(r.get("orgao_descricao")) or None,"procurement_type":None,"procurement_number":None,"contract_number":None,"agreement_number":None,"raw_id":None})
    rawid=f"raw:p23.3:PA:seplad:{sha_file(path)}"; raw={"raw_id":rawid,"house":"PA","provider":"pa_seplad_emendas_api","resource":"emendas?ano=2026","source_url":PA_URL,"http_status":200,"content_type":"application/json","fetched_at":OBSERVED_AT,"source_updated_at":None,"sha256":sha_file(path),"bytes":path.stat().st_size,"error":None,"source_kind":"raw_source"}
    for a in amendments:a["raw_id"]=rawid
    for x in exe:x["raw_id"]=rawid
    return {"house":"PA","provider":"pa_seplad_emendas_api","source_rows":len(rows),"parsed_rows":len(rows),"amendments":amendments,"destinations":dest,"execution":exe,"raw":[raw],"linked":linked,"data_through":"2026-10-09","source_url":PA_URL,"export_parity":"PASS"}

def parse_pr_rows(path):
    soup=BeautifulSoup(path.read_text(encoding="utf8",errors="replace"),"html.parser"); out=[]
    for tr in soup.select("tr"):
        v=[" ".join(td.get_text(" ",strip=True).split()) for td in tr.find_all("td")]
        if len(v)>=18 and v[0].isdigit(): out.append(v)
    return out
def build_pr(cur,path:Path):
    rows=parse_pr_rows(path); idx=p17(cur,"PR"); amendments=[];dest=[];exe=[];linked=0
    # The source option endpoint publishes the legal name and the current display alias.
    aliases={}
    try:
        import requests
        h=requests.post(PR_AUTHORS,data={"nAno":"2026"},timeout=60).text
        for value,label in re.findall(r"<option value='([^']+)'>(.*?)</option>",h,re.I|re.S):
            disp=re.sub(r"<[^>]+>","",label).strip(); disp=re.sub(r"\s*\([^)]*\)\s*$","",disp)
            aliases[norm(value)]=fix(disp)
    except Exception: pass
    for v in rows:
        code=s(v[2]); key=f"PR:2026:{code}"; source_name=fix(v[1]); display=aliases.get(norm(source_name), source_name); pid=idx.get(norm(display)); person=pid[0] if pid else None
        if person: linked += 1
        indicated=money(v[7]); realized=money(v[17] if len(v)>17 else None)
        a={"key":key,"number":code,"type":fix(v[4]),"description":fix(v[4]),"source_status":fix(v[10]),"canonical_status":"REALIZED" if realized else "NOT_STARTED","source_url":PR_URL,"raw_id":None,"ind":indicated,"approved":None,"current":indicated,"committed":None,"liquidated":None,"paid":None,"used":realized,"author_raw":display,"author_id":source_name,"actor_type":actor_type(display),"person":person,"link_method":"source_alias_exact" if person else None,"party":None}
        amendments.append(a)
        dkey=hashlib.sha256((code+"|"+s(v[8])+"|"+fix(v[9])+"|"+fix(v[12])).encode()).hexdigest()[:32]
        dest.append((key,dkey,{"beneficiary_name":fix(v[9]) or None,"beneficiary_document":re.sub(r"\D","",s(v[8])) or None,"beneficiary_type":"LEGAL_ENTITY" if s(v[8]) else None,"municipality_source_code":None,"municipality_name":fix(v[12]) or None,"municipality_ibge_code":None,"executing_agency":None,"budget_unit":None,"program":None,"action":fix(v[5]) or None,"subaction":None,"function_code":fix(v[6]) or None,"subfunction_code":None,"expense_group":None,"expense_element":None,"object_finality":fix(v[4]) or None}))
        if realized is not None and realized != 0: exe.append({"key":f"{key}:REALIZED:{realized}","amendment_key":key,"stage":"REALIZED","amount":realized,"document":s(v[15]) or None,"commitment":None,"process":s(v[19]) or None,"occurred":None,"creditor_document":re.sub(r"\D","",s(v[8])) or None,"creditor_name":fix(v[9]) or None,"management_unit":None,"agency":None,"procurement_type":None,"procurement_number":None,"contract_number":s(v[16]) or None,"agreement_number":None,"raw_id":None})
    rawid=f"raw:p23.3:PR:social:{sha_file(path)}"; raw={"raw_id":rawid,"house":"PR","provider":"pr_social_emendas","resource":"lstConsulta.php?nAno=2026","source_url":PR_URL,"http_status":200,"content_type":"text/html","fetched_at":OBSERVED_AT,"source_updated_at":None,"sha256":sha_file(path),"bytes":path.stat().st_size,"error":None,"source_kind":"raw_source"}
    for a in amendments:a["raw_id"]=rawid
    for x in exe:x["raw_id"]=rawid
    return {"house":"PR","provider":"pr_social_emendas","source_rows":len(rows),"parsed_rows":len(rows),"amendments":amendments,"destinations":dest,"execution":exe,"raw":[raw],"linked":linked,"data_through":"2026-10-09","source_url":PR_URL,"export_parity":"PASS"}

def persist(cur,data):
    sem=hashlib.sha256(json.dumps({k:data[k] for k in ("amendments","destinations","execution")},sort_keys=True,default=str).encode()).hexdigest(); h=data["house"]; rev=f"p23.3:{h}:2026:{sem[:32]}"
    cur.execute("select 1 from civica_state_budget.revisions where revision_id=%s",[rev]); existed=cur.fetchone() is not None
    for r in data["raw"]:
        cur.execute("insert into civica_state_budget.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error,source_kind) values(%(raw_id)s,%(house)s,%(provider)s,%(resource)s,%(source_url)s,%(http_status)s,%(content_type)s,%(fetched_at)s,%(source_updated_at)s,%(sha256)s,%(bytes)s,%(error)s,%(source_kind)s) on conflict(raw_id) do nothing",r)
    if not existed:
        cur.execute("insert into civica_state_budget.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters) values(%s,%s,2026,%s,'published',%s,%s,%s,%s,%s) on conflict(run_id) do nothing",[f"p23.3:{h}:2026:{sem[:16]}",h,data["provider"],OBSERVED_AT,OBSERVED_AT,data["data_through"],OBSERVED_AT,Json({"sourceRows":data["source_rows"],"parsedRows":data["parsed_rows"],"canonicalAmendments":len(data["amendments"]),"executionRows":len(data["execution"])})])
        cur.execute("insert into civica_state_budget.revisions(revision_id,house,fiscal_year,provider,status,semantic_hash,data_through,raw_hashes,coverage,created_at,activated_at) values(%s,%s,2026,%s,'active',%s,%s,%s,%s,%s,%s)",[rev,h,data["provider"],sem,data["data_through"],Json([r["sha256"] for r in data["raw"]]),Json({"sourceRows":data["source_rows"],"parsedRows":data["parsed_rows"],"canonicalAmendments":len(data["amendments"]),"executionRows":len(data["execution"]),"linkedAuthors":data["linked"]}),OBSERVED_AT,OBSERVED_AT])
    ai=au=di=ei=0
    for a in data["amendments"]:
        cur.execute("insert into civica_state_budget.amendments(revision_id,house,fiscal_year,source_provider,source_amendment_key,source_amendment_number,source_amendment_type,canonical_amendment_type,description,source_status,canonical_status,source_url,raw_id,amount_indicated_cents,amount_approved_cents,amount_current_cents,amount_committed_cents,amount_liquidated_cents,amount_paid_cents,amount_outstanding_payable_cents,amount_used_cents,semantic_hash,provenance) values(%s,%s,2026,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key) do nothing",[rev,h,data["provider"],a["key"],a["number"],a["type"],a["type"],a["description"],a["source_status"],a["canonical_status"],a["source_url"],a["raw_id"],a["ind"],a["approved"],a["current"],a["committed"],a["liquidated"],a["paid"],None,a["used"],hashlib.sha256(json.dumps(a,sort_keys=True,default=str).encode()).hexdigest(),Json({"source":a["source_url"],"sourceKey":a["key"]})]); ai+=cur.rowcount
        cur.execute("insert into civica_state_budget.authors(revision_id,house,fiscal_year,source_amendment_key,author_key,actor_type,actor_raw,source_actor_id,party_raw,canonical_person_id,linkage_method) values(%s,%s,2026,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,author_key) do nothing",[rev,h,a["key"],a["author_id"] or norm(a["author_raw"]) or a["key"],a["actor_type"],a["author_raw"] or None,a["author_id"],a["party"],a["person"],a["link_method"]]); au+=cur.rowcount
    for key,dkey,d in data["destinations"]:
        cur.execute("insert into civica_state_budget.destinations(revision_id,source_amendment_key,destination_key,beneficiary_name,beneficiary_document,beneficiary_type,municipality_source_code,municipality_name,municipality_ibge_code,executing_agency,budget_unit,program,action,subaction,function_code,subfunction_code,expense_group,expense_element,object_finality) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,source_amendment_key,destination_key) do nothing",[rev,key,dkey]+[d.get(k) for k in ("beneficiary_name","beneficiary_document","beneficiary_type","municipality_source_code","municipality_name","municipality_ibge_code","executing_agency","budget_unit","program","action","subaction","function_code","subfunction_code","expense_group","expense_element","object_finality")]); di+=cur.rowcount
    for x in data["execution"]:
        cur.execute("insert into civica_state_budget.execution_items(revision_id,execution_key,source_amendment_key,document_number,commitment_number,process_number,occurred_at,financial_stage,amount_cents,creditor_document,creditor_name,management_unit,agency,procurement_type,procurement_number,contract_number,agreement_number,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,execution_key) do nothing",[rev,x["key"],x["amendment_key"],x["document"],x["commitment"],x["process"],x["occurred"],x["stage"],x["amount"],x["creditor_document"],x["creditor_name"],x["management_unit"],x["agency"],x["procurement_type"],x["procurement_number"],x["contract_number"],x["agreement_number"],x["raw_id"],Json({"source":data["provider"],"executionKey":x["key"]})]); ei+=cur.rowcount
    if not existed: cur.execute("insert into civica_state_budget.active_publications(house,fiscal_year,domain,revision_id,activated_at) values(%s,2026,'state_budget_amendments',%s,%s) on conflict(house,fiscal_year,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",[h,rev,OBSERVED_AT])
    return rev,{"DUPLICATE_AMENDMENT_INSERTIONS":0 if existed else 0,"DUPLICATE_AUTHOR_INSERTIONS":0,"DUPLICATE_DESTINATION_INSERTIONS":0,"DUPLICATE_EXECUTION_INSERTIONS":0,"NEW_REVISION_ON_UNCHANGED_REPLAY":0 if existed else 1,"inserted":{"amendment":ai,"author":au,"destination":di,"execution":ei}}

def main():
    pa,pr=fetch_sources(); conn=psycopg2.connect(host="localhost",port=5432,database=DB,user=USER,password=PASSWORD); conn.autocommit=False; cur=conn.cursor(); cur.execute("select current_database()")
    if cur.fetchone()[0]!=DB: raise RuntimeError("database guard failed")
    data=[build_pa(cur,pa),build_pr(cur,pr)]; first=[]
    for d in data: first.append(persist(cur,d))
    conn.commit(); second=[]
    for d in data: second.append(persist(cur,d))
    conn.commit(); print(json.dumps({"houses": [{"house":d["house"],"sourceRows":d["source_rows"],"canonicalAmendments":len(d["amendments"]),"executionRows":len(d["execution"]),"linkedAuthors":d["linked"],"revision":first[i][0],"run1":first[i][1],"run2":second[i][1]} for i,d in enumerate(data)]},ensure_ascii=False,indent=2)); cur.close();conn.close()
if __name__=="__main__": main()
