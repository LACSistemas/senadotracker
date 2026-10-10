import requests,re,json,hashlib,concurrent.futures,csv,io
from bs4 import BeautifulSoup
base='https://www.al.ce.gov.br'; html=requests.get(base+'/legislativo/expediente-historico',params={'ano':2026},timeout=30).content;s=BeautifulSoup(html,'html.parser');urls=[]
for a in s.find_all('a',href=True):
 if '/legislativo/expediente-historico-csv/' in a['href']:
  u=a['href'] if a['href'].startswith('http') else base+a['href'];
  if u not in urls:urls.append(u)
def one(u):
 r=requests.get(u,timeout=30);return {'url':u,'status':r.status_code,'bytes':len(r.content),'sha256':hashlib.sha256(r.content).hexdigest(),'text':r.content.decode('utf8','replace')}
with concurrent.futures.ThreadPoolExecutor(8) as ex: docs=list(ex.map(one,urls))
rows=[]
for d in docs:
 lines=list(csv.reader(io.StringIO(d['text'].lstrip('\ufeff')),delimiter=';')); current=''
 for i,row in enumerate(lines[1:],1):
  txt=' '.join(row[1:]).strip() if len(row)>1 else ''
  if not txt:continue
  m=re.search(r'(PROJETOS? DE LEI COMPLEMENTAR|PROJETOS? DE LEI|PROJETOS? DE INDICA(?:Ç|C)ÃO|PROJETOS? DE RESOLU(?:Ç|C)ÃO|REQUERIMENTOS?|MENSAGENS?|MO(?:Ç|C)(?:Õ|O)ES?)',txt,re.I)
  if m: current=m.group(1).upper()
  for x in re.finditer(r'(?<!\d)(\d{1,5})/2026',txt):
   rows.append({'source_id':d['url'].rsplit('/',1)[-1]+':'+str(i)+':'+x.group(1),'expediente_id':d['url'].rsplit('/',1)[-1],'type_raw':current,'number':int(x.group(1)),'year':2026,'text':txt,'source_url':d['url']})
json.dump({'house':'CE','provider':'alece_expediente_csv','expedients':[{k:v for k,v in d.items() if k!='text'} for d in docs],'rows':rows},open('artifacts/p20_5_CE_raw.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('EXPEDIENTS',len(docs),'DOC_OK',sum(d['status']==200 for d in docs),'ROWS',len(rows),'DISTINCT',len({r['source_id'] for r in rows}))
