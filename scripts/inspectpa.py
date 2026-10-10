import json,re
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'));b=x['pages'][0]['body'];
for m in re.finditer('Autor',b,re.I): print(b[m.start()-300:m.start()+500]); break
