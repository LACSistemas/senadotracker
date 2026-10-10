import json
from bs4 import BeautifulSoup
x=json.load(open('artifacts/P20_7A_SE_corpus.json',encoding='utf8'))
# fetch saved page first and show card with no detected author via own parse criterion
s=BeautifulSoup(open('artifacts/p20_7a_se_page100.html','rb').read(),'html.parser')
for c in s.select('div.kt-widget5__content.consulta--listagem'):
 if 'Autor(es)' in c.get_text() and not c.select('a[href*="consulta-producao.aspx?autor="]'):
  print(c.select_one('div.kt-widget5__info:last-child').prettify()); break
