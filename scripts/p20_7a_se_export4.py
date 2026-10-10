import requests,time
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026&x='+str(time.time());s=requests.Session();r=s.get(u,timeout=60);sp=BeautifulSoup(r.content,'html.parser');d={x.get('name'):x.get('value','') for x in sp.select('form input') if x.get('name') and x.get('type') in (None,'hidden','text')};d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$btn_export_csv'; d['__EVENTARGUMENT']='';
p=s.post(u,data=d,timeout=120);print(p.status_code,len(p.content),p.headers.get('content-type'),p.headers.get('content-disposition'),p.content[:50]);open('artifacts/p20_7a_se_export4.bin','wb').write(p.content)
