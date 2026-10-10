from bs4 import BeautifulSoup
s=BeautifulSoup(open('artifacts/p20_7a_se_page.html','rb').read(),'html.parser')
for x in s.find_all(['select','input','textarea']):
 n=x.get('name') or ''
 if n and ('ano' in n.lower() or 'process' in n.lower() or 'pagina' in n.lower() or 'page' in n.lower()): print(x.name,n,x.get('type'),x.get('value'),[(o.get('value'),o.get_text(' ',strip=True)) for o in x.find_all('option')][:5])
