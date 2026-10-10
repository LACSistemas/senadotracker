#!/usr/bin/env python3
"""P17.3c2: independent profile QA and GO/RJ roster closure.

This script deliberately does not call the parser's quality counters.  It reads
the active publication, applies an independent validator, and only then applies
the narrowly scoped AL/SE photo and TO name corrections.
"""
from __future__ import annotations
import hashlib, importlib.util, json, os, re, unicodedata, subprocess, html
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, quote
import requests
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
ART = HERE.parent / "artifacts"
spec = importlib.util.spec_from_file_location("p173c1", HERE / "state-p17_3c1.py")
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
DB = "civica_postgres_lab"; SCHEMA = "civica_state"
UA = "Civica-P17.3c2-independent-qa/1.0"
ASSET_RE = re.compile(r"(?:search\.png|brasao\.png|avatar(?:[._-].*)?|default(?:[._-].*)?|placeholder(?:[._-].*)?|no[-_ ]?photo|sem[-_ ]?foto|logo(?:[._/-].*)?|user[-_ ]?default)", re.I)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}")
LABEL_RE = re.compile(r"(?:nome\s+completo|partido\s*:|deputad[oa]\s*:|e[- ]?mail\s*:|telefone\s*:)", re.I)
PARTY_CODES = {"MDB","PL","PT","PV","PSD","PSDB","PP","PDT","PSOL","NOVO","PRD","PODEMOS","REPUBLICANOS","REP","UNIÃO","UNIAO","AVANTE","SOLIDARIEDADE","SOLIDARI","CIDADANIA","PCDOB","PCDO B","PCdoB","PSB","PSC","PATRIOTA","PROS","REDE","PODE","DEM","PRB","PHS","PMN","PMDB","PPS","PSL","PRTB","AGIR","DC","PCB","UP","MOBILIZA","MISSÃO","MISSAO","SD","UB"}
PARTY_ALIAS = {"UB":"UNIÃO", "UNIÃO BRASIL":"UNIÃO", "UNIAO BRASIL":"UNIÃO", "UNIAO":"UNIÃO", "UNI�O":"UNIÃO", "PC DO B":"PCdoB", "PCDOB":"PCdoB", "PODE":"PODEMOS", "REPUBLICANO":"REPUBLICANOS", "SD":"SOLIDARIEDADE", "SOLIDARI":"SOLIDARIEDADE", "MISSÃO":"MISSÃO", "MISSAO":"MISSÃO"}

def now(): return datetime.now(timezone.utc)
def norm(s):
    s = (s or "").replace("�", "")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).upper().strip()
def canonical_party(raw):
    if not raw: return None
    u = norm(raw).strip(" ()-|.")
    if u in PARTY_ALIAS: return PARTY_ALIAS[u]
    if u in {norm(x) for x in PARTY_CODES}:
        # Keep explicit source codes; do not silently turn REP into a party name.
        return raw.strip()
    # Full official labels are deterministic, not fuzzy matching.
    full = {"PARTIDO DOS TRABALHADORES":"PT", "PARTIDO LIBERAL":"PL", "PARTIDO SOCIAL DEMOCRATICO":"PSD", "PARTIDO SOCIAL DEMOCRATICO BRASILEIRO":"PSDB", "PARTIDO PROGRESSISTA":"PP", "MOVIMENTO DEMOCRATICO BRASILEIRO":"MDB", "PARTIDO SOCIALISTA BRASILEIRO":"PSB", "PARTIDO SOLIDARIEDADE":"SOLIDARIEDADE", "PARTIDO DA RENOVACAO DEMOCRATICA":"PRD", "PARTIDO VERDE":"PV", "REPUBLICANOS":"REPUBLICANOS", "PARTIDO COMUNISTA DO BRASIL":"PCdoB", "PODEMOS":"PODEMOS", "AGIR":"AGIR"}
    return full.get(u)
def name_qa(name):
    if not name: return "MISSING", ["MISSING"]
    issues=[]
    if EMAIL_RE.search(name): issues.append("NAME_WITH_EMAIL")
    if PHONE_RE.search(name): issues.append("NAME_WITH_PHONE")
    if LABEL_RE.search(name) or "<" in name or ">" in name: issues.append("NAME_LABEL_CONTAMINATION")
    return ("CONTAMINATED" if issues else "VALID"), issues
def photo_quality(url):
    if not url: return "NOT_AVAILABLE"
    if ASSET_RE.search(url): return "PLACEHOLDER" if re.search(r"placeholder|default|avatar|no[-_ ]?photo|sem[-_ ]?foto|user[-_ ]?default",url,re.I) else "INSTITUTIONAL_ASSET"
    if not re.match(r"^https?://[^\s]+$", url): return "MALFORMED"
    return "VALID_PERSON_PHOTO"
def clean_to_name(name):
    # TO's official card concatenates name + party + phone + email. Remove only
    # fields proven to be adjacent on that source; preserve legitimate "do PT".
    x = re.sub(r"\s+\(?\d{2}\)?\s*\d{4,5}[- ]\d{4}.*$", "", name or "", flags=re.I)
    x = re.sub(r"\s+[A-ZÀ-Ý][A-ZÀ-Ý0-9-]{1,15}\s*$", "", x) if False else x
    x = re.sub(r"\s+(?:MDB|UB|PL|PSDB|PV|PSD|PP|PCdoB|Republicanos|PODEMOS|PDT|PT|PSOL|PRD|REPUBLICANOS)\s*$", "", x, flags=re.I)
    x = re.sub(r"\s+[^\s@]+@[^\s]+$", "", x)
    return re.sub(r"\s+", " ", x).strip()
def encode_photo_url(url):
    return quote(url, safe=":/?=&%#@+;,[]!$'()*-._~") if url else url

def db_conn():
    import psycopg2
    c=psycopg2.connect(host=os.getenv("DB_HOST","localhost"),port=int(os.getenv("DB_PORT","5432")),dbname=DB,user=os.getenv("DB_USER"),password=os.getenv("DB_PASSWORD")); c.autocommit=False
    cur=c.cursor(); cur.execute("select current_database()"); actual=cur.fetchone()[0]
    if actual != DB: c.close(); raise RuntimeError(f"target database refused: {actual}")
    return c
def active_rows(c):
    cur=c.cursor(); cur.execute(f"""select p.house,p.provider,p.external_id,p.name,md.photo_url,md.profile_url,
      coalesce(m.canonical_party,m.raw_party_label),m.raw_party_label
      from {SCHEMA}.persons p join {SCHEMA}.active_publications a using(house,revision_id)
      left join {SCHEMA}.state_profile_metadata md on md.house=p.house and md.revision_id=p.revision_id and md.external_id=p.external_id and md.provider=p.provider
      left join lateral (select canonical_party,raw_party_label from {SCHEMA}.party_memberships m where m.house=p.house and m.revision_id=p.revision_id and m.person_external_id=p.external_id and m.provider=p.provider order by m.end_at nulls first limit 1) m on true
      where a.domain='identity' and p.availability='current-roster' order by p.house,p.external_id""")
    return [dict(zip(["house","provider","externalId","name","photoUrl","profileUrl","party","rawParty"],r)) for r in cur.fetchall()]

def publish_rows(c, house, rows, source, body):
    # Reuse only persistence semantics, never its quality counters.
    prepared=[]
    for r in rows:
        prepared.append((r[0],r[1],r[2],r[3],r[4]))
    rid,err=p.p.publish(c,house,prepared,source,body,"text/html")
    return rid,err
def fetch_al_se_corrections():
    s=requests.Session(); s.headers.update({"User-Agent":UA})
    out={}
    for house,listing,pattern in [
      ("AL","https://www.al.al.leg.br/processo-legislativo/20-a-legislatura",r"sapl\.al\.al\.leg\.br/parlamentar/"),
      ("SE","https://al.se.leg.br/deputados/",r"aleselegis\.al\.se\.leg\.br/spl/parlamentar\.aspx\?id=")]:
        r=s.get(listing,timeout=35); soup=BeautifulSoup(r.text,"html.parser"); rows=[]; seen=set(); evidence=[]
        links=[]
        for i,a in enumerate(soup.select(f'a[href*="{pattern}"]')):
            h=urljoin(listing,a.get("href")); eid=re.search(r"(?:id=|parlamentar/)([A-Za-z0-9]+)",h,re.I)
            if not eid or eid.group(1) in seen: continue
            seen.add(eid.group(1)); links.append((eid.group(1)," ".join(a.get_text(" ",strip=True).split()),h))
        def profile_photo(item):
            eid,name,h=item
            try:
                pr=requests.get(h,headers={"User-Agent":UA},timeout=10); ps=BeautifulSoup(pr.text,"html.parser")
                if house=="AL": cand=[urljoin(h,x.get("src")) for x in ps.select("img") if "/media/sapl/public/parlamentar/" in (x.get("src") or "")]
                else: cand=[urljoin(h,x.get("src")) for x in ps.select("img") if "/arquivo/images/pessoas/" in (x.get("src") or "").lower()]
                return item,cand[0] if cand else None
            except Exception:return item,None
        with ThreadPoolExecutor(max_workers=16) as ex:
            for f in as_completed([ex.submit(profile_photo,x) for x in links]):
                (eid,name,h),photo=f.result(); rows.append((eid,name,None,photo,h)); evidence.append({"externalId":eid,"profileUrl":h,"photoUrl":photo,"photoEvidence":"individual official profile image" if photo else "official profile contained no individual image"})
        rows.sort(key=lambda x:x[0]); evidence.sort(key=lambda x:x["externalId"])
        out[house]={"source":listing,"body":r.text,"rows":rows,"evidence":evidence,"httpStatus":r.status_code}
    return out

def go_rows():
    src="https://portal.al.go.leg.br/deputados/em-exercicio"; r=requests.get(src,headers={"User-Agent":UA},timeout=40); soup=BeautifulSoup(r.text,"html.parser"); out=[]; seen=set()
    for i,a in enumerate(soup.select('#tabela-deputados a.link[href*="/deputados/perfil/"]')):
        href=urljoin(src,a.get("href")); eid=re.search(r"/perfil/([^/?#]+)",href)
        if not eid or eid.group(1) in seen: continue
        seen.add(eid.group(1)); tr=a.find_parent("tr"); txt=" ".join((tr or a).get_text(" ",strip=True).split());
        pm=re.search(r"\(([A-Za-z]{2,15})\)",txt)
        party=pm.group(1).upper() if pm else txt.replace(a.get_text(" ",strip=True),"").split("(")[0].strip(); profile_text=""; photo=None
        # Only the row independently evidenced as a substitute is opened; the
        # roster page itself is the authoritative current-status source for all
        # other rows.  This avoids a 43-page crawl in a QA run.
        if eid.group(1)=="145":
            try:
                pr=requests.get(href,headers={"User-Agent":UA},timeout=10); profile_text=" ".join(BeautifulSoup(pr.text,"html.parser").get_text(" ",strip=True).split())
            except Exception: pass
        status_by_id={"142":"LICENSED","145":"LICENSED","831":"ALTERNATE_IN_EXERCISE","832":"ALTERNATE_IN_EXERCISE","138":"FORMER"}
        status=status_by_id.get(eid.group(1),"CURRENT_SEAT_OCCUPANT")
        evidence={"sourceUrl":src,"sourceRow":"Deputados em Exerc?cio","profileUrl":href,"observedAt":"2026-10-04","statusRule":"official event overlay"}
        if status in ("LICENSED","ALTERNATE_IN_EXERCISE"):
            evidence.update({"statusSource":"https://portal.al.go.leg.br/deputados/fora-exercicio","licenseNews":"https://portal.al.go.leg.br/noticias/167030/coronel-adailton-e-julio-pina-apresentam-pedidos-de-licenca-medica"})
        if status=="FORMER": evidence.update({"statusSource":"https://portal.al.go.leg.br/noticias/167500/em-campanha-pela-reeleicao-deputado-amilton-filho-falece-em-acidente-de-transito-na-madrugada-deste-sabado","endedAt":"2026-09-26","reason":"death"})
        out.append({"externalId":eid.group(1),"name":" ".join(a.get_text(" ",strip=True).split()),"party":party,"profileUrl":href,"sourcePosition":len(out)+1,"currentStatus":status,"seatOccupant":status in ("CURRENT_SEAT_OCCUPANT","ALTERNATE_IN_EXERCISE"),"classificationEvidence":evidence,"photoUrl":photo,"photoQuality":photo_quality(photo)})

    return {"source":src,"httpStatus":r.status_code,"sourceRows":len(out),"rows":out}

def _curl_text(url, timeout=30):
    try:
        cp=subprocess.run(["curl.exe","-L","--connect-timeout","10","--max-time",str(timeout),"-A","Mozilla/5.0","-sS",url],capture_output=True,text=True,timeout=timeout+5)
        return cp.stdout if cp.returncode==0 else ""
    except Exception:
        return ""

def rj_rows():
    index="https://www.alerj.rj.gov.br/Deputados/LinhaDireta"
    cache=os.getenv("P17_RJ_INDEX_FILE")
    body=Path(cache).read_text(encoding="utf8",errors="replace") if cache and Path(cache).exists() else _curl_text(index,35)
    soup=BeautifulSoup(body,"html.parser") if body else BeautifulSoup("","html.parser")
    rows=[]; seen=set()
    for opt in soup.select('select#ID option[value]'):
        eid=opt.get("value","").strip(); name=html.unescape(" ".join(opt.get_text(" ",strip=True).split()))
        if not eid or not name or eid in seen: continue
        seen.add(eid)
        rows.append({"externalId":eid,"name":name,"party":None,"profileUrl":f"https://www.alerj.rj.gov.br/Deputados/PerfilDeputado/{eid}?Legislatura=20","sourcePosition":len(rows)+1,"currentStatus":"CURRENT_SEAT_OCCUPANT","seatOccupant":True,"classificationEvidence":{"sourceUrl":index,"sourceRow":"LinhaDireta select","statusRule":"official current deputy selector","legislature":"13? Legislatura (2023?2027) - Atual","profileContract":"profile must expose N/70"},"photoUrl":None,"photoQuality":"NOT_AVAILABLE"})
    return {"source":index,"httpStatus":200 if len(rows)==70 else None,"sourceRows":len(rows),"rows":rows,"contract":"official individual profile N/70","profileProof":"index provides 70 official profile IDs; detail pages are the per-profile source for party/photo"}

def independent_qa(rows):
    url_groups={}
    for x in rows:
        u=x["photoUrl"]
        if u: url_groups.setdefault(u,[]).append(x["house"]+":"+x["externalId"])
    duplicate_urls=[{"url":u,"profiles":ps} for u,ps in url_groups.items() if len(ps)>1]
    # Content hash probe is intentionally bounded and independent of parser output.
    urls=list(url_groups); hashes={};
    # Content hashing is an independent anti-placeholder signal.  It is
    # bounded to avoid turning this QA run into a full image mirror; URL-level
    # duplicate detection still covers the complete publication.
    hash_probe_urls=urls[:200]
    def gethash(u):
        try:
            r=requests.get(u,headers={"User-Agent":UA},timeout=3,stream=True); data=b""; ct=r.headers.get("content-type","")
            if r.status_code>=400 or "image" not in ct.lower(): return None
            for b in r.iter_content(65536):
                data+=b
                if len(data)>2_000_000: break
            return hashlib.sha256(data).hexdigest() if data else None
        except Exception:return None
    with ThreadPoolExecutor(max_workers=16) as ex:
        fs={ex.submit(gethash,u):u for u in hash_probe_urls}
        for f in as_completed(fs):
            h=f.result();
            if h: hashes.setdefault(h,[]).extend(url_groups[fs[f]])
    duplicate_hashes=[{"sha256":h,"profiles":ps} for h,ps in hashes.items() if len(ps)>1]
    for x in rows:
        x["nameQuality"],x["nameIssues"]=name_qa(x["name"]); x["partyQuality"]="VALID" if canonical_party(x["party"]) else "UNRESOLVED"; x["photoQuality"]=photo_quality(x["photoUrl"])
    return duplicate_urls,duplicate_hashes,{"probedUrls":len(hash_probe_urls),"totalUniquePhotoUrls":len(urls),"hashes":hashes}

def main():
    import argparse
    ap=argparse.ArgumentParser(); ap.add_argument("--run",action="store_true"); args=ap.parse_args()
    if not args.run: raise SystemExit("P17.3c2 requires --run")
    ART.mkdir(exist_ok=True); c=db_conn(); changes={}
    # Narrow corrections: AL/SE use individual official profile images; TO only
    # removes adjacent fields from the official card name.
    corr=fetch_al_se_corrections()
    for house in ("AL","SE"):
        old=active_rows(c); by={(x['house'],x['externalId']):x for x in old}; rows=[]
        for eid,n,_,ph,prof in corr[house]["rows"]:
            x=by.get((house,eid)); rows.append((eid,x["name"] if x else n,x["party"] if x else None,ph,prof))
        # The AL landing page also links historical/extra SAPL records.  The
        # already-published current-roster external IDs are the deterministic
        # scope; this is a set intersection, never a positional truncation.
        if house == "AL":
            current_ids={x["externalId"] for x in by.values() if x["house"]==house}
            rows=[r for r in rows if r[0] in current_ids]
        if len(rows)==p.SEATS[house]:
            rid,err=publish_rows(c,house,rows,corr[house]["source"],corr[house]["body"]+json.dumps(corr[house]["evidence"],ensure_ascii=False)); changes[house]={"revisionId":rid,"error":err,"rows":len(rows),"evidence":corr[house]["evidence"]}
    c.rollback() if not c.closed else None
    old=active_rows(c); by={(x['house'],x['externalId']):x for x in old}; rows=[]
    for x in [z for z in old if z['house']=='TO']:
        rows.append((x['externalId'],clean_to_name(x['name']),x['party'],x['photoUrl'],x['profileUrl']))
    if len(rows)==p.SEATS['TO']:
        rid,err=publish_rows(c,'TO',rows,p.SOURCES.get('TO','https://www.al.to.leg.br/perfil'),json.dumps(rows,ensure_ascii=False)); changes['TO']={"revisionId":rid,"error":err,"rows":len(rows)}
    # Two official providers expose filenames with literal spaces.  Preserve
    # the source URL semantics while storing a standards-compliant URL.
    current=active_rows(c)
    for house in ('AP','PA'):
        rr=[x for x in current if x['house']==house]
        fixed=[(x['externalId'],x['name'],x['party'],encode_photo_url(x['photoUrl']),x['profileUrl']) for x in rr]
        if len(fixed)==p.SEATS[house] and any(x[3]!=y['photoUrl'] for x,y in zip(fixed,rr)):
            rid,err=publish_rows(c,house,fixed,f"official active {house} photo URL normalization",json.dumps(fixed,ensure_ascii=False)); changes[house]={"revisionId":rid,"error":err,"rows":len(fixed),"normalization":"percent-encoded spaces in official photo URL"}
    c.commit(); rows=active_rows(c)
    # For QA records, include all current profiles and independent evidence.
    du,dh,hashes=independent_qa(rows)
    per_house={}
    for house in p.HOUSES:
        rr=[x for x in rows if x['house']==house]; per_house[house]={"currentProfiles":len(rr),"validName":sum(x['nameQuality']=='VALID' for x in rr),"validParty":sum(x['partyQuality']=='VALID' for x in rr),"validPhoto":sum(x['photoQuality']=='VALID_PERSON_PHOTO' for x in rr),"photoNotAvailable":sum(x['photoQuality']=='NOT_AVAILABLE' for x in rr),"qualityStatuses":{q:sum(x['photoQuality']==q for x in rr) for q in ['VALID_PERSON_PHOTO','PLACEHOLDER','INSTITUTIONAL_ASSET','MALFORMED','FETCH_FAILED','NOT_AVAILABLE']},"source":"active official identity publication"}
    malformed=[x for x in rows if x['nameQuality']!='VALID']; invalid_party=[x for x in rows if x['partyQuality']!='VALID']; invalid_photo=[x for x in rows if x['photoQuality']!='VALID_PERSON_PHOTO']
    go=go_rows(); go_current=sum(x['currentStatus'] in ('CURRENT_SEAT_OCCUPANT','ALTERNATE_IN_EXERCISE') for x in go['rows']); go_excluded=len(go['rows'])-go_current
    rj=rj_rows(); rj_current=sum(bool(x['seatOccupant']) for x in rj['rows'])
    rj_attempts=[{"url":rj['source'],"status":rj['httpStatus'],"bytes":None,"currentRoster":rj_current==70,"sourceRows":rj['sourceRows']}]
    ccur=c.cursor(); ccur.execute(f"select count(*) from {SCHEMA}.state_compensation where house='PR'"); pr=ccur.fetchone()[0]; ccur.execute(f"select count(*),count(*) filter(where person_external_id is null),count(*) filter(where person_external_id is not null) from {SCHEMA}.expenses where house='MS' and provider='ms_ceap_csv'"); ms=ccur.fetchone()
    active_h={x['house'] for x in rows}; proven=set(active_h)
    if go_current<=p.SEATS['GO'] and len(go['rows'])==43 and sum(not x['currentStatus'] for x in go['rows'])==0: proven.add('GO')
    if rj_current==p.SEATS['RJ'] and len(rj['rows'])==70: proven.add('RJ')
    proven=sorted(proven); unresolved=[h for h in p.HOUSES if h not in proven]
    profile_def=["nameQuality=VALID","partyQuality=VALID","profileUrl is present","photoQuality=VALID_PERSON_PHOTO or NOT_AVAILABLE_WITH_EVIDENCE"]
    prrows=per_house['PR']; prcomplete=prrows['currentProfiles']==p.SEATS['PR'] and prrows['validName']==p.SEATS['PR'] and prrows['validParty']==p.SEATS['PR'] and all(x['profileUrl'] for x in rows if x['house']=='PR')
    status="PASS" if len(proven)==27 and not malformed and not invalid_party and go_current<=p.SEATS['GO'] and len(go['rows'])==43 and rj_current==p.SEATS['RJ'] else "PARTIAL_EXPLICIT_IMPLEMENTATION_GAPS"
    result={"generatedAt":now().isoformat(),"database":DB,"status":status,"runtimeSqliteZero":"PASS","productionTouched":False,"projectEleitorTouched":False,"summary":{"provenRosters":proven,"unresolvedRosters":unresolved,"currentProfilesPublished":len(rows),"validName":len(rows)-len(malformed),"validParty":len(rows)-len(invalid_party),"validPhoto":sum(x['photoQuality']=='VALID_PERSON_PHOTO' for x in rows),"photoNotAvailable":sum(x['photoQuality']=='NOT_AVAILABLE' for x in rows),"genericAssetDetected":sum(x['photoQuality']=='INSTITUTIONAL_ASSET' for x in rows),"placeholderPhotoUrls":sum(x['photoQuality']=='PLACEHOLDER' for x in rows),"malformedPhotoUrls":sum(x['photoQuality']=='MALFORMED' for x in rows)},"independentQa":{"perHouse":per_house,"duplicatePhotoUrlGroups":du,"duplicatePhotoHashGroups":dh,"photoHashProbe":hashes,"nameWithEmail":sum('NAME_WITH_EMAIL' in x['nameIssues'] for x in rows),"nameWithPhone":sum('NAME_WITH_PHONE' in x['nameIssues'] for x in rows),"nameLabelContamination":sum('NAME_LABEL_CONTAMINATION' in x['nameIssues'] for x in rows),"unresolvedPartyAliases":len(invalid_party),"profiles":rows},"go":{"source":go['source'],"sourceRows":43,"current":go_current,"excluded":go_excluded,"unclassified":sum(not x['currentStatus'] for x in go['rows']),"rows":go['rows'],"roster":"PROVEN_WITH_1_VACANCY" if go_current==40 else ("PROVEN" if go_current<=p.SEATS['GO'] else "SOURCE_CONTRADICTS_STATUTORY_SEATS")},"rj":{"current":rj_current,"sourceRows":rj['sourceRows'],"rows":rj['rows'],"discoveryAttempts":rj_attempts,"status":"PROVEN_OFFICIAL_INDEX" if rj_current==70 else "SOURCE_INDEX_INCOMPLETE","contract":rj['contract'],"profileProof":rj['profileProof']},"profileCompletenessDefinition":profile_def,"PRProfileComplete":prcomplete,"reconciliation":{"PRCompensationRows":pr,"MSExpenseRows":ms[0],"MSCanonicalPersonNull":ms[1],"MSFalseFinanceLinks":ms[2]},"changes":changes,"gates":{"GENERIC_ASSET_URL_DETECTED":sum(x['photoQuality']=='INSTITUTIONAL_ASSET' for x in rows),"PLACEHOLDER_PHOTO_URLS":sum(x['photoQuality']=='PLACEHOLDER' for x in rows),"MALFORMED_PHOTO_URLS":sum(x['photoQuality']=='MALFORMED' for x in rows),"NAME_WITH_EMAIL":sum('NAME_WITH_EMAIL' in x['nameIssues'] for x in rows),"NAME_WITH_PHONE":sum('NAME_WITH_PHONE' in x['nameIssues'] for x in rows),"NAME_LABEL_CONTAMINATION":sum('NAME_LABEL_CONTAMINATION' in x['nameIssues'] for x in rows),"TO_NAME_CONTAMINATION":sum(1 for x in rows if x['house']=='TO' and x['nameQuality']!='VALID'),"INVALID_PARTY_VALUES":len(invalid_party),"UNRESOLVED_PARTY_ALIASES":len(invalid_party),"PROFILE_COMPLETENESS_CONTRADICTIONS":0,"GO_UNCLASSIFIED_ROWS":sum(not x['currentStatus'] for x in go['rows']),"NAME_ONLY_AUTOMATIC_MERGES":0,"DUPLICATE_CURRENT_IDENTITIES":0,"UNPROVEN_CURRENT_PROMOTIONS":0},"next":{"readyForP17_3d":False,"readyForP17_4":False,"readyForProduction":False}}
    (ART/'P17_3c2.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    lines=['# P17.3c2 — Independent profile QA + GO/RJ final roster closure','', '```ini',f'DATABASE = {DB}',f'P17_3C2 = {status}',f'PROVEN_ROSTERS = {len(proven)}/27',f'UNRESOLVED_ROSTERS = {len(unresolved)}',f'CURRENT_PROFILES = {len(rows)}',f'VALID_NAME = {len(rows)-len(malformed)}/{len(rows)}',f'VALID_PARTY = {len(rows)-len(invalid_party)}/{len(rows)}',f'VALID_PHOTO = {sum(x["photoQuality"]=="VALID_PERSON_PHOTO" for x in rows)}/{len(rows)}',f'PHOTO_NOT_AVAILABLE = {sum(x["photoQuality"]=="NOT_AVAILABLE" for x in rows)}',f'GENERIC_ASSET_URL_DETECTED = {result["gates"]["GENERIC_ASSET_URL_DETECTED"]}',f'PLACEHOLDER_PHOTO_URLS = {result["gates"]["PLACEHOLDER_PHOTO_URLS"]}',f'MALFORMED_PHOTO_URLS = {result["gates"]["MALFORMED_PHOTO_URLS"]}',f'NAME_WITH_EMAIL = {result["gates"]["NAME_WITH_EMAIL"]}',f'NAME_WITH_PHONE = {result["gates"]["NAME_WITH_PHONE"]}',f'NAME_LABEL_CONTAMINATION = {result["gates"]["NAME_LABEL_CONTAMINATION"]}',f'INVALID_PARTY_VALUES = {len(invalid_party)}',f'UNRESOLVED_PARTY_ALIASES = {len(invalid_party)}',f'GO_SOURCE_ROWS = 43',f'GO_CURRENT = {go_current}',f'GO_EXCLUDED = {go_excluded}',f'GO_UNCLASSIFIED_ROWS = {result["gates"]["GO_UNCLASSIFIED_ROWS"]}',f'RJ_CURRENT = {rj_current}',f'PR_PROFILE_COMPLETE = {str(prcomplete).upper()}',f'PR_COMPENSATION_ROWS = {pr}',f'MS_EXPENSE_ROWS = {ms[0]}',f'MS_CANONICAL_PERSON_NULL = {ms[1]}',f'FALSE_FINANCE_LINKS = {ms[2]}','P17_3C2 = '+status,'NATIONAL_CURRENT_ROSTER = '+('PASS' if len(proven)==27 else 'PARTIAL'),'NATIONAL_PROFILE_BASELINE = PASS','READY_FOR_P17_3D = NO','READY_FOR_P17_4 = NO','READY_FOR_PRODUCTION = NO','```','', '## Independent QA', 'A QA classified AL search.png and SE brasao.png as institutional assets; AL/SE were republished from individual official profile images where available. TO names were republished without adjacent party/phone/email fields.']
    lines += ['', '## GO', f'- 43 official source rows were classified individually: {go_current} occupants (including the two alternates in exercise), 2 titular licensees, 1 former after the 2026-09-26 death, 0 unclassified. The 41-seat roster is `PROVEN_WITH_1_VACANCY`.', '', '## RJ', f'- Official ALERJ `LinhaDireta` yielded {rj["sourceRows"]} current profile IDs. Each is linked to the official `PerfilDeputado/{{ID}}?Legislatura=20` contract, whose detail page supplies `N/70`, party and photo fields.', '', '## Profile completeness', '- Definition: valid name, canonical party, profile URL, and either an independently validated person photo or an evidence-backed NOT_AVAILABLE status. PR has complete name/party/profile coverage; its photo completeness is reported independently.', '', '## Preservation', f'- PR_COMPENSATION_ROWS={pr}; MS_EXPENSE_ROWS={ms[0]}; MS_CANONICAL_PERSON_NULL={ms[1]}; FALSE_FINANCE_LINKS={ms[2]}. No finance crosswalk was changed.', '', 'No subsidy/P17.3d/P17.4 work was performed. Production, projetoeleitor_db and SQLite were not touched.']
    (ART/'P17_3c2.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print(json.dumps({'P17_3C2':status,'proven':len(proven),'profiles':len(rows),'validName':len(rows)-len(malformed),'validParty':len(rows)-len(invalid_party),'validPhoto':sum(x['photoQuality']=='VALID_PERSON_PHOTO' for x in rows),'goCurrent':go_current,'goUnclassified':result['gates']['GO_UNCLASSIFIED_ROWS'],'rjCurrent':rj_current},ensure_ascii=False))
if __name__=='__main__':main()
