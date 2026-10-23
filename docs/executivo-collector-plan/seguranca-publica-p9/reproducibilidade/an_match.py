import pandas as pd, json, unicodedata, re
def norm(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().upper().strip(); s=re.sub(r"[^A-Z0-9 ]",'',s); return re.sub(r'\s+',' ',s)
ib=json.load(open('ibge_munis.json',encoding='utf-8')); key={(r['uf'],norm(r['name'])):r['entity_id'] for r in ib}
dup=len(ib)-len(key)
d=pd.read_excel('vde2025.xlsx',usecols=['uf','municipio','evento']); m=d[d.evento.str.contains('Homic.*doloso',regex=True,na=False)][['uf','municipio']].drop_duplicates()
m['k']=[ (u,norm(n)) for u,n in zip(m.uf,m.municipio)]; m['ok']=m.k.map(lambda k:k in key)
print('pares VDE homicidio',len(m),'casam IBGE',int(m.ok.sum()),'sem casar',int((~m.ok).sum()),'colisoes_nome_ibge',dup)
print(m[~m.ok].head(25)[['uf','municipio']].to_string())
r={'pares':len(m),'casam':int(m.ok.sum()),'nao_casam':int((~m.ok).sum()),'nao_casam_amostra':m[~m.ok].head(40)[['uf','municipio']].values.tolist(),'ibge_colisoes':dup}
es=m[m.uf=='ES']; r['ES']={'pares':len(es),'casam':int(es.ok.sum())}
json.dump(r,open('vde_match.json','w'),ensure_ascii=False,indent=1); print(r['ES'])
