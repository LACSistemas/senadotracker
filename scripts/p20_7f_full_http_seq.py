import json,re,requests,time,hashlib,sys
from bs4 import BeautifulSoup
from pathlib import Path

def fields(html):
 s=BeautifulSoup(html,'html.parser');d={}
 for x in s.select('form input,form select,form textarea'):
  n=x.get('name');
  if not n:continue
  if x.name=='select':o=x.find('option',selected=True) or x.find('option');d[n]=o.get('value','') if o else ''
  elif x.get('type') in (None,'hidden','text'):d[n]=x.get('value','')
 return d

def collect(h,root):
 base='https://www3.al.es.gov.br/spl/' if h=='ES' else 'https://albalegis.nopapercloud.com.br/spl/';typ=root['type_id'];u=f'{base}consulta-producao.aspx?tipo={typ}&ano_proposicao=2026';s=requests.Session();s.headers['User-Agent']='Mozilla/5.0 (Civica P20.7F)';r=s.get(u,timeout=180);d=fields(r.text);m=re.search(r'(\d+)\s+proposi',BeautifulSoup(r.text,'html.parser').get_text(' ',strip=True),re.I);ann=int(m.group(1)) if m else root.get('announced',0);ids=set();pages=[];page=1;rawdir=Path(f'artifacts/P20_7F_{h}_full_pages');rawdir.mkdir(exist_ok=True)
 while True:
  rawdir.joinpath(f'{typ}_{page}.html').write_bytes(r.content);now=sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',r.text)));new=set(now)-ids;ids.update(now);pages.append({'page':page,'rawPath':str(rawdir/f'{typ}_{page}.html'),'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'ids':now,'newIds':len(new)});print(h,typ,page,len(new),len(ids),'/',ann,flush=True)
  if len(ids)>=ann:break
  if page>ann+20:break
  for n,v in re.findall(r'hiddenField\|([^|]+)\|([^|]*)',r.text):d[n]=v
  d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$lbNext';d['__EVENTARGUMENT']='';d['ctl00$scm_principal']='ctl00$ContentPlaceHolder1$upp_consultaProducao|ctl00$ContentPlaceHolder1$lbNext';
  try:r=s.post(u,data=d,headers={'X-Requested-With':'XMLHttpRequest','X-MicrosoftAjax':'Delta=true','Referer':u,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0'},timeout=180)
  except Exception as e:return {'type_id':typ,'announced':ann,'pagesFetched':len(pages),'sourceRows':sum(len(x['ids']) for x in pages),'distinctIds':len(ids),'complete':False,'pages':pages,'error':str(e)}
  page+=1
 return {'type_id':typ,'announced':ann,'pagesFetched':len(pages),'sourceRows':sum(len(x['ids']) for x in pages),'distinctIds':len(ids),'complete':len(ids)>=ann,'pages':pages}

h=sys.argv[1]; roots=json.loads(Path(f'artifacts/P20_7D_{h}_type_partitions.json').read_text())['partitions'];out={'house':h,'year':2026,'strategy':'browser-proven ASP.NET async UpdatePanel postback replay','types':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ')}; cp=Path(f'artifacts/P20_7F_collection_{h}_checkpoint.json')
for root in roots:
 if any(x['type_id']==root['type_id'] for x in out['types']):continue
 x=collect(h,root);out['types'].append(x);cp.write_text(json.dumps(out,ensure_ascii=False,indent=2));
out['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ');Path(f'artifacts/P20_7F_collection_{h}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('DONE',h,sum(x['distinctIds'] for x in out['types']),sum(x['complete'] for x in out['types']))
