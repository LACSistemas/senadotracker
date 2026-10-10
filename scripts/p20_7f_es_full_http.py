import concurrent.futures,requests,re,json,time,hashlib,sys
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

def collect(root):
 base='https://www3.al.es.gov.br/spl/';typ=root['type_id'];u=f'{base}consulta-producao.aspx?tipo={typ}&ano_proposicao=2026';sess=requests.Session();sess.headers['User-Agent']='Mozilla/5.0 (Civica P20.7F)';d={};ids=set();pages=[]
 try:
  r=sess.get(u,timeout=180);d=fields(r.text);m=re.search(r'(\d+)\s+proposi',BeautifulSoup(r.text,'html.parser').get_text(' ',strip=True),re.I);ann=int(m.group(1)) if m else root.get('announced',0);page=1
  rawdir=Path('artifacts/P20_7F_ES_full_pages');rawdir.mkdir(exist_ok=True)
  while True:
   (rawdir/f'{typ}_{page}.html').write_bytes(r.content);now=sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',r.text)));ids.update(now);pages.append({'page':page,'rawPath':str(rawdir/f'{typ}_{page}.html'),'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'ids':now})
   if len(ids)>=ann:break
   d=fields(r.text) if '|updatePanel|' not in r.text else d
   for n,v in re.findall(r'hiddenField\|([^|]+)\|([^|]*)',r.text):d[n]=v
   d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$lbNext';d['__EVENTARGUMENT']='';d['ctl00$scm_principal']='ctl00$ContentPlaceHolder1$upp_consultaProducao|ctl00$ContentPlaceHolder1$lbNext';r=sess.post(u,data=d,headers={'X-Requested-With':'XMLHttpRequest','X-MicrosoftAjax':'Delta=true','Referer':u,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0'},timeout=180);page+=1
   if page>ann+5:break
  return {'type_id':typ,'announced':ann,'pagesFetched':len(pages),'sourceRows':sum(len(x['ids']) for x in pages),'distinctIds':len(ids),'complete':len(ids)>=ann,'pages':pages}
 except Exception as e:return {'type_id':typ,'announced':root.get('announced'),'pagesFetched':len(pages),'sourceRows':sum(len(x['ids']) for x in pages),'distinctIds':len(ids),'complete':False,'pages':pages,'error':str(e)}
roots=json.loads(Path('artifacts/P20_7D_ES_type_partitions.json').read_text())['partitions'];out={'house':'ES','year':2026,'strategy':'browser-discovered async UpdatePanel postback replay','types':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ')}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for row in ex.map(collect,roots):out['types'].append(row);Path('artifacts/P20_7F_ES_full_http_checkpoint.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(row['type_id'],row['distinctIds'],'/',row['announced'],row['complete'],flush=True)
out['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ');Path('artifacts/P20_7F_collection_ES.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('DONE',len(out['types']),sum(x['distinctIds'] for x in out['types']))
