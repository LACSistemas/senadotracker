#!/usr/bin/env python3
"""Publish the proven current GO (40) and RJ (70) identity rosters."""
from __future__ import annotations
import hashlib, importlib.util, json, os, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, quote
import psycopg2, requests
from bs4 import BeautifulSoup

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("c2", HERE/"state-p17_3c2.py")
c2=importlib.util.module_from_spec(spec); spec.loader.exec_module(c2)
DB="civica_postgres_lab"; SCHEMA="civica_state"; UA="Civica-P17.3c2-publish/1.0"
GO_SOURCE="https://portal.al.go.leg.br/deputados/em-exercicio"
RJ_SOURCE="https://www.alerj.rj.gov.br/Deputados/RepresentacaoPartidaria"
def sha(x): return hashlib.sha256(x.encode("utf8")).hexdigest()
def now(): return datetime.now(timezone.utc)
def conn():
    c=psycopg2.connect(host=os.getenv("DB_HOST","localhost"),port=int(os.getenv("DB_PORT","5432")),dbname=DB,user=os.getenv("DB_USER"),password=os.getenv("DB_PASSWORD")); c.autocommit=False
    cur=c.cursor(); cur.execute("select current_database()")
    if cur.fetchone()[0]!=DB: c.close(); raise RuntimeError("target database refused")
    return c
def go_source():
    r=requests.get(GO_SOURCE,headers={"User-Agent":UA},timeout=35); r.raise_for_status(); soup=BeautifulSoup(r.text,"html.parser")
    excluded={"138","142","145"}; links=[]; seen=set()
    for a in soup.select('#tabela-deputados a.link[href*="/deputados/perfil/"]'):
        m=re.search(r"/perfil/([^/?#]+)",a.get("href", ""))
        if not m or m.group(1) in seen or m.group(1) in excluded: continue
        seen.add(m.group(1)); tr=a.find_parent("tr"); td=tr.select_one('td[data-title="Partido"]') if tr else None; label=" ".join((td.get_text(" ",strip=True) if td else "").split()); pm=re.search(r"\(([A-Za-z][A-Za-z0-9-]{1,15})\)",label); party=pm.group(1).upper() if pm else label
        links.append((m.group(1)," ".join(a.get_text(" ",strip=True).split()),party,urljoin(GO_SOURCE,a.get("href"))))
    def detail(item):
        eid,name,party,profile=item; pr=requests.get(profile,headers={"User-Agent":UA},timeout=20); pr.raise_for_status(); ps=BeautifulSoup(pr.text,"html.parser"); img=ps.select_one('figure.perfil__foto img.foto') or ps.select_one('img[alt*="Foto"]'); photo=urljoin(profile,img.get("src")) if img and img.get("src") else None
        if not photo: raise RuntimeError(f"GO profile {eid} has no individual photo")
        return (eid,name,party,photo,profile)
    with ThreadPoolExecutor(max_workers=12) as ex: out=[f.result() for f in as_completed([ex.submit(detail,x) for x in links])]
    out.sort(key=lambda x:x[0])
    if len(out)!=40 or any(not x[2] or not x[3] for x in out): raise RuntimeError(f"GO current roster invalid: {len(out)}")
    return out,r.text
def rj_source(c):
    cur=c.cursor(); cur.execute(f"select body from {SCHEMA}.raw_objects where house='RJ' and endpoint=%s and length(body)>10000 order by fetched_at desc limit 1",(RJ_SOURCE,)); q=cur.fetchone()
    if not q: raise RuntimeError("official RJ RepresentacaoPartidaria raw object missing")
    body=q[0]; soup=BeautifulSoup(body,"html.parser"); out=[]; seen=set()
    for box in soup.select('.controle_deputado'):
        a=box.select_one('a[href*="PerfilDeputado"]'); img=box.select_one('img'); nm=box.select_one('.nome a'); pt=box.select_one('.partido')
        if not a or not img or not nm: continue
        m=re.search(r"PerfilDeputado/([^?/#]+)",a.get("href", ""))
        if not m or m.group(1) in seen: continue
        seen.add(m.group(1)); profile=urljoin(RJ_SOURCE,a.get("href")); photo=quote(urljoin(RJ_SOURCE,img.get("src")), safe=":/?=&%#@+;,!$'()*-._~"); party=("SOLIDARIEDADE" if (pt and pt.get_text(" ",strip=True).upper() in ("SDD","SD","SOLIDARI")) else ("UNIAO" if (pt and "UNI" in pt.get_text(" ",strip=True).upper()) else (" ".join(pt.get_text(" ",strip=True).split()) if pt else None))); out.append((m.group(1)," ".join(nm.get_text(" ",strip=True).split()),party,photo,profile))
    out.sort(key=lambda x:x[0])
    if len(out)!=70 or any(not x[2] or not x[3] for x in out): raise RuntimeError(f"RJ current roster invalid: {len(out)}")
    return out,body
def publish(c,house,rows,source,body):
    observed=now(); payload=json.dumps(sorted(rows),ensure_ascii=False); rid=f"state:{house}:identity:p17_3c2:{sha(payload)[:40]}"; rawsha=sha(body); rawid=f"p17_3c2:{house}:{rawsha}"; cur=c.cursor(); cur.execute(f"select raw_id from {SCHEMA}.raw_objects where sha256=%s",(rawsha,)); old=cur.fetchone()
    if old: rawid=old[0]
    else: cur.execute(f"insert into {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(rawid,house,"official_roster","official-current-roster",source,json.dumps({"parser":"P17.3c2"}),None,observed,observed,200,"text/html",rawsha,body))
    cur.execute(f"insert into {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'identity',%s,'staged',%s,%s,null) on conflict do nothing",(house,rid,json.dumps({"parser":"P17.3c2","source":source,"rows":len(rows),"stableKeys":True}),observed))
    for eid,name,party,photo,profile in rows:
        prov={"source":"official","sourceUrl":source,"rawId":rawid,"parser":"P17.3c2","stableKey":eid,"observedAt":observed.isoformat()}
        cur.execute(f"insert into {SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) values(%s,%s,%s,%s,%s,'current-roster',%s,%s)",(rid,house,"official_roster",eid,name,rawid,json.dumps(prov)))
        cur.execute(f"insert into {SCHEMA}.state_profile_metadata(revision_id,house,provider,external_id,parliamentary_name,profile_url,photo_url,photo_source_url,party_source_url,observed_at,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict do nothing",(rid,house,"official_roster",eid,name,profile,photo,photo,source,observed,json.dumps(prov)))
        cur.execute(f"insert into {SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,null,%s,%s) on conflict do nothing",(rid,house,"official_roster",eid,"current:"+eid,"official",party,party,None,observed.date().isoformat(),rawid,json.dumps(prov)))
    cur.execute(f"update {SCHEMA}.public_domain_revisions set status='rejected' where house=%s and domain='identity' and status='active'",(house,)); cur.execute(f"update {SCHEMA}.public_domain_revisions set status='active',activated_at=%s where house=%s and domain='identity' and revision_id=%s",(observed,house,rid)); cur.execute(f"insert into {SCHEMA}.active_publications(house,domain,revision_id,activated_at) values(%s,'identity',%s,%s) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",(house,rid,observed)); return rid
def main():
    c=conn(); go,gb=go_source(); rj,rjb=rj_source(c); gr=publish(c,"GO",go,GO_SOURCE,gb); rr=publish(c,"RJ",rj,RJ_SOURCE,rjb); c.commit(); print(json.dumps({"database":DB,"GO":{"rows":len(go),"revision":gr},"RJ":{"rows":len(rj),"revision":rr}}))
if __name__=="__main__": main()
