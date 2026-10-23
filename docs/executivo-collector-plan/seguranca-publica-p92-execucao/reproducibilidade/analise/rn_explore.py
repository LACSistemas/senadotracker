import zipfile,csv,io,collections,sys,time,numpy as np,json
t0=time.time()
z=zipfile.ZipFile('../p9/nat/renaest_last.zip')
name=[n for n in z.namelist() if n.startswith('Acidentes')][0]
f=io.TextIOWrapper(z.open(name),encoding='latin-1',newline='')
rd=csv.reader(f,delimiter=';'); hdr=next(rd); ix={h:i for i,h in enumerate(hdr)}
cat={c:collections.Counter() for c in ['tp_acidente','cond_meteorologica','tp_rodovia','fase_dia','uf_acidente','ano_acidente','qtde_acidente','qtde_acid_com_obitos']}
ids=[]; n=0; sums=collections.Counter(); bad_ibge=0; ibge_len=collections.Counter(); ym=collections.Counter(); ufym=collections.defaultdict(lambda:[0,0,0])
for r in rd:
    n+=1
    ids.append(int(r[0]) if r[0].isdigit() else -1)
    for c,cnt in cat.items(): cnt[r[ix[c]]]+=1
    for c in ['qtde_acidente','qtde_acid_com_obitos','qtde_envolvidos','qtde_feridosilesos','qtde_obitos']:
        v=r[ix[c]]; sums[c]+= int(v) if v.lstrip('-').isdigit() else 0
    ib=r[ix['codigo_ibge']]; ibge_len[len(ib)]+=1
    ym[r[ix['mes_ano_acidente']]]+=1
    k=(r[ix['uf_acidente']],r[ix['ano_acidente']]); a=ufym[k]; a[0]+=1; a[1]+= 1 if r[ix['qtde_acid_com_obitos']]=='1' else 0; a[2]+=int(r[ix['qtde_obitos']] or 0)
    if n%2000000==0: print(n,time.time()-t0,flush=True)
a=np.array(ids,dtype=np.int64); u=np.unique(a)
print('linhas',n,'ids distintos',len(u),'ids invalidos',int((a<0).sum()))
print('somas',dict(sums)); print('ibge len',dict(ibge_len))
for c,cnt in cat.items(): print(c,dict(cnt.most_common(30)))
print('meses',len(ym),min(ym),max(ym))
json.dump({f'{k[0]}|{k[1]}':v for k,v in ufym.items()},open('rn_ufyear.json','w'))
print('tempo',time.time()-t0)
