import requests,re
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026';s=requests.Session();r=s.get(u,timeout=60);sp=BeautifulSoup(r.content,'html.parser');
def hidden(sp):return {x.get('name'):x.get('value','') for x in sp.select('form input') if x.get('name') and x.get('type') in (None,'hidden','text')}
d=hidden(sp);d['__EVENTTARGET']='ctl00$ContentPlaceHolder1$ddl_ItensExibidos';d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos']='100';r=s.post(u,data=d,timeout=120);sp=BeautifulSoup(r.content,'html.parser');
def post_page(sp,num):
 d=hidden(sp);d['__EVENTTARGET']=next((re.search(r"__doPostBack\('([^']+)'",a.get('href','')).group(1) for a in sp.select('#ContentPlaceHolder1_rptPaging a') if a.get_text(strip=True)==str(num)),None);d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos']='100'; return s.post(u,data=d,timeout=120)
r=post_page(sp,2);sp=BeautifulSoup(r.content,'html.parser');print('page2',len(sp.select('a[href*="processo.aspx?id="]')),[(a.get_text(strip=True),a.get('href')) for a in sp.select('#ContentPlaceHolder1_rptPaging a')]); print('ids',re.findall(r'processo.aspx\?id=(\d+)',str(sp))[:3]);
