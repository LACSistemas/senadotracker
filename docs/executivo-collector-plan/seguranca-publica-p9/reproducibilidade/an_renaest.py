import zipfile,io,csv,collections,json,time
t0=time.time(); z=zipfile.ZipFile('renaest_last.zip')
acid=collections.Counter(); obit=collections.Counter(); munis=collections.defaultdict(set); es_obit=collections.Counter(); rows=0; meses=set()
nm=[i.filename for i in z.infolist() if i.filename.startswith('Acidentes')][0]
with z.open(nm) as f:
    r=csv.reader(io.TextIOWrapper(f,encoding='latin-1',newline=''),delimiter=';'); h=next(r); ix={c:i for i,c in enumerate(h)}
    for row in r:
        rows+=1
        uf=row[ix['uf_acidente']]; ano=row[ix['ano_acidente']]; mes=row[ix['mes_ano_acidente']]
        try: q=int(row[ix['qtde_acidente']] or 0); o=int(row[ix['qtde_obitos']] or 0)
        except: continue
        acid[(uf,ano)]+=q; obit[(uf,ano)]+=o; munis[(uf,ano)].add(row[ix['codigo_ibge']]); meses.add(mes)
        if uf=='ES': es_obit[(row[ix['codigo_ibge']],ano)]+=o
tot={}
for (uf,ano),v in acid.items(): tot.setdefault(ano,{})[uf]=(v,obit[(uf,ano)],len(munis[(uf,ano)]))
out={'linhas':rows,'segs':round(time.time()-t0),'meses_distintos':len(meses),'ultimo_mes':sorted(meses,key=lambda m:(m[2:],m[:2]))[-1],
 'por_ano':{a:{'acidentes':sum(x[0] for x in d.values()),'obitos':sum(x[1] for x in d.values()),'ufs':len(d)} for a,d in sorted(tot.items())},
 'uf_2024':{uf:{'acid':v[0],'obit':v[1],'mun':v[2]} for uf,v in sorted(tot.get('2024',{}).items())},
 'ES_obitos_2023_top':sorted([(m,v) for (m,a),v in es_obit.items() if a=='2023'],key=lambda x:-x[1])[:5],'ES_obitos_2023':sum(v for (m,a),v in es_obit.items() if a=='2023')}
json.dump(out,open('renaest_resumo.json','w'),indent=1); print(json.dumps(out)[:2500])
