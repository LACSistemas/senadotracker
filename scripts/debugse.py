import requests
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026';s=requests.Session();r=s.get(u,timeout=90);sp=BeautifulSoup(r.content,'html.parser'); d={}
for x in sp.select('form input,form select'):
 n=x.get('name');
 if n:
  if x.name=='select':d[n]=(x.find('option',selected=True) or x.find('option')).get('value','')
  elif x.get('type') in (None,'hidden','text'):d[n]=x.get('value','')
d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$ddl_ItensExibidos';d['__EVENTARGUMENT']='';d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos']='100';r=s.post(u,data=d,timeout=120);sp=BeautifulSoup(r.content,'html.parser');print(r.status_code,len(r.content),sp.title.get_text(strip=True),len(sp.select('div.consulta--listagem')),sp.get_text(' ',strip=True).find('Localizada'));open('artifacts/p20_7a_debug.html','wb').write(r.content)
