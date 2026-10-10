import json,re
from bs4 import BeautifulSoup
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'));s=BeautifulSoup(x['pages'][1]['body'],'html.parser');c=s.select_one('div.card-proposicao');print(c, c.get('onclick'));print(re.search(r'IdProposicao=(\\d+)',c.get('onclick','')))
