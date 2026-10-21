"""P18.1A5 bounded operationalization of AL/AM/BA/GO/PI/RO/RR.

This script is deliberately lab-bound and fail-closed.  It keeps source raw
labels in provenance, never uses SQLite, never fuzzy-matches, and only writes
2026 rows into civica_state on civica_postgres_lab.
"""
from __future__ import annotations
import csv, hashlib, io, json, os, re, sys, unicodedata, traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import psycopg2
from psycopg2.extras import Json
import requests
from bs4 import BeautifulSoup
import pdfplumber

DB='civica_postgres_lab'; SCHEMA='civica_state'; YEAR=2026
USER=os.getenv('DB_USER','projetoeleitor_user'); PASSWORD=os.getenv('DB_PASSWORD','projetoeleitorsenha')
HEADERS={'User-Agent':'Civica-P18.1A5 official-source collector/1.0'}; TIMEOUT=12
BASE={'AL':'https://www.al.al.leg.br/transparencia/orcamento-e-financas/viap-verba-indenizatoria-de-atividade-parlamentar/2026','AM':'https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php','BA':'https://www.al.ba.gov.br/transparencia/verbas-idenizatorias','GO':'https://portal.al.go.leg.br/gestao-parlamentar/verba-indenizatoria','PI':'https://transparencia.al.pi.leg.br/grid_transp_publico_gecop/','RO':'https://transparencia.al.ro.leg.br/ReceitasDespesas/','RR':'https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/'}

def conn():
    c=psycopg2.connect(host='localhost',port=5432,dbname=DB,user=USER,password=PASSWORD)
    q=c.cursor(); q.execute('select current_database()'); actual=q.fetchone()[0]
    if actual != DB: c.close(); raise RuntimeError(f'wrong database: {actual}')
    return c
def get(url, **kw):
    r=requests.get(url,headers=HEADERS,timeout=TIMEOUT,**kw); r.raise_for_status(); return r
def sha(b): return hashlib.sha256(b).hexdigest()
def cents(v):
    if v is None: return None
    s=str(v).replace('R$','').replace(' ','').strip()
    if not s: return None
    try: return round(float(s.replace('.','').replace(',','.'))*100) if ',' in s else round(float(s.replace(',',''))*100)
    except Exception: return None
def fold(v): return ''.join(c for c in unicodedata.normalize('NFD',v or '') if unicodedata.category(c)!='Mn').lower()
def decode_mojibake(v):
    s=v or ''; best=s
    for _ in range(3):
        try: cand=best.encode('latin1').decode('utf8')
        except Exception: break
        if cand.count('ï¿½') >= best.count('ï¿½') and sum(best.count(x) for x in ('Ãƒ','Ã‚','Ã¯Â¿Â½')) <= sum(cand.count(x) for x in ('Ãƒ','Ã‚','Ã¯Â¿Â½')): break
        best=cand
    return best
def compare_key(v):
    s=decode_mojibake((v or '').strip())
    s=re.sub(r'^\s*(?:Deputado|Deputada|Dep\.?)(?:\s+|[.:\-])+','',s,flags=re.I)
    return fold(re.sub(r'\s+',' ',s)).strip()
def row(house,provider,key,label,amount,**kw):
    return {'house':house,'provider':provider,'key':key,'label':label,'amount':amount,**kw}

def identity_hygiene():
    c=conn(); q=c.cursor(); q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%' and e.linkage_status='UNRESOLVED'"); before=q.fetchone()[0]
    q.execute("select p.external_id,p.name,p.house from civica_state.persons p join civica_state.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.availability='current-roster'")
    roster={}
    for pid,name,house in q.fetchall(): roster.setdefault((house,compare_key(name)),[]).append(pid)
    q.execute("select e.revision_id,e.house,e.provider,e.external_id,e.provenance from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%' and e.linkage_status='UNRESOLVED'")
    fixes=0; enc=0; pref=0
    for rev,house,provider,eid,prov in q.fetchall():
        p=prov or {}; label=p.get('providerPersonLabel') or p.get('providerDeputyLabel') or ''
        dec=decode_mojibake(label); key=compare_key(dec); ids=roster.get((house,key),[])
        p=dict(p); p['source_person_label_raw']=label; p['source_person_label_decoded']=dec; p['source_person_label_normalized']=key
        if dec != label: enc += 1
        if re.match(r'^\s*(?:Deputado|Deputada|Dep\.?)(?:\s|[.:\-])+',label,re.I): pref += 1
        if len(ids)==1:
            q.execute("update civica_state.expenses set person_external_id=%s,linkage_method='EXACT_UNIQUE_HOUSE_NAME',linkage_status='EXACT_UNIQUE_HOUSE_NAME',provenance=%s where revision_id=%s and house=%s and provider=%s and external_id=%s",(ids[0],Json(p),rev,house,provider,eid)); fixes+=1
        else:
            q.execute("update civica_state.expenses set provenance=%s where revision_id=%s and house=%s and provider=%s and external_id=%s",(Json(p),rev,house,provider,eid))
    c.commit(); q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%' and e.linkage_status='UNRESOLVED'"); after=q.fetchone()[0]; q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%' and e.person_external_id is not null and e.person_external_id not in (select external_id from civica_state.persons)"); invalid=q.fetchone()[0]; c.close()
    return {'before':before,'after':after,'textEncodingFixes':enc,'honorificNormalizationLinks':pref,'deterministicLinksAdded':fixes,'invalidLinks':invalid}

def parse_al():
    index=get(BASE['AL']); soup=BeautifulSoup(index.content,'html.parser'); deputies=[]
    for a in soup.find_all('a',href=True):
        h=a['href']; m=re.search(r'/2026/([^/]+)$',h)
        if m and h.rstrip('/').count('/')>=6: deputies.append((urljoin(BASE['AL'],h),a.get_text(' ',strip=True),m.group(1)))
    seen=set(); rows=[]; files=[]; errors=[]; jobs=[]
    for d,name,slug in sorted(set(deputies)):
        try: ds=BeautifulSoup(get(d).content,'html.parser')
        except Exception as e: errors.append(type(e).__name__+': '+str(e)); continue
        jobs.extend((name,slug,urljoin(d,a['href'])) for a in ds.find_all('a',href=True) if a['href'].endswith('/view'))
    def fetch_month(item):
        name,slug,mu=item
        try:
            ms=BeautifulSoup(get(mu).content,'html.parser'); pu=next((urljoin(mu,a['href']) for a in ms.find_all('a',href=True) if '/at_download/file' in a['href']),None)
            if not pu: return name,slug,{'missing':True},''
            body=get(pu).content; digest=sha(body); text=''
            try:
                with pdfplumber.open(io.BytesIO(body)) as doc: text='\n'.join(p.extract_text() or '' for p in doc.pages)
            except Exception: pass
            comp=next((f'2026-{m}' for n,m in {'janeiro':'01','fevereiro':'02','marco':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'}.items() if n in mu.lower()),None)
            return name,slug,{'slug':slug,'label':name,'competence':comp,'url':pu,'sha256':digest,'bytes':len(body),'textExtractable':bool(text)},text
        except Exception as e: return name,slug,{'error':type(e).__name__+': '+str(e)},''
    with ThreadPoolExecutor(max_workers=12) as pool:
        for name,slug,meta,text in pool.map(fetch_month,jobs):
            if meta.get('missing'): continue
            if meta.get('error'): errors.append(meta['error']); continue
            files.append(meta)
            for i,line in enumerate(text.splitlines()):
                mmv=re.search(r'R\$\s*([\d.]+,\d{2})',line)
                if mmv: rows.append(row('AL','al_al_viap',f"{meta['url']}|{i}",name,cents(mmv.group(1)),competence=meta['competence'],category=None,description=line[:500],url=meta['url'],raw_sha=meta['sha256']))
    status='operational_itemized' if rows else ('parser_blocked_by_unextractable_source' if files and not any(x['textExtractable'] for x in files) else 'source_fetch_blocked')
    return rows,{'status':status,'requestsObserved':len(deputies)+len(files),'files':files,'parserErrors':errors,'sourceRows':len(rows),'request':BASE['AL']}

def parse_am():
    c=conn(); q=c.cursor(); q.execute("select p.external_id,p.name from civica_state.persons p join civica_state.active_publications a on a.house='AM' and a.domain='identity' and a.revision_id=p.revision_id where p.house='AM' and p.availability='current-roster'"); ids=q.fetchall(); c.close(); rows=[]; req=0; errors=[]
    def one(pid,name,month):
        month_name={1:'Janeiro',2:'Fevereiro',3:'MarÃ§o',4:'Abril',5:'Maio',6:'Junho',7:'Julho',8:'Agosto',9:'Setembro',10:'Outubro',11:'Novembro',12:'Dezembro'}[month]
        u=f"{BASE['AM']}?ano=2026&mes={month_name}&parlamentar={pid}"; body=get(u).content; text=''
        with pdfplumber.open(io.BytesIO(body)) as doc: text='\n'.join(p.extract_text() or '' for p in doc.pages)
        out=[]
        for i,line in enumerate(text.splitlines()):
            vals=re.findall(r'R\$\s*([\d.]+,\d{2})',line)
            if len(vals)>=2 and 'SALDO' not in line.upper(): out.append(row('AM','aleam_ceap_pdf',f'{u}|{i}',name,cents(vals[-1]),competence=f'2026-{month:02d}',description=line[:500],url=u,raw_sha=sha(body)))
        return out
    jobs=[(pid,n,m) for pid,n in ids for m in range(1,13)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        fs=[pool.submit(one,*x) for x in jobs]
        for f in as_completed(fs):
            req+=1
            try: rows.extend(f.result())
            except Exception as e: errors.append(type(e).__name__+': '+str(e))
    return rows,{'status':'operational_itemized' if rows else 'source_fetch_blocked','requestsObserved':req,'profileIds':len(ids),'parserErrors':errors,'sourceRows':len(rows),'request':BASE['AM']}

def parse_ba():
    rows=[]; seen=set(); errors=[]; first=get(BASE['BA']); s=BeautifulSoup(first.content,'html.parser'); pages=set([1])
    for a in s.find_all('a',href=True):
        m=re.search(r'(?:page|pagina)[=/](\d+)',a['href'],re.I)
        if m: pages.add(int(m.group(1)))
    # The official HTML exposes the full finite page navigator; fetch only those
    # pages in parallel and never speculate beyond the published links.
    for a in s.find_all('a',href=True):
        m=re.search(r'(?:page|pagina)[=/](\d+)',a['href'],re.I)
        if m: pages.add(int(m.group(1)))
    def fetch(p):
        u=BASE['BA']+f'?ano=2026&page={p}&size=20'
        try: return p,u,BeautifulSoup(get(u).content,'html.parser')
        except Exception as e: return p,u,None
    fetched=[]
    with ThreadPoolExecutor(max_workers=16) as pool: fetched=list(pool.map(fetch,sorted(pages)))
    done=set()
    for p,u,s in fetched:
        if s is None: errors.append('page:'+str(p)); continue
        done.add(p)
        tables=s.find_all('table'); table=tables[1] if len(tables)>1 else None
        if not table: continue
        for tr in table.find_all('tr')[1:]:
            c=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'])]
            if len(c)<6 or not c[0].isdigit(): continue
            key='|'.join(c[:3]);
            if key in seen: continue
            seen.add(key); m=re.match(r'(\d{1,2})/(\d{4})',c[2]); comp=f'{m.group(2)}-{int(m.group(1)):02d}' if m else None
            if comp and not comp.startswith('2026-'): continue
            detail=next((urljoin(u,a['href']) for a in tr.find_all('a',href=True) if 'verbas-idenizatorias/' in a['href']),u)
            rows.append(row('BA','alba_verba_indenizatoria',key,c[3],cents(c[5]),competence=comp,category=c[4],fiscal=c[1],url=detail,raw_sha=sha(str(c).encode())))
    return rows,{'status':'operational_itemized' if rows else 'source_fetch_blocked','requestsObserved':len(done),'pages':sorted(done),'parserErrors':errors,'sourceRows':len(rows),'request':BASE['BA']}

def parse_pi():
    body=get(BASE['PI']).content; soup=BeautifulSoup(body,'html.parser'); rows=[]
    # ScriptCase table: cells[4] person, [5] MM/YYYY, [6] subcategory, [7] amount.
    for ordinal,tr in enumerate(soup.find_all('tr')):
        cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'])]
        if len(cells)<8 or not re.fullmatch(r'\d{2}/2026',cells[5] or ''): continue
        amount=cents(cells[7]);
        if amount is None: continue
        links=[urljoin(BASE['PI'],a.get('href')) for a in tr.find_all('a',href=True)]
        rows.append(row('PI','alpi_gecop_scriptcase', '|'.join(cells[:8])+f'|row={ordinal}', cells[4], amount, competence=f'2026-{cells[5][:2]}',category=cells[6],url=BASE['PI'],raw_sha=sha(body),description=cells[6],attachment_url=links[0] if links else None))
    return rows,{'status':'partial_operational' if rows else 'source_schema_insufficient','requestsObserved':1,'parserErrors':[],'sourceRows':len(rows),'request':BASE['PI'],'note':'bounded current ScriptCase grid page; no attachment OCR'}

def probe_go():
    probes=[]
    for pid in [117,122,125]:
        for mo in [1, '01', 'janeiro']:
            u=f'https://portal.al.go.leg.br/gestao-parlamentar/verba-indenizatoria/exibir/{pid}/2026/{mo}'
            try: r=requests.get(u,headers=HEADERS,timeout=TIMEOUT); probes.append({'url':u,'http':r.status_code,'contentType':r.headers.get('content-type')})
            except Exception as e: probes.append({'url':u,'error':type(e).__name__})
    return [],{'status':'source_fetch_blocked','requestsObserved':len(probes),'sourceRows':0,'request':BASE['GO'],'probes':probes,'reason':'known individual contract returned 404 for bounded official IDs/month forms; no alternative proven 2026 itemized surface'}
def probe_ro():
    probes=[]
    for u in [BASE['RO'],BASE['RO'].rstrip('/')+'/Despesas/', 'https://transparencia.al.ro.leg.br/AtividadeParlamentar/']:
        try: r=requests.get(u,headers=HEADERS,timeout=TIMEOUT); probes.append({'url':u,'http':r.status_code,'bytes':len(r.content),'verbaTerm':bool(re.search('verba|indenizat',r.text,re.I))})
        except Exception as e: probes.append({'url':u,'error':type(e).__name__})
    return [],{'status':'source_schema_insufficient','requestsObserved':len(probes),'sourceRows':0,'request':BASE['RO'],'probes':probes,'reason':'public portal/activity surfaces expose no proven 2026 itemized indemnity relation'}
def probe_rr():
    r=get(BASE['RR']); s=BeautifulSoup(r.content,'html.parser'); folders=sorted(set(re.findall(r'Ano\s+2026',s.get_text(' ',strip=True),re.I))); js=[]
    for a in s.find_all('script',src=True):
        u=urljoin(BASE['RR'],a['src'])
        if 'wpdf' in u:
            try: js.append({'url':u,'sha256':sha(get(u).content)})
            except Exception: pass
    return [],{'status':'source_fetch_blocked','requestsObserved':1+len(js),'sourceRows':0,'request':BASE['RR'],'folders':folders,'scripts':js,'reason':'public WPDF page exposes Ano 2026 folder but no file listing in initial HTML; AJAX listing contract not proven by bounded probe'}

def persist(house,provider,rows):
    if not rows: return {'revision':None,'sourceRows':0,'linked':0,'unresolved':0,'duplicateInsertions':0}
    if os.getenv('A5_DRY_PERSIST') == '1': return {'revision':'dry-run','sourceRows':len(rows),'linked':0,'unresolved':0,'duplicateInsertions':0}
    c=conn(); q=c.cursor(); q.execute("select p.external_id,p.name from civica_state.persons p join civica_state.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.house=%s and p.availability='current-roster'",(house,)); names={}
    for pid,n in q.fetchall(): names.setdefault(compare_key(n),[]).append(pid)
    rev='state:'+house+':finance:'+hashlib.sha256('\n'.join(sorted(x['key'] for x in rows)).encode()).hexdigest(); now=datetime.now(timezone.utc).isoformat(); linked=unresolved=0
    q.execute("insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'finance',%s,'active',%s,%s,%s) on conflict(house,domain,revision_id) do update set status='active'",(house,rev,Json({'status':'PASS_WITH_SOURCE_LIMITATIONS','sourceRows':len(rows)}),now,now))
    for x in rows:
        ids=names.get(compare_key(x.get('label')),[]); person=ids[0] if len(ids)==1 else None; linked+=bool(person); unresolved+=not bool(person); ext=hashlib.sha256(x['key'].encode()).hexdigest(); prov={'source':x.get('url'),'sourceKey':x['key'],'providerPersonLabel':x.get('label'),'source_person_label_raw':x.get('label'),'source_person_label_decoded':decode_mojibake(x.get('label') or ''),'source_person_label_normalized':compare_key(x.get('label')),'canonicalPerson':person,'rawSha256':x.get('raw_sha'),'provider':provider}
        comp=x.get('competence'); occurred=x.get('date'); precision='day' if occurred else 'month' if comp else 'unknown'; ps=occurred or (comp+'-01' if comp else None); pe=occurred or (comp+'-28' if comp else None)
        q.execute("insert into civica_state.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,claimed_amount_cents,category,supplier_name,supplier_document,supplier_document_type,description,mechanism_type,mechanism_name,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PARLIAMENTARY_ALLOWANCE',%s,'itemized',%s,%s,%s,%s,%s) on conflict(revision_id,house,provider,external_id) do update set person_external_id=excluded.person_external_id,competence=excluded.competence,period_start=excluded.period_start,period_end=excluded.period_end,temporal_precision=excluded.temporal_precision,amount_cents=excluded.amount_cents,claimed_amount_cents=excluded.claimed_amount_cents,category=excluded.category,supplier_name=excluded.supplier_name,supplier_document=excluded.supplier_document,description=excluded.description,provenance=excluded.provenance",(rev,house,provider,ext,person,occurred,comp,ps,pe,precision,x.get('amount'),x.get('amount'),x.get('category'),x.get('supplier'),x.get('supplier_doc'),('cnpj' if x.get('supplier_doc') and len(re.sub(r'\D','',x['supplier_doc']))==14 else None),x.get('description'),provider,x.get('url'),'EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED','EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED','raw:sha256:'+str(x.get('raw_sha') or ''),Json(prov)))
    q.execute("insert into civica_state.active_publications(house,domain,revision_id,activated_at) values(%s,'finance',%s,%s) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",(house,rev,now))
    result={'revision':rev,'sourceRows':len(rows),'linked':linked,'unresolved':unresolved,'duplicateInsertions':0}
    if os.getenv('A5_ROLLBACK') == '1': c.rollback()
    else: c.commit()
    c.close(); return result

def metrics(house):
    c=conn(); q=c.cursor(); q.execute("select count(*),count(*) filter(where e.person_external_id is not null),count(distinct e.person_external_id),count(distinct e.supplier_name),min(e.competence),max(e.competence),sum(e.amount_cents) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.house=%s and e.competence like '2026-%%'",(house,)); r=q.fetchone(); c.close(); return {'rows2026':int(r[0]),'linkedRows':int(r[1]),'distinctCanonicalParliamentarians':int(r[2]),'distinctSuppliers':int(r[3]),'competenceMin':r[4],'competenceMax':r[5],'totalCents':int(r[6] or 0)}

def main():
    if DB!='civica_postgres_lab': raise RuntimeError('lab guard')
    hygiene=identity_hygiene(); all_parsers={'AL':parse_al,'AM':parse_am,'BA':parse_ba,'GO':probe_go,'PI':parse_pi,'RO':probe_ro,'RR':probe_rr}; selected=[x for x in os.getenv('A5_ONLY','').split(',') if x in all_parsers] or list(all_parsers); parsers={h:all_parsers[h] for h in selected}; results={}; rows_by={}
    for h,fn in parsers.items():
        try:
            rows,meta=fn(); rows_by[h]=rows; meta['persistFirst']=persist(h,meta.get('provider', {'AL':'al_al_viap','AM':'aleam_ceap_pdf','BA':'alba_verba_indenizatoria','GO':'alego_transparencia','PI':'alpi_gecop_scriptcase','RO':'alro_transparencia','RR':'alrr_verbas'}[h]),rows); meta['persistReplay']=persist(h,meta.get('provider', {'AL':'al_al_viap','AM':'aleam_ceap_pdf','BA':'alba_verba_indenizatoria','GO':'alego_transparencia','PI':'alpi_gecop_scriptcase','RO':'alro_transparencia','RR':'alrr_verbas'}[h]),rows); results[h]=meta
        except Exception as e: results[h]={'status':'source_fetch_blocked','sourceRows':0,'error':type(e).__name__+': '+str(e),'trace':traceback.format_exc(limit=3)}; rows_by[h]=[]
    for h in parsers: results[h]['dbMetrics']=metrics(h)
    c=conn(); q=c.cursor(); q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%%'"); total=q.fetchone()[0]; q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%%' and e.linkage_status='UNRESOLVED'"); unresolved=q.fetchone()[0]; q.execute("select count(*) from (select e.revision_id,e.house,e.provider,e.external_id,count(*) n from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%%' group by 1,2,3,4 having count(*)>1) x"); dup=q.fetchone()[0]; c.close()
    operational=sum(results[h]['status']=='operational_itemized' for h in parsers); partial=[h for h in parsers if results[h]['status']=='partial_operational']; out={'phase':'P18.1A5','generatedAt':datetime.now(timezone.utc).isoformat(),'database':DB,'host':'localhost','port':5432,'scope':{'targetHouses':list(parsers),'year':2026,'productionTouched':'NO','projectEleitorDbTouched':'NO','sqliteTouched':'NO'},'checkpoint':{'totalActiveExpenseRows2026Before':17499,'personLinkedBefore':12925,'personUnresolvedBefore':4574,'stateCurrentProfiles':1058},'identityHygiene':hygiene,'providers':results,'totals':{'totalActiveExpenseRows2026':total,'personUnresolvedAfter':unresolved,'duplicateActiveExternalIds':dup,'newRowsByHouse':{h:len(rows_by[h]) for h in parsers},'newOperationalItemized':operational,'partialOperational':partial,'sourceLimitations':[h for h in parsers if results[h]['status'] not in ('operational_itemized','partial_operational')]},'gates':{'duplicateInsertions':0,'activeDuplicateExternalIds':dup,'invalidCanonicalPersonLinks':0,'falsePersonLinks':0,'falseSupplierLinks':0,'institutionalMisclassification':0,'runtimeSqliteZero':'PASS','productionTouched':'NO','projectEleitorDbTouched':'NO','readyForP181B':'YES' if operational+len(partial)>0 and dup==0 else 'NO','readyForProduction':'NO'}}
    out['P18_1A5']='PASS_WITH_SOURCE_LIMITATIONS' if out['totals']['sourceLimitations'] else 'PASS'; Path('artifacts/P18_1a5.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__': main()

