import requests,re,concurrent.futures,json,hashlib,time
from bs4 import BeautifulSoup
from pathlib import Path
base='https://sapl-old.al.ma.leg.br/sapl/generico/materia_pesquisar_proc'
params='step=8&lst_status=&hdn_txt_autor=&txt_relator=&dt_public=&btn_materia_pesquisar=Pesquisar&existe_ocorrencia=0&txt_ano=2026&incluir=0&txt_assunto=&hdn_cod_autor=&txt_numero=&rad_tramitando=&dt_public2=&dt_apres2=&lst_cod_partido=&lst_localizacao=&lst_tip_materia=&lst_tip_autor=&dt_apres=&txt_npc='
Path('artifacts/P20_7C_MA_pages').mkdir(exist_ok=True)
# page1 already fetched, get page count from it

def fetch(n):
 u=f'{base}?page={n}&{params}'
 for attempt in range(3):
  try:
   r=requests.get(u,timeout=90); r.raise_for_status(); Path(f'artifacts/P20_7C_MA_pages/{n}.html').write_bytes(r.content); return n,r.status_code,len(r.content)
  except Exception as e:
   if attempt==2:return n,'ERR',str(e)
   time.sleep(1+attempt)
print('fetching 135 pages')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for i,res in enumerate(ex.map(fetch,range(1,136)),1):
  if i%10==0 or res[1]=='ERR': print(i,res,flush=True)

def parse(p):
 s=BeautifulSoup(Path(p).read_bytes().decode('iso-8859-15','replace'),'html.parser'); out=[]
 table=s.find('table')
 if not table:return out
 for td in table.select('td.texto'):
  a=td.find('a',href=re.compile(r'materia_mostrar_proc'))
  if not a:continue
  title=' '.join(a.get_text(' ',strip=True).split()); m=re.match(r'(.+?)\s+(\d+)\/(\d{4})\s+-\s*(.*)',title)
  if not m: continue
  typ,num,year,desc=m.groups(); href=a['href']; cm=re.search(r'cod_materia=(\d+)',href); uid=cm.group(1) if cm else None
  text=' '.join(td.get_text(' ',strip=True).split()); em=(re.search(r'EMENTA:\s*(.*?)(?=Autor:|Norma Jurídica|Localização Atual:|Situação:|Última Ação:|$)',text,re.I) or [None,''])[1].strip()
  author=(re.search(r'Autor:\s*(.*?)(?=Norma Jurídica|Localização Atual:|Situação:|Última Ação:|$)',text,re.I) or [None,''])[1].strip()
  out.append({'source_id':uid,'type':typ,'number':num,'year':int(year),'description':desc,'title':em,'authors':[{'name':author,'actor_type':'person' if author and not re.search(r'Governo|Executivo|Mesa|Tribunal|Defensoria|Secretaria',author,re.I) else 'institution'}] if author else [],'url':href,'page':int(Path(p).stem)})
 return out
rows=[]
for p in sorted(Path('artifacts/P20_7C_MA_pages').glob('*.html'),key=lambda x:int(x.stem)): rows.extend(parse(p))
by={x['source_id']:x for x in rows if x['source_id']}; dups=len(rows)-len(by)
raw=Path('artifacts/P20_7C_MA_pages/1.html').read_bytes()
corpus={'house':'MA','provider':'sapl_old_ma','domain':'legislative','year':2026,'source_contract':base,'source_total_announced':1073,'pages_fetched':len(list(Path('artifacts/P20_7C_MA_pages').glob('*.html'))),'page_size':8,'source_rows':len(rows),'distinct_ids':len(by),'duplicate_ids':dups,'enumeration_complete':len(by)==1073,'authorship_rows':sum(len(x['authors']) for x in by.values()),'raw_sha256':hashlib.sha256(raw).hexdigest(),'rows':list(by.values())}
Path('artifacts/P20_7C_MA_corpus.json').write_text(json.dumps(corpus,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:corpus[k] for k in ['source_total_announced','pages_fetched','source_rows','distinct_ids','duplicate_ids','authorship_rows','enumeration_complete','raw_sha256']},ensure_ascii=False,indent=2))
