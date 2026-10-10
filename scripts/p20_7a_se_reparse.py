import hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup
RAW_DIR=Path('artifacts/P20_7A_SE_pages'); OUT=Path('artifacts/P20_7A_SE_corpus.json')
def clean(t): return re.sub(r'\s+',' ',t or '').strip()
def total(s):
 t=clean(s.get_text(' ',strip=True)); m=re.search(r'Localizada\(s\)\s*([0-9.]+)\s+proposi',t,re.I); return int(m.group(1).replace('.','')) if m else None
def card(c):
 title=c.select_one('a.kt-widget5__title'); desc=c.select_one('a.kt-widget5__desc'); href=title.get('href','') if title else ''; mm=re.search(r'[?&]id=(\d+)',href); sid=mm.group(1) if mm else None
 vals={}; info=c.select_one('div.kt-widget5__info')
 if info:
  raw=clean(info.get_text(' ',strip=True))
  for k,p in {'process':r'Processo\s+N[^:]*:\s*([^\s]+)','protocol':r'Protocolo\s+N[^:]*:\s*([^\s]+)','id':r'ID:\s*(\d+)','date':r'Data:\s*([0-9/: ]+?)(?=Situa|$)','status':r'Situa[^:]*:\s*(.*?)(?=Atividade Atual:|$)','activity':r'Atividade Atual:\s*(.*)$'}.items():
   x=re.search(p,raw,re.I)
   if x: vals[k]=clean(x.group(1))
 authors=[]
 for a in c.select('div.kt-widget5__info a[href*="consulta-producao.aspx?autor="]'):
  name=clean(a.get_text(' ',strip=True)); hm=re.search(r'[?&]autor=([^&]+)',a.get('href',''))
  if name: authors.append({'name':name,'sourceAuthorId':hm.group(1) if hm else None})
 return {'source_id':sid,'title':clean(title.get_text(' ',strip=True)) if title else None,'summary':clean(desc.get_text(' ',strip=True)) if desc else None,'process_number':vals.get('process'),'protocol_number':vals.get('protocol'),'date':vals.get('date'),'status_raw':vals.get('status'),'current_activity_raw':vals.get('activity'),'authors':authors,'url':'https://aleselegis.al.se.leg.br/'+href.lstrip('./')}
allrows=[]; ev=[]
for f in sorted(RAW_DIR.glob('*.html')):
 b=f.read_bytes(); s=BeautifulSoup(b.decode('utf-8','replace'),'html.parser'); rs=[card(c) for c in s.select('div.kt-widget5__content.consulta--listagem')]; rs=[r for r in rs if r['source_id']]; allrows+=rs; ev.append({'page':int(f.stem),'status':200,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'url':'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026','rawPath':str(f)})
by={}; dup=[]
for r in allrows:
 if r['source_id'] in by: dup.append(r['source_id'])
 else: by[r['source_id']]=r
rows=list(by.values()); result={'house':'SE','provider':'alese_spl','contract':'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026','year':2026,'source_total_announced':total(BeautifulSoup((RAW_DIR/'001.html').read_bytes().decode('utf-8','replace'),'html.parser')),'pages_fetched':len(ev),'source_rows':len(allrows),'distinct_ids':len(rows),'duplicate_ids':sorted(set(dup)),'rows':rows,'page_evidence':ev,'collected_at':datetime.now(timezone.utc).isoformat()}
OUT.write_text(json.dumps(result,ensure_ascii=False),encoding='utf8');print({k:result[k] for k in ['source_total_announced','pages_fetched','source_rows','distinct_ids','duplicate_ids']});print(rows[0]);print('authors',sum(len(r['authors']) for r in rows),'noauthors',sum(not r['authors'] for r in rows))

