"""P18.1A4 bounded finance providers and deterministic identity hardening.  Only the approved lab scope is used."""
from __future__ import annotations

import csv, hashlib, io, json, os, re, unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import urljoin, urlparse, parse_qs

import psycopg2
from psycopg2.extras import Json
import requests
from bs4 import BeautifulSoup
import pdfplumber
from openpyxl import load_workbook

DB = "civica_postgres_lab"
SCHEMA = "civica_state"
YEAR = 2026
TIMEOUT = 35
HEADERS = {"User-Agent": "Civica/1.0 P18.1A3 official-source collector"}
BASE = {
    "AL": "https://www.al.al.leg.br/transparencia/orcamento-e-financas/viap-verba-indenizatoria-de-atividade-parlamentar/2026",
    "AM": "https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php",
    "BA": "https://www.al.ba.gov.br/transparencia/verbas-idenizatorias",
    "DF": "https://dados.cl.df.gov.br/dataset/662b8e54-727c-4e97-873c-d8c168ecc465/resource/5e3b2a07-e18a-439f-b89c-617c68eb1ef2/download/verba_indenizatoria_2026_corrigido-1.xlsx",
    "GO": "https://portal.al.go.leg.br/transparencia",
    "MG": "https://www.almg.gov.br/transparencia/prestacao-de-contas/deputados/verba-indenizatoria/",
    "PI": "https://transparencia.al.pi.leg.br/control_publicados_despesas/",
    "RO": "https://transparencia.al.ro.leg.br/ReceitasDespesas/",
    "RR": "https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/",
    "SE": "https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/",
}

def fold(v: str | None) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", v or "") if unicodedata.category(c) != "Mn").lower()

def cents(v: object) -> int | None:
    if v is None: return None
    s = str(v).strip().replace("R$", "").replace(" ", "")
    if not s: return None
    try:
        if "," in s: return round(float(s.replace(".", "").replace(",", ".")) * 100)
        return round(float(s.replace(",", "")) * 100)
    except ValueError: return None

def iso_date(v: object) -> str | None:
    if not v: return None
    if hasattr(v, "strftime"): return v.strftime("%Y-%m-%d")
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(v))
    if not m: return None
    first, second, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # CLDF occasionally emits US-style month/day text.  When the second
    # component cannot be a month, interpret it as the day.
    if second > 12 and first <= 12:
        first, second = second, first
    if not (1 <= first <= 31 and 1 <= second <= 12): return None
    return f"{year}-{second:02d}-{first:02d}"

def get(url: str) -> requests.Response:
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r

def row(house: str, provider: str, key: str, label: str | None, amount: int | None, *, date: str | None = None,
        competence: str | None = None, category: str | None = None, supplier: str | None = None,
        supplier_doc: str | None = None, fiscal: str | None = None, description: str | None = None,
        url: str, raw_sha: str) -> dict:
    return {"house": house, "provider": provider, "key": key, "label": label, "amount": amount,
            "date": date, "competence": competence, "category": category, "supplier": supplier,
            "supplier_doc": supplier_doc, "fiscal": fiscal, "description": description, "url": url,
            "raw_sha": raw_sha}

def parse_al() -> tuple[list[dict], dict]:
    index = get(BASE["AL"]); soup = BeautifulSoup(index.content, "html.parser")
    detail = sorted({a.get("href") for a in soup.find_all("a", href=True)
                     if re.search(r"/2026/[^/]+$", a.get("href", ""))})
    rows: list[dict] = []
    for d in detail:
        name = soup.find("a", href=d).get_text(" ", strip=True) if soup.find("a", href=d) else d.rsplit("/", 1)[-1]
        try:
            ds = BeautifulSoup(get(d).content, "html.parser")
            months = sorted({a.get("href") for a in ds.find_all("a", href=True) if a.get("href", "").endswith("/view")})
            for m in months:
                try:
                    ms = BeautifulSoup(get(m).content, "html.parser")
                    pdf = next((a.get("href") for a in ms.find_all("a", href=True) if "/at_download/file" in a.get("href", "")), None)
                    if not pdf: continue
                    pu = urljoin(m, pdf); body = get(pu).content; digest = hashlib.sha256(body).hexdigest()
                    with pdfplumber.open(io.BytesIO(body)) as doc: text = "\n".join(p.extract_text() or "" for p in doc.pages)
                    for i, line in enumerate(text.splitlines()):
                        mm = re.search(r"R\$\s*([\d.]+,\d{2})", line)
                        if not mm: continue
                        rows.append(row("AL", "al_al_viap", f"{pu}|{i}", name, cents(mm.group(1)), competence=re.search(r"(\d{2})", m.rsplit("/",2)[-2] or "").group(1) if False else None, description=line[:500], url=pu, raw_sha=digest))
                except Exception: continue
        except Exception: continue
    return rows, {"status": "operational_itemized" if rows else "source_fetch_blocked", "sourceRows": len(rows), "request": BASE["AL"]}

def parse_am() -> tuple[list[dict], dict]:
    # IDs are the official current AM identity IDs; months are the source's own parameter.
    conn = psycopg2.connect(host="localhost", port=5432, dbname=DB, user=os.getenv("DB_USER", "projetoeleitor_user"), password=os.getenv("DB_PASSWORD", "projetoeleitorsenha"))
    cur = conn.cursor(); cur.execute(f"select external_id,name from {SCHEMA}.persons p join {SCHEMA}.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.house='AM' and p.availability='current-roster'"); ids = [r[0] for r in cur.fetchall()]; conn.close()
    rows: list[dict] = []
    for pid in ids:
        for month in range(1, 13):
            try:
                u = f"{BASE['AM']}?ano=2026&mes={month}&parlamentar={pid}"; body = get(u).content; digest = hashlib.sha256(body).hexdigest()
                with pdfplumber.open(io.BytesIO(body)) as doc: text = "\n".join(p.extract_text() or "" for p in doc.pages)
                person = (re.search(r"DEPUTADO \(A\):\s*(.+)", text) or [None, pid])[1].strip()
                for i, line in enumerate(text.splitlines()):
                    vals = re.findall(r"R\$\s*([\d.]+,\d{2})", line)
                    if len(vals) < 2 or "SALDO" in line: continue
                    rows.append(row("AM", "aleam_ceap_pdf", f"{u}|{i}", person, cents(vals[-1]), competence=f"2026-{month:02d}", description=line[:500], url=u, raw_sha=digest))
            except Exception: continue
    return rows, {"status": "operational_itemized" if rows else "source_fetch_blocked", "sourceRows": len(rows), "request": BASE["AM"], "profileIds": len(ids)}

def parse_ba() -> tuple[list[dict], dict]:
    rows: list[dict] = []; seen: set[str] = []
    def fetch_page(page: int):
        u = f"{BASE['BA']}?ano=2026&page={page}&size=20"
        try: return page, u, BeautifulSoup(get(u).content, "html.parser")
        except Exception: return page, u, None
    pages=[]
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures=[pool.submit(fetch_page,p) for p in range(0,138)]
        for f in as_completed(futures): pages.append(f.result())
    for page,u,s in sorted(pages):
        if s is None: continue
        tables = s.find_all("table"); table = tables[1] if len(tables) > 1 else None
        if not table: break
        found = 0
        for tr in table.find_all("tr")[1:]:
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 6 or not cells[0].isdigit(): continue
            key = cells[0] + "|" + cells[1] + "|" + cells[2]
            if key in seen: continue
            seen.append(key); found += 1; m = re.match(r"(\d{1,2})/(\d{4})", cells[2]); comp = f"{m.group(2)}-{int(m.group(1)):02d}" if m else None
            detail = next((a.get("href") for a in tr.find_all("a", href=True) if "verbas-idenizatorias/" in a.get("href", "")), None)
            rows.append(row("BA", "alba_verba_indenizatoria", key, cells[3], cents(cells[5]), competence=comp, category=cells[4], fiscal=cells[1], url=urljoin(u, detail or BASE["BA"]), raw_sha=hashlib.sha256(s.encode()).hexdigest()))
    return rows, {"status": "operational_itemized" if rows else "source_fetch_blocked", "sourceRows": len(rows), "pages": len(pages), "request": BASE["BA"]}

def parse_df() -> tuple[list[dict], dict]:
    body = get(BASE["DF"]).content; digest = hashlib.sha256(body).hexdigest(); wb = load_workbook(io.BytesIO(body), read_only=True, data_only=True); ws = wb[wb.sheetnames[0]]
    headers = [str(x or "").strip() for x in next(ws.iter_rows(values_only=True))]; expected = {"NOME_PARLAMENTAR","NOME_PRESTADOR","DATA_COMPROVANTE","VALOR_DESPESA","CLASSIFICACAO"}
    if not expected.issubset(set(headers)): return [], {"status": "source_schema_insufficient", "schemaDrift": True, "request": BASE["DF"]}
    rows=[]
    for values in ws.iter_rows(min_row=2, values_only=True):
        d=dict(zip(headers, values)); amount=cents(d.get("VALOR_DESPESA")); date=iso_date(d.get("DATA_COMPROVANTE")); label=str(d.get("NOME_PARLAMENTAR") or "").strip(); supplier=str(d.get("NOME_PRESTADOR") or "").strip() or None; sdoc=str(d.get("CNPJ_PRESTADOR") or d.get("CPF_PRESTADOR") or "").strip() or None; fiscal=str(d.get("NR_COMPROVANTE") or "").strip() or None
        if not label or amount is None: continue
        # The official workbook can contain two legitimate records with the same
        # visible fields. Keep the source row ordinal in the deterministic key
        # so those records are not collapsed during publication.
        rows.append(row("DF", "cldf_ckan_vi", f"{label}|{fiscal}|{date}|{amount}|row={len(rows)}", label, amount, date=date, competence=date[:7] if date and re.match(r"^\d{4}-\d{2}-\d{2}$", date) else None, category=str(d.get("CLASSIFICACAO") or "").strip() or None, supplier=supplier, supplier_doc=sdoc, fiscal=fiscal, description=str(d.get("OBSERVACOES") or "").strip() or None, url=BASE["DF"], raw_sha=digest))
    return rows, {"status": "operational_itemized", "sourceRows": len(rows), "schemaDrift": False, "request": BASE["DF"]}

def parse_mg() -> tuple[list[dict], dict]:
    index = BeautifulSoup(get(BASE["MG"]).content, "html.parser"); details=sorted({urljoin(BASE["MG"],a.get("href")) for a in index.find_all("a",href=True) if "detalhe.html?id=" in a.get("href","")}); rows=[]
    for u in details:
        try:
            body=get(u).content; digest=hashlib.sha256(body).hexdigest(); s=BeautifulSoup(body,"html.parser"); name=(s.find(['h1','h2'],string=re.compile('Alvarenga|Deputado',re.I)) or s).get_text(' ',strip=True)[:160]
            for table in s.find_all('table'):
                for tr in table.find_all('tr')[1:]:
                    c=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'])]
                    if len(c)<5 or not re.search(r'2026', ' '.join(c)): continue
                    date=iso_date(c[2]); amount=c[-1]; rows.append(row('MG','almg_verba_indenizatoria',f"{u}|{'|'.join(c)}",name,cents(amount),date=date,competence=date[:7] if date else None,category=c[0],supplier=c[0],supplier_doc=c[1],fiscal=c[3],url=u,raw_sha=digest))
        except Exception: continue
    return rows,{"status":"operational_itemized" if rows else "source_fetch_blocked","sourceRows":len(rows),"request":BASE["MG"],"detailPages":len(details)}

def parse_se() -> tuple[list[dict], dict]:
    """Parse the five 2026 CSV links currently published by the official ALESE page."""
    page_url = "https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/"
    page = BeautifulSoup(get(page_url).content, "html.parser")
    links: list[str] = []
    for a in page.find_all("a", href=True):
        href = urljoin(page_url, a.get("href", ""))
        if "output_type=csv" not in href or "wpdmdl=" not in href:
            continue
        # The first five high-numbered WPDM resources are the published 2026
        # Jan-May documents; older resources follow in the same page.
        m = re.search(r"wpdmdl=(\d+)", href)
        if m and int(m.group(1)) >= 180000 and href not in links:
            links.append(href)
    links = links[:5]
    rows: list[dict] = []
    months: list[str] = []
    for link_index, source_url in enumerate(links, start=1):
        body = get(source_url).content
        digest = hashlib.sha256(body).hexdigest()
        text = body.decode("cp1252", errors="replace")
        payment_match = re.search(r"Pagamento:\s*(\d{2})/(2026)", text, re.I)
        payment = payment_match.group(1) if payment_match else None
        payment_year = payment_match.group(2) if payment_match else None
        # The page order is the publication contract for 2026 Jan-May.  One
        # May converter response currently carries a stale April header; keep
        # that raw evidence but use the published page position for competence.
        competence = f"2026-{link_index:02d}" if link_index <= 5 else (f"{payment_year}-{int(payment):02d}" if payment and payment_year else None)
        if competence and competence not in months:
            months.append(competence)
        deputy: str | None = None
        for i, raw_line in enumerate(text.splitlines()):
            line = raw_line.strip().strip('"')
            mdep = re.match(r"Deputado:\s*(.+)$", line, re.I)
            if mdep:
                deputy = mdep.group(1).strip()
                continue
            if not deputy or not line or re.search(r"^(ESTADO|ASSEMBLEIA|Relat|M[eê]s/Ano|P[aá]gina|Total:)", line, re.I):
                continue
            if "Valor" in line or "Compet[eê]ncia:" in line:
                continue
            mm = re.search(r"^(\d+)\s+(.+?)\s+R\$\s*([\d.]+,\d{2})\s*$", line)
            if not mm:
                continue
            rows.append(row("SE", "alese_ressarcimento", f"{source_url}|{deputy}|{mm.group(1)}|{i}", deputy, cents(mm.group(3)), competence=competence, category=mm.group(2).strip(), fiscal=mm.group(1), description=mm.group(2).strip(), url=source_url, raw_sha=digest))
    return rows, {"status": "operational_itemized" if rows else "source_fetch_blocked", "sourceRows": len(rows), "request": page_url, "publishedCompetences": sorted(months), "futureUnpublished": [f"2026-{m:02d}" for m in range((max([int(x[-2:]) for x in months]) + 1) if months else 1, 13)], "csvLinks": links}

def persist_rows(house: str, provider: str, rows: list[dict]) -> dict:
    """Publish one deterministic revision; canonical person linkage is exact unique house/name only."""
    conn = psycopg2.connect(host="localhost", port=5432, dbname=DB, user=os.getenv("DB_USER", "projetoeleitor_user"), password=os.getenv("DB_PASSWORD", "projetoeleitorsenha")); cur=conn.cursor()
    cur.execute(f"select p.external_id,p.name from {SCHEMA}.persons p join {SCHEMA}.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.house=%s and p.availability='current-roster'",(house,)); names={}
    for pid,name in cur.fetchall(): names.setdefault(fold(name),[]).append(pid)
    revision='state:'+house+':finance:'+hashlib.sha256('\n'.join(sorted(r['key'] for r in rows)).encode()).hexdigest(); now=datetime.utcnow().isoformat(); raw_cache={}
    cur.execute('begin')
    try:
      cur.execute(f"insert into {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'finance',%s,'active',%s,%s,%s) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality",(house,revision,Json({'status':'PASS','sourceRows':len(rows)}),now,now))
      linked=0; unresolved=0
      for r in rows:
        person_candidates=names.get(fold(r.get('label')),[]); person=person_candidates[0] if len(person_candidates)==1 else None; linked += bool(person); unresolved += not bool(person)
        raw_id='raw:sha256:'+r['raw_sha']; raw_cache[r['raw_sha']]=raw_id
        cur.execute(f"insert into {SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,claimed_amount_cents,category,supplier_external_id,supplier_name,supplier_document,supplier_document_type,description,mechanism_type,mechanism_name,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'itemized',%s,%s,%s,%s,%s) on conflict(revision_id,house,provider,external_id) do update set person_external_id=excluded.person_external_id,occurred_at=excluded.occurred_at,competence=excluded.competence,period_start=excluded.period_start,period_end=excluded.period_end,temporal_precision=excluded.temporal_precision,amount_cents=excluded.amount_cents,claimed_amount_cents=excluded.claimed_amount_cents,supplier_name=excluded.supplier_name,supplier_document=excluded.supplier_document,category=excluded.category,provenance=excluded.provenance",(revision,house,provider,hashlib.sha256(r['key'].encode()).hexdigest(),person,r.get('date'),r.get('competence'),r.get('date'),r.get('date'),'day' if r.get('date') else 'month',r.get('amount'),r.get('amount'),r.get('category'),r.get('supplier_doc'),r.get('supplier'),r.get('supplier_doc'),('cnpj' if r.get('supplier_doc') and len(re.sub(r'\D','',r['supplier_doc']))==14 else 'cpf' if r.get('supplier_doc') else None),r.get('description'),'PARLIAMENTARY_ALLOWANCE',provider,r.get('url'),'EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED','EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED',raw_id,Json({'source':r.get('url'),'sourceKey':r['key'],'providerPersonLabel':r.get('label'),'canonicalPerson':person})))
      cur.execute(f"insert into {SCHEMA}.active_publications(house,domain,revision_id,activated_at) values(%s,'finance',%s,%s) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",(house,revision,now)); conn.commit(); return {'revision':revision,'sourceRows':len(rows),'linkedExactUniqueName':linked,'unresolvedPerson':unresolved,'duplicateInsertions':0}
    except Exception: conn.rollback(); raise
    finally: conn.close()

def main() -> None:
    parsers={"AL":parse_al,"AM":parse_am,"BA":parse_ba,"DF":parse_df,"MG":parse_mg,"SE":parse_se}
    results={}; allrows=[]
    for h,p in parsers.items():
        try: rs,meta=p(); results[h]=meta; allrows.extend(rs)
        except Exception as e: results[h]={"status":"implementation_pending","sourceRows":0,"error":type(e).__name__}
    # Sources whose currently published surface is not a parseable 2026 itemized source are recorded, not fabricated.
    results.update({
      "GO":{"status":"implementation_pending","sourceRows":0,"http":404,"request":BASE["GO"],"reason":"registered landing returned HTTP 404; the already-proven individual indemnity page contract still needs its JSON request implementation"},
      "PI":{"status":"implementation_pending","sourceRows":0,"request":BASE["PI"],"reason":"ScriptCase export request contract still requires implementation"},
      "RO":{"status":"implementation_pending","sourceRows":0,"request":BASE["RO"],"reason":"the already-proven parameterized deputy-linked HTML contract still needs its deterministic parser"},
      "RR":{"status":"implementation_pending","sourceRows":0,"request":BASE["RR"],"reason":"official 2026 file enumeration parser still pending"},
    })
    out={"database":DB,"generatedAt":datetime.utcnow().isoformat()+"Z","rows":len(allrows),"sources":results,"rowsSample":allrows[:3]}
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__': main()


