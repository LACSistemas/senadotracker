from bs4 import BeautifulSoup
s=BeautifulSoup(open('artifacts/p20_7a_se_page.html','rb').read(),'html.parser'); a=s.select_one('a[href*="processo.aspx?id="]'); card=a.find_parent('div',class_='kt-widget5__content'); print(card.prettify()[:6000])
