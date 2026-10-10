import json,re
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'));b=x['pages'][1]['body'];
for pat in ['Autor(es)','Autor','autor']:
 print(pat,b.find(pat));
 i=b.find(pat,50000); print(b[i-200:i+600] if i>0 else '')
