import pandas as pd
d=pd.read_pickle('tmp/vde2025.pkl')
ufev=d[d.evento=='Estupro']
print(ufev.municipio.value_counts().head(3).to_dict(), ufev.uf.nunique())
ho=d[d.evento=='Homicídio doloso']
# universe consistency
u={}
for e,g in d[d.groupby('evento').municipio.transform('nunique')>1].groupby('evento'):
    s=g.groupby('data_referencia').apply(lambda x:frozenset(zip(x.uf,x.municipio)))
    u[e]=s
import itertools
base=u['Homicídio doloso']
for e,s in u.items():
    same=sum(1 for m in s.index if m in base.index and s[m]==base[m]); print(e[:50].ljust(52),'meses',len(s),'iguais ao universo de homicidio',same, 'tam', len(s.iloc[0]))
print('universo homicidio por mes', {str(k)[:7]:len(v) for k,v in base.items()})
print('NOME INFORMADO', ho[ho.municipio.str.contains('INFORMADO',na=False)].groupby('uf').size().head(5).to_dict())
# sex split vs total
for e in ['Homicídio doloso','Feminicídio']:
    g=d[d.evento==e]; print(e,(g.feminino+g.masculino+g.nao_informado-g.total_vitima).abs().sum())
# nan
print(d[['total','total_vitima','total_peso']].isna().mean())
# duplicates
k=['uf','municipio','evento','data_referencia','abrangencia','agente','arma','faixa_etaria']
print('dup keys',d.duplicated(subset=k).sum())
d2=d.fillna({'agente':'-','arma':'-','faixa_etaria':'-'}); print('dup keys sem nan',d2.duplicated(subset=k).sum())
print(d[d.evento=='Mandado de prisão cumprido'].groupby('abrangencia').agg(n=('total','size'),s=('total','sum')))
mm=d[d.evento=='Mortes no trânsito']; print(mm.groupby('abrangencia').agg(n=('total_vitima','size'),s=('total_vitima','sum')))
print(d.groupby(['evento','abrangencia']).size().shape)
