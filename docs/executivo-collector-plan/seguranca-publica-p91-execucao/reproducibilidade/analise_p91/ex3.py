import pandas as pd
d=pd.read_pickle('tmp/vde2025.pkl')
k=['uf','municipio','evento','data_referencia','abrangencia','agente','arma','faixa_etaria']
dd=d[d.duplicated(subset=k,keep=False)]
print(dd.evento.value_counts().to_dict())
print(dd.groupby(['uf','municipio']).size().sort_values(ascending=False).head(10))
print(dd.sort_values(k).head(8).to_string())
