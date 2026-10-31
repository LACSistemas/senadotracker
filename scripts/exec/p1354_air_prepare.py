import json,collections
p=r'D:\Civica\raw\infraestrutura\logistica\anac_Dados_Estatisticos_2021_a_2030.json'
s=open(p,encoding='utf8').read(); dec=json.JSONDecoder(); pos=0; n=0; rows=0; agg=collections.defaultdict(lambda:[0.0,0.0,0.0])
while pos<len(s):
    while pos<len(s) and s[pos].isspace(): pos+=1
    if pos>=len(s): break
    arr,end=dec.raw_decode(s,pos); pos=end; n+=1
    for r in arr:
        if str(r.get('ANO')) not in ('2025','2026'): continue
        ym=int(str(r.get('ANO')))*100+int(str(r.get('MES') or 0))
        code=r.get('AEROPORTO_DE_ORIGEM_SIGLA') or ''
        try: pax=float(str(r.get('PASSAGEIROS_PAGOS') or 0).replace(',','.'))
        except: pax=0
        try: cargo=float(str(r.get('CARGA_PAGA_KG') or r.get('CARGA_KG') or 0).replace(',','.'))
        except: cargo=0
        try: dep=float(str(r.get('DECOLAGENS') or r.get('DECOLAGENS_REGULARES') or 0).replace(',','.'))
        except: dep=0
        x=agg[(ym,code,r.get('AEROPORTO_DE_ORIGEM_UF') or '')]; x[0]+=pax; x[1]+=cargo; x[2]+=dep; rows+=1
print('arrays',n,'records',rows,'groups',len(agg))
out=[{'source_system':'ANAC','source_key':f'ANAC-AIR:{ym}:{code}','competence':ym,'airport_code':code,'uf':uf,'municipality':None,'passenger_count':v[0],'cargo_kg':v[1],'departures':v[2]} for (ym,code,uf),v in agg.items()]
json.dump({'source_file':p,'source_rows':rows,'rows':out,'groups':len(out)},open(r'D:\Civica\staging\infraestrutura\logistica\anac_air_ops.json','w',encoding='utf8'),ensure_ascii=False,separators=(',',':'))

