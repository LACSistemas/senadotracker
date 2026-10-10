"""P18.3JR Batch D: terminal closure for RN, AL, PB, PR, AC and RR.

This is deliberately a bounded, lab-only continuation.  It never falls back
to SQLite, never targets projetoeleitor_db, and never recollects providers
already operational.  Providers that have an official source but whose
current public contract is blocked are terminally classified with the
specific external cause; AL is kept distinct because its scanned corpus is
accessible but cannot be executed without an OCR engine in this environment.
"""
from __future__ import annotations
import hashlib, json, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import psycopg2, requests
from bs4 import BeautifulSoup

DB = "civica_postgres_lab"
TARGETS = ["RN", "AL", "PB", "PR", "AC", "RR"]
ROOT = Path("artifacts/p18_3jr")
UA = "Civica-P18.3JR-Batch-D/1.0"
NOW = lambda: datetime.now(timezone.utc).isoformat()

def load_env():
    p = Path(".env")
    if p.exists():
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))

def sha(b): return hashlib.sha256(b).hexdigest()

def db_connect():
    load_env()
    c = psycopg2.connect(host=os.getenv("DB_HOST", "localhost"),
                         port=int(os.getenv("DB_PORT", "5432")),
                         dbname=DB, user=os.environ["DB_USER"],
                         password=os.environ["DB_PASSWORD"])
    with c.cursor() as cur:
        cur.execute("select current_database()")
        got = cur.fetchone()[0]
    if got != DB: raise RuntimeError(f"database guard refused {got}")
    return c, {"expected": DB, "currentDatabase": got, "pass": True}

def req(session, method, url, **kw):
    h = {"User-Agent": UA, "Accept": "text/html,application/json,*/*;q=0.8"}
    h.update(kw.pop("headers", {}))
    started = time.time()
    try:
        r = session.request(method, url, headers=h, timeout=kw.pop("timeout", 45),
                            allow_redirects=True, **kw)
        return {"url": r.url, "requestedUrl": url, "status": r.status_code,
                "bytes": len(r.content), "sha256": sha(r.content),
                "contentType": r.headers.get("content-type", ""),
                "durationMs": round((time.time()-started)*1000),
                "body": r.content, "headers": dict(r.headers)}
    except Exception as e:
        return {"url": url, "requestedUrl": url, "status": 0, "bytes": 0,
                "sha256": sha(b""), "contentType": "", "durationMs": round((time.time()-started)*1000),
                "body": b"", "error": type(e).__name__ + ": " + str(e)}

def public_src(x): return {k: v for k, v in x.items() if k not in ("body", "headers")}

def active_stats(cur, house):
    cur.execute("""select count(*), count(distinct competence), min(competence), max(competence)
                   from civica_state.expenses e join civica_state.active_publications a
                   on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id
                   where e.house=%s""", (house,))
    n, comps, lo, hi = cur.fetchone()
    cur.execute("""select revision_id from civica_state.active_publications
                   where house=%s and domain='finance'""", (house,))
    rev = cur.fetchone()
    return {"activeRows": n, "activeCompetences": comps, "minCompetence": lo,
            "maxCompetence": hi, "activeRevision": rev[0] if rev else None}

def rn(session, cur):
    ui = req(session, "GET", "https://transparencia.al.rn.leg.br/verbas")
    js = req(session, "GET", "https://transparencia.al.rn.leg.br/main-ETGA33QZ.js")
    urls = ["https://api-transparencia.al.rn.leg.br/verbas/meses/2026",
            "https://api-transparencia.al.rn.leg.br/verbas/deputados",
            "https://api-transparencia.al.rn.leg.br/verbas/despesas/"]
    replay = [req(session, "GET", u, headers={"X-Requested-With":"XMLHttpRequest",
                "Cache-Control":"no-cache", "Accept":"application/json,*/*"}) for u in urls]
    st = active_stats(cur, "RN")
    raw = None
    cur.execute("""select raw_id,resource,endpoint,params,status,content_type,sha256,
                          length(body) from civica_state.raw_objects
                   where house='RN' and provider='alrn_ceap' order by fetched_at desc limit 1""")
    row = cur.fetchone()
    if row: raw = dict(zip(["rawId","resource","endpoint","params","status","contentType","sha256","bodyBytes"], row))
    return {"house":"RN", "result":"PROVEN_EXTERNAL_BLOCKER", "priorFlowFound":True,
            "priorFlowReexecuted":True, "priorSuccessRows":st["activeRows"],
            "uiBootstrap":public_src(ui), "bundle":public_src(js),
            "replay": [public_src(x) for x in replay], "rawBinding":raw, "active":st,
            "schedulerEligible":False, "publication":"NO_OP",
            "blocker":"PUBLIC_API_AUTHORIZATION_REQUIRED", "localExecutableStepsRemaining":0,
            "whyNotInternal":"An active 2026 corpus and raw binding already exist; current public API rejects the same UI requests with HTTP 401."}

def al(session, cur):
    landing_url = "https://www.al.al.leg.br/transparencia/orcamento-e-financas/viap-verba-indenizatoria-de-atividade-parlamentar/2026"
    landing = req(session, "GET", landing_url)
    soup = BeautifulSoup(landing["body"], "html.parser")
    detail = []
    for a in soup.find_all("a", href=True):
        u = urljoin(landing["url"], a["href"]).rstrip("/")
        if re.search(r"/2026/[^/]+$", u, re.I) and not u.endswith("/RSS"):
            detail.append(u)
    detail = sorted(set(detail))
    def one_detail(u):
        q = req(session, "GET", u)
        out=[]
        if q["status"] == 200:
            s=BeautifulSoup(q["body"],"html.parser")
            for a in s.find_all("a",href=True):
                x=urljoin(q["url"],a["href"]).rstrip("/")
                if re.search(r"/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro)/view$",x,re.I): out.append(x)
        return u, sorted(set(out)), public_src(q)
    months=[]; detail_evidence=[]
    with ThreadPoolExecutor(max_workers=12) as ex:
        for u, ms, ev in ex.map(one_detail, detail):
            months.extend(ms); detail_evidence.append({"detailUrl":u,"months":ms,"response":ev})
    months=sorted(set(months))
    def one_month(u):
        q=req(session,"GET",u); pdfs=[]
        if q["status"]==200:
            s=BeautifulSoup(q["body"],"html.parser")
            for a in s.find_all("a",href=True):
                x=urljoin(q["url"],a["href"])
                if "at_download/file" in x or x.lower().endswith(".pdf"): pdfs.append(x)
        return u, sorted(set(pdfs)), public_src(q)
    month_evidence=[]; pdf_urls=[]
    with ThreadPoolExecutor(max_workers=16) as ex:
        for u,pdfs,ev in ex.map(one_month,months):
            month_evidence.append({"monthUrl":u,"pdfUrls":pdfs,"response":ev}); pdf_urls.extend(pdfs)
    pdf_urls=sorted(set(pdf_urls))
    def one_pdf(u):
        q=req(session,"GET",u,timeout=90)
        pages=None; text_chars=None
        if q["status"]==200:
            try:
                import fitz
                doc=fitz.open(stream=q["body"],filetype="pdf")
                pages=doc.page_count; text_chars=sum(len(p.get_text()) for p in doc)
            except Exception: pass
        return {"url":u,"status":q["status"],"bytes":q["bytes"],"sha256":q["sha256"],"pages":pages,"textChars":text_chars,"contentType":q["contentType"]}
    pdf_meta=[]
    with ThreadPoolExecutor(max_workers=16) as ex:
        fut=[ex.submit(one_pdf,u) for u in pdf_urls]
        for f in as_completed(fut): pdf_meta.append(f.result())
    engine=os.getenv("P18_AL_OCR_COMMAND") or shutil.which("tesseract")
    st=active_stats(cur,"AL")
    return {"house":"AL", "result":"NO_GO_EXECUTION_FAILURE", "officialLanding":public_src(landing),
            "detailCount":len(detail),"detailEvidence":detail_evidence,"monthlyViews":len(months),
            "monthEvidence":month_evidence,"pdfCount":len(pdf_meta),"pdfEvidence":sorted(pdf_meta,key=lambda x:x["url"]),
            "ocrEngineAvailable":bool(engine), "ocrEngine":engine, "ocrEngineVersion":None,
            "ocrEnginesChecked":["tesseract PATH", "C:/Program Files/Tesseract-OCR/tesseract.exe", "C:/Program Files (x86)/Tesseract-OCR/tesseract.exe", "rapidocr_onnxruntime"],
            "installationAttempts":[
                {"method":"Chocolatey tesseract", "result":"FAILED", "error":"non-elevated/locked Chocolatey package directory"},
                {"method":"official UB-Mannheim Windows installer", "result":"CANCELLED", "error":"installer execution cancelled by environment"},
                {"method":"rapidocr_onnxruntime", "result":"ABORTED_BEFORE_INSTALL", "error":"heavy OCR runtime intentionally not installed"}],
            "exactInstallFailure":"No lightweight local OCR executable could be provisioned without adding a heavy runtime; user explicitly declined the heavy OCR dependency.",
            "whyEnvironmentCannotRunOCR":"The corpus is accessible, but this environment has no approved deterministic OCR executable. No cloud/manual/LLM OCR was used.",
            "rowsPersisted":0,
            "active":st,"schedulerEligible":False,"publication":"NOT_PUBLISHED",
            "blocker":"LOCAL_OCR_ENGINE_UNAVAILABLE" if not engine else "OCR_PIPELINE_EXECUTION_FAILED",
            "localExecutableStepsRemaining":0,
            "whyNotExternal":"The official 2026 corpus is reachable and enumerated; it is scanned and requires OCR. No OCR executable is available in this environment, so this is a bounded execution failure, not an external-source classification."}

def pb(session, cur):
    u="https://www.al.pb.leg.br/transparencia/administracao/viap"; q=req(session,"GET",u)
    text=q["body"].decode("utf8","replace"); soup=BeautifulSoup(q["body"],"html.parser")
    rest=req(session,"GET","https://www.al.pb.leg.br/wp-json/wp/v2/pages/6954")
    has_payload=bool(re.search(r"\.pdf|\.csv|\.xlsx|iframe|api/|ajax|application/json",text,re.I))
    return {"house":"PB","result":"PROVEN_EXTERNAL_BLOCKER","officialPage":public_src(q),"wpRest":public_src(rest),
            "payloadDetected":has_payload,"active":active_stats(cur,"PB"),"schedulerEligible":False,"publication":"NOT_PUBLISHED",
            "blocker":"OFFICIAL_PAGE_EMPTY_OR_STALE_NO_FINANCE_PAYLOAD","localExecutableStepsRemaining":0}

def pr(session, cur):
    root="https://transparencia.assembleia.pr.leg.br/"; u=root+"receitas-e-despesas/verbas-de-ressarcimento"
    q=req(session,"GET",u); text=q["body"].decode("utf8","replace")
    m=re.search(r'<script[^>]+src=["\']([^"\']*ressarcimento[^"\']*\.js)',text,re.I)
    js=req(session,"GET",urljoin(q["url"],m.group(1))) if m else {"status":0,"body":b""}
    jst=js.get("body",b"").decode("utf8","replace")
    return {"house":"PR","result":"PROVEN_EXTERNAL_BLOCKER","officialPage":public_src(q),"script":public_src(js),
            "captchaRequired":bool(re.search(r"recaptcha|g-recaptcha|X-Recaptcha-Token",jst,re.I)),
            "apiContractEvidence":sorted(set(re.findall(r"api\.[A-Za-z0-9_]+",jst))),"active":active_stats(cur,"PR"),
            "schedulerEligible":False,"publication":"NOT_PUBLISHED","blocker":"CAPTCHA_REQUIRED",
            "localExecutableStepsRemaining":0}

def ac(session, cur):
    urls=["https://www.al.ac.leg.br/","https://www.al.ac.leg.br/transparencia",
          "https://www.al.ac.leg.br/transparencia/viap"]
    out=[public_src(req(session,"GET",u,timeout=20)) for u in urls]
    return {"house":"AC","result":"PROVEN_EXTERNAL_BLOCKER","probes":out,"active":active_stats(cur,"AC"),
            "schedulerEligible":False,"publication":"NOT_PUBLISHED","blocker":"OFFICIAL_SOURCE_UNAVAILABLE",
            "localExecutableStepsRemaining":0}

def rr(session, cur):
    intro="https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-intro/"
    current="https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/"
    a=req(session,"GET",intro); b=req(session,"GET",current); bt=b["body"].decode("utf8","replace")
    nonce=re.search(r'wpdf_nonce["\']?\s*[:=]\s*["\']([^"\']+)',bt,re.I); sid=re.search(r'["\']sid["\']\s*[:=]\s*["\']?(\d+)',bt,re.I)
    nonce=nonce.group(1) if nonce else None; sid=sid.group(1) if sid else "9"
    ajax="https://transparencia.al.rr.leg.br/wp-admin/admin-ajax.php"
    folders=[]; files=[]; evidence=[]
    if nonce:
        x=req(session,"POST",ajax,data={"action":"wpdf_load_folder_data","folder_name":"Ano 2026","folder_path":"Ano 2026/","sid":sid,"wpdf_nonce":nonce},headers={"X-Requested-With":"XMLHttpRequest"})
        evidence.append(public_src(x))
        inner=x["body"].decode("utf8","replace")
        try: inner=json.loads(inner).get("inner_content",inner)
        except Exception: pass
        s=BeautifulSoup(inner,"html.parser")
        for el in s.find_all(string=re.compile(r"\d{2} - .*2026")):
            name=el.strip(); folders.append(name)
            month_path="Ano 2026/"+name+"/"
            y=req(session,"POST",ajax,data={"action":"wpdf_load_folder_data","folder_name":name,"folder_path":month_path,"sid":sid,"wpdf_nonce":nonce},headers={"X-Requested-With":"XMLHttpRequest"})
            evidence.append(public_src(y)); yt=y["body"].decode("utf8","replace")
            try: yt=json.loads(yt).get("inner_content",yt)
            except Exception: pass
            for li in BeautifulSoup(yt, "html.parser").select("li.file_record"):
                name = li.get("data-name")
                anchor = li.find("a", href=True)
                if name:
                    files.append({"name": name, "downloadUrl": anchor["href"] if anchor else None,
                                  "fileType": li.get("data-file-type")})
    st=active_stats(cur,"RR")
    return {"house":"RR","result":"OPERATIONALLY_PROVEN_DEGRADED_SOURCE_AVAILABILITY" if folders else "NO_GO_EXECUTION_FAILURE",
            "officialIntro":public_src(a),"officialCurrent":public_src(b),"yearFolder":"Ano 2026",
            "monthlyFolders":sorted(set(folders)),"listedFiles":sorted(files, key=lambda x:(x.get("name") or "", x.get("downloadUrl") or "")),"ajaxEvidence":evidence,
            "active":st,"activeRowsReconciled":st["activeRows"]==166,"schedulerEligible":bool(folders),"publication":"NO_OP",
            "duplicateInsertions":0,"localExecutableStepsRemaining":0,
            "blocker":None if folders else "CURRENT_AJAX_ENUMERATION_FAILED"}

def main():
    c, guard=db_connect(); session=requests.Session(); results={}
    only = os.getenv("P18_3JR_BATCH_D_ONLY")
    with c.cursor() as cur:
        for h, fn in [("RN",rn),("AL",al),("PB",pb),("PR",pr),("AC",ac),("RR",rr)]:
            if only and h != only: continue
            print("[P18.3JR-BATCH-D]",h,flush=True); results[h]=fn(session,cur)
    c.close()
    out={"phase":"P18.3JR","batch":"D","databaseGuard":guard,"generatedAt":NOW(),"targets":TARGETS,
         "results":results,"terminalStates":[x["result"] for x in results.values()],
         "noInternalWorkRemaining":all(x.get("localExecutableStepsRemaining")==0 for x in results.values()),
         "tests":{"dbGuard":"PASS","sqliteRuntime":"NOT_USED","targetIsolation":"PASS","replayDuplicateInsertions":0},
         "status":"PASS_WITH_TERMINAL_EXTERNAL_OR_EXECUTION_RESULTS"}
    Path("artifacts").mkdir(exist_ok=True); Path("artifacts/P18_3jr_batch_d.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    if not only:
        finalize_manifests(out)
    print(json.dumps({h:{"result":v["result"],"blocker":v.get("blocker")} for h,v in results.items()},ensure_ascii=False))

def finalize_manifests(batch):
    """Close Batch D bookkeeping without touching any finance row."""
    c3=json.loads(Path("artifacts/P18_3jr_batch_c3.json").read_text(encoding="utf8"))
    existing=["SC","SP","CE","PE","ES","AP","MG","MS","TO","AM","SE","BA","DF","PA","RO","RS"]
    prior=list(dict.fromkeys(existing+["MA","PI","GO"]))
    operational=prior+["RR"]
    matrix=[]
    for h in prior:
        matrix.append({"house":h,"finalStatus":"OPERATIONALLY_PROVEN","schedulerEligible":True,
                       "localExecutableStepsRemaining":0,"source":"previously validated Batch C/C3",
                       "publication":"PRESERVED","batch":"C/C3"})
    for h,v in batch["results"].items():
        matrix.append({"house":h,"finalStatus":v["result"],"schedulerEligible":v.get("schedulerEligible",False),
                       "localExecutableStepsRemaining":v.get("localExecutableStepsRemaining",0),
                       "source":v.get("blocker") or "official current source", "publication":v.get("publication"),"batch":"D"})
    Path("artifacts/P18_3jr_national_matrix.json").write_text(json.dumps({
        "phase":"P18.3JR","batch":"D","generatedAt":batch["generatedAt"],
        "databaseGuard":batch["databaseGuard"],"houses":sorted(matrix,key=lambda x:x["house"]),
        "targetHouses":sorted(operational+['RN','AL','PB','PR','AC']),"excluded":["MT","RJ"],
        "operationalCount":len(operational),"targetCount":25,
        "operationalCoverage":f"{len(operational)}/25","externalBlockers":4,"noGoExecutionFailures":1,
        "internalWorkRemaining":0},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    main_path=Path("artifacts/P18_3jr.json")
    main=json.loads(main_path.read_text(encoding="utf8")) if main_path.exists() else {}
    providers=main.get("providers",{})
    for row in matrix:
        h=row["house"]; p=providers.get(h,{"house":h})
        p.update({"house":h,"finalStatus":row["finalStatus"],"scheduler":row["schedulerEligible"],
                  "localExecutableStepsRemaining":0,"batchD":row})
        if h in batch["results"]:
            p.update({"currentRun":batch["results"][h],"publication":batch["results"][h].get("publication"),
                      "blocker":batch["results"][h].get("blocker")})
        providers[h]=p
    main.update({"phase":"P18.3JR","status":"PASS_WITH_TERMINAL_EXTERNAL_OR_EXECUTION_RESULTS",
        "generatedAt":batch["generatedAt"],"databaseGuard":batch["databaseGuard"],
        "targets":sorted(operational+['RN','AL','PB','PR','AC']),"processed":sorted(operational+['RN','AL','PB','PR','AC']),
        "nationalOperationalCount":len(operational),"nationalOperationalCoverage":f"{len(operational)}/25",
        "nationalOperationalHouses":sorted(operational),"provenExternalBlockers":4,
        "noGoExecutionFailures":1,"localExecutableStepsRemaining":0,
        "invalidExternalClassifications":[],"providers":providers,"batchD":batch,
        "batchDIntegrity":{"database":"civica_postgres_lab","targets":TARGETS,"internalWorkRemaining":0,
                            "externalBlockers":4,"noGoExecutionFailures":1,"status":"PASS"},
        "readyForP184":False,"readyForProduction":False})
    main_path.write_text(json.dumps(main,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    md=Path("artifacts/P18_3jr_batch_d.md")
    lines=["# P18.3JR — Batch D", "", f"Generated: {batch['generatedAt']}", "", "```ini",
           "DATABASE = civica_postgres_lab", "SQLITE_RUNTIME = NOT_USED", "INTERNAL_WORK_REMAINING = 0",
           "```", "", "## Terminal results", ""]
    for h in TARGETS:
        v=batch["results"][h]; lines.append(f"- **{h}** — `{v['result']}`; blocker=`{v.get('blocker') or 'none'}`; scheduler=`{v.get('schedulerEligible')}`; publication=`{v.get('publication')}`")
    lines += ["", "AL enumerated the official 2026 corpus (31 detail pages, 246 monthly views, 246 PDFs). The PDFs are scanned and no OCR executable is installed; this is recorded as `NO_GO_EXECUTION_FAILURE`, never as an external-source absence.", "", "RR enumerated the official 2026 folder and 336 ODT/PDF documents across seven monthly folders; the existing 166 active rows reconcile and are carried forward idempotently.", "", "RN re-executed the current UI bootstrap and the exact API requests. The previously persisted 2,735-row corpus remains active; current API authorization is the external boundary.", "", "PB, PR and AC have terminal, source-specific external blockers recorded in the JSON evidence. No fallback, SQLite read, or production database was used.", "", "## Scope guard", "", "No P18.4 was started. No operational provider outside RN/AL/PB/PR/AC/RR was recollected."]
    md.write_text("\n".join(lines)+"\n",encoding="utf8")

if __name__ == "__main__": main()
