import pandas as pd
d=pd.read_pickle('tmp/vde2025.pkl')
g=d[(d.uf=='DF')&(d.evento=='Homicídio doloso')&(d.data_referencia=='2025-03-01')]
print(g.to_string())
g=d[(d.uf=='DF')&(d.evento=='Homicídio doloso')]
print(g.groupby('data_referencia').agg(n=('total_vitima','size'),s=('total_vitima','sum')))
n=d[(d.municipio=='NÃO INFORMADO')&(d.total_vitima>0)]; print(n.groupby(['uf','evento']).total_vitima.sum().head(15))
print(d[(d.municipio=='NÃO INFORMADO')].groupby('evento').total_vitima.sum().sort_values().tail(5))
