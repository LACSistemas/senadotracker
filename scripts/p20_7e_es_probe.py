import concurrent.futures,json,re,requests,hashlib
from bs4 import BeautifulSoup
from pathlib import Path
types=json.loads(Path('artifacts/P20_7D_ES_type_partitions.json').read_text())['partitions']; authors=json.loads(Path('artifacts/P20_7D_ES_author_partitions.json').read_text())['partitions']; aids=[x['author_id'] for x in authors]; jobs=[(t['type_id'],a) for t in types if (t.get('announced') or 0)>len(t.get('ids',[])) for a in aids];print('jobs',len(jobs),flush=True)
def one(j):
 typ,a=j;u=f'https://www3.al.es.gov.br/spl/consulta-producao.aspx?tipo={typ}&autor={a}&ano_proposicao=2026'
 try:
  r=requests.get(u,timeout=20);s=BeautifulSoup(r.text,'html.parser');m=re.search(r'(\d+)\s+proposi',s.get_text(' ',strip=True),re.I);n=int(m.group(1)) if m else None;ids=sorted(set(re.findall(r'processo\.aspx\?id=(\d+)',r.text)));return {'partition_id':f'{typ}:{a}:2026','parent_partition_id':typ,'type_id':typ,'author_id':a,'url':u,'status':r.status_code,'announced_count':n,'observed_rows':len(ids),'distinct_ids':len(ids),'safe_capacity':10,'requires_split':(n or 0)>10,'complete':bool(r.status_code==200 and n is not None and n<=10 and n==len(ids)),'raw_sha256':hashlib.sha256(r.content).hexdigest()}
 except Exception as e:return {'partition_id':f'{typ}:{a}:2026','parent_partition_id':typ,'type_id':typ,'author_id':a,'url':u,'status':'error','error':str(e),'complete':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: rows=list(ex.map(one,jobs))
out={'house':'ES','year':2026,'strategy':'type x author','rootCount':len(types),'jobs':len(jobs),'leaves':rows,'leafComplete':sum(r.get('complete',False) for r in rows),'leafIncomplete':sum(not r.get('complete',False) for r in rows)};Path('artifacts/P20_7E_ES_type_author.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('complete',out['leafComplete'],'incomplete',out['leafIncomplete'],flush=True)
