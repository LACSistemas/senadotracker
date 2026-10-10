import json,re,hashlib
from pathlib import Path
from bs4 import BeautifulSoup
def clean(x): return re.sub(r'\s+',' ',x or '').strip()
def card(c):
 t=c.select_one('a.kt-widget5__title'); d=c.select_one('a.kt-widget5__desc'); h=t.get('href','') if t else ''; m=re.search(r'[?&]id=(\d+)',h)
 if not m:return None
 raw=clean((c.select_one('div.kt-widget5__info') or c).get_text(' ',strip=True)); vals={}
 for k,p in {'process':r'Processo\s+N[^:]*:\s*([^\s]+)','protocol':r'Protocolo\s+N[^:]*:\s*([^\s]+)','date':r'Data:\s*([0-9/: ]+?)(?=Situa|$)','status':r'Situa[^:]*:\s*(.*?)(?=Atividade Atual:|$)','activity':r'Atividade Atual:\s*(.*)$'}.items():
  q=re.search(p,raw,re.I)
  if q: vals[k]=clean(q.group(1))
 aa=[]
 for a in c.select('a[href*="consulta-producao.aspx?autor="]'):
  n=clean(a.get_text(' ',strip=True)); q=re.search(r'[?&]autor=([^&]+)',a.get('href',''))
  if n: aa.append({'name':n,'sourceAuthorId':q.group(1) if q else None})
 return {'source_id':m.group(1),'title':clean(t.get_text(' ',strip=True)),'summary':clean(d.get_text(' ',strip=True)) if d else None,'process_number':vals.get('process'),'protocol_number':vals.get('protocol'),'date':vals.get('date'),'status_raw':vals.get('status'),'current_activity_raw':vals.get('activity'),'authors':aa,'url':'https://www3.al.es.gov.br/spl/'+h.lstrip('./')}
parts=json.loads(Path('artifacts/P20_7D_ES_type_partitions.json').read_text())['partitions']; rows=[]; ev=[]
for p in parts:
 body=Path(p['file']).read_text(encoding='utf-8',errors='ignore'); s=BeautifulSoup(body,'html.parser'); rs=[card(c) for c in s.select('div.kt-widget5__content.consulta--listagem')]; rs=[r for r in rs if r]
 rows.extend(rs); ev.append({'partition':p['type_id'],'url':p['url'],'rawPath':p['file'],'status':p['status'],'bytes':p['bytes'],'sha256':hashlib.sha256(Path(p['file']).read_bytes()).hexdigest(),'announced':p.get('announced'),'observedRows':len(rs),'distinctIds':len({r['source_id'] for r in rs}),'enumerationComplete':False})
by={};dups=[]
for r in rows:
 if r['source_id'] in by: dups.append(r['source_id'])
 else: by[r['source_id']]=r
out={'house':'ES','provider':'ales_spl','contract':'https://www3.al.es.gov.br/spl/consulta-producao.aspx?ano=2026','year':2026,'source_total_announced':sum(p.get('announced') or 0 for p in parts),'partitions_total':len(parts),'partitions_complete':0,'partitions_incomplete':len(parts),'source_rows_observed':len(rows),'distinct_ids':len(by),'duplicate_observations':len(dups),'duplicate_ids':sorted(set(dups)),'rows':list(by.values()),'page_evidence':ev,'coverage_complete':False,'missing_boundary':['each type partition has additional official pages beyond first observed page'],'collected_at':'2026-10-08T00:00:00Z'}
Path('artifacts/P20_7D_ES_corpus.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps({k:out[k] for k in ['source_total_announced','partitions_total','source_rows_observed','distinct_ids','duplicate_observations']}))
