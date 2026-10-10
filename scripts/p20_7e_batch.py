import concurrent.futures,json,re,requests,hashlib,sys
from bs4 import BeautifulSoup
from pathlib import Path
start=int(sys.argv[1]);end=int(sys.argv[2]);house=sys.argv[3];base='https://www3.al.es.gov.br/spl/' if house=='ES' else 'https://albalegis.nopapercloud.com.br/spl/'
types=json.loads(Path(f'artifacts/P20_7D_{house}_type_partitions.json').read_text())['partitions'];authors=json.loads(Path(f'artifacts/P20_7D_{house}_author_partitions.json').read_text())['partitions'];jobs=[(t['type_id'],a['author_id']) for t in types if (t.get('announced') or 0)>len(t.get('ids',[])) for a in authors][start:end]
def one(j):
 typ,a=j;u=f'{base}consulta-producao.aspx?tipo={typ}&autor={a}&ano_proposicao=2026'
 try:
  r=requests.get(u,timeout=20);s=BeautifulSoup(r.text,'html.parser');m=re.search(r'(\d+)\s+proposi',s.get_text(' ',strip=True),re.I);n=int(m.group(1)) if m else None;ids=sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',r.text)));return {'partition_id':f'{typ}:{a}:2026','parent_partition_id':typ,'type_id':typ,'author_id':a,'url':u,'status':r.status_code,'announced_count':n,'observed_rows':len(ids),'distinct_ids':len(ids),'safe_capacity':10,'requires_split':(n or 0)>10,'complete':bool(r.status_code==200 and n is not None and n<=10 and n==len(ids)),'raw_sha256':hashlib.sha256(r.content).hexdigest()}
 except Exception as e:return {'partition_id':f'{typ}:{a}:2026','parent_partition_id':typ,'type_id':typ,'author_id':a,'url':u,'status':'error','error':str(e),'complete':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(one,jobs))
path=Path(f'artifacts/P20_7E_{house}_type_author_parts.json'); old=json.loads(path.read_text()) if path.exists() else {'house':house,'year':2026,'strategy':'type x author','jobsTotal':len([1 for t in types if (t.get("announced") or 0)>len(t.get("ids",[])) for a in authors]),'leaves':[]};old['leaves']+=rows;old['leafComplete']=sum(r.get('complete',False) for r in old['leaves']);old['leafIncomplete']=sum(not r.get('complete',False) for r in old['leaves']);path.write_text(json.dumps(old,ensure_ascii=False,indent=2));print(house,start,end,len(rows),old['leafComplete'],old['leafIncomplete'])
