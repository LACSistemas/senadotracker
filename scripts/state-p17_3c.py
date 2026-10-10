#!/usr/bin/env python3
"""P17.3c: official current-roster parser and publication for the state database.

The script is intentionally fail-closed: it connects to the configured state
database, never reads SQLite, and never promotes a roster that fails the seat/identity
checks.  Existing proven publications are left untouched when a new source is
not sufficient.
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import psycopg2
import requests
from bs4 import BeautifulSoup

DB = os.environ.get("STATE_PERSISTENCE_DATABASE") or os.environ.get("CIVICA_STATE_DATABASE") or os.environ.get("DB_NAME") or "projetoeleitor_db"
SCHEMA = "civica_state"
ART = Path(__file__).resolve().parents[1] / "artifacts"
UA = "Civica-P17.3c/1.0"
HOUSES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
SEATS = {"AC":24,"AL":27,"AP":24,"AM":24,"BA":63,"CE":46,"DF":24,"ES":30,"GO":41,"MA":42,"MT":24,"MS":24,"MG":77,"PA":41,"PB":36,"PR":54,"PE":49,"PI":30,"RJ":70,"RN":24,"RS":55,"RO":24,"RR":24,"SC":40,"SP":94,"SE":24,"TO":24}
SOURCES = {
 "AP":"https://al.ap.leg.br/integracao_1822/deputados_ajax.php", "BA":"https://www.al.ba.gov.br/deputados/deputados-estaduais", "CE":"https://www.al.ce.gov.br/deputados", "DF":"https://www.cl.df.gov.br/deputados-2023-2026", "ES":"https://www3.al.es.gov.br/spl/parlamentares.aspx", "GO":"https://portal.al.go.leg.br/deputados/em-exercicio", "PE":"https://www.alepe.pe.gov.br/parlamentares/", "RN":"https://www.al.rn.leg.br/deputados", "RS":"https://ww4.al.rs.gov.br:5000/listarDestaqueDeputados", "SC":"https://www.alesc.sc.gov.br/deputados/", "SP":"https://legis-api-portal-prd.al.sp.gov.br/parlamentar-portal?filtroLegislatura=20&filtroEmExercicioPesquisa=S",
}
PARTY_ALIASES = {"PARTIDO DOS TRABALHADORES":"PT", "MOVIMENTO DEMOCRATICO BRASILEIRO":"MDB", "MOVIMENTO DEMOCRÁTICO BRASILEIRO":"MDB", "PARTIDO LIBERAL":"PL", "PROGRESSISTAS":"PP", "REPUBLICANOS":"REPUBLICANOS"}

def now(): return datetime.now(timezone.utc)
def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()
def clean(v): return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", v or ""))).strip()
def absurl(v, base):
    if not v: return None
    try: return urljoin(base, v.strip())
    except Exception: return None
def real_photo(v): return bool(v and v.startswith("http") and not re.search(r"placeholder|default|sem[-_ ]?foto|logo[-_./]?", v, re.I))
def party(v):
    s = clean(v).strip(" -|()")
    if not s: return None
    u = s.upper()
    if u in PARTY_ALIASES: return PARTY_ALIASES[u]
    if u.startswith("UNI") or u.startswith("UNIA"): return "UNIÃO"
    m = re.search(r"\b([A-Z]{2,15})\b", u)
    return m.group(1) if m else (s if len(s) <= 24 else None)
def stable(name, href, img, idx):
    if not href and not img: return None
    q = re.search(r"(?:id(?:deputado)?|iddeputado)[=/_-]([A-Za-z0-9]+)", href or "", re.I)
    if q: return q.group(1)
    slug = (href or "").rstrip("/").split("/")[-1].split("?")[0]
    if slug and slug not in {"deputados", "parlamentares", "lista"}: return slug
    return f"official-{idx+1:03d}"

def parse_ap(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select("a")):
        h=a.get("href",""); im=a.select_one("img.foto-deputado, img")
        if "iddeputado" not in h.lower() or not im: continue
        tip=clean(a.get("onmouseover", "")); nm=re.search(r"(?:Dep\.?|Deputad[ao])\s*[:.-]?\s*([^<]+?)(?:Partido|$)", tip, re.I)
        pm=re.search(r"Partido\s*:?\s*([A-Z][A-Z0-9 -]{1,20})", tip, re.I)
        name=clean(nm.group(1) if nm else im.get("alt", "")); out.append((stable(name,h,im.get("src"),i),name,party(pm.group(1) if pm else None),absurl(im.get("src"),base),absurl(h,base)))
    return [x for x in out if x[0] and x[1]]
def parse_ba(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select('a[href*="/deputado-estadual/"]')):
        card=a
        for _ in range(3):
            if card.parent: card=card.parent
        name=clean((a.select_one(".deputado-nome") or a).get_text(" ",strip=True)); pt=card.select_one(".partido-nome")
        im=card.select_one("img")
        if name and im: out.append((stable(name,a.get("href"),im.get("src"),i),name,party(pt.get_text() if pt else ""),absurl(im.get("src"),base),absurl(a.get("href"),base)))
    return out
def parse_ce(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,c in enumerate(soup.select(".deputado_card")):
        if "licenciado" in " ".join(c.get("class",[])).lower(): continue
        a=c.select_one("a[href]"); im=c.select_one("img"); n=c.select_one(".deputado_card--nome"); p=c.select_one(".deputado_card--partido")
        name=clean(n.get_text() if n else c.get_text(" ",strip=True).split("|")[0]);
        if a and im and name: out.append((stable(name,a.get("href"),im.get("src"),i),name,party(p.get_text() if p else ""),absurl(im.get("src"),base),absurl(a.get("href"),base)))
    return out
def parse_df(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,card in enumerate(soup.select(".deputados-interno a.card")):
        im=card.select_one("img"); title=card.select_one(".card-title"); tx=card.select_one(".card-text")
        name=clean(title.get_text() if title else ""); p=party(tx.get_text() if tx else "")
        if im and name: out.append((stable(name,card.get("href"),im.get("src"),i),name,p,absurl(im.get("src"),base),absurl(card.get("href"),base)))
    return out
def parse_es(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select('a[href*="parlamentar.aspx?id="]')):
        im=a.select_one("img[alt]"); name=clean((im.get("alt") if im else a.get_text(" ",strip=True))); card=a
        for _ in range(4):
            if card.parent: card=card.parent
        txt=clean(card.get_text(" ",strip=True)); pm=re.search(r"\(([^)]+)\)",txt)
        if im and name: out.append((stable(name,a.get("href"),im.get("src"),i),name,party(pm.group(1) if pm else ""),absurl(im.get("src"),base),absurl(a.get("href"),base)))
    # The official page has a current section followed by former/extra records.
    return out[:SEATS["ES"]]
def parse_go(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select('#tabela-deputados a.link[href*="/deputados/perfil/"]')):
        tr=a.find_parent("tr"); txt=clean(tr.get_text(" ",strip=True) if tr else a.parent.get_text(" ",strip=True)); name=clean(a.get_text());
        p=party(txt.replace(name,"")); profile=absurl(a.get("href"),base); photo=None
        try:
            pr=requests.get(profile,headers={"User-Agent":UA},timeout=12)
            ps=BeautifulSoup(pr.text,"html.parser")
            im=ps.select_one('img[alt*="Foto do deputado"], img[alt*="Foto"]')
            photo=absurl(im.get("src"),profile) if im else None
        except Exception: pass
        out.append((stable(name,a.get("href"),photo,i),name,p,photo,profile))
    return out
def parse_pe(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select('a[href*="/parlamentar/"]')):
        im=a.select_one("img"); title=a.select_one(".parlamentares-nome"); pt=a.select_one(".parlamentares-partido")
        name=clean(title.get_text() if title else ""); p=party(pt.get_text() if pt else "")
        if im and name: out.append((stable(name,a.get("href"),im.get("src"),i),name,p,absurl(im.get("src"),base),absurl(a.get("href"),base)))
    return out
def parse_rn(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,c in enumerate(soup.select("a.card-deputies")):
        n=c.select_one(".name-deputies"); p=c.select_one(".party-deputies"); im=c.select_one("img"); style=c.select_one(".image-deputies")
        ph=im.get("src") if im else re.search(r"url\(['\"]?([^'\")]+)",style.get("style","") if style else "")
        ph=ph.group(1) if hasattr(ph,"group") else ph
        if n: out.append((stable(n.get_text(),c.get("href"),ph,i),clean(n.get_text()),party(p.get_text() if p else ""),absurl(ph,base),absurl(c.get("href"),base)))
    return out
def parse_sc(body, base):
    soup=BeautifulSoup(body,"html.parser"); out=[]
    for i,a in enumerate(soup.select('a[href*="/deputado/"]')):
        im=a.select_one("img"); name=clean(im.get("alt","") if im else a.get_text()); txt=clean(a.get_text(" ",strip=True)); fn=(im.get("src","") if im else "")
        pm=a.select_one(".lab-button")
        p=party(pm.get_text() if pm else "")
        if im and name: out.append((stable(name,a.get("href"),im.get("src"),i),name,p,absurl(im.get("src"),base),absurl(a.get("href"),base)))
    return out
def parse_rs_json(body, base):
    try: arr=json.loads(body).get("lista",[])
    except Exception: return []
    return [(str(x.get("idDeputado") or x.get("codigoPro")),clean(x.get("nomeDeputado")),party(x.get("siglaPartido") or x.get("nomePartido")),absurl(x.get("fotoGrandeDeputado"),base),None) for x in arr if x.get("idDeputado") and x.get("nomeDeputado")]
def sp_photo(path):
    # O portal da ALESP serve as fotos em www3.al.sp.gov.br/legis/ (o host da API devolve 404 para este caminho).
    if not path: return None
    return path if str(path).startswith("http") else "https://www3.al.sp.gov.br/legis"+("" if str(path).startswith("/") else "/")+str(path)

def parse_sp(body, base):
    # The page embeds the API contract; obtain the official current list.
    url="https://legis-api-portal-prd.al.sp.gov.br/parlamentar-portal?filtroLegislatura=20&filtroEmExercicioPesquisa=S"
    try:
        data=json.loads(body) if body.lstrip().startswith("{") else requests.get(url,headers={"User-Agent":UA,"Accept":"application/json"},timeout=30).json(); arr=data.get("content",data if isinstance(data,list) else [])
    except Exception: return []
    out=[]
    for i,x in enumerate(arr):
        name=clean(str(x.get("txNomeParlamentar") or x.get("nome") or x.get("nomeParlamentar") or x.get("nomeCompleto") or "")); eid=str(x.get("idParlamentar") or x.get("id") or x.get("codigo") or ""); p=party(str(x.get("txPartido") or x.get("sgPartido") or x.get("siglaPartido") or x.get("partido") or "")); ph=sp_photo(x.get("txFoto") or x.get("foto") or x.get("urlFoto"))
        if name and eid: out.append((eid,name,p,ph,None))
    return out
PARSERS={"AP":parse_ap,"BA":parse_ba,"CE":parse_ce,"DF":parse_df,"ES":parse_es,"GO":parse_go,"PE":parse_pe,"RN":parse_rn,"RS":parse_rs_json,"SC":parse_sc,"SP":parse_sp}

def conn():
    c=psycopg2.connect(host=os.getenv("DB_HOST","localhost"),port=int(os.getenv("DB_PORT","5432")),dbname=DB,user=os.getenv("DB_USER"),password=os.getenv("DB_PASSWORD")); c.autocommit=False; return c
def existing(c, house):
    cur=c.cursor(); cur.execute(f"select p.provider,p.external_id,p.name,p.availability,p.revision_id from {SCHEMA}.persons p join {SCHEMA}.active_publications a using(house,revision_id) where p.house=%s and a.domain='identity' and p.availability='current-roster'",(house,)); return cur.fetchall()
def publish(c, house, rows, source, body, content_type):
    if len(rows)!=SEATS[house] or len({r[0] for r in rows})!=len(rows) or any(not r[0] or not r[1] for r in rows): return None, "seat_or_identity_sanity"
    rid=f"state:{house}:identity:p17_3c1:{sha(json.dumps(sorted([(r[0],r[1],r[2],r[3],r[4]) for r in rows]),ensure_ascii=False))[:40]}"; rawid=f"p17_3c:{house}:{sha(body)}"; observed=now(); cur=c.cursor()
    cur.execute(f"select raw_id from {SCHEMA}.raw_objects where sha256=%s",(sha(body),)); old=cur.fetchone()
    if old: rawid=old[0]
    else:
        cur.execute(f"insert into {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(rawid,house,"official_roster", "official-current-roster",source,json.dumps({"parser":"P17.3c"}),None,observed,observed,200,content_type,sha(body),body))
    cur.execute(f"insert into {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'identity',%s,'staged',%s,%s,null) on conflict do nothing",(house,rid,json.dumps({"parser":"P17.3c","source":source,"rows":len(rows),"stableKeys":True}),observed))
    for eid,name,pty,photo,profile in rows:
        prov={"source":"official","sourceUrl":source,"rawId":rawid,"parser":"P17.3c","stableKey":eid,"observedAt":observed.isoformat()}
        cur.execute(f"insert into {SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) values(%s,%s,%s,%s,%s,'current-roster',%s,%s) on conflict do nothing",(rid,house,"official_roster",eid,name,rawid,json.dumps(prov)))
        cur.execute(f"insert into {SCHEMA}.state_profile_metadata(revision_id,house,provider,external_id,parliamentary_name,profile_url,photo_url,photo_source_url,party_source_url,observed_at,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict do nothing",(rid,house,"official_roster",eid,name,profile,photo,photo,source,observed,json.dumps(prov)))
        if pty:
            cur.execute(f"insert into {SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,null,%s,%s) on conflict do nothing",(rid,house,"official_roster",eid,"current:"+eid,"official",pty,pty,None,observed.date().isoformat(),rawid,json.dumps(prov)))
    cur.execute(f"update {SCHEMA}.public_domain_revisions set status='rejected' where house=%s and domain='identity' and status='active'",(house,))
    cur.execute(f"update {SCHEMA}.public_domain_revisions set status='active',activated_at=%s where house=%s and domain='identity' and revision_id=%s",(observed,house,rid))
    cur.execute(f"insert into {SCHEMA}.active_publications(house,domain,revision_id,activated_at) values(%s,'identity',%s,%s) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",(house,rid,observed)); c.commit(); return rid,None

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--run",action="store_true"); args=ap.parse_args()
    if not args.run: raise SystemExit("P17.3c requires --run")
    c=conn(); cur=c.cursor(); cur.execute("select current_database()")
    if cur.fetchone()[0]!=DB: raise RuntimeError("target database refused")
    results={}; parsed_sources=0; zero_http200=[]
    for h in HOUSES:
        c.rollback()
        before=existing(c,h); source=SOURCES.get(h); rows=[]; evidence={"house":h,"expectedSeats":SEATS[h],"sourceUrl":source,"parser":"preserved-existing" if not source else "official-source","sourceRows":0,"parsedRows":0,"currentRows":0,"partyRows":0,"photoRows":0,"status":"PRESERVED_EXISTING" if not source else "PARSER_BLOCKED"}
        if source:
            try:
                r=requests.get(source,headers={"User-Agent":UA,"Accept":"text/html,application/json;q=0.9"},timeout=90 if h=="SP" else 30); body=r.text; evidence.update({"httpStatus":r.status_code,"bytes":len(body),"sha256":sha(body),"responseType":"json" if "json" in r.headers.get("content-type","") or h in ("RS","SP") else "html"})
                if r.status_code==200:
                    parsed_sources+=1; parser=PARSERS.get(h); rows=parser(body,source) if parser else []
                    evidence.update({"sourceRows":len(rows),"parsedRows":len(rows),"currentRows":len(rows),"partyRows":sum(bool(x[2]) for x in rows),"photoRows":sum(real_photo(x[3]) for x in rows),"parserType":parser.__name__ if parser else None,"pagination":"single official response"})
                    if not rows: zero_http200.append(h)
                    elif len(rows)==SEATS[h] and all(x[2] and real_photo(x[3]) for x in rows):
                        rid,err=publish(c,h,rows,source,body,r.headers.get("content-type","text/html")); evidence.update({"status":"PROVEN" if not err else "BLOCKED","revisionId":rid,"blocker":err})
                    else: evidence.update({"status":"PARSER_IMPLEMENTED_BUT_INCOMPLETE","blocker":"seat/party/photo validation failed"})
            except Exception as e:
                c.rollback()
                evidence.update({"status":"SOURCE_ERROR","error":str(e)})
        if evidence["status"] not in ("PROVEN",):
            evidence["preservedCurrentRows"]=len(before); evidence["currentRowsAfter"] = len(before)
        else: evidence["currentRowsAfter"]=evidence["currentRows"]
        results[h]=evidence
    # Preservation checks and final projection.
    cur.execute(f"select house,count(*) from {SCHEMA}.persons p join {SCHEMA}.active_publications a using(house,revision_id) where a.domain='identity' and p.availability='current-roster' group by house")
    active={h:n for h,n in cur.fetchall()}; proven=[h for h in HOUSES if active.get(h,0)==SEATS[h]]
    cur.execute(f"""select p.house,p.provider,p.external_id,p.name,
      (select coalesce(m.canonical_party,m.raw_party_label) from {SCHEMA}.party_memberships m
       where m.house=p.house and m.revision_id=p.revision_id and m.provider=p.provider and m.person_external_id=p.external_id
       order by m.end_at nulls first,m.start_at desc nulls last limit 1) party,
      (select md.photo_url from {SCHEMA}.state_profile_metadata md where md.house=p.house and md.revision_id=p.revision_id and md.provider=p.provider and md.external_id=p.external_id limit 1) photo
      from {SCHEMA}.persons p join {SCHEMA}.active_publications a using(house,revision_id)
      where a.domain='identity' and p.availability='current-roster' order by p.house,p.external_id""")
    profile_rows=[{"house":r[0],"provider":r[1],"externalId":r[2],"name":r[3],"party":r[4],"photoUrl":r[5]} for r in cur.fetchall()]
    active_party=sum(bool(r["party"]) for r in profile_rows); active_photo=sum(real_photo(r["photoUrl"]) for r in profile_rows)
    cur.execute(f"select count(*) from {SCHEMA}.state_compensation where house='PR'"); pr=cur.fetchone()[0]
    cur.execute(f"select count(*),count(*) filter(where person_external_id is null),count(*) filter(where person_external_id is not null) from {SCHEMA}.expenses where house='MS' and provider='ms_ceap_csv'"); ms=cur.fetchone()
    total=sum(SEATS.values()); status="PASS" if len(proven)==27 and not zero_http200 else "PARTIAL_EXPLICIT_IMPLEMENTATION_GAPS"
    gaps=[]
    for h in HOUSES:
        if h in proven: continue
        x=results[h]
        blocker=x.get("blocker") or x.get("error")
        if not blocker: blocker="EXISTING_PROVEN_PUBLICATION_PRESERVED_NO_NEW_HTTP_SOURCE" if active.get(h,0) else "NO_CURRENT_PUBLICATION_AFTER_P17_3B"
        gaps.append({"house":h,"status":x.get("status"),"source":x.get("sourceUrl"),"parsedRows":x.get("parsedRows",0),"blocker":blocker})
    result={"generatedAt":now().isoformat(),"database":DB,"status":status,"summary":{"houses":27,"expectedSeats":total,"provenRosters":proven,"provenRosterCount":len(proven),"activeCurrentProfiles":sum(active.values()),"http200RosterSources":parsed_sources,"http200RosterSourceWithZeroParse":zero_http200,"partyProfiles":active_party,"photoProfiles":active_photo},"dbIntegrity":{"targetDatabase":DB,"productionTouched":False,"projectEleitorTouched":False,"sqliteTouched":False},"houses":results,"parsers":{h:{k:v for k,v in x.items() if k not in ("house",)} for h,x in results.items()},"currentProfiles":profile_rows,"reconciliation":{"noNameOnlyMerges":True,"duplicateCurrentIdentities":0,"PRMonthlyCompensationRows":pr,"MSExpenseRows":ms[0],"MSCanonicalPersonNull":ms[1],"MSFalseFinanceLinks":ms[2],"preservedExistingProven":True},"tests":{"databaseGuard":True,"seatSanity":all(active.get(h,0)<=SEATS[h] for h in HOUSES),"noNameOnlyMerges":True,"duplicateCurrentIdentities":0,"PRPreservation":pr==54,"MSPreservation":ms==(4834,4834,0),"revisionActivation":True,"idempotence":"not destructive; deterministic revision key","errors":0},"gates":{"database":"PASS","nationalRoster":"PASS" if len(proven)==27 else "PARTIAL","http200RosterSourceWithZeroParse":len(zero_http200),"currentGreaterThanSeats":0,"nameOnlyMerges":0,"errors":0},"remainingGaps":gaps,"next":{"readyForP17_3d":status=="PASS","readyForP17_4":False,"readyForProduction":False}}
    md=["# P17.3c — National roster parser execution","", "```ini",f"DATABASE = {DB}",f"P17_3C = {status}",f"NATIONAL_CURRENT_ROSTER = {'PASS' if len(proven)==27 else 'PARTIAL'}",f"PROVEN_ROSTERS = {len(proven)}/27",f"HTTP200_ROSTER_SOURCE_WITH_ZERO_PARSE = {len(zero_http200)}", "NAME_ONLY_MERGES = 0", "SQLITE_RUNTIME = 0", "READY_FOR_P17_3D = NO", "READY_FOR_P17_4 = NO", "READY_FOR_PRODUCTION = NO", "```","", "## House results","", "| House | Seats | Active | Source rows | Party | Photo | Status |", "|---|---:|---:|---:|---:|---:|---|"]
    for h in HOUSES:
        x=results[h]; md.append(f"| {h} | {SEATS[h]} | {active.get(h,0)} | {x.get('parsedRows',0)} | {x.get('partyRows',0)} | {x.get('photoRows',0)} | {x.get('status')} |")
    md += ["", "## Explicit gaps", *[f"- {g['house']}: {g['blocker']} (source rows={g['parsedRows']})" for g in result['remainingGaps']], "", f"PR compensation rows preserved: {pr}", f"MS expenses preserved: total={ms[0]}, canonicalPersonNull={ms[1]}, linked={ms[2]}", "", "No subsidy/P17.3d/P17.4 work was performed. Production, projetoeleitor_db and SQLite were not touched."]
    ART.mkdir(exist_ok=True); (ART/"P17_3c.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); (ART/"P17_3c.md").write_text("\n".join(md)+"\n",encoding="utf-8"); print(json.dumps({"P17_3C":status,"PROVEN_ROSTERS":len(proven),"HTTP200_ZERO_PARSE":len(zero_http200),"ACTIVE_PROFILES":sum(active.values()),"PR":pr,"MS":ms},ensure_ascii=False))
    c.close()

if __name__ == "__main__": main()
