import requests,re
from bs4 import BeautifulSoup
u='https://www3.al.es.gov.br/spl/consulta-producao.aspx?tipo=18&ano_proposicao=2026';s=requests.Session();r=s.get(u,timeout=120);so=BeautifulSoup(r.text,'html.parser');d={}
for x in so.select('form input,form select,form textarea'):
 if x.get('name'):
  if x.name=='select':d[x['name']]=(x.find('option',selected=True) or x.find('option')).get('value','')
  elif x.get('type') in (None,'hidden','text'):d[x['name']]=x.get('value','')
d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$lbNext';d['__EVENTARGUMENT']='';d['ctl00$scm_principal']='ctl00$ContentPlaceHolder1$upp_consultaProducao|ctl00$ContentPlaceHolder1$lbNext';h={'X-Requested-With':'XMLHttpRequest','X-MicrosoftAjax':'Delta=true','Referer':u,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0'};q=s.post(u,data=d,headers=h,timeout=120);print(q.status_code,len(q.text),q.text[:200]);open('artifacts/P20_7F_ES_http_delta.txt','w',encoding='utf8').write(q.text)
