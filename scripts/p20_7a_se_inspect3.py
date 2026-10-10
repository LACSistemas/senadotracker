from bs4 import BeautifulSoup
s=BeautifulSoup(open('artifacts/p20_7a_se_page.html','rb').read(),'html.parser')
for tag in s.find_all(string=lambda t:t and 'Ano Processo' in t):
 print(tag.parent.parent.prettify()[:4000])
