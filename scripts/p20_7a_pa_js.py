import re,requests
h=open('artifacts/p20_7a_pa_initial.html',encoding='utf8',errors='ignore').read(); urls=set('https://www.alepa.pa.gov.br'+x for x in re.findall(r'(?:src|href)="(/DXR\.axd\?r=[^"]+)',h)); print(len(urls));
for u in urls:
 t=requests.get(u,timeout=60).text
 if 'GVPagerOnClick' in t or 'GOTOPAGE' in t or 'PAGERONCLICK' in t: print('FOUND',u,len(t)); open('artifacts/p20_7a_dx.js','w',encoding='utf8').write(t)
