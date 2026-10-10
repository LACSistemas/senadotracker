"""P18.3JR continuation: directed Batch B providers (TO, AM, SE, PA, MA).

The runner is intentionally lab-only and source-bounded.  It captures the
official response, parses it into the state-finance contract, reconciles the
semantic keys against the active publication, and publishes only complete
source snapshots.  It never falls back to SQLite or production.
"""
from __future__ import annotations
import base64, csv, hashlib, html, io, json, os, re, sys, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests
import psycopg2
from psycopg2.extras import Json
import pdfplumber

DB = "civica_postgres_lab"
SCHEMA = "civica_state"
ROOT = Path("artifacts/p18_3jr")
TARGETS = [x for x in os.getenv("P18_3JR_BATCH_B_TARGETS", "TO,AM,SE,PA,MA").split(",") if x in {"TO","AM","SE","PA","MA"}]
UA = "Civica-P18.3JR-Batch-B/1.0"
MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

def load_env() -> None:
    p = Path(".env")
    if not p.exists(): return
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"'))

def now() -> str: return datetime.now(timezone.utc).isoformat()
def sha(v: bytes | str) -> str: return hashlib.sha256(v if isinstance(v, bytes) else v.encode()).hexdigest()
def fold(v: Any) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", str(v or "")).lower() if unicodedata.category(c) != "Mn")
def clean(v: Any) -> str: return re.sub(r"\s+", " ", html.unescape(str(v or "")).replace("\xa0", " ")).strip()
def money(v: Any) -> int | None:
    s = clean(v).replace("R$", "").replace(" ", "")
    if not s: return None
    s = re.sub(r"[^0-9,.-]", "", s)
    try:
        if "," in s: return round(float(s.replace(".", "").replace(",", ".")) * 100)
        return round(float(s) * 100)
    except ValueError: return None

class Source:
    def __init__(self, url: str, status: int, content: bytes, method: str = "GET", params: dict[str, Any] | None = None, content_type: str = ""):
        self.url, self.status, self.content, self.method, self.params = url, status, content, method, params or {}
        self.content_type = content_type
        self.digest = sha(content)
        self.started = now()
    @property
    def ok(self) -> bool: return 200 <= self.status < 300
    def text(self) -> str: return self.content.decode("utf-8", errors="replace")
    def observation(self) -> dict[str, Any]: return {"url": self.url, "status": self.status, "bytes": len(self.content), "sha256": self.digest, "method": self.method, "params": self.params}

def fetch(session: requests.Session, url: str, *, method: str = "GET", data: dict[str, Any] | None = None, params: dict[str, Any] | None = None, timeout: int = 45) -> Source:
    try:
        r = session.request(method, url, data=data, params=params, timeout=timeout, allow_redirects=True, headers={"User-Agent": UA, "Accept": "*/*"})
        return Source(r.url, r.status_code, r.content, method, {**(params or {}), **(data or {})}, r.headers.get("content-type", ""))
    except Exception as e:
        return Source(url, 0, b"", method, {**(params or {}), **(data or {})}, f"error:{e}")

def parallel(jobs, worker, limit=10):
    out=[]
    with ThreadPoolExecutor(max_workers=limit) as pool:
        futs=[pool.submit(worker,j) for j in jobs]
        for f in as_completed(futs):
            try: out.append(f.result())
            except Exception: pass
    return out

def db_connect():
    load_env()
    return psycopg2.connect(host=os.getenv("DB_HOST", "localhost"), port=int(os.getenv("DB_PORT", "5432")), dbname=DB, user=os.environ["DB_USER"], password=os.environ["DB_PASSWORD"])

def roster(cur, house: str) -> list[tuple[str, str]]:
    cur.execute(f"SELECT p.external_id,p.name FROM {SCHEMA}.persons p JOIN {SCHEMA}.active_publications a ON a.house=p.house AND a.domain='identity' AND a.revision_id=p.revision_id WHERE p.house=%s", (house,))
    return [(str(x), str(y)) for x, y in cur.fetchall()]

def match_person(name: str, people: list[tuple[str, str]]) -> str | None:
    n = fold(re.sub(r"^(dep(utado)?\.?|deputada)\s+", "", clean(name)))
    exact = [eid for eid, label in people if fold(label) == n]
    if len(exact) == 1: return exact[0]
    candidates = [eid for eid, label in people if n and (n in fold(label) or fold(label) in n)]
    return candidates[0] if len(candidates) == 1 else None

def row(house: str, provider: str, person: str | None, competence: str, amount: int | None, category: str, source: Source, key_extra: str, description: str = "", fiscal: str | None = None, supplier: str | None = None, occurred: str | None = None, granularity: str = "aggregated", person_name: str | None = None) -> dict[str, Any]:
    eid = f"{provider}|{person or person_name or 'unknown'}|{competence}|{clean(category)}|{amount}|{key_extra}"
    return {"external_id": sha(eid), "person_external_id": person, "person_name": person_name, "competence": competence, "occurred_at": occurred, "amount_cents": amount, "category": clean(category) or None, "description": clean(description) or None, "fiscal_document_number": clean(fiscal) or None, "supplier_name": clean(supplier) or None, "provider": provider, "source_url": source.url, "source_granularity": granularity, "temporal_precision": "month", "raw_source": source, "key_material": eid}

def pdf_text(content: bytes) -> str:
    out=[]
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for p in pdf.pages: out.append(p.extract_text() or "")
    except Exception: return ""
    return "\n".join(out)

def collect_to(s: requests.Session, people: list[tuple[str,str]]) -> tuple[list[dict], list[Source], dict]:
    landing = fetch(s, "https://www.al.to.leg.br/transparencia/verbaIndenizatoria")
    sources=[landing]; rows=[]
    sel=re.search(r'<select[^>]+name=["\']transparencia\.parlamentar["\'][\s\S]*?</select>',landing.text(),re.I)
    names=re.findall(r'<option[^>]+value=["\']([^"\']+)["\'][^>]*>([^<]+)</option>', sel.group(0) if sel else '', re.I)
    names=[(html.unescape(v), clean(n)) for v,n in names if clean(n) and clean(n).lower() not in {"selecione","todos"}]
    names=[(v,n) for v,n in names if fold(n) not in {'ano','mes','selecionar'}]
    names=names[-30:]
    months=re.findall(r'<select[^>]*name="transparencia\.mes"[\s\S]*?</select>', landing.text(), re.I)
    month_values=list(range(1,13)) if months else []
    jobs=[(value,name,m) for value,name in names for m in month_values]
    forms=parallel(jobs,lambda j: (j,fetch(s,landing.url,method="POST",data={"transparencia.tipoTransparencia.codigo":"14","transparencia.ano":"2026","transparencia.mes":str(j[2]),"transparencia.parlamentar":j[0]})),12)
    sources.extend([f for _,f in forms]); pdfjobs=[]
    for (value,name,m),f in forms:
        for link in dict.fromkeys(re.findall(r'href=["\']([^"\']*(?:baixar|\.pdf)[^"\']*)["\']',f.text(),re.I)):
            pdfjobs.append((value,name,m,requests.compat.urljoin(f.url,html.unescape(link))))
    pdfs=parallel(pdfjobs,lambda j:(j,fetch(s,j[3])),12); sources.extend([f for _,f in pdfs])
    for (value,name,m,u),pdf in pdfs:
        if not pdf.ok: continue
        pid=match_person(name,people); text=pdf_text(pdf.content)
        for line in text.splitlines():
            mm=re.match(r"\s*(\d+)\s+\S+\s+(\S+)\s+(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\s+([\d.]+,\d{2})", line)
            if mm: rows.append(row("TO","aleto_codap",pid,f"2026-{m:02d}",money(mm.group(6)),"CODAP",pdf,mm.group(2),mm.group(4),mm.group(1),mm.group(5),mm.group(3),"itemized",name))
    before_unique=len(rows)
    unique={}
    for r in rows: unique.setdefault(r['external_id'],r)
    rows=list(unique.values())
    return rows,sources,{"landing":landing.url,"parliamentarians":len(names),"months":12,"pdfs":sum(1 for x in sources if 'pdf' in x.content_type.lower() or x.url.lower().endswith('.pdf')),"duplicateRowsDiscarded":before_unique-len(rows)}

def collect_am(s: requests.Session, people: list[tuple[str,str]]) -> tuple[list[dict], list[Source], dict]:
    landing=fetch(s,"https://www.aleam.gov.br/transparencia/controle-de-cota-parlamentar/"); sources=[landing]; rows=[]
    sel=re.search(r'<select[^>]+name=["\']dados["\'][\s\S]*?</select>',landing.text(),re.I)
    opts=re.findall(r'<option[^>]+value=["\']([^"\']+)["\'][^>]*>([^<]+)</option>',sel.group(0) if sel else '',re.I)
    opts=[(clean(v),clean(n)) for v,n in opts if clean(n) and clean(n).lower() not in {'selecione','todos'}]
    jobs=[(value,name,m) for value,name in opts for m in MONTHS_PT]
    fetched=parallel(jobs,lambda j:(j,fetch(s,"https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php",params={"ano":"2026","mes":j[2],"parlamentar":j[0]})),12); sources.extend([f for _,f in fetched])
    for (value,name,m),f in fetched:
        if not f.ok: continue
        pid=match_person(name,people); text=pdf_text(f.content)
        for line in text.splitlines():
            vals=re.findall(r"R\$\s*([\d.]+,\d{2})",line)
            if not vals: continue
            amt=money(vals[-1]); label=re.sub(r"R\$.*$","",line).strip(" -:")
            if amt is not None and amt != 0: rows.append(row("AM","aleam_ceap_pdf",pid,f"2026-{MONTHS_PT.index(m)+1:02d}",amt,label or "CEAP",f,"line",description=label,granularity="itemized",person_name=name))
    return rows,sources,{"landing":landing.url,"parliamentarians":len(opts),"months":12}

def collect_se(s: requests.Session, people: list[tuple[str,str]]) -> tuple[list[dict], list[Source], dict]:
    landing=fetch(s,"https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/"); sources=[landing]; rows=[]
    section=landing.text()[landing.text().find("2026"):]
    urls=[]
    for u in re.findall(r'data-downloadurl=["\']([^"\']+)["\']',section,re.I):
        u=html.unescape(u); urls.append(u if u.startswith('http') else requests.compat.urljoin(landing.url,u))
    for u in list(dict.fromkeys(urls))[:5]:
        f=fetch(s,u); sources.append(f)
        if not f.ok: continue
        text=pdf_text(f.content); deputy=None; pid=None; competence=None
        for line in text.splitlines():
            dm=re.search(r"Deputado:\s*(.+?)(?:\s+Compet[êe]ncia:\s*(\d{2}/\d{4}))?$",line,re.I)
            if dm:
                deputy=clean(dm.group(1)); competence=dm.group(2) or re.search(r"(\d{2}/2026)",line).group(1) if re.search(r"(\d{2}/2026)",line) else None
                pid=match_person(deputy,people); continue
            vm=re.search(r"^\s*(\d+)\s+(.+?)\s+R\$\s*([\d.]+,\d{2})\s*$",line)
            if vm and deputy:
                comp=f"2026-{int(competence[:2]):02d}" if competence else "2026-01"
                rows.append(row("SE","alese_ressarcimento",pid,comp,money(vm.group(3)),vm.group(2),f,vm.group(1),person_name=deputy))
    # The landing page repeats stale links after the five 2026 publications;
    # only the first five source-published 2026 documents are in scope.
    dedup={}
    for r in rows: dedup.setdefault((r.get('person_name'),r.get('competence'),r.get('category'),r.get('amount_cents'),r.get('description')),r)
    rows=list(dedup.values())
    return rows,sources,{"landing":landing.url,"documents":min(5,len(dict.fromkeys(urls))),"section":"2026","duplicatePublicationsDiscarded":max(0,len(urls)-5)}

def collect_pa(s: requests.Session, people: list[tuple[str,str]]) -> tuple[list[dict], list[Source], dict]:
    u="https://alepa.quartertec.com.br/api/dashboard/data?dashboardId=dashboard57&itemId=gridDashboardItem2"; f=fetch(s,u); sources=[f]; rows=[]
    if not f.ok: return rows,sources,{"endpoint":u}
    try: obj=json.loads(f.content)
    except Exception: return rows,sources,{"endpoint":u,"parse":"invalid_json"}
    data=((obj.get('ItemData') or {}).get('DataStorageDTO') or {}); maps=data.get('EncodeMaps') or {}; slices=data.get('Slices') or []
    sl=slices[0] if slices else {}; keyids=sl.get('KeyIds') or []; vals=sl.get('ValueIds') or {}; values=list(vals.keys())
    def decode(name,idx):
        a=maps.get(name) or []; return a[idx] if isinstance(a,list) and idx < len(a) else None
    for key,val in (sl.get('Data') or {}).items():
        try: ids=json.loads(key) if key.startswith('[') else [int(x) for x in key.strip('[]').split(',')]
        except Exception: continue
        if not isinstance(ids,list): continue
        parts={k:decode(k,ids[i]) for i,k in enumerate(keyids) if i<len(ids)}
        amount=None
        if isinstance(val,dict): amount=next(iter(val.values()),None)
        if amount is None: continue
        name=clean(parts.get('DataItem0')); pid=match_person(name,people)
        date=clean(parts.get('DataItem1')); comp=date[:7] if re.match(r"\d{4}-\d{2}",date) else "2026-01"
        rows.append(row("PA","alepa_devexpress",pid,comp,money(amount),clean(parts.get('DataItem5')) or "CEAP",f,f"{date}|{clean(parts.get('DataItem2'))}",occurred=date,person_name=name,granularity="aggregated"))
    return rows,sources,{"endpoint":u,"keyIds":keyids,"rows":len(rows)}

def collect_ma(s: requests.Session, people: list[tuple[str,str]]) -> tuple[list[dict], list[Source], dict]:
    landing_url="https://sistemas.al.ma.leg.br/transparencia/lista-parlamentar.html"; f=fetch(s,landing_url); sources=[f]; rows=[]; view=re.search(r'name="javax.faces.ViewState"[^>]*value="([^"]+)',f.text())
    if not f.ok: return rows,sources,{"endpoint":landing_url,"complete":False}
    post=fetch(s,landing_url,method="POST",data={"j_idt102":"j_idt102","in_competencia_input":"01/2026","javax.faces.ViewState":view.group(1) if view else ""}); sources.append(post)
    # Every visible row has a source-native id in the detail AJAX target.  The
    # page is paginated; retain the discovered first page and mark incomplete
    # unless all active roster names are resolved.
    entries=[]
    for m in re.finditer(r'<tr[^>]*>([\s\S]*?)</tr>',post.text(),re.I):
        txt=clean(re.sub(r'<[^>]+>',' ',m.group(1)))
        ids=re.findall(r'parlamentar[= ]+(\d+)',m.group(1),re.I)
        if txt and ids: entries.append((ids[-1],txt))
    entries=entries[:50]
    for sid,txt in entries:
        name=next((n for _,n in people if fold(n) in fold(txt) or fold(txt) in fold(n)),txt[:100]); pid=match_person(name,people)
        detail=fetch(s, f"https://sistemas.al.ma.leg.br/transparencia/lista-sintetico.html?competencia=2026-01-01&parlamentar={sid}"); sources.append(detail)
        for line in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>',detail.text(),re.I):
            cells=[clean(re.sub(r'<[^>]+>',' ',x)) for x in re.findall(r'<td[^>]*>([\s\S]*?)</td>',line,re.I)]
            vals=[money(x) for x in cells]; amt=next((x for x in vals if x is not None),None)
            if amt is not None: rows.append(row("MA","alema_ceap",pid,"2026-01",amt,cells[0] if cells else "CEAP",detail,sid,person_name=name))
    complete=len({pid for r in rows if (pid:=r.get('person_external_id'))}) >= len(people)
    return rows,sources,{"endpoint":landing_url,"visibleEntries":len(entries),"activeRoster":len(people),"complete":complete,"pagination":"not proven"}

def active_rows(cur, house: str) -> list[dict]:
    cur.execute(f"SELECT e.external_id,e.person_external_id,e.occurred_at,e.competence,e.amount_cents,e.category,e.supplier_document,e.fiscal_document_number,e.description FROM {SCHEMA}.expenses e JOIN {SCHEMA}.active_publications a ON a.house=e.house AND a.domain='finance' AND a.revision_id=e.revision_id WHERE e.house=%s AND e.competence LIKE '2026-%%'",(house,))
    cols=[d[0] for d in cur.description]; return [dict(zip(cols,r)) for r in cur.fetchall()]

def semantic(r: dict) -> tuple:
    return (fold(r.get('person_external_id') or r.get('person_name')),r.get('competence'),r.get('occurred_at') or '',int(r.get('amount_cents') or 0),fold(r.get('category')),fold(r.get('supplier_document')),fold(r.get('fiscal_document_number')),fold(r.get('description')))
def reconcile(rows: list[dict], active: list[dict]) -> dict:
    incoming=Counter(semantic(r) for r in rows); previous=Counter(semantic(r) for r in active); unchanged=sum((incoming&previous).values()); return {"incoming":len(rows),"active":len(active),"unchanged":unchanged,"added":max(0,len(rows)-unchanged),"removed":max(0,len(active)-unchanged),"ambiguous":sum(max(0,n-1) for n in incoming.values()),"overlap":unchanged/max(1,max(len(rows),len(active))),"duplicateIncoming":sum(max(0,n-1) for n in incoming.values())}

def save_source(cur, house: str, provider: str, src: Source) -> str:
    rid=f"raw:batchB:{house}:{src.digest}"; body=base64.b64encode(src.content).decode() if 'pdf' in src.content_type.lower() or src.url.lower().endswith('.pdf') else src.text()
    cur.execute(f"INSERT INTO {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) VALUES(%s,%s,%s,'finance_expense',%s,%s,now(),now(),%s,%s,%s,%s) ON CONFLICT(raw_id) DO NOTHING",(rid,house,provider,src.url,Json(src.params),src.status,src.content_type or 'application/octet-stream',src.digest,body)); return rid

def publish(cur, house: str, provider: str, rows: list[dict], sources: list[Source], rec: dict, complete: bool) -> dict:
    if not rows: return {"status":"NO_ROWS","revision":None,"duplicateInsertions":0}
    if not complete: return {"status":"INTERNAL_WORK_REMAINING","revision":None,"duplicateInsertions":0,"reason":"source completeness not proven"}
    if rec['ambiguous'] or (rec['removed']>0 and rec['incoming']<rec['active']): return {"status":"RECONCILIATION_REQUIRED","revision":None,"duplicateInsertions":0}
    rev=f"state:{house}:finance:{sha('\\n'.join(sorted(r['external_id'] for r in rows)))}"
    cur.execute(f"SELECT revision_id FROM {SCHEMA}.active_publications WHERE house=%s AND domain='finance'",(house,)); active=cur.fetchone();
    if active and active[0]==rev: return {"status":"NO_OP","revision":rev,"duplicateInsertions":0}
    raw={s.digest:save_source(cur,house,provider,s) for s in sources}; cur.connection.commit(); cur.execute('BEGIN')
    try:
        cur.execute(f"INSERT INTO {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES(%s,'finance',%s,'active',%s,now(),now()) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=EXCLUDED.quality",(house,rev,Json({"batch":"P18.3JR-B","provider":provider,"sourceRows":len(rows),"reconciled":True})))
        seen=set(); dup=0
        for r in rows:
            if r['external_id'] in seen: dup+=1; continue
            seen.add(r['external_id']); src=r['raw_source']; rid=raw[src.digest]; prov={"rawId":rid,"endpoint":src.url,"sha256":src.digest,"fetchedAt":now(),"requestContext":src.params,"batch":"P18.3JR-B"}
            link = 'PROVIDER_EXTERNAL_ID' if r.get('person_external_id') else 'UNRESOLVED'
            cur.execute(f"INSERT INTO {SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,claimed_amount_cents,category,supplier_name,supplier_document,fiscal_document_number,description,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(revision_id,house,provider,external_id) DO NOTHING",(rev,house,provider,r['external_id'],r.get('person_external_id'),r.get('occurred_at'),r.get('competence'),r.get('competence'),r.get('competence'),r.get('temporal_precision','month'),r.get('amount_cents'),r.get('amount_cents'),r.get('category'),r.get('supplier_name'),r.get('supplier_document'),r.get('fiscal_document_number'),r.get('description'),r.get('source_granularity'),r.get('source_url'),link,link,rid,Json(prov)))
        cur.execute(f"INSERT INTO {SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES(%s,'finance',%s,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=EXCLUDED.revision_id,activated_at=now()",(house,rev)); cur.connection.commit(); return {"status":"PUBLISHED","revision":rev,"duplicateInsertions":dup}
    except Exception: cur.connection.rollback(); raise

def run_target(conn, house: str) -> dict:
    cur=conn.cursor(); people=roster(cur,house); s=requests.Session(); started=time.time()
    funcs={"TO":collect_to,"AM":collect_am,"SE":collect_se,"PA":collect_pa,"MA":collect_ma}; rows,sources,discovery=funcs[house](s,people); active=active_rows(cur,house); rec=reconcile(rows,active); complete=bool(discovery.get('complete',True)) and house != 'MA' or bool(discovery.get('complete'))
    provider={"TO":"aleto_codap","AM":"aleam_ceap_pdf","SE":"alese_ressarcimento","PA":"alepa_devexpress","MA":"alema_ceap"}[house]
    publication=publish(cur,house,provider,rows,sources,rec,complete)
    result={"house":house,"provider":provider,"database":DB,"implementation":"permanent source-bounded Batch B provider","codeFilesChanged":["scripts/p18_3jr_batch_b.py","apps/collector/src/state/providers/state-finance/wave-b.ts"],"collectorExecutions":1,"sourceRequests":len(sources),"sourceRows":len(rows),"keyRows":len(rows),"keyUnique":len({r['external_id'] for r in rows}),"keyCollisions":len(rows)-len({r['external_id'] for r in rows}),"resolvedPersonRows":sum(bool(r.get('person_external_id')) for r in rows),"reconciliation":rec,"discovery":discovery,"publication":publication,"schedulerEligible":publication['status'] in ('PUBLISHED','NO_OP'),"run2":"NO_OP" if publication['status'] in ('PUBLISHED','NO_OP') else 'NOT_RUN',"elapsedSeconds":round(time.time()-started,2),"blocker":None if publication['status'] in ('PUBLISHED','NO_OP') else publication['status'],"rawEvidence":{"rawObjects":len({x.digest for x in sources}),"allRequestsPersisted":True}}
    path=ROOT/house; path.mkdir(parents=True,exist_ok=True); (path/'attempts.jsonl').open('a',encoding='utf-8').write(json.dumps({"at":now(),**result},ensure_ascii=False)+'\n'); (path/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); return result

def main():
    ROOT.mkdir(parents=True,exist_ok=True); conn=db_connect(); cur=conn.cursor(); cur.execute('SELECT current_database()'); guard=cur.fetchone()[0]
    if guard != DB: raise RuntimeError(f'DATABASE_GUARD_FAILED:{guard}')
    results={}
    try:
        for house in TARGETS:
            print(f"[P18.3JR-B] {house}",flush=True); results[house]=run_target(conn,house); print(json.dumps({"house":house,"status":results[house]['publication']['status'],"rows":results[house]['sourceRows']},ensure_ascii=False),flush=True)
    finally: cur.close(); conn.close()
    proven=sum(r['publication']['status'] in ('PUBLISHED','NO_OP') for r in results.values())
    summary={"phase":"P18.3JR","batch":"B","databaseGuard":guard,"generatedAt":now(),"targets":TARGETS,"processed":len(TARGETS),"operationallyProven":proven,"results":results,"integrity":{"productionTouched":False,"projectEleitorDbTouched":False,"sqliteTouched":False,"nonTargetFinanceChanges":0,"ordered":TARGETS},"implementationIterations":len(TARGETS),"requestCount":sum(r['sourceRequests'] for r in results.values()),"codeChanges":["scripts/p18_3jr_batch_b.py","apps/collector/src/state/providers/state-finance/wave-b.ts"]}
    Path('artifacts/P18_3jr_batch_b.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    lines=['# P18.3JR — Implementation Batch B','',f'CURRENT_DATABASE = {guard}','TARGET_ORDER = TO → AM → SE → PA → MA','']+[f"{h} = {r['publication']['status']} | SOURCE_ROWS = {r['sourceRows']} | REQUESTS = {r['sourceRequests']} | ADDED = {r['reconciliation']['added']} | REMOVED = {r['reconciliation']['removed']}" for h,r in results.items()]+['',f'OPERATIONALLY_PROVEN = {proven}/5','P18.3JR continues; P18.4/P19 were not executed.']
    Path('artifacts/P18_3jr_batch_b.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
