from bs4 import BeautifulSoup
b=open('artifacts/P20_7A_SE_pages/001.html','rb').read(); s=BeautifulSoup(b,'html.parser',from_encoding='utf-8'); a=s.select_one('a.kt-widget5__title'); print(repr(a.get_text())); print(repr(s.original_encoding));
