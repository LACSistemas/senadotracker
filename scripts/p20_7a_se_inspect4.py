from bs4 import BeautifulSoup
s=BeautifulSoup(open('artifacts/p20_7a_se_page.html','rb').read(),'html.parser')
x=s.find('select',id='ContentPlaceHolder1_ddl_ItensExibidos'); print(x.prettify())
