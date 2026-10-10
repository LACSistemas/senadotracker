b=open('artifacts/P20_7A_SE_pages/001.html','rb').read(); i=b.find(b'Requerimento de Voto'); print(repr(b[i:i+35].decode('utf-8')))
