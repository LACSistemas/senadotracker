import json, unicodedata, re, collections
def norm(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().upper().strip(); s=re.sub(r"[^A-Z0-9 ]",'',s); return re.sub(r'\s+',' ',s)
ib=json.load(open('ibge_munis.json',encoding='utf-8')); print(len(ib), ib[0])
key=collections.defaultdict(list)
for r in ib: key[(r['uf'],norm(r['name']))].append(r)
print('colisoes',[k for k,v in key.items() if len(v)>1])
pairs=collections.defaultdict(set)
for y in range(2015,2027):
    j=json.load(open(f'tmp/vde{y}.json',encoding='utf-8'))
    for c in j['cov']:
        pass
    for r in j['rows']:
        pairs[(r[0],r[1])].add(y)
# universo completo vem do cov? cov nao tem municipio; usar rows (apenas nao-zero) => incompleto. Complementar com xlsx 2025 pickle
import pandas as pd
d=pd.read_pickle('tmp/vde2025.pkl'); allp=set(zip(d.uf,d.municipio))
for k in pairs: allp.add(k)
bad=sorted(p for p in allp if p[1]!='NÃO INFORMADO' and (p[0],norm(p[1])) not in key)
print(len(allp),'sem casar',len(bad)); print(bad)
# IBGE sem par VDE
vkeys={(u,norm(m)) for u,m in allp}
print('IBGE sem VDE',[ (k,v[0]['name']) for k,v in key.items() if k not in vkeys][:20])
