import requests,re,json,time,hashlib,sys
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

def delta_hidden(text,d):
 for name,val in re.findall(r'hiddenField\|([^|]+)\|([^|]*)',text):d[name]=val

def collect(base,typ,limit=None):
 u=f'{base}consulta-producao.aspx?tipo={typ}&ano_proposicao=2026';sess=requests.Session();sess.headers['User-Agent']='Mozilla/5.0 (Civica P20.7F)';r=sess.get(u,timeout=120);d=fields(r.text);ann=int(re.search(r'(\d+)\s+proposi',BeautifulSoup(r.text,'html.parser').get_text(' ',strip=True),re.I).group(1));ids=set();pages=[];page=1
 while True:
  ids_now=sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',r.text)));ids.update(ids_now);pages.append({'page':page,'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'ids':ids_now});print(typ,page,len(ids_now),len(ids),ann,flush=True)
  if len(ids)>=ann or (limit and page>=limit):break
  d=fields(r.text) if '|updatePanel|' not in r.text else d;delta_hidden(r.text,d);d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$lbNext';d['__EVENTARGUMENT']='';d['ctl00$scm_principal']='ctl00$ContentPlaceHolder1$upp_consultaProducao|ctl00$ContentPlaceHolder1$lbNext';h={'X-Requested-With':'XMLHttpRequest','X-MicrosoftAjax':'Delta=true','Referer':u,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0'};time.sleep(.1);r=sess.post(u,data=d,headers=h,timeout=180);page+=1
  if page>ann+5:break
 return {'type_id':typ,'announced':ann,'pagesFetched':len(pages),'sourceRows':sum(len(x['ids']) for x in pages),'distinctIds':len(ids),'complete':len(ids)>=ann,'pages':pages}
print(json.dumps(collect('https://albalegis.nopapercloud.com.br/spl/','3',5),ensure_ascii=False))

