b=open('artifacts/P20_7A_SE_pages/001.html','rb').read(); i=b.find(b'Requerimento de Voto'); s=b[i:i+35].decode('utf-8'); print([ord(c) for c in s[-15:]]); print(s.encode('unicode_escape'))
