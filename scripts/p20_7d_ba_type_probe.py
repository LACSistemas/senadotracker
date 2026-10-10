import concurrent.futures, json, re, requests
from bs4 import BeautifulSoup
from pathlib import Path
s=BeautifulSoup(Path('artifacts/P20_7D_BA_consulta-tipo.aspx').read_text(encoding='utf-8',errors='ignore'),'html.parser')
links={}
for a in s.find_all('a',href=True):
 m=re.search(r'consulta-producao\.aspx\?tipo=([^&]+)&ano_proposicao=2026',a['href'])
 if m: links[m.group(1)]=a['href']
base='https://albalegis.nopapercloud.com.br/spl/'
def one(kv):
 k,h=kv;u=base+h
 try:
  t=requests.get(u,timeout=60).text;Path('artifacts').joinpath(f'P20_7D_BA_type_{k}.html').write_text(t,encoding='utf-8');so=BeautifulSoup(t,'html.parser');m=re.search(r'(\d+)\s+proposi',so.get_text(' ',strip=True),re.I);return {'type_id':k,'url':u,'status':200,'bytes':len(t),'file':f'artifacts/P20_7D_BA_type_{k}.html','announced':int(m.group(1)) if m else None,'ids':sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',t))),'pagination':'lbNext' in t}
 except Exception as e:return {'type_id':k,'url':u,'status':'error','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: out=list(ex.map(one,links.items()))
Path('artifacts/P20_7D_BA_type_partitions.json').write_text(json.dumps({'year':2026,'partitions':out},ensure_ascii=False,indent=2),encoding='utf-8')
print('types',len(links),'sum',sum(x.get('announced') or 0 for x in out),'distinct',len(set(i for x in out for i in x.get('ids',[]))))
for x in out: print(x['type_id'],x.get('announced'),len(x.get('ids',[])),x.get('pagination'))
