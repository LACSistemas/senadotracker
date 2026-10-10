import requests,re,concurrent.futures,json,hashlib
from bs4 import BeautifulSoup
from urllib.parse import urlparse,parse_qs,urljoin
base='https://www3.al.es.gov.br/spl/'
s=BeautifulSoup(open('artifacts/P20_7D_ES_consulta-tipo.aspx','rb').read(),'html.parser')
parts=[]
for a in s.find_all('a',href=True):
 q=parse_qs(urlparse(a['href']).query)
 if q.get('ano_proposicao')==['2026'] and q.get('tipo'):
  if q['tipo'][0] not in [p['type_id'] for p in parts]: parts.append({'type_id':q['tipo'][0],'url':urljoin(base,a['href'])})

def fetch(p):
 try:
  r=requests.get(p['url'],timeout=90); p['status']=r.status_code;p['bytes']=len(r.content);p['html']=r.content;return p
 except Exception as e:p['error']=str(e);return p
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: res=list(ex.map(fetch,parts))
for p in res:
 if 'html' not in p:continue
 soup=BeautifulSoup(p['html'],'html.parser'); p['file']=f"artifacts/P20_7D_ES_type_{p['type_id']}.html";open(p['file'],'wb').write(p['html']); text=' '.join(soup.get_text(' ',strip=True).split()); p['rows']=len(soup.select('a[href*="processo.aspx?id="]')); p['announced']=None
 m=re.search(r'(\d[\d.]*)\s+proposi',text,re.I); p['announced']=int(m.group(1).replace('.','')) if m else None;p['pagination']=bool(soup.select_one('#ContentPlaceHolder1_lbNext')) or ('página' in text.lower() and p['rows']>10);p['ids']=list(dict.fromkeys(re.findall(r'processo\.aspx\?id=(\d+)',str(soup))));p.pop('html',None)
print(json.dumps(res,ensure_ascii=False,indent=2))
json.dump({'source':'ALES consulta-tipo','year':2026,'partitions':res},open('artifacts/P20_7D_ES_type_partitions.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
