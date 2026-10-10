b=open('artifacts/P20_7A_SE_pages/001.html','rb').read(); i=b.find(b'Requerimento de Voto'); print(list(b[i:i+35]));
