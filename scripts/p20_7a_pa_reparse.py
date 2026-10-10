import json,re,html,hashlib
from pathlib import Path
from bs4 import BeautifulSoup
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'))
rows=[];pages=[]
for p in x['pages']:
 b=p['body'];s=BeautifulSoup(b,'html.parser'); page_rows=[]
 for c in s.select('div.card-proposicao'):
  onclick=c.get('onclick','');m=re.search(r'IdProposicao=(\d+)',onclick)
  if not m:continue
  sid=m.group(1); label=' '.join(c.select_one('span').get_text(' ',strip=True).split()) if c.select_one('span') else ''
  author=' '.join(c.select_one('h3').get_text(' ',strip=True).split()) if c.select_one('h3') else ''
  summary=' '.join(c.select_one('p').get_text(' ',strip=True).split()) if c.select_one('p') else ''
  mm=re.search(r'^(.+?)\s+N[^0-9]*([0-9]+)/(\d{4})(?:,\s*DE\s*([0-9/]+))?',label,re.I)
  page_rows.append({'source_id':sid,'title':label,'summary':summary,'type':mm.group(1).strip() if mm else None,'number':mm.group(2) if mm else None,'year':int(mm.group(3)) if mm else 2026,'date':mm.group(4) if mm else None,'authors':[{'name':author,'sourceAuthorId':None}] if author else [],'officialUrl':'https://www.alepa.pa.gov.br'+re.search(r'&quot;([^&]+DetalhesProposicao[^&]+)&quot;',onclick).group(1) if re.search(r'&quot;([^&]+DetalhesProposicao[^&]+)&quot;',onclick) else 'https://www.alepa.pa.gov.br/Legislativo/DetalhesProposicao?IdProposicao='+sid})
 rows+=page_rows;pages.append({**p,'rowCount':len(page_rows)})
by={};dup=[]
for r in rows:
 if r['source_id'] in by:dup.append(r['source_id'])
 else:by[r['source_id']]=r
rows=list(by.values())
out={k:x[k] for k in ['house','provider','year','contract','pageCount','pagesFetched','collectedAt'] if k in x};out.update({'provider':'alepa_devexpress_browser','sourceRows':len(rows)+len(dup),'distinctIds':len(rows),'duplicateIds':sorted(set(dup)),'authorshipRows':sum(len(r['authors']) for r in rows),'rows':rows,'pages':pages})
open('artifacts/P20_7A_PA_corpus.json','w',encoding='utf8').write(json.dumps(out,ensure_ascii=False))
print({k:out[k] for k in ['pageCount','pagesFetched','sourceRows','distinctIds','duplicateIds','authorshipRows']});print(rows[0])

