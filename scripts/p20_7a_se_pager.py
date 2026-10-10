from bs4 import BeautifulSoup
s=BeautifulSoup(open('artifacts/p20_7a_se_page100.html','rb').read(),'html.parser'); x=s.find(id='ContentPlaceHolder1_rptPaging'); print(x.prettify()[:8000])
