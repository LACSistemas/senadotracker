import pandas as pd, sys
d=pd.read_excel('vde2025.xlsx'); d.to_pickle('tmp/vde2025.pkl')
print(d.dtypes)
print(d.head(3).to_string())
for c in ['agente','arma','faixa_etaria','abrangencia']:
    print(c, d[c].value_counts(dropna=False).head(15).to_dict())
for e,g in d.groupby('evento'):
    nz=g[(g.total>0)|(g.total_vitima>0)]
    print(e.ljust(60), len(g), 'mun/mes', g.groupby('data_referencia').municipio.nunique().max(), 'sumTotal',int(g.total.sum()),'sumVit',int(g.total_vitima.sum()),'peso',round(g.total_peso.sum(),1), sorted(g.abrangencia.dropna().unique()), 'agente',g.agente.nunique(),'arma',g.arma.nunique(),'faixa',g.faixa_etaria.nunique())
