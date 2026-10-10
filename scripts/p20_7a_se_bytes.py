b=open('artifacts/p20_7a_se_page.html','rb').read(); i=b.find(b'Processo'); print(b[i:i+100]); print(b[i:i+100].decode('utf8','replace'));print(b[i:i+100].decode('latin1','replace'))
