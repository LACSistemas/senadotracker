b=open('artifacts/p20_7a_se_page.html','rb').read();
for enc in ['utf-8','cp1252','latin1']:
 t=b.decode(enc,errors='replace'); i=t.find('5487 propos'); print(enc,repr(t[i-30:i+30]))
