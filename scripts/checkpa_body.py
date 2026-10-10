import json,re
x=json.load(open('artifacts/P20_7A_PA_browser_corpus.json',encoding='utf8'));b=x['pages'][1]['body'];print(len(b),b.find('card-proposicao'),b.find('IdProposicao'));print(re.findall(r'class="([^"]*card[^"]*)"',b)[:5]);
