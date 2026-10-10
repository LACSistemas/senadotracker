import base64, hashlib, json, re, time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

GATE='http://www3.alerj.rj.gov.br/lotus_notes/default.asp'
families={159:'PEC',160:'PLC',161:'PL',162:'PDL',163:'PR',164:'IND_LEGISLATIVA',165:'INDICACAO',166:'MENSAGEM',167:'MOCAO',168:'OFICIO',169:'PROCESSO',170:'REQ',171:'REQ_INFO',172:'REQ_SEM_NUMERO',173:'PROPOSICAO_GERAL'}
views={159:'EmendaInt',160:'LeiCompInt',161:'LeiInt',162:'DecretoInt',163:'ResolucaoInt',164:'IndLegInt',165:'IndInt',166:'MensInt',167:'MocaoInt',168:'OficioInt',169:'ProcessoInt',170:'ReqInt',171:'ReqInfInt',172:'ReqSNInt',173:'PropInt'}
root=Path('artifacts/P20_7A_RJ_pages');root.mkdir(parents=True,exist_ok=True)
s=requests.Session();s.headers['User-Agent']='Civica-P20.7A/1.0'
def get_page(fid,start,count=1000):
    role=f'/scpro2327.nsf/Internet/{views[fid]}?OpenForm&Start={start}&Count={count}'
    enc=base64.b64encode(role.encode()).decode();u=f'{GATE}?id={fid}&url={enc}'
    p=root/f'{fid}_{start}_{count}.html'
    if p.exists(): body=p.read_text(encoding='utf8',errors='ignore')
    else:
        r=s.get(u,timeout=90);r.raise_for_status();body=r.content.decode('utf8','replace');p.write_text(body,encoding='utf8')
    return role,u,body
def parse(fid,start,body):
    soup=BeautifulSoup(body,'html.parser');out=[]
    for a in soup.find_all('a',attrs={'data-role':True}):
        role=a.get('data-role','')
        if 'OpenDocument' not in role: continue
        tr=a.find_parent('tr');cells=tr.find_all('td') if tr else []
        vals=[' '.join(c.get_text(' ',strip=True).split()) for c in cells]
        out.append({'family':families[fid],'familyId':fid,'source_id':a.get_text(' ',strip=True),'detail_role':role,'detail_url':'http://www3.alerj.rj.gov.br'+role,'title':vals[2] if len(vals)>2 else None,'date':vals[3] if len(vals)>3 else None,'authors':vals[4] if len(vals)>4 else None,'pageStart':start})
    return out
allrows=[];catalog=[]
for fid,family in families.items():
    seen=set();pages=0;rows=[];start=1
    while pages<1000:
        role,url,body=get_page(fid,start,1000);cur=parse(fid,start,body);pages+=1
        ids=[x['source_id'] for x in cur]; new=[x for x in cur if x['source_id'] not in seen]
        if not cur or not new: break
        rows.extend(new);seen.update(ids);start += 1000
        # Lotus views are sorted newest-first; once a complete page is outside
        # 2026, the bounded 2026 corpus has ended for this family.
        if rows and not any('2026' in (x.get('source_id') or '') or '2026' in (x.get('date') or '') for x in cur): break
        if len(cur)<1000: break
    yrows=[x for x in rows if '2026' in (x.get('source_id') or '') or '2026' in (x.get('date') or '')]
    allrows.extend(yrows);catalog.append({'family':family,'familyId':fid,'route':f'/scpro2327.nsf/Internet/{views[fid]}?OpenForm','pages':pages,'rawRows':len(rows),'rows2026':len(yrows),'termination':'EMPTY_OR_REPEAT_OR_SHORT','status':'ENUMERATED'})
    print(family,len(yrows),'pages',pages)
ids=[x['source_id'] for x in allrows];dups=sorted({i for i in ids if ids.count(i)>1})
out={'house':'RJ','provider':'alerj_lotus_legislative','year':2026,'contract':GATE,'typeCatalog':catalog,'rows':allrows,'sourceRows':len(allrows),'distinctIds':len(set(ids)),'duplicateIds':dups,'pagesFetched':sum(x['pages'] for x in catalog),'enumeration':'official www3 Lotus gateway with base64 callback and Start offsets'}
Path('artifacts/P20_7A_RJ_corpus.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8');Path('artifacts/P20_7A_RJ_type_catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({k:out[k] for k in ['sourceRows','distinctIds','duplicateIds','pagesFetched']},indent=2))
