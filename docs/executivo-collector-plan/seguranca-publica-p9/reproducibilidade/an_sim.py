import sys, json, os, re, collections
from pyreaddbc import dbc2dbf
from dbfread import DBF
res={}
for uf,yr,base in (('ES',2023,'definitivo'),('SP',2023,'definitivo'),('ES',2024,'definitivo')):
    src=f'D:/Civica/raw/datasus/sim/{base}/DO{uf}{yr}.dbc'
    if not os.path.exists(src): res[f'{uf}{yr}']='ausente'; continue
    out=f'tmp/DO{uf}{yr}.dbf'; dbc2dbf(src.encode(),out.encode())
    cols=None; tot=0; agr=collections.Counter(); inter=0; ign=0; byres=collections.Counter(); circ=collections.Counter(); cid3=collections.Counter()
    for r in DBF(out,encoding='latin-1',load=False,ignorecase=True):
        tot+=1
        if cols is None: cols=list(r.keys())
        c=str(r.get('CAUSABAS','')).strip().upper()
        if str(r.get('TIPOBITO','')).strip()!='2': continue
        if re.match(r'^(X8[5-9]|X9\d|Y0\d)',c): agr[c[:3]]+=1; byres[str(r['CODMUNRES'])]+=1
        elif c.startswith('Y35') or c.startswith('Y36'): inter+=1
        elif re.match(r'^Y(1\d|2\d|3[0-4])',c): ign+=1
    os.remove(out)
    res[f'{uf}{yr}']={'linhas':tot,'colunas':cols,'agressoes_X85_Y09':sum(agr.values()),'intervencao_legal_Y35_Y36':inter,'eventos_indeterminados_Y10_Y34':ign,'municipios_com_agressao':len(byres),'top5':byres.most_common(5)}
json.dump(res,open('sim_violencia_teste.json','w'),ensure_ascii=False,indent=1)
for k,v in res.items(): print(k, v if isinstance(v,str) else {kk:vv for kk,vv in v.items() if kk!='colunas'})
print('colunas',res.get('ES2023',{}).get('colunas'))
