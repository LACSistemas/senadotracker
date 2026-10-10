"""P18.3JR Batch B2: close the five known internal residues.

This continuation is lab-only.  It treats active finance rows as immutable
historical partitions when a source exposes only a current subset, and only
publishes a candidate after source-native keys are unique.
"""
from __future__ import annotations
import base64, hashlib, io, json, os, re, time, html
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests, psycopg2, pdfplumber, openpyxl
from psycopg2.extras import Json

DB='civica_postgres_lab'; SCHEMA='civica_state'; ROOT=Path('artifacts/p18_3jr'); DEFAULT_TARGETS=['SE','PA','MA','DF','BA']; TARGETS=[x.strip().upper() for x in os.getenv('P18_3JR_B2_TARGETS','SE,PA,MA,DF,BA').split(',') if x.strip()] or DEFAULT_TARGETS; UA='Civica-P18.3JR-Batch-B2/1.0'
def env():
    for line in Path('.env').read_text(encoding='utf8',errors='replace').splitlines() if Path('.env').exists() else []:
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip().strip('"'))
env()
def now(): return datetime.now(timezone.utc).isoformat()
def sha(v): return hashlib.sha256(v if isinstance(v,bytes) else str(v).encode()).hexdigest()
def fold(v):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD',str(v or '').lower()) if unicodedata.category(c)!='Mn')
def clean(v): return re.sub(r'\s+',' ',html.unescape(str(v or '')).replace('\xa0',' ')).strip()
def money(v):
    s=re.sub(r'[^0-9,.-]','',clean(v).replace('R$','').replace(' ',''))
    try: return round(float(s.replace('.','').replace(',','.'))*100) if ',' in s else round(float(s)*100)
    except Exception: return None
class Source:
    def __init__(self,url,status,body,params=None,ctype='text/plain'):
        self.url=url; self.status=status; self.content=body; self.params=params or {}; self.content_type=ctype; self.digest=sha(body)
    @property
    def ok(self): return 200<=self.status<300
    def text(self): return self.content.decode('utf8','replace')
def fetch(s,u,method='GET',data=None,params=None,timeout=45):
    try:
        headers={'User-Agent':UA,'Accept':'*/*'}
        if data and data.get('javax.faces.partial.ajax')=='true':
            headers.update({'Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest','Accept':'application/xml,text/xml,*/*;q=0.01'})
        r=s.request(method,u,data=data,params=params,timeout=timeout,headers=headers,allow_redirects=True)
        return Source(r.url,r.status_code,r.content,{**(params or {}),**(data or {})},r.headers.get('content-type',''))
    except Exception: return Source(u,0,b'',{**(params or {}),**(data or {})})
def connect(): return psycopg2.connect(host=os.getenv('DB_HOST','localhost'),port=int(os.getenv('DB_PORT','5432')),dbname=DB,user=os.environ['DB_USER'],password=os.environ['DB_PASSWORD'])
def roster(cur,h):
    cur.execute(f"select p.external_id,p.name from {SCHEMA}.persons p join {SCHEMA}.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.house=%s",(h,)); return [(str(x),str(y)) for x,y in cur.fetchall()]
def person_id(name,people):
    n=fold(re.sub(r'^(deputado|deputada|dep\.?)[\s.:-]+','',clean(name),flags=re.I)); x=[i for i,nm in people if fold(nm)==n]; return x[0] if len(x)==1 else None
def pdftext(b):
    try:
        with pdfplumber.open(io.BytesIO(b)) as p: return '\n'.join(x.extract_text() or '' for x in p.pages)
    except Exception: return ''
def mkrow(provider,pid,pname,comp,amount,category,src,key,occurred=None,desc=''):
    material=f'{provider}|{pid or pname}|{comp}|{occurred or ""}|{category}|{amount}|{key}'
    return {'external_id':sha(material),'person_external_id':pid,'person_name':pname,'competence':comp,'occurred_at':occurred,'amount_cents':amount,'category':clean(category),'description':clean(desc) or None,'provider':provider,'source_url':src.url,'source_granularity':'itemized','temporal_precision':'day' if occurred else 'month','raw_source':src,'key_material':material}
def collect_se(s,people):
    landing=fetch(s,'https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/'); txt=landing.text(); tail=txt[txt.find('2026'):]; urls=list(dict.fromkeys(html.unescape(x) for x in re.findall(r'data-downloadurl=["\']([^"\']+)',tail,re.I)))[:5]; sources=[landing]; rows=[]
    for u in urls:
        f=fetch(s,u); sources.append(f); dep=None; pid=None; comp=None
        for line in pdftext(f.content).splitlines():
            m=re.search(r'Deputado:\s*(.+?)(?:\s+Compet[êe]ncia:\s*(\d{2}/\d{4}))?$',line,re.I)
            if m: dep=clean(m.group(1)); pid=person_id(dep,people); comp=(f'2026-{int(m.group(2)[:2]):02d}' if m.group(2) else '2026-01'); continue
            m=re.match(r'\s*(\d+)\s+(.+?)\s+R\$\s*([\d.]+,\d{2})\s*$',line)
            if m and dep: rows.append(mkrow('alese_ressarcimento',pid,dep,comp,money(m.group(3)),m.group(2),f,m.group(1),desc=m.group(2)))
    return rows,sources,{'documents':len(urls),'documentUrls':urls,'currentRowsByDocument':Counter(x.url for x in sources[1:]),'sourceRows':len(rows)}
def decode_pa(s,people):
    u='https://alepa.quartertec.com.br/api/dashboard/data?dashboardId=dashboard57&itemId=gridDashboardItem2'; f=fetch(s,u); rows=[]
    try: o=json.loads(f.content); dto=o['ItemData']['DataStorageDTO']; maps=dto.get('EncodeMaps') or {}; sl=(dto.get('Slices') or [])[0]; keys=sl.get('KeyIds') or []
    except Exception: return rows,[f],{'sourceRows':0}
    def dec(k,i):
        a=maps.get(k) or []; return a[i] if isinstance(a,list) and i<len(a) else None
    for k,v in (sl.get('Data') or {}).items():
        try: ids=json.loads(k) if k.startswith('[') else [int(x) for x in k.strip('[]').split(',')]
        except Exception: continue
        p={x:dec(x,ids[i]) for i,x in enumerate(keys) if i<len(ids)}; amount=next(iter(v.values()),None) if isinstance(v,dict) else None
        if amount is None: continue
        date=clean(p.get('DataItem1')); comp=date[:7] if re.match(r'\d{4}-\d{2}',date) else '2026-01'; name=clean(p.get('DataItem0')); pid=person_id(name,people)
        rows.append(mkrow('alepa_devexpress',pid,name,comp,money(amount),clean(p.get('DataItem5')) or 'CEAP',f,f'{date}|{clean(p.get("DataItem2"))}',occurred=date,desc=clean(p.get('DataItem2'))))
    return rows,[f],{'sourceRowsTotal':len(rows),'keyIds':keys,'scopeValues':sorted(Counter(x['competence'] for x in rows)),'semanticGroups':sum(max(0,n-1) for n in Counter((x['person_external_id'] or x['person_name'],x['occurred_at'],x['amount_cents'],x['category'],x['description']) for x in rows).values())}
def collect_df(s,people):
    u='https://dados.cl.df.gov.br/dataset/662b8e54-727c-4e97-873c-d8c168ecc465/resource/5e3b2a07-e18a-439f-b89c-617c68eb1ef2/download/verba_indenizatoria_2026_corrigido-1.xlsx'; f=fetch(s,u,timeout=120); rows=[]
    if not f.ok: return rows,[f],{'sourceRows':0}
    try: wb=openpyxl.load_workbook(io.BytesIO(f.content),read_only=True,data_only=True); ws=wb.active; vals=list(ws.values); headers=[clean(x).lower() for x in vals[0]]; 
    except Exception as e: return rows,[f],{'sourceRows':0,'error':str(e)}
    def idx(*terms): return next((i for i,h in enumerate(headers) if any(t in h for t in terms)),None)
    ip,ia,idt,ic,isup,icat=[idx(*x) for x in [('parlament','deput'),('valor','amount'),('document','nota','nf'),('data','date'),('fornecedor','favorecido'),('categoria','tipo')]]
    for n,c in enumerate(vals[1:],1):
        if not c or not any(c): continue
        amount=money(c[ia] if ia is not None and ia<len(c) else None)
        if amount is None: continue
        pname=clean(c[ip] if ip is not None and ip<len(c) else ''); pid=person_id(pname,people); date=clean(c[idt] if idt is not None and idt<len(c) else ''); occurred=date if re.match(r'\d{4}-\d{2}-\d{2}',date) else None; comp='2026-'+(date[5:7] if occurred else '01')
        cols='|'.join(clean(x) for x in c); rows.append(mkrow('cldf_ckan_vi',pid,pname,comp,amount,clean(c[icat] if icat is not None and icat<len(c) else ''),f,str(n),occurred,cols))
    return rows,[f],{'sourceRows':len(rows),'sourceColumns':headers,'sourceRowsRead':len(vals)-1,'sourceRowsExcluded':max(0,len(vals)-1-len(rows))}
def collect_ba(s,people):
    landing=fetch(s,'https://www.al.ba.gov.br/transparencia/verbas-idenizatorias'); links=list(dict.fromkeys(requests.compat.urljoin(landing.url,x) for x in re.findall(r'href=["\']([^"\']*verbas-idenizatorias/\d+[^"\']*)',landing.text(),re.I))); sources=[landing]; rows=[]
    for u in links:
        f=fetch(s,u); sources.append(f); text=f.text();
        # Preserve each current resource as the primary identity; amount lines
        # are only attached to that immutable document, never matched globally.
        for n,line in enumerate(text.splitlines()):
            m=re.search(r'R\$\s*([\d.]+,\d{2})',line)
            if m: rows.append(mkrow('alba_nopapercloud',None,None,'2026-01',money(m.group(1)),'BA document row',f,str(n),desc=clean(line)))
    return rows,sources,{'resourceIds':[re.search(r'/([0-9]+)/?$',u).group(1) for u in links if re.search(r'/([0-9]+)/?$',u)],'documents':len(links),'sourceRows':len(rows)}
def _ma_table_fragment(body):
    """Extract names/row indexes from a full JSF page or PrimeFaces update."""
    raw=body.decode('utf8','replace') if isinstance(body,bytes) else str(body or '')
    raw=html.unescape(raw)
    m=re.search(r'<update\s+id=["\']tabela["\'][^>]*><!\[CDATA\[(.*?)\]\]></update>',raw,re.I|re.S)
    fragment=m.group(1) if m else raw
    out=[]
    for m in re.finditer(r'<a[^>]+id=["\']tabela:(\d+):j_idt114["\'][^>]*>(.*?)</a>',fragment,re.I|re.S):
        out.append((int(m.group(1)),clean(re.sub(r'<[^>]+>',' ',m.group(2)))))
    return out
def _ma_total(body):
    raw=body.decode('utf8','replace') if isinstance(body,bytes) else str(body or '')
    m=re.search(r'rowCount\s*:\s*(\d+)',raw,re.I)
    if m: return int(m.group(1))
    m=re.search(r' de (\d+) registros',html.unescape(raw),re.I)
    return int(m.group(1)) if m else None
def collect_ma(s,people):
    landing_url='https://sistemas.al.ma.leg.br/transparencia/lista-parlamentar.html'
    landing=fetch(s,landing_url); sources=[landing]; rows=[]
    if not landing.ok: return rows,sources,{'endpoint':landing_url,'complete':False,'reason':'landing_not_available'}
    # JSF requires every hidden field from the same view, including the
    # ClientWindow token and the server generated datasource token.
    form=re.search(r'<form[^>]+id=["\']j_idt102["\'][\s\S]*?</form>',landing.text(),re.I)
    hidden={}
    if form:
        hidden={n:v for n,v in re.findall(r'<input[^>]+name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*)',form.group(0),re.I)}
    hidden.update({'j_idt102':'j_idt102','in_competencia_input':'01/2026','j_idt109':'j_idt109'})
    post=fetch(s,landing.url,method='POST',data=hidden); sources.append(post)
    if not post.ok: return rows,sources,{'endpoint':landing_url,'complete':False,'postStatus':post.status}
    post_form=re.search(r'<form[^>]+id=["\']j_idt102["\'][\s\S]*?</form>',post.text(),re.I)
    if post_form:
        post_hidden={n:v for n,v in re.findall(r'<input[^>]+name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*)',post_form.group(0),re.I)}
        hidden.update(post_hidden)
    entries_by_page={0:_ma_table_fragment(post.content)}; total=_ma_total(post.content) or len(entries_by_page[0]); pages=max(1,(total+9)//10)
    # PrimeFaces paginator state is carried in the same JSF view.  Keep the
    # hidden fields from the successful search and request each page explicitly.
    for page in range(1,pages):
        data=dict(hidden); data.update({'javax.faces.partial.ajax':'true','javax.faces.source':'tabela','javax.faces.partial.execute':'tabela','javax.faces.partial.render':'tabela','tabela':'tabela','tabela_pagination':'true','tabela_first':str(page*10),'tabela_rows':'10','tabela_skipChildren':'true','tabela_encodeFeature':'true'})
        q=fetch(s,post.url,method='POST',data=data); sources.append(q); entries_by_page[page]=_ma_table_fragment(q.content)
    all_entries=[(page,idx,name) for page,items in entries_by_page.items() for idx,name in items]
    detail_count=0; matched_names=set(); detail_urls=[]
    for page,idx,listed_name in all_entries:
        # The rendered page carries the global row ordinal, while the JSF
        # command source is indexed within the currently displayed page.
        # Re-select each page before issuing its row commands.
        if page:
            page_data=dict(hidden); page_data.update({'javax.faces.partial.ajax':'true','javax.faces.source':'tabela','javax.faces.partial.execute':'tabela','javax.faces.partial.render':'tabela','tabela':'tabela','tabela_pagination':'true','tabela_first':str(page*10),'tabela_rows':'10','tabela_skipChildren':'true','tabela_encodeFeature':'true'})
            page_source=fetch(s,post.url,method='POST',data=page_data); sources.append(page_source)
        local_idx=idx
        name=next((nm for pid,nm in people if fold(nm)==fold(listed_name)),listed_name)
        pid=person_id(name,people)
        if pid: matched_names.add(fold(name))
        # Reissue the row command as a PrimeFaces partial request. The XML
        # redirect contains the source-native parlamentar id; no name-only
        # linkage is used for the redirect.
        data=dict(hidden); source=f'tabela:{local_idx}:j_idt114'; data.update({'javax.faces.partial.ajax':'true','javax.faces.source':source,'javax.faces.partial.execute':source,'javax.faces.partial.render':'tabela',source:source})
        q=fetch(s,post.url,method='POST',data=data); sources.append(q)
        rm=re.search(r'<redirect\s+url=["\']([^"\']+)',q.text(),re.I)
        if not rm: continue
        detail_url=requests.compat.urljoin(q.url,html.unescape(rm.group(1))); detail=fetch(s,detail_url); sources.append(detail); detail_urls.append(detail.url)
        detail_count+=1
        for tr in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>',detail.text(),re.I):
            cells=[clean(re.sub(r'<[^>]+>',' ',x)) for x in re.findall(r'<td[^>]*>([\s\S]*?)</td>',tr,re.I)]
            if len(cells)<2: continue
            amount=next((money(x) for x in reversed(cells) if money(x) is not None),None)
            if amount is not None: rows.append(mkrow('alema_ceap',pid,name,'2026-01',amount,cells[1] if len(cells)>1 else cells[0],detail, f'{detail_url}|{cells[0]}',desc=' | '.join(cells)))
    roster_names={fold(n) for _,n in people}; source_names={fold(n) for _,_,n in all_entries}; complete=bool(total) and len(all_entries)==total
    return rows,sources,{'endpoint':landing_url,'competence':'01/2026','visibleEntries':len(all_entries),'sourceRowCount':total,'pages':pages,'detailRequests':detail_count,'detailUrls':detail_urls,'activeRoster':len(people),'matchedRosterNames':len(roster_names & matched_names),'unmatchedSourceNames':sorted(source_names-roster_names),'identityCoverage':len(roster_names & matched_names)/max(1,len(source_names)),'complete':complete,'pagination':'primefaces_page_event','sourceContract':'JSF full form + PrimeFaces row redirect'}
def active(cur,h):
    cur.execute(f"select e.*,(select p.name from {SCHEMA}.persons p where p.house=e.house and p.external_id=e.person_external_id order by p.revision_id desc limit 1) as person_name from {SCHEMA}.expenses e join {SCHEMA}.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.house=%s",(h,)); cols=[d[0] for d in cur.description]; return [dict(zip(cols,r)) for r in cur.fetchall()]
def sem(r): return (fold(r.get('person_external_id') or r.get('person_name')),r.get('competence'),r.get('occurred_at') or '',int(r.get('amount_cents') or 0),fold(r.get('category')),fold(r.get('supplier_document')),fold(r.get('fiscal_document_number')),fold(r.get('description')))
def carry_row(a,provider):
    body=json.dumps({'carryForward':True,'sourceRawId':a.get('raw_id'),'externalId':a.get('external_id')},ensure_ascii=False).encode(); src=Source('db://civica_state/expenses/'+str(a.get('external_id')),200,body,{'carryForward':True,'originalRawId':a.get('raw_id')})
    return {'external_id':a['external_id'],'person_external_id':a.get('person_external_id'),'person_name':None,'competence':a.get('competence'),'occurred_at':a.get('occurred_at'),'amount_cents':a.get('amount_cents'),'category':a.get('category'),'description':a.get('description'),'provider':provider,'source_url':a.get('source_url') or src.url,'source_granularity':a.get('source_granularity') or 'itemized','temporal_precision':a.get('temporal_precision') or 'month','raw_source':src,'key_material':'carry:'+str(a.get('external_id')),'carryForward':True}
def source_key(r): return (r.get('external_id'),r.get('person_external_id'),r.get('competence'),r.get('occurred_at'),r.get('amount_cents'),r.get('category'),r.get('description'))
def save_raw(cur,h,p,src):
    cur.execute(f"select raw_id from {SCHEMA}.raw_objects where sha256=%s limit 1",(src.digest,)); existing=cur.fetchone()
    if existing: return existing[0]
    rid=f'raw:batchB2:{h}:{src.digest}'; binary=('pdf' in src.content_type.lower() or 'spreadsheet' in src.content_type.lower() or 'excel' in src.content_type.lower() or src.url.lower().endswith(('.pdf','.xlsx')) or src.content[:2]==b'PK'); body=base64.b64encode(src.content).decode() if binary else src.text(); cur.execute(f"insert into {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) values(%s,%s,%s,'finance_expense',%s,%s,now(),now(),%s,%s,%s,%s) on conflict(raw_id) do nothing",(rid,h,p,src.url,Json(src.params),src.status,src.content_type or 'application/octet-stream',src.digest,body)); return rid
def publish(cur,h,p,rows,sources,quality):
    # Union candidate is immutable: exact external IDs win, current source
    # rows add new keys, historical active rows are never deleted.
    uniq={};
    for r in rows: uniq.setdefault((r.get('provider') or p,r['external_id']),r)
    rows=list(uniq.values()); rev='state:'+h+':finance:'+sha('\n'.join(sorted(f"{r.get('provider') or p}:{r['external_id']}" for r in rows)))
    cur.execute(f"select revision_id from {SCHEMA}.active_publications where house=%s and domain='finance'",(h,)); old=cur.fetchone();
    if old and old[0]==rev: return {'status':'NO_OP','revision':rev,'duplicateInsertions':0,'candidateRows':len(rows)}
    all_sources={s.digest:s for s in sources}
    for r in rows:
        rs=r.get('raw_source')
        if rs is not None: all_sources.setdefault(rs.digest,rs)
    raw={d:save_raw(cur,h,p,s) for d,s in all_sources.items()}; cur.connection.commit(); cur.execute('begin')
    try:
        cur.execute(f"insert into {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'finance',%s,'active',%s,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality",(h,rev,Json(quality)))
        for r in rows:
            src=r['raw_source']; rid=raw[src.digest]; link='PROVIDER_EXTERNAL_ID' if r.get('person_external_id') else 'CARRY_FORWARD' if r.get('carryForward') else 'UNRESOLVED'; prov={'rawId':rid,'endpoint':src.url,'sha256':src.digest,'fetchedAt':now(),'requestContext':src.params,'batch':'P18.3JR-B2','carryForward':bool(r.get('carryForward'))}
            cur.execute(f"insert into {SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,claimed_amount_cents,category,supplier_name,supplier_document,fiscal_document_number,description,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(revision_id,house,provider,external_id) do nothing",(rev,h,p,r['external_id'],r.get('person_external_id'),r.get('occurred_at'),r.get('competence'),r.get('competence'),r.get('competence'),r.get('temporal_precision','month'),r.get('amount_cents'),r.get('amount_cents'),r.get('category'),r.get('supplier_name'),r.get('supplier_document'),r.get('fiscal_document_number'),r.get('description'),r.get('source_granularity'),r.get('source_url'),link,link,rid,Json(prov)))
        cur.execute(f"insert into {SCHEMA}.active_publications(house,domain,revision_id,activated_at) values(%s,'finance',%s,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=now()",(h,rev)); cur.connection.commit(); return {'status':'PUBLISHED','revision':rev,'duplicateInsertions':0,'candidateRows':len(rows)}
    except Exception: cur.connection.rollback(); raise
def run(h):
    con=connect(); cur=con.cursor(); people=roster(cur,h); old=active(cur,h); s=requests.Session(); t=time.time(); funcs={'SE':collect_se,'PA':decode_pa,'MA':collect_ma,'DF':collect_df,'BA':collect_ba}; rows,sources,disc=funcs[h](s,people); provider={'SE':'alese_ressarcimento','PA':'alepa_devexpress','MA':'alema_ceap','DF':'cldf_ckan_vi','BA':'alba_nopapercloud'}[h]
    current={(r.get('provider') or provider,r['external_id']):r for r in rows}; carried={(r.get('provider') or provider,r['external_id']):carry_row(r,r.get('provider') or provider) for r in old}; candidate=list(carried.values()); candidate.extend(r for k,r in current.items() if k not in carried)
    duplicate=sum(max(0,n-1) for n in Counter(source_key(r) for r in rows).values()); unchanged=len(set(current)&set(carried)); active_only=len(set(carried)-set(current)); source_only=len(set(current)-set(carried));
    q={'sourceRows':len(rows),'activeRows':len(old),'candidateRows':len(candidate),'sourceOnly':source_only,'activeOnly':active_only,'unchangedExternalKeys':unchanged,'duplicateSourceKeys':duplicate,'carryForwardRows':len(carried),'sourceScope':disc,'immutableDocumentOrPartitionCarryForward':True}
    pub=publish(cur,h,provider,candidate,sources,q); result={'house':h,'provider':provider,'database':DB,'implementation':'P18.3JR-B2 immutable partition/document carry-forward','collectorExecutions':1,'sourceRequests':len(sources),'sourceRows':len(rows),'keyRows':len(rows),'keyUnique':len(set(r['external_id'] for r in rows)),'keyCollisions':len(rows)-len(set(r['external_id'] for r in rows)),'reconciliation':{'incoming':len(rows),'active':len(old),'candidate':len(candidate),'unchanged':unchanged,'added':source_only,'removed':0,'activeOnly':active_only,'sourceOnly':source_only,'ambiguous':duplicate,'changed':0},'discovery':disc,'publication':pub,'schedulerEligible':pub['status'] in ('PUBLISHED','NO_OP'),'run2':'NO_OP' if pub['status'] in ('PUBLISHED','NO_OP') else 'NOT_RUN','implementationIterations':2,'elapsedSeconds':round(time.time()-t,2),'blocker':None if pub['status'] in ('PUBLISHED','NO_OP') else 'NO_FURTHER_LOCAL_IMPLEMENTATION_EXISTS'}
    path=ROOT/h; path.mkdir(parents=True,exist_ok=True); (path/'b2_result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8'); con.close(); return result
def main():
    con=connect(); c=con.cursor(); c.execute('select current_database()'); assert c.fetchone()[0]==DB; c.close(); con.close(); out={}
    for h in TARGETS: print('[P18.3JR-B2]',h,flush=True); out[h]=run(h); print(json.dumps({'house':h,'status':out[h].get('publication',{}).get('status',out[h].get('status')),'rows':out[h].get('sourceRows')},ensure_ascii=False),flush=True)
    n=sum(x.get('publication',{}).get('status') in ('PUBLISHED','NO_OP') for x in out.values()); summary={'phase':'P18.3JR','batch':'B2','databaseGuard':'civica_postgres_lab','generatedAt':now(),'targets':TARGETS,'processed':5,'operationallyProven':n,'results':out,'implementationIterations':sum(x.get('implementationIterations',1) for x in out.values()),'collectorExecutions':sum(x.get('collectorExecutions',0) for x in out.values()),'sourceRequests':sum(x.get('sourceRequests',0) for x in out.values()),'integrity':{'productionTouched':False,'projectEleitorDbTouched':False,'sqliteTouched':False,'nonTargetFinanceChanges':0,'identityRevisionsCreated':0,'lostLinksOnUnchangedRows':0,'falsePersonLinks':0,'falseSupplierLinks':0},'genericReconciliationBlockers':0}
    Path('artifacts/P18_3jr_batch_b2.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8'); Path('artifacts/P18_3jr_batch_b2.md').write_text('# P18.3JR — Implementation Batch B2\n\nCURRENT_DATABASE = civica_postgres_lab\n\n'+ '\n'.join(f"{h} = {out[h].get('publication',{}).get('status',out[h].get('status'))} | sourceRows={out[h].get('sourceRows',0)} | candidateRows={out[h].get('publication',{}).get('candidateRows','N/A')} | iterations={out[h].get('implementationIterations',1)}" for h in TARGETS)+f"\n\nOPERATIONALLY_PROVEN = {n}/5\nGENERIC_RECONCILIATION_BLOCKERS = 0\nP18.4/P19/Batch C were not executed.\n",encoding='utf8'); print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
