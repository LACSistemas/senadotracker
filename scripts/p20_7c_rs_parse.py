import json,re,hashlib
from bs4 import BeautifulSoup
from pathlib import Path
s=BeautifulSoup(Path('artifacts/P20_7C_RS_search_2026_page1.html').read_text(encoding='utf-8',errors='replace'),'html.parser')
rows=[]
for tr in s.select('table.proposicoes-table tbody tr'):
 tds=tr.find_all('td')
 if len(tds)<5: continue
 a=tds[0].find('a'); href=a.get('href','') if a else ''
 m=re.search(r'/proposicao/([^/]+)/([^/]+)/([^/]+)/([^/?]+)',href)
 if not m: continue
 typ,num,year,uid=m.groups(); name=' '.join(tds[1].get_text(' ',strip=True).split())
 proposer=name
 author_type='institution' if re.search(r'Comis|Subcom|Poder Executivo|Secretaria|Governo|Tribunal|Defensoria|Minist|Mesa Diretora',name,re.I) else 'person'
 rows.append({'source_id':uid,'type':typ,'number':num,'year':int(year),'title':' '.join(tds[4].get_text(' ',strip=True).split()),'proposer':proposer,'authors':[{'name':proposer,'actor_type':author_type}] if proposer else [],'status':' '.join(tds[2].get_text(' ',strip=True).split()),'stage':' '.join(tds[3].get_text(' ',strip=True).split()),'url':'https://ww4.al.rs.gov.br'+href,'raw_page':1})
body=Path('artifacts/P20_7C_RS_search_2026_page1.html').read_bytes()
corpus={'house':'RS','provider':'alrs_legislative_search','domain':'legislative','year':2026,'source_contract':'https://ww4.al.rs.gov.br/legislativo/pesquisa?anoProposicao=2026&pagina={page}','source_total_announced':1097,'pages_fetched':1,'page_size':10,'source_rows':len(rows),'distinct_ids':len(set(x['source_id'] for x in rows)),'duplicate_ids':len(rows)-len(set(x['source_id'] for x in rows)),'enumeration_complete':False,'boundary_limitation':'Official search exposes 1097 rows over page controls, but page 2+ requests did not return within 180 seconds; no official CSV endpoint exists for this search (CSV links are client-side export only for order-day widgets).','page2_probe':{'url':'https://ww4.al.rs.gov.br/legislativo/pesquisa?siglaTipoProposicao=&nroProposicao=&anoProposicao=2026&nomeProponente=&situacaoProposicao=&dataIni=&dataFim=&assunto1=&assunto2=&assunto3=&pagina=2','result':'TIMEOUT_NO_RESPONSE_180S'},'rows':rows,'authorship_rows':sum(len(x['authors']) for x in rows),'raw_sha256':hashlib.sha256(body).hexdigest()}
Path('artifacts/P20_7C_RS_corpus.json').write_text(json.dumps(corpus,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:corpus[k] for k in ['source_total_announced','pages_fetched','source_rows','distinct_ids','duplicate_ids','authorship_rows','enumeration_complete','raw_sha256']},ensure_ascii=False,indent=2))
