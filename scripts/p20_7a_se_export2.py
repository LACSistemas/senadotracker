import requests
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026';s=requests.Session();r=s.get(u,timeout=60);sp=BeautifulSoup(r.content,'html.parser');d={}
for x in sp.select('form input,form select,form textarea'):
 n=x.get('name');
 if not n: continue
 if x.name=='select':
  o=x.find('option',selected=True) or x.find('option'); d[n]=o.get('value','') if o else ''
 elif x.get('type') in (None,'hidden','text'): d[n]=x.get('value','')
d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos']='100';d['ctl00$ContentPlaceHolder1$btn_export_csv']='CSV';
print('keys',len(d),'btn',d.get('ctl00$ContentPlaceHolder1$btn_export_csv'));p=s.post(u,data=d,timeout=120,headers={'Referer':u,'User-Agent':'Mozilla/5.0'});print(p.status_code,len(p.content),p.headers);print(p.content[:100]);open('artifacts/p20_7a_se_export2.bin','wb').write(p.content)
