import requests,re
u='https://www.alepa.pa.gov.br/Legislativo/Proposicoes';r=requests.get(u,timeout=60);open('artifacts/p20_7a_pa_initial.html','wb').write(r.content);t=r.text
for pat in ['GOTOPAGE','Page','page','DXPager','dxp-page']:
 print(pat,[t[max(0,m.start()-200):m.start()+500] for m in list(re.finditer(pat,t,re.I))[:3]])
