import requests,re,html,json
from bs4 import BeautifulSoup
u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026'
s=requests.Session(); r=s.get(u,timeout=60); print(r.status_code,len(r.content),r.url,r.headers.get('content-type')); open('artifacts/p20_7a_se_page.html','wb').write(r.content)
soup=BeautifulSoup(r.content,'html.parser')
print('title',soup.title.get_text(' ',strip=True) if soup.title else '')
text=soup.get_text(' ',strip=True)
for pat in ['5.487','5487','proposições localizadas','Total de']:
 i=text.lower().find(pat.lower()); print(pat,i,text[max(0,i-180):i+300] if i>=0 else '')
form=soup.find('form'); print('form',form.get('action'),form.get('method'))
for x in soup.find_all(['input','select','button']):
 n=x.get('name'); v=x.get('value'); typ=x.get('type'); txt=x.get_text(' ',strip=True)
 if (n and ('export' in n.lower() or typ in ('submit','button'))) or (v and v in ('CSV','XLS','TXT','RTF')): print('CONTROL',x.name,n,typ,v,txt[:80])
# all links with page-ish text
for a in soup.find_all('a'):
 t=a.get_text(' ',strip=True); h=a.get('href') or ''
 if re.search(r'^(Anterior|Próxima|\d+)$',t,re.I) or 'page' in h.lower() or 'pager' in (a.get('class') or []): print('LINK',repr(t),h[:200],a.get('onclick'))
# tables dimensions
for i,t in enumerate(soup.find_all('table')):
 rows=t.find_all('tr'); print('TABLE',i,len(rows),[(c.get_text(' ',strip=True)[:60]) for c in rows[0].find_all(['th','td'])][:10] if rows else [])
