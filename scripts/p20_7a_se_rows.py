from bs4 import BeautifulSoup
import re
for f in ['artifacts/p20_7a_se_page.html','artifacts/p20_7a_se_page100.html']:
 s=BeautifulSoup(open(f,'rb').read(),'html.parser'); ids=[a.get('href') for a in s.select('a[href*="processo.aspx?id="]')]; print(f,len(ids),len(set(ids)),ids[:2],ids[-2:]);
 # row-ish table structures containing processo links
 for a in s.select('a[href*="processo.aspx?id="]')[:1]: print(a.parent.parent.prettify()[:1200])
