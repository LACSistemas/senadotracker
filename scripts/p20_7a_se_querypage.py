import requests
from bs4 import BeautifulSoup
for q in ['&page=2','&pagina=2','&p=2','&Page=2']:
 u='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026'+q;r=requests.get(u,timeout=60);s=BeautifulSoup(r.content,'html.parser');ids=[a.get('href') for a in s.select('a[href*="processo.aspx?id="]')];print(q,len(set(ids)),ids[0] if ids else '')
