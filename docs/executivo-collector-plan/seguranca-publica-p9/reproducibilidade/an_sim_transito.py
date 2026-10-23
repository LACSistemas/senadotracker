import os,re,json,collections
from pyreaddbc import dbc2dbf
from dbfread import DBF
res={}
for uf,yr in (('ES',2023),('SP',2023),('RS',2023),('MG',2023)):
    src=f'D:/Civica/raw/datasus/sim/definitivo/DO{uf}{yr}.dbc'; out=f'tmp/DO{uf}{yr}.dbf'; dbc2dbf(src.encode(),out.encode())
    n=0; mun=collections.Counter(); tot=0
    for r in DBF(out,encoding='latin-1',load=False,ignorecase=True):
        tot+=1
        if str(r.get('TIPOBITO','')).strip()!='2': continue
        c=str(r.get('CAUSABAS','')).strip().upper()
        if re.match(r'^V(0[1-9]|[1-8]\d|9[0-9])',c) or c.startswith('Y850'): n+=1; mun[str(r['CODMUNRES'])]+=1
    os.remove(out); res[f'{uf}{yr}']={'obitos_V01_V99_Y850':n,'municipios':len(mun)}
json.dump(res,open('sim_transito_teste.json','w')); print(res)
