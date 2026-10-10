from bs4 import BeautifulSoup
for f in ['artifacts/p20_7a_se_page100.html']:
 s=BeautifulSoup(open(f,'rb').read(),'html.parser');print(len(s.select('div.kt-widget5__content.consulta--listagem')),len(s.select('div.consulta--listagem')))
