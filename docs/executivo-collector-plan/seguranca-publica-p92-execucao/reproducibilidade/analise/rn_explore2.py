import zipfile,csv,io,collections,time
z=zipfile.ZipFile('../p9/nat/renaest_last.zip')
def rd(prefix):
    name=[n for n in z.namelist() if n.startswith(prefix)][0]
    f=io.TextIOWrapper(z.open(name),encoding='latin-1',newline=''); r=csv.reader(f,delimiter=';'); h=next(r); return h,r
h,r=rd('Localidade'); ix={c:i for i,c in enumerate(h)}; L=list(r); print('Localidade',len(L)); print(L[0],L[1000]); 
print('chv unicas',len({x[0] for x in L}),'anos',collections.Counter(x[1] for x in L).most_common(12))
print('ibge distintos',len({x[ix['codigo_ibge']] for x in L}), 'ufs',len({x[ix['uf']] for x in L}))
print('frota_circulante nao vazio', sum(1 for x in L if x[ix['frota_circulante']] not in('','0')))
t0=time.time()
h,r=rd('Vitimas'); ix={c:i for i,c in enumerate(h)}; cat={c:collections.Counter() for c in ['faixa_idade','genero','tp_envolvido','gravidade_lesao','equip_seguranca','ind_motorista','susp_alcool','qtde_envolvidos','qtde_feridosilesos','qtde_obitos']}; n=0
for x in r:
    n+=1
    for c,cnt in cat.items(): cnt[x[ix[c]]]+=1
print('Vitimas',n,time.time()-t0)
for c,cnt in cat.items(): print(' ',c,dict(cnt.most_common(14)))
h,r=rd('TipoVeiculo'); ix={c:i for i,c in enumerate(h)}; cat={c:collections.Counter() for c in ['tipo_veiculo','ind_veic_estrangeiro','qtde_veiculos']}; n=0; s=0
for x in r:
    n+=1
    for c,cnt in cat.items(): cnt[x[ix[c]]]+=1
    s+=int(x[ix['qtde_veiculos']] or 0)
print('TipoVeiculo',n,'soma veic',s)
for c,cnt in cat.items(): print(' ',c,dict(cnt.most_common(30)))
