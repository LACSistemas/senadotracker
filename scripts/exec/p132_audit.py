import csv, json, math, hashlib
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(r"D:\Civica\raw\infraestrutura\energia\aneel")
STG = Path(r"D:\Civica\staging\infraestrutura\energia\aneel")
OUT = STG / "audit"
OUT.mkdir(parents=True, exist_ok=True)

def n(v):
    if v is None: return None
    s = str(v).strip()
    if not s: return None
    try: return float(s.replace('.', '').replace(',', '.')) if ',' in s else float(s)
    except Exception: return None

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

def indger():
    p=ROOT/'indger-dados-comerciais.csv'; rows=0; bad=0; months=Counter(); ufs=Counter(); mun=set(); agents=set(); keys=Counter(); latest=None; latest_rows=0; latest_mun=set(); latest_agents=set(); values=Counter(); cnpj_by_mun=defaultdict(set)
    with p.open('r',encoding='utf-8-sig',newline='',errors='replace') as f:
        rd=csv.DictReader(f,delimiter=';')
        headers=rd.fieldnames or []
        for r in rd:
            rows+=1; ref=(r.get('DatReferenciaInformada') or '').strip(); cnpj=(r.get('NumCNPJ') or '').strip(); ibge=(r.get('CodMunicipioIBGE') or '').strip(); agent=(r.get('SigAgente') or '').strip()
            if not ref or not ibge or not cnpj: bad+=1
            months[ref]+=1; mun.add(ibge); agents.add(cnpj); key=(ref,cnpj,ibge,agent); keys[key]+=1; cnpj_by_mun[ibge].add(cnpj)
            if latest is None or ref>latest: latest=ref
        latest_rows=months[latest] if latest else 0
    # second pass latest rows for coverage and valid value counts
    if latest:
        with p.open('r',encoding='utf-8-sig',newline='',errors='replace') as f:
            for r in csv.DictReader(f,delimiter=';'):
                if (r.get('DatReferenciaInformada') or '').strip()==latest:
                    latest_mun.add((r.get('CodMunicipioIBGE') or '').strip()); latest_agents.add((r.get('NumCNPJ') or '').strip())
                    for k in ['QtdUCAtiva','QtdUCAtivaFat','QtdFatura','QtdFaturaSemLeitura','QtdUCSuspInadimplemento','QtdSolicRessarcimentoDano','VlrPagoRessarcDano']:
                        if n(r.get(k)) is not None: values[k]+=1
    dup=sum(v-1 for v in keys.values() if v>1)
    return {'file':str(p),'bytes':p.stat().st_size,'sha256':sha(p),'rows':rows,'headers':headers,'badIdentityRows':bad,'distinctMonths':len(months),'firstCompetence':min(months) if months else None,'latestCompetence':latest,'latestRows':latest_rows,'distinctMunicipalCodes':len(mun),'distinctAgents':len(agents),'latestMunicipalCodes':len(latest_mun),'latestAgents':len(latest_agents),'duplicateNaturalKeys':dup,'naturalKey':['DatReferenciaInformada','NumCNPJ','CodMunicipioIBGE','SigAgente'],'valueCountsLatest':dict(values),'municipalDistributorMultiplicity':{'one':sum(1 for v in cnpj_by_mun.values() if len(v)==1),'multiple':sum(1 for v in cnpj_by_mun.values() if len(v)>1)}}

def dec_file(name, delim=';'):
    p=ROOT/name
    if not p.exists(): p=STG/name
    rows=0; indicators=Counter(); months=Counter(); sets=set(); agents=set(); keys=Counter(); bad=0; latest=None
    with p.open('r',encoding='utf-8-sig',newline='',errors='replace') as f:
        rd=csv.DictReader(f,delimiter=delim); headers=rd.fieldnames or []
        for r in rd:
            rows+=1; y=(r.get('AnoIndice') or r.get('AnoLimiteQualidade') or '').strip(); per=(r.get('NumPeriodoIndice') or '').strip(); ind=(r.get('SigIndicador') or '').strip(); sid=(r.get('IdeConjUndConsumidoras') or r.get('IdeConjUnidConsumidoras') or '').strip(); cnpj=(r.get('NumCNPJ') or '').strip()
            if y and per: months[f'{y}-{per}']+=1
            elif y: months[y]+=1
            indicators[ind]+=1; sets.add(sid); agents.add(cnpj); keys[(y,per,ind,sid,cnpj)]+=1
            gen=(r.get('DatGeracaoConjuntoDados') or '').strip(); latest=gen if latest is None or gen>latest else latest
            if not sid or not ind: bad+=1
    return {'file':str(p),'bytes':p.stat().st_size,'sha256':sha(p),'rows':rows,'headers':headers,'distinctIndicators':sorted(indicators),'indicatorCounts':dict(indicators),'distinctPeriods':len(months),'firstPeriod':min(months) if months else None,'lastPeriod':max(months) if months else None,'distinctSets':len(sets),'distinctAgents':len(agents),'duplicateNaturalKeys':sum(v-1 for v in keys.values() if v>1),'badIdentityRows':bad,'latestGeneration':latest}

def indqual():
    p=ROOT/'indqual-municipio.csv'; rows=0; municipalities=set(); sets=Counter(); ufs=Counter(); keys=Counter(); latest=None
    with p.open('r',encoding='utf-8-sig',newline='',errors='replace') as f:
        rd=csv.DictReader(f,delimiter=';'); headers=rd.fieldnames or []
        for r in rd:
            rows+=1; m=(r.get('CodMunicipio') or '').strip(); s=(r.get('IdeConjUnidConsumidoras') or '').strip(); uf=(r.get('SigUF') or '').strip(); municipalities.add(m); sets[s]+=1; ufs[uf]+=1; keys[(m,s)]+=1; g=(r.get('DatGeracaoConjuntoDados') or '').strip(); latest=g if latest is None or g>latest else latest
    return {'file':str(p),'bytes':p.stat().st_size,'sha256':sha(p),'rows':rows,'headers':headers,'distinctMunicipalCodes':len(municipalities),'distinctSets':len(sets),'distinctUF':len(ufs),'rowsWithMultipleMunicipalities':sum(1 for v in sets.values() if v>1),'rowsWithMultipleSets':sum(1 for v in Counter(k[0] for k in keys).values() if v>1),'duplicateNaturalKeys':sum(v-1 for v in keys.values() if v>1),'latestGeneration':latest}

def main():
    out={'indger':indger(),'indqual':indqual(),'decFec':dec_file('dec-fec/indicadores-continuidade-coletivos-2020-2029.csv'),'decLimits':dec_file('dec-fec-limites.csv'),'decAttributes':dec_file('dec-fec-atributos.csv')}
    (OUT/'p132_audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
