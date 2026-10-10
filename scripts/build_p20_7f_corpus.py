import json,re,hashlib
from pathlib import Path
from bs4 import BeautifulSoup

def clean(t): return re.sub(r'\s+',' ',t or '').strip()
def parse_card(card):
 title=card.select_one('a.kt-widget5__title'); desc=card.select_one('a.kt-widget5__desc'); href=title.get('href','') if title else ''
 mm=re.search(r'[?&]id=(\d+)',href); sid=mm.group(1) if mm else None
 vals={}; info=card.select_one('div.kt-widget5__info')
 if info:
  raw=clean(info.get_text(' ',strip=True)); pats={'process':r'Processo\s+N[^:]*:\s*([^\s]+)','protocol':r'Protocolo\s+N[^:]*:\s*([^\s]+)','id':r'ID:\s*(\d+)','date':r'Data:\s*([0-9/: ]+?)(?=Situa|$)','status':r'Situa[^:]*:\s*(.*?)(?=Atividade Atual:|$)','activity':r'Atividade Atual:\s*(.*)$'}
  for k,p in pats.items():
   x=re.search(p,raw,re.I)
   if x: vals[k]=clean(x.group(1))
 authors=[]
 for a in card.select('div.kt-widget5__info a[href*="autor="]'):
  n=clean(a.get_text(' ',strip=True)); hm=re.search(r'[?&]autor=([^&]+)',a.get('href',''))
  if n: authors.append({'name':n,'sourceAuthorId':hm.group(1) if hm else None})
 return {'source_id':sid,'title':clean(title.get_text(' ',strip=True)) if title else None,'summary':clean(desc.get_text(' ',strip=True)) if desc else None,'process_number':vals.get('process'),'protocol_number':vals.get('protocol'),'date':vals.get('date'),'status_raw':vals.get('status'),'current_activity_raw':vals.get('activity'),'authors':authors,'url':'https://aleselegis.al.se.leg.br/'+href.lstrip('./')}
for house in ['ES','BA']:
 c=json.load(open(f'artifacts/P20_7F_collection_{house}.json')); allrows=[]; ev=[]
 for t in c['types']:
  for p in t['pages']:
   path=Path(p['rawPath']); body=path.read_bytes(); soup=BeautifulSoup(body,'html.parser',from_encoding='utf-8')
   allrows.extend([x for x in (parse_card(z) for z in soup.select('div.kt-widget5__content.consulta--listagem')) if x['source_id']])
   ev.append({'page':len(ev)+1,'type_id':t['type_id'],'type_page':p['page'],'status':p.get('status',200),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'url':p.get('url'), 'rawPath':str(path)})
 seen={}; dups=[]
 for x in allrows:
  if x['source_id'] in seen: dups.append(x['source_id'])
  else: seen[x['source_id']]=x
 rows=list(seen.values())
 out={'house':house,'provider':'ales_spl' if house=='ES' else 'alba_spl','contract': 'https://www3.al.es.gov.br/spl/consulta-producao.aspx?ano=2026' if house=='ES' else 'https://albalegis.nopapercloud.com.br/spl/consulta-producao.aspx','year':2026,'source_total_announced':sum((t.get('announced') or 0) for t in c['types']),'pages_fetched':len(ev),'source_rows':len(allrows),'distinct_ids':len(rows),'duplicate_ids':sorted(set(dups)),'rows':rows,'page_evidence':ev,'collected_at':c.get('finishedAt')}
 Path(f'artifacts/P20_7F_{house}_corpus.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
 print(house, out['source_total_announced'],out['source_rows'],out['distinct_ids'],len(out['duplicate_ids']),sum(len(x['authors']) for x in rows),flush=True)
