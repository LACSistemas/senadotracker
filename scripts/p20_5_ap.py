import requests,re,json,hashlib,concurrent.futures
from bs4 import BeautifulSoup
base='https://elegis.al.ap.leg.br/portal/proposicoes';
def one(p):
 r=requests.get(base,params={'page':p,'ano':'2026'},timeout=30,headers={'User-Agent':'Civica-P20.5/1.0'}); s=BeautifulSoup(r.content,'html.parser'); t=s.find('table'); rows=[]
 for tr in (t.find_all('tr')[1:] if t else []):
  cells=tr.find_all('td'); a=tr.find('a',href=re.compile('/proposicao/'))
  if len(cells)>=4 and a:
   x=[c.get_text(' ',strip=True) for c in cells]; rows.append({'source_id':a['href'].rstrip('/').split('/')[-1],'date':x[0],'number':x[1],'author':x[2],'summary':x[3],'url':a['href']})
 return {'page':p,'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'rows':rows}
with concurrent.futures.ThreadPoolExecutor(12) as ex: pages=list(ex.map(one,range(1,151)))
rows=[x for p in pages for x in p['rows']]; uniq={x['source_id']:x for x in rows};
json.dump({'house':'AP','provider':'elegis_alap','pages':[{'page':x['page'],'status':x['status'],'bytes':x['bytes'],'sha256':x['sha256'],'rows':len(x['rows'])} for x in pages],'rows':list(uniq.values())},open('artifacts/p20_5_AP_raw.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('TOTAL',len(rows),'DISTINCT',len(uniq),'NONEMPTY_PAGES',sum(bool(x['rows']) for x in pages),'LAST_NONEMPTY',max(x['page'] for x in pages if x['rows']))
