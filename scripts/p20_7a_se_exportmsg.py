from bs4 import BeautifulSoup
b=open('artifacts/p20_7a_se_export3.bin','rb').read();s=BeautifulSoup(b,'html.parser'); t=s.get_text(' ',strip=True); print(t[:1200]);
for x in s.select('[id*=Mensagem],.alert'): print(x.get('id'),x.get_text(' ',strip=True)[:500])
