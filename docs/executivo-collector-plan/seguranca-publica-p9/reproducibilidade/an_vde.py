import pandas as pd, json, unicodedata, re
out={}
def norm(s): 
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().upper().strip(); return re.sub(r'[^A-Z0-9 ]','',s)
for y in (2025,2026):
    d=pd.read_excel(f'vde{y}.xlsx'); d['mes']=pd.to_datetime(d['data_referencia']).dt.strftime('%Y-%m')
    o={'linhas':len(d),'meses':sorted(d['mes'].unique().tolist()),'ufs':d['uf'].nunique(),'abrangencia':d['abrangencia'].value_counts(dropna=False).to_dict()}
    ev=[]
    for e,g in d.groupby('evento'):
        per_month=g.groupby('mes')['municipio'].nunique()
        nz=g[(g['total']>0)|(g['total_vitima']>0)]
        ev.append({'evento':e,'linhas':len(g),'municipios_distintos_mes_max':int(per_month.max()),'municipios_com_ocorrencia':int(nz['municipio'].nunique()),'ufs_com_ocorrencia':int(nz['uf'].nunique()),'total':float(g['total'].sum()),'total_vitima':float(g['total_vitima'].sum()),'tudo_zero':bool(len(nz)==0),'abrangencias':sorted(g['abrangencia'].dropna().unique().tolist()),'tem_sexo':bool((g['feminino']+g['masculino']).sum()>0),'tem_faixa':bool(g['faixa_etaria'].notna().any()),'tem_arma':bool(g['arma'].notna().any()),'tem_agente':bool(g['agente'].notna().any())})
    o['eventos']=sorted(ev,key=lambda x:-x['total'])
    pares=d[['uf','municipio']].drop_duplicates(); o['pares_uf_municipio']=len(pares)
    out[str(y)]=o
    if y==2025: d25=d
# ES detalhe
es=d25[d25.uf=='ES']
out['ES_2025']={'municipios_distintos':int(es['municipio'].nunique()),'homicidio_doloso_vitimas':float(es[es.evento.str.contains('Homic',na=False)&es.evento.str.contains('doloso',na=False)]['total_vitima'].sum())}
h=d25[d25.evento.str.contains('Homic.*doloso',regex=True,na=False)&(d25.uf=='ES')].groupby('municipio')['total_vitima'].sum().sort_values(ascending=False)
out['ES_2025']['top_homicidio']= {k:float(v) for k,v in h.head(10).items()}
json.dump(out,open('vde_analise.json','w'),ensure_ascii=False,indent=1)
print(json.dumps({k:(v if k.startswith('ES') else {kk:vv for kk,vv in v.items() if kk!='eventos'}) for k,v in out.items()},ensure_ascii=False)[:1500])
for e in out['2025']['eventos']: print(e['evento'][:42].ljust(44),e['linhas'],e['municipios_distintos_mes_max'],e['municipios_com_ocorrencia'],e['ufs_com_ocorrencia'],int(e['total']),int(e['total_vitima']),e['abrangencias'],'ZERO' if e['tudo_zero'] else '')
