import json,re,hashlib
from bs4 import BeautifulSoup
from pathlib import Path
files=sorted(Path('artifacts/P20_7C_MA_pages').glob('*.html'),key=lambda x:int(x.stem)); rows=[]
for p in files:
 s=BeautifulSoup(p.read_bytes().decode('iso-8859-15','replace'),'html.parser'); table=s.find('table')
 if not table:continue
 for td in table.select('td.texto'):
  a=td.find('a',href=re.compile(r'materia_mostrar_proc'))
  if not a:continue
  title=' '.join(a.get_text(' ',strip=True).split()); m=re.match(r'(.+?)\s+(\d+)\/(\d{4})\s+-\s*(.*)',title)
  if not m:continue
  typ,num,year,desc=m.groups(); href=a['href']; cm=re.search(r'cod_materia=(\d+)',href); uid=cm.group(1) if cm else None; text=' '.join(td.get_text(' ',strip=True).split())
  mm=re.search(r'EMENTA:\s*(.*?)(?=Autor:|Norma Jurídica|Localização Atual:|Situação:|Última Ação:|$)',text,re.I); em=mm.group(1).strip() if mm else ''
  ma=re.search(r'Autor:\s*(.*?)(?=Norma Jurídica|Localização Atual:|Situação:|Última Ação:|$)',text,re.I); author=ma.group(1).strip() if ma else ''
  inst=bool(re.search(r'Governo|Executivo|Mesa|Tribunal|Defensoria|Secretaria|Minist',author,re.I))
  rows.append({'source_id':uid,'type':typ,'number':num,'year':int(year),'description':desc,'title':em,'authors':[{'name':author,'actor_type':'institution' if inst else 'person'}] if author else [],'url':href,'page':int(p.stem)})
by={x['source_id']:x for x in rows if x['source_id']}; dups=len(rows)-len(by); raw=Path('artifacts/P20_7C_MA_pages/1.html').read_bytes(); corpus={'house':'MA','provider':'sapl_old_ma','domain':'legislative','year':2026,'source_contract':'https://sapl-old.al.ma.leg.br/sapl/generico/materia_pesquisar_proc','source_total_announced':1073,'pages_fetched':len(files),'page_size':8,'source_rows':len(rows),'distinct_ids':len(by),'duplicate_ids':dups,'enumeration_complete':len(by)==1073,'authorship_rows':sum(len(x['authors']) for x in by.values()),'raw_sha256':hashlib.sha256(raw).hexdigest(),'rows':list(by.values())}
Path('artifacts/P20_7C_MA_corpus.json').write_text(json.dumps(corpus,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps({k:corpus[k] for k in ['source_total_announced','pages_fetched','source_rows','distinct_ids','duplicate_ids','authorship_rows','enumeration_complete']},ensure_ascii=False,indent=2))
