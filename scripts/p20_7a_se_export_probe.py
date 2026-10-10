import requests,re,json,csv,io
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026'; s=requests.Session(); r=s.get(u,timeout=60); soup=BeautifulSoup(r.content,'html.parser'); form=soup.find('form'); data={}
for x in form.find_all('input'):
 n=x.get('name');
 if n and x.get('type') in (None,'hidden','text') : data[n]=x.get('value','')
for key,val in [('ctl00$ContentPlaceHolder1$btn_export_csv','CSV'),('ctl00$ContentPlaceHolder1$txt_ano_processo','2026')]: data[key]=val
p=s.post(u,data=data,timeout=120); print('CSV',p.status_code,len(p.content),p.url,p.headers.get('content-type'),p.headers.get('content-disposition')); print(p.content[:300]); open('artifacts/p20_7a_se_export_csv.bin','wb').write(p.content)
# xls
s=requests.Session(); r=s.get(u,timeout=60); soup=BeautifulSoup(r.content,'html.parser'); form=soup.find('form'); data={x.get('name'):x.get('value','') for x in form.find_all('input') if x.get('name') and x.get('type') in (None,'hidden','text')}; data['ctl00$ContentPlaceHolder1$btn_export_excel']='XLS'; data['ctl00$ContentPlaceHolder1$txt_ano_processo']='2026'; p=s.post(u,data=data,timeout=120); print('XLS',p.status_code,len(p.content),p.url,p.headers.get('content-type'),p.headers.get('content-disposition')); print(p.content[:300]); open('artifacts/p20_7a_se_export_xls.bin','wb').write(p.content)
