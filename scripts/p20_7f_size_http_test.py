import requests,re
from bs4 import BeautifulSoup
for host,typ in [('https://www3.al.es.gov.br/spl/','18'),('https://albalegis.nopapercloud.com.br/spl/','3')]:
 u=f'{host}consulta-producao.aspx?tipo={typ}&ano_proposicao=2026';s=requests.Session();r=s.get(u,timeout=120);so=BeautifulSoup(r.text,'html.parser');d={}
 for x in so.select('form input,form select,form textarea'):
  n=x.get('name');
  if not n:continue
  if x.name=='select':d[n]='100'
  elif x.get('type') in (None,'hidden','text'):d[n]=x.get('value','')
 d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$ddl_ItensExibidos';d['__EVENTARGUMENT']='';d['ctl00$scm_principal']='ctl00$ContentPlaceHolder1$upp_consultaProducao|ctl00$ContentPlaceHolder1$ddl_ItensExibidos';q=s.post(u,data=d,headers={'X-Requested-With':'XMLHttpRequest','X-MicrosoftAjax':'Delta=true','Referer':u,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0'},timeout=180);print(host,q.status_code,len(set(re.findall(r'processo\.aspx\?id=(\d+)',q.text))),q.text[:30])
