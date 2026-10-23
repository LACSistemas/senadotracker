import os,re,json,glob,collections
import pandas as pd
from pyreaddbc import dbc2dbf
from dbfread import DBF
UFS="AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split()
sim={}
for uf in UFS:
    srcs=glob.glob(f'D:/Civica/raw/datasus/sim/prelim/*/DO{uf}2025.dbc')
    if not srcs: sim[uf]=None; continue
    out=f'tmp/p_{uf}.dbf'; dbc2dbf(srcs[0].encode(),out.encode()); a=0; i=0; ind=0; res=collections.Counter()
    for r in DBF(out,encoding='latin-1',load=False,ignorecase=True):
        if str(r.get('TIPOBITO','')).strip()!='2': continue
        c=str(r.get('CAUSABAS','')).strip().upper()
        if re.match(r'^(X8[5-9]|X9\d|Y0\d)',c): a+=1; res[str(r['CODMUNRES'])]+=1
        elif c.startswith('Y35'): i+=1
        elif re.match(r'^Y(1\d|2\d|3[0-4])',c): ind+=1
    os.remove(out); sim[uf]={'agressoes':a,'interv_legal':i,'indeterminada':ind,'mun_com_agressao':len(res)}
d=pd.read_excel('vde2025.xlsx',usecols=['uf','municipio','evento','total','total_vitima','abrangencia'])
d['evento']=d['evento'].astype(str)
vde={}
for uf in UFS:
    g=d[(d.uf==uf)&(d.abrangencia=='Estadual')]
    def vit(p): return float(g[g.evento.str.contains(p,regex=True)]['total_vitima'].sum())
    hd=g[g.evento.str.contains('Homic.*doloso',regex=True)]
    vde[uf]={'homicidio_doloso':vit('^Homic.*doloso'),'latrocinio':vit('latroc'),'lesao_morte':vit('Les.o corporal seguida'),'esclarecer':vit('Mortes a esclarecer'),'municipios_com_homicidio':int(hd[hd.total_vitima>0].municipio.nunique()),'interv_estado':float(d[(d.uf==uf)&d.evento.str.contains('interven')]['total_vitima'].sum())}
json.dump({'sim_prelim_2025':sim,'vde_2025':vde},open('uf_matrix_vde_sim.json','w'),indent=1)
for uf in UFS: print(uf,sim[uf],vde[uf])
