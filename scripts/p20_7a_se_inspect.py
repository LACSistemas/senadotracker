from bs4 import BeautifulSoup
b=open('artifacts/p20_7a_se_page.html','rb').read(); s=BeautifulSoup(b,'html.parser');
for x in s.find_all('input'):
 n=x.get('name') or ''; v=x.get('value','');
 if any(k in n.lower() for k in ['ano','page','export','paging','viewstate','eventvalidation','eventtarget']) or x.get('type') in ['submit','button']: print(x.get('type'),n,repr(v[:100]))
for a in s.find_all('a'):
 if (a.get_text(' ',strip=True) in ['2','3','10']): print('A',a)
