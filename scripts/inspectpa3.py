import json,re
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'));b=x['pages'][1]['body'];i=b.find('cardViewProposicoes_DXDataCard');print(b[i:i+2500])
