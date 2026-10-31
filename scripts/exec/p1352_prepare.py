import csv, json, re
from pathlib import Path
ROOT=Path(r'D:\Civica\raw\infraestrutura\recursos_hidricos')
ST=Path(r'D:\Civica\staging\infraestrutura\recursos_hidricos')
ST.mkdir(parents=True, exist_ok=True)
def clean(v):
    if v is None:return None
    v=str(v).strip()
    return None if v in ('','-','N/A','Não se aplica a esse tipo de barragem') else v
def pick(row,names):
    for n in names:
        if n in row:return row.get(n)
    return None
def dms(s):
    if not s:return None
    s=str(s).strip().replace('º','°').replace("''",'"')
    m=re.search(r'([+-]?\d+)[° ]+(\d+)[\' ]+(\d+(?:[.,]\d+)?)',s)
    if not m:
        try:return float(str(s).replace(',','.'))
        except:return None
    v=float(m.group(1))+float(m.group(2))/60+float(m.group(3).replace(',','.'))/3600
    if m.group(1).startswith('-') or 'SUL' in s.upper() or 'OESTE' in s.upper():v=-abs(v)
    return v
anm=[]
with open(ROOT/'anm'/'Barragens.csv',encoding='latin1',newline='') as f:
    for r in csv.DictReader(f):
        anm.append({'sourceKey':clean(pick(r,['ID'])),'name':clean(pick(r,['Nome'])),'entrepreneur':clean(pick(r,['Empreendedor'])),'uf':clean(pick(r,['UF'])),'municipality':clean(pick(r,['Município','Munic\xedpio'])),'latitude':dms(clean(pick(r,['Latitude']))),'longitude':dms(clean(pick(r,['Longitude']))),'categoryRisk':clean(pick(r,['Categoria de Risco - CRI'])),'potentialDamage':clean(pick(r,['Dano Potencial Associado - DPA'])),'operationalStatus':clean(pick(r,['Situação Operacional'])),'emergencyLevel':clean(pick(r,['Nível de Emergência'])),'pnsb':clean(pick(r,['Inserido na PNSB'])),'pae':clean(pick(r,['Necessita de PAEBM'])),'primaryUse':clean(pick(r,['Estrutura com o Objetivo de Contenção'])),'fiscalAuthority':'ANM'})
snisb=[]
for p in sorted((ROOT/'snisb').glob('ids-page-*.json')):
    for f in json.loads(p.read_text(encoding='utf-8')).get('features',[]):
        a=f.get('attributes',{})
        snisb.append({'sourceKey':str(a.get('BAR_CD_SNISB')),'name':clean(a.get('BAR_NM_NOME')),'entrepreneur':clean(a.get('NM_EMPREENDEDOR')),'uf':clean(a.get('ING_SG_UFMUNICIPIO')),'municipality':clean(a.get('ING_NM_MUNICIPIO')),'latitude':a.get('BAR_NU_LATITUDE'),'longitude':a.get('BAR_NU_LONGITUDE'),'primaryUse':clean(a.get('USO_PRINCIPAL')),'categoryRisk':clean(a.get('CATEGORIA_RISCO')),'potentialDamage':clean(a.get('DANO_POTENCIAL')),'operationalStatus':clean(a.get('FASE_DE_VIDA')),'emergencyLevel':None,'pnsb':clean(a.get('REGULADA_PELO_PNSB')),'pae':clean(a.get('POSSUI_PAE')),'inspectionDate':a.get('INS_DT_INSPECAO'),'fiscalAuthority':clean(a.get('ORG_NM_ORGANIZACAO'))})
seen_snisb={}
for x in snisb:
    if x['sourceKey'] not in seen_snisb:
        seen_snisb[x['sourceKey']]=x
snisb=list(seen_snisb.values())
atlas=[]
for p in sorted((ROOT/'atlas').glob('page-*.json')):
    for f in json.loads(p.read_text(encoding='utf-8')).get('features',[]):
        a=f.get('attributes',{})
        atlas.append({'ibge7':int(a['CDMUN']) if a.get('CDMUN') is not None else None,'municipality':clean(a.get('NMMUN')),'uf':clean(a.get('SGUF')),'ish':clean(a.get('ISH')),'tpm':clean(a.get('TPMAN')),'csm':clean(a.get('CSMAN')),'tpsis':clean(a.get('TPSIS')),'tpope':clean(a.get('TPOPE'))})
seen={}; dup=0
for x in atlas:
    if x['ibge7'] is None:continue
    if x['ibge7'] in seen:dup+=1
    else:seen[x['ibge7']]=x
atlas=list(seen.values())
(ST/'snisb_facilities.json').write_text(json.dumps(snisb,ensure_ascii=False),encoding='utf-8')
(ST/'anm_facilities.json').write_text(json.dumps(anm,ensure_ascii=False),encoding='utf-8')
(ST/'atlas_municipalities.json').write_text(json.dumps(atlas,ensure_ascii=False),encoding='utf-8')
stats={'snisbRows':len(snisb),'snisbUnique':len({x['sourceKey'] for x in snisb if x['sourceKey']}),'anmRows':len(anm),'anmUnique':len({x['sourceKey'] for x in anm if x['sourceKey']}),'atlasSourceRows':sum(len(json.loads(p.read_text(encoding='utf-8')).get('features',[])) for p in (ROOT/'atlas').glob('page-*.json')),'atlasUniqueMunicipalities':len(atlas),'atlasDuplicates':dup}
(ST/'prepare-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
print(json.dumps(stats,indent=2,ensure_ascii=False))
