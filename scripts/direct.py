b=open('artifacts/P20_7A_SE_pages/001.html','rb').read().decode('utf8'); i=b.find('Requerimento de Voto'); print(repr(b[i:i+50])); print([hex(ord(c)) for c in b[i+20:i+30]])
