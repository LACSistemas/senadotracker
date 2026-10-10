import requests,re,json,hashlib,concurrent.futures,sys
from bs4 import BeautifulSoup
base='https://elegis.al.ap.leg.br/portal/proposicoes'
lo=int(sys.argv[1]) if len(sys.argv)>1 else 1;hi=int(sys.argv[2]) if len(sys.argv)>2 else 50
def one(p):
 try:
  r=requests.get(base,params={'page':p,'ano':'2026'},timeout=20);s=BeautifulSoup(r.content,'html.parser');t=s.find('table');rows=[]
  for tr in (t.find_all('tr')[1:] if t else []):
   cells=tr.find_all('td');a=tr.find('a',href=re.compile('/proposicao/'))
   if len(cells)>=4 and a:
    x=[c.get_text(' ',strip=True) for c in cells];rows.append({'source_id':a['href'].rstrip('/').split('/')[-1],'date':x[0],'number':x[1],'author':x[2],'summary':x[3],'url':a['href']})
  return {'page':p,'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'rows':rows}
 except Exception as e:return {'page':p,'status':0,'rows':[],'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(12) as ex:out=list(ex.map(one,range(lo,hi+1)))
json.dump(out,open(f'artifacts/p20_5_AP_{lo}_{hi}.json','w',encoding='utf8'),ensure_ascii=False);print(lo,hi,sum(len(x['rows']) for x in out),sum(x['status']==200 for x in out))

