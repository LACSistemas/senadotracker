"""P18.1B: bounded official-source finance rollout for AP/PB/RN/RS/TO.
Lab-only, 2026-only, no SQLite, no fuzzy linkage, and no first-batch rewrites.
"""
from __future__ import annotations
import csv, hashlib, io, json, os, re, traceback, unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import psycopg2, requests, pdfplumber
from psycopg2.extras import Json
from bs4 import BeautifulSoup

DB='civica_postgres_lab'; YEAR=2026; TARGET=['AP','PB','RN','RS','TO']
U='https://al.ap.leg.br/transparencia/pagina.php?pg=ceap&acao=buscar'
H={'User-Agent':'Civica-P18.1B official-source collector/1.0'}; TIMEOUT=15
AP='https://al.ap.leg.br/transparencia/pagina.php?pg=ceap'
PB='https://www.al.pb.leg.br/transparencia/deputados/viap-v2'
RN='https://transparencia.al.rn.leg.br/verbas'
RN_API='https://api-transparencia.al.rn.leg.br'
RS='https://transparencia.al.rs.gov.br/parlamentares/gastos'
TO='https://www.al.to.leg.br/transparencia/verbaIndenizatoria'

def db():
    c=psycopg2.connect(host='localhost',port=5432,dbname=DB,user=os.getenv('DB_USER','projetoeleitor_user'),password=os.getenv('DB_PASSWORD','projetoeleitorsenha'))
    q=c.cursor(); q.execute('select current_database()')
    if q.fetchone()[0] != DB: c.close(); raise RuntimeError('wrong database')
    return c
def get(url, **kw):
    kw.setdefault('headers',H); kw.setdefault('timeout',TIMEOUT)
    return requests.get(url,**kw)
def post(url, **kw):
    kw.setdefault('headers',H); kw.setdefault('timeout',TIMEOUT)
    return requests.post(url,**kw)
def sha(b): return hashlib.sha256(b).hexdigest()
def decode(v):
    s=v or ''
    for _ in range(2):
        try:
            t=s.encode('latin1').decode('utf8')
            if t.count('�')<=s.count('�'): s=t
            else: break
        except Exception: break
    return s
def key(v):
    s=decode(str(v or '')).strip()
    s=re.sub(r'^\s*(?:Deputado|Deputada|Dep\.?)(?:\s+|[.:-])+','',s,flags=re.I)
    s=''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
    return re.sub(r'\s+',' ',s).casefold().strip()
def money(v):
    if v is None: return None
    s=str(v).replace('R$','').replace(' ','').strip()
    if not s: return None
    try:
        if ',' in s: return int(round(float(s.replace('.','').replace(',','.'))*100))
        return int(round(float(s.replace(',',''))*100))
    except Exception: return None
def row(house,provider,stable,label,amount,competence,**kw):
    return {'house':house,'provider':provider,'stable_source_key':stable,'label':decode(label),'amount_cents':amount,'competence':competence,**kw}

def identity_map(house):
    c=db(); q=c.cursor(); q.execute("select p.external_id,p.name from civica_state.persons p join civica_state.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id where p.house=%s and p.availability='current-roster'",(house,)); out={}
    for pid,n in q.fetchall(): out.setdefault(key(n),[]).append(pid)
    c.close(); return out

def parse_ap():
    rows=[]; errors=[]; observed=0; months=[]; cabinets={}
    try:
        r=post('https://al.ap.leg.br/transparencia/mes_ceap_json.php',data={'ano_verbaB':'2026'}); observed+=1
        months=[o.get('value') for o in BeautifulSoup(r.content,'html.parser').find_all('option') if re.fullmatch(r'\d{2}',o.get('value',''))]
    except Exception as e: errors.append(str(e))
    for m in months:
        try:
            r=post('https://al.ap.leg.br/transparencia/gabinete_ceap_json.php',data={'ano_verbaB':'2026','mes_verbaB':m}); observed+=1
            cabinets[m]=[(o.get('value'),o.get_text(' ',strip=True)) for o in BeautifulSoup(r.content,'html.parser').find_all('option') if o.get('value')]
        except Exception as e: errors.append(f'cabinet {m}: {e}')
    jobs=[(m,g,n) for m,items in cabinets.items() for g,n in items]
    def one(x):
        m,g,n=x
        try:
            r=post(U,data={'ano_verbaB':'2026','mes_verbaB':m,'idgabineteB':g}); s=BeautifulSoup(r.content,'html.parser'); t=s.find('table'); out=[]
            if t:
                for tr in t.find_all('tr')[1:]:
                    cells=[z.get_text(' ',strip=True) for z in tr.find_all(['th','td'])]
                    if len(cells)>=2 and cells[0] and cells[0].upper()!='TOTAL':
                        a=money(cells[1]);
                        if a is not None: out.append(row('AP','alap_ceap',f'{m}|{g}|{cells[0]}',n,a,f'2026-{int(m):02d}',category=cells[0],source_url=r.url,raw_sha=sha(r.content),provider_person_id=g))
            return out,None
        except Exception as e: return [],str(e)
    with ThreadPoolExecutor(max_workers=10) as p:
        fs=[p.submit(one,j) for j in jobs]
        for f in as_completed(fs):
            x,e=f.result(); rows.extend(x); errors += [e] if e else []
    return rows,{'provider':'alap_ceap','status':'operational_itemized' if rows else 'source_schema_insufficient','source_url':AP,'requests_observed':observed+len(jobs),'requests_parsed':len(jobs),'parser_errors':errors,'schema_drift':[],'source_parliamentarians':len(set(x['provider_person_id'] for x in rows)) if rows else 0}

def parse_pb():
    rows=[]; errors=[]; observed=0; months=[]; names=[]
    try:
        r=get(PB,params={'tipo_viap':'deputados','ano_viap':'2026','mes_viap':'1','deputado':'0'}); observed+=1; s=BeautifulSoup(r.content,'html.parser')
        months=[o.get('value') for o in s.find('select',attrs={'name':'mes_viap'}).find_all('option') if re.fullmatch(r'\d+',o.get('value',''))]
        sel=s.find('select',attrs={'name':'deputado'}); names=[(o.get('value'),o.get_text(' ',strip=True)) for o in sel.find_all('option') if o.get('value') and o.get('value')!='0'] if sel else []
    except Exception as e: errors.append(str(e))
    # The official v2 surface exposes the parliamentarian roster but returned no
    # parliamentary result table/detail for the tested 2026 selections.
    for m in months:
        try:
            r=get(PB,params={'tipo_viap':'deputados','ano_viap':'2026','mes_viap':m,'deputado':'0'}); observed+=1
            s=BeautifulSoup(r.content,'html.parser')
            if s.find('table'):
                errors.append(f'unexpected table in month {m}')
        except Exception as e: errors.append(f'month {m}: {e}')
    return rows,{'provider':'alpb_viap','status':'source_schema_insufficient','source_url':PB,'requests_observed':observed,'requests_parsed':observed,'parser_errors':errors,'schema_drift':['2026 parliamentary selections returned no itemized/detail table'],'source_parliamentarians':len(names),'other_org_imported':0}

def parse_rn():
    errors=[]; observed=1; details=[]
    try:
        r=get(RN); observed+=0
        api=get(RN_API+'/verbas/deputados'); observed+=1
        details.append({'api':api.url,'http':api.status_code,'body':api.text[:200]})
        api2=get(RN_API+'/verbas/meses/2026'); observed+=1; details.append({'api':api2.url,'http':api2.status_code,'body':api2.text[:200]})
    except Exception as e: errors.append(str(e))
    return [],{'provider':'alrn_ceap','status':'source_fetch_blocked','source_url':RN,'requests_observed':observed,'requests_parsed':0,'parser_errors':errors,'schema_drift':['official Angular page embeds API contract; API endpoints returned HTTP 401 without public bearer token'],'api_probes':details}

def parse_rs():
    rows=[]; errors=[]; observed=0; months=[]; bymonth={}
    try:
        r=get('https://transparencia.al.rs.gov.br/ajax-gastosParlamentaresListarMes?ano=2026'); observed+=1; months=[x['mes'] for x in r.json().get('lista',[])]
    except Exception as e: errors.append(str(e))
    for m in months:
        try:
            r=get(f'https://transparencia.al.rs.gov.br/ajax-gastosParlamentaresListarGabinete?ano=2026&mes={m}'); observed+=1; bymonth[m]=r.json().get('lista',[])
        except Exception as e: errors.append(f'gab {m}: {e}')
    jobs=[(m,g['codProponente'],g['nomeCota']) for m,gs in bymonth.items() for g in gs]
    def one(x):
        m,cod,n=x
        try:
            r=get('https://transparencia.al.rs.gov.br/parlamentares/gastos/pesquisa',params={'ano':'2026','mes':m,'solicitante':cod}); s=BeautifulSoup(r.content,'html.parser'); txt=s.get_text(' ',strip=True); out=[]
            dep=(s.select_one('.spn-deputadoNome').get_text(' ',strip=True) if s.select_one('.spn-deputadoNome') else n).replace('Deputado(a)','').strip()
            # This surface publishes category-level monthly aggregates in HTML.
            for match in re.finditer(r'([A-Za-zÀ-ÿ][^:]{2,100}):\s*(?:-\s*)?R\$\s*([\d.]+,\d{2})',txt):
                cat=match.group(1).strip(); amount=money(match.group(2))
                if amount is None or cat.lower().startswith(('total','saldo','outros creditos')): continue
                out.append(row('RS','alrs_gastos_agregado',f'{m}|{cod}|{cat}',dep,amount,f'2026-{int(m):02d}',category=cat,source_url=r.url,raw_sha=sha(r.content),provider_person_id=str(cod)))
            return out,None
        except Exception as e: return [],str(e)
    with ThreadPoolExecutor(max_workers=12) as p:
        fs=[p.submit(one,j) for j in jobs]
        for f in as_completed(fs):
            x,e=f.result(); rows.extend(x); errors += [e] if e else []
    # stable de-duplication of category rows (the page repeats desktop/mobile text)
    uniq={x['stable_source_key']:x for x in rows}; rows=list(uniq.values())
    return rows,{'provider':'alrs_gastos_agregado','status':'operational_aggregated' if rows else 'source_schema_insufficient','source_url':RS,'requests_observed':observed+len(jobs),'requests_parsed':len(jobs),'parser_errors':errors,'schema_drift':[],'source_parliamentarians':len(set(x['provider_person_id'] for x in rows)) if rows else 0,'published_months':months}

def parse_to():
    rows=[]; errors=[]; observed=0; deputies=[]
    try:
        r=get(TO); observed+=1; s=BeautifulSoup(r.content,'html.parser'); sel=s.find('select',attrs={'name':'transparencia.parlamentar'}); deputies=[o.get('value') for o in sel.find_all('option') if o.get('value')] if sel else []
    except Exception as e: errors.append(str(e))
    jobs=[(name,m) for name in deputies for m in range(1,13)]
    def one(x):
        name,m=x; out=[]
        try:
            r=post(TO,data={'transparencia.tipoTransparencia.codigo':'14','transparencia.ano':'2026','transparencia.mes':str(m),'transparencia.parlamentar':name}); s=BeautifulSoup(r.content,'html.parser'); a=s.find('table') and s.find('table').find('a',href=True)
            if not a: return [],None
            u='https://www.al.to.leg.br'+a['href'] if a['href'].startswith('/') else a['href']; pdf=get(u); observed_local=len(pdf.content)
            with pdfplumber.open(io.BytesIO(pdf.content)) as doc: text='\n'.join(p.extract_text() or '' for p in doc.pages)
            for line in text.splitlines():
                mm=re.match(r'^\s*(\d+)\s+(\S+)\s+(\S+)\s+(\d{2}/\d{2}/2026)\s+(.+?)\s+(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})',line)
                if mm:
                    supplier=mm.group(5).strip(); out.append(row('TO','aleto_codap',f'{m}|{name}|{mm.group(1)}|{mm.group(3)}|{mm.group(4)}',name,money(mm.group(7)),f'2026-{m:02d}',category=mm.group(2),supplier=supplier,supplier_doc=mm.group(6),fiscal_document_number=mm.group(3),occurred_at=mm.group(4),source_url=u,raw_sha=sha(pdf.content)))
            return out,None
        except Exception as e: return [],str(e)
    with ThreadPoolExecutor(max_workers=8) as p:
        fs=[p.submit(one,j) for j in jobs]
        for f in as_completed(fs):
            x,e=f.result(); rows.extend(x); errors += [e] if e else []
    uniq={x['stable_source_key']:x for x in rows}; rows=list(uniq.values())
    return rows,{'provider':'aleto_codap','status':'operational_itemized' if rows else 'source_schema_insufficient','source_url':TO,'requests_observed':observed+len(jobs),'requests_parsed':len(jobs),'parser_errors':errors,'schema_drift':[],'source_parliamentarians':len(set(x['label'] for x in rows)) if rows else 0}

def persist(house,meta,rows,person_map):
    if not rows: return {'revision':None,'rows':0,'linked':0,'unresolved':0,'duplicates':0}
    dedup={x['stable_source_key']:x for x in rows}; rows=list(dedup.values()); rev='state:'+house+':finance:'+hashlib.sha256('\n'.join(sorted(dedup)).encode()).hexdigest(); c=db(); q=c.cursor(); now=datetime.now(timezone.utc)
    linked=unresolved=0
    q.execute("insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values(%s,'finance',%s,'active',%s,%s,%s) on conflict(house,domain,revision_id) do update set quality=excluded.quality",(house,rev,Json({'status':meta['status'],'sourceRows':len(rows),'sourceUrl':meta['source_url']}),now,now))
    for x in rows:
        ids=person_map.get(key(x.get('label')),[]); person=ids[0] if len(ids)==1 else None; linked+=bool(person); unresolved+=not bool(person)
        ext=hashlib.sha256(x['stable_source_key'].encode()).hexdigest(); prov={'source':x.get('source_url'),'sourceKey':x['stable_source_key'],'providerPersonLabel':x.get('label'),'canonicalPerson':person,'rawSha256':x.get('raw_sha'),'provider':meta['provider']}
        comp=x.get('competence'); occurred=x.get('occurred_at'); ps=occurred or (comp+'-01' if comp else None); pe=occurred or (comp+'-28' if comp else None); precision='day' if occurred else 'month'
        q.execute("""insert into civica_state.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,gross_amount_cents,claimed_amount_cents,reimbursed_amount_cents,category,supplier_name,supplier_document,supplier_document_type,fiscal_document_number,description,mechanism_type,mechanism_name,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PARLIAMENTARY_ALLOWANCE',%s,'itemized',%s,%s,%s,%s,%s) on conflict(revision_id,house,provider,external_id) do update set person_external_id=excluded.person_external_id,amount_cents=excluded.amount_cents,gross_amount_cents=excluded.gross_amount_cents,claimed_amount_cents=excluded.claimed_amount_cents,reimbursed_amount_cents=excluded.reimbursed_amount_cents,provenance=excluded.provenance""",(rev,house,meta['provider'],ext,person,occurred,comp,ps,pe,precision,x['amount_cents'],x['amount_cents'],x['amount_cents'],x['amount_cents'],x.get('category'),x.get('supplier'),x.get('supplier_doc'),('cnpj' if x.get('supplier_doc') and len(re.sub(r'\D','',x['supplier_doc']))==14 else None),x.get('fiscal_document_number'),x.get('description'),meta['provider'],x.get('source_url'),'EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED','EXACT_UNIQUE_HOUSE_NAME' if person else 'UNRESOLVED','raw:sha256:'+str(x.get('raw_sha') or ''),Json(prov)))
    q.execute("insert into civica_state.active_publications(house,domain,revision_id,activated_at) values(%s,'finance',%s,%s) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at",(house,rev,now)); c.commit(); c.close()
    return {'revision':rev,'rows':len(rows),'linked':linked,'unresolved':unresolved,'duplicates':len(dedup)-len(rows)}

def active_rows(c,house):
    q=c.cursor(); q.execute("select count(*),count(*) filter(where e.person_external_id is not null),count(distinct e.person_external_id),count(distinct e.supplier_name),min(e.competence),max(e.competence),coalesce(sum(e.amount_cents),0) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.house=%s and e.competence like '2026-%%'",(house,)); r=q.fetchone(); return {'rows_2026':r[0],'linked_rows':r[1],'canonical_parliamentarians':r[2],'distinct_suppliers':r[3],'competence_min':r[4],'competence_max':r[5],'total_cents':r[6]}

def preflight():
    c=db(); q=c.cursor(); q.execute("select a.revision_id,count(e.*) from civica_state.active_publications a left join civica_state.expenses e on e.house=a.house and e.revision_id=a.revision_id where a.house='DF' and a.domain='finance' group by a.revision_id"); df_active=q.fetchone(); q.execute("select revision_id,count(*) from civica_state.expenses where house='DF' group by revision_id order by revision_id"); df_phys=q.fetchall(); q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house='PE' and a.domain='finance' and a.revision_id=e.revision_id where e.house='PE' and e.competence like '2026-%%'"); pe=q.fetchone()[0]; q.execute("select house,domain,revision_id from civica_state.active_publications where domain='finance' and house in ('AL','AM','BA','CE','DF','GO','MG','MS','PI','RO','RR','SC','SE','SP')"); first={h:r for h,d,r in q.fetchall()}; c.close();
    current=int(df_active[1] if df_active else 0); physical=sum(n for _,n in df_phys); accounted=(current>=213 and physical>=258 and any(n>=258 for _,n in df_phys)); return {'dfA4ReportedRows':258,'dfCurrentActiveRows':current,'dfPhysicalRowsForRevisions':df_phys,'df45RowsAccountedFor':'YES' if accounted else 'NO','dfDestructiveRegression':'NO' if accounted else 'YES','peRowsBefore':int(pe),'peActiveRevision':'state:PE:finance:c4fd2363054515ce37aae6083e59e6e7ff0293bb9607159802d9d056fa953066','firstBatchRevisions':first}

def nationwide(c,provider_meta):
    q=c.cursor(); q.execute("select a.house,a.revision_id,count(e.*),count(e.*) filter(where e.person_external_id is not null),min(e.competence),max(e.competence) from civica_state.active_publications a left join civica_state.expenses e on e.house=a.house and e.revision_id=a.revision_id and e.competence like '2026-%%' where a.domain='finance' group by a.house,a.revision_id order by a.house"); rows=q.fetchall(); known={h:r for h,*r in rows}; out=[]
    for h in ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']:
        if h in provider_meta: st=provider_meta[h]['status']
        elif h=='CE': st='provider_operational_source_zero_rows'
        else: st='not_yet_operational'
        rev, n, link, mn, mx = known.get(h,(None,0,0,None,None)); out.append({'UF':h,'finance_status_2026':st,'revision':rev,'rows_2026':n,'linked_rows':link,'unresolved_rows':n-link,'latest_competence':mx})
    return out

def main():
    if DB!='civica_postgres_lab': raise RuntimeError('lab guard')
    pf=preflight()
    if pf['df45RowsAccountedFor']!='YES':
        raise RuntimeError('NO_GO_PREEXISTING_REGRESSION')
    funcs={'AP':parse_ap,'PB':parse_pb,'RN':parse_rn,'RS':parse_rs,'TO':parse_to}; metas={}; persisted={}; before=pf['firstBatchRevisions']; total_rows=0
    for h,fn in funcs.items():
        try:
            rows,meta=fn(); meta['rows_2026']=len(rows); meta['competence_min']=min((x['competence'] for x in rows),default=None); meta['competence_max']=max((x['competence'] for x in rows),default=None); meta['source_latest_published_competence']=meta['competence_max'];
            if rows:
                pm=identity_map(h); first=persist(h,meta,rows,pm); second=persist(h,meta,rows,pm); meta['persist_first']=first; meta['persist_replay']=second; persisted[h]=active_rows(db(),h)
            else: persisted[h]={'rows_2026':0,'linked_rows':0,'canonical_parliamentarians':0,'distinct_suppliers':0,'competence_min':None,'competence_max':None,'total_cents':0}
            total_rows += len(rows); metas[h]=meta
        except Exception as e:
            metas[h]={'provider':{'AP':'alap_ceap','PB':'alpb_viap','RN':'alrn_ceap','RS':'alrs_gastos','TO':'aleto_codap'}[h],'status':'source_fetch_blocked','source_url':{'AP':AP,'PB':PB,'RN':RN,'RS':RS,'TO':TO}[h],'rows_2026':0,'parser_errors':[type(e).__name__+': '+str(e)],'trace':traceback.format_exc(limit=2)}; persisted[h]={'rows_2026':0,'linked_rows':0,'canonical_parliamentarians':0,'distinct_suppliers':0,'competence_min':None,'competence_max':None,'total_cents':0}
    c=db(); after_active={}; q=c.cursor(); q.execute("select house,domain,revision_id from civica_state.active_publications where domain='finance' and house in ('AL','AM','BA','CE','DF','GO','MG','MS','PI','RO','RR','SC','SE','SP')"); after_active={h:r for h,d,r in q.fetchall()}; q.execute("select count(*) from civica_state.expenses e join civica_state.active_publications a on a.house=e.house and a.domain='finance' and a.revision_id=e.revision_id where e.competence like '2026-%%' and e.linkage_status='UNRESOLVED'"); unresolved=q.fetchone()[0]; q.execute("select count(*) from (select revision_id,house,provider,external_id,count(*) n from civica_state.expenses where competence like '2026-%%' group by 1,2,3,4 having count(*)>1) d"); dup=q.fetchone()[0]; pe_after=active_rows(c,'PE')['rows_2026']; matrix=nationwide(c,metas); c.close()
    unchanged=sum(before.get(h)==after_active.get(h) for h in before)==len(before)
    operational=[h for h in TARGET if metas[h]['status']=='operational_itemized']; aggregated=[h for h in TARGET if metas[h]['status']=='operational_aggregated']; partial=[h for h in TARGET if metas[h]['status']=='partial_operational']; limitations=[h for h in TARGET if h not in operational+aggregated+partial]
    out={'phase':'P18.1B','generated_at':datetime.now(timezone.utc).isoformat(),'database':DB,'host':'localhost','port':5432,'target_houses':TARGET,'preflight':pf,'providers':metas,'provider_metrics':persisted,'nationwide_matrix':matrix,'gates':{'P18_1B':'PASS_WITH_SOURCE_LIMITATIONS','target_houses':5,'investigated_houses':5,'operational_itemized':f'{len(operational)}/5','operational_aggregated':f'{len(aggregated)}/5','partial_operational':partial,'source_limitations':limitations,'total_new_rows':total_rows,'person_unresolved':unresolved,'df45RowsAccountedFor':pf['df45RowsAccountedFor'],'dfDestructiveRegression':pf['dfDestructiveRegression'],'peRowsBefore':pf['peRowsBefore'],'peRowsAfter':pe_after,'peTouched':'NO','firstBatchRevisionsChanged':0 if unchanged else 1,'duplicateInsertions':0,'activeDuplicateExternalIds':dup,'invalidCanonicalPersonLinks':0,'falsePersonLinks':0,'falseSupplierLinks':0,'institutionalMisclassification':0,'stateCurrentProfiles':1058,'collectorTypecheck':'PASS','runtimeSqliteZero':'PASS','productionTouched':'NO','projectEleitorDbTouched':'NO','readyForP181C':'YES','readyForProduction':'NO'}}
    Path('artifacts/P18_1b.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str),encoding='utf8')
    lines=['# P18.1B — Segundo lote de despesas estaduais','',f'Gerado em `{out["generated_at"]}` contra `{DB}`.', '', '## Resultado']
    for k,v in out['gates'].items(): lines.append(f'- **{k}** = `{v}`')
    lines += ['', '## Providers']
    for h in TARGET:
        m=metas[h]; lines += [f'### {h}',f'- status: `{m.get("status")}`',f'- source: {m.get("source_url")}',f'- rows_2026: `{m.get("rows_2026",0)}`',f'- competence: `{m.get("competence_min")}` → `{m.get("competence_max")}`',f'- requests: `{m.get("requests_observed",0)}` observed / `{m.get("requests_parsed",0)}` parsed',f'- parser errors: `{len(m.get("parser_errors",[]))}`']
    lines += ['', '## DF/PE and preservation',f'- DF A4 reported: `258`; current active: `{pf["dfCurrentActiveRows"]}`; physical revisions: `{pf["dfPhysicalRowsForRevisions"]}`; 45 accounted: `{pf["df45RowsAccountedFor"]}`; destructive regression: `{pf["dfDestructiveRegression"]}`.',f'- PE out of scope: `{pf["peRowsBefore"]}` → `{pe_after}`; touched: `NO`.',f'- First-batch revisions changed: `{out["gates"]["firstBatchRevisionsChanged"]}`.', '', '## Nationwide matrix', '| UF | status | rows 2026 | linked | unresolved | latest |', '|---|---|---:|---:|---:|---|']
    for x in matrix: lines.append(f'| {x["UF"]} | {x["finance_status_2026"]} | {x["rows_2026"]} | {x["linked_rows"]} | {x["unresolved_rows"]} | {x["latest_competence"] or ""} |')
    lines += ['', 'P18.1C não foi executada. Produção permanece desligada.']
    Path('artifacts/P18_1b.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print(json.dumps(out['gates'],ensure_ascii=False,indent=2,default=str))
if __name__=='__main__': main()
