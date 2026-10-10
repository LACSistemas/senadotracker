import json
x=json.load(open('artifacts/P20_7A_SE_corpus.json',encoding='utf8')); print([r['title'] for r in x['rows'] if not r['authors']][:20])
