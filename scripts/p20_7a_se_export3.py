import requests,time
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026&x='+str(time.time());s=requests.Session();r=s.get(u,headers={'Cache-Control':'no-cache','User-Agent':'Mozilla/5.0'},timeout=60);sp=BeautifulSoup(r.content,'html.parser');d={}
for x in sp.select('form input,form select'):
 n=x.get('name');
 if not n: continue
 if x.name=='select': d[n]=(x.find('option',selected=True) or x.find('option')).get('value','')
 elif x.get('type') in (None,'hidden','text'): d[n]=x.get('value','')
d['ctl00$ContentPlaceHolder1$btn_export_csv']='CSV';
p=s.post(u,data=d,headers={'Referer':u,'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'},timeout=120);print(p.status_code,len(p.content),p.headers.get('content-type'),p.headers.get('content-disposition'),p.url);print('has form',b'btn_export_csv' in p.content,'has csv marker',b'CSV' in p.content[:200]);open('artifacts/p20_7a_se_export3.bin','wb').write(p.content)
