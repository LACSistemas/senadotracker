import csv, hashlib, json, re
from pathlib import Path
import pandas as pd

ROOT=Path(r'D:\Civica\raw\infraestrutura\logistica')
STAGE=Path(r'D:\Civica\staging\infraestrutura\logistica'); STAGE.mkdir(parents=True,exist_ok=True)

def sha(p):
    h=hashlib.sha256();
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def clean(v):
    if v is None: return None
    s=str(v).strip(); return None if not s or s.lower() in {'nan','none'} else s
def dump(n,o): (STAGE/n).write_text(json.dumps(o,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

STATES={'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amapa':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Ceara':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Espirito Santo':'ES','Goiás':'GO','Goias':'GO','Maranhão':'MA','Maranhao':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Minas Gerais':'MG','Pará':'PA','Para':'PA','Paraíba':'PB','Paraiba':'PB','Paraná':'PR','Parana':'PR','Pernambuco':'PE','Piauí':'PI','Piaui':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Rondonia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sao Paulo':'SP','Sergipe':'SE','Tocantins':'TO'}

def aerodromes():
    p=ROOT/'anac_AerodromosPublicos.csv'; rows=[]
    with open(p,encoding='latin1',newline='') as f:
        next(f, None)
        rd=csv.DictReader(f,delimiter=';');
        for r in rd:
            key=clean(r.get('CIAD')) or clean(r.get('Código OACI')) or clean(r.get('Nome'))
            if not key: continue
            uf=STATES.get(clean(r.get('UF')),clean(r.get('UF')))
            def num(k):
                try:return float(str(r.get(k,'')).replace(',','.'))
                except:return None
            rows.append({'source_system':'ANAC','source_key':key,'facility_type':'AERODROME_PUBLIC','name':clean(r.get('Nome')),'uf':uf,'municipality':clean(r.get('Município')),'municipality_served':clean(r.get('Município Servido')),'oaci':clean(r.get('Código OACI')),'latitude':num('LATGEOPOINT'),'longitude':num('LONGEOPOINT'),'status':clean(r.get('Situação')),'competence':202610})
    dump('anac_aerodromes.json',{'source_file':str(p),'source_sha256':sha(p),'source_rows':len(rows),'rows':rows,'ufs':sorted(set(r['uf'] for r in rows if r['uf']))}); return len(rows)

def snv():
    p=ROOT/'dnit_snv_202407a.xls'; d=pd.read_excel(p,sheet_name='TABELA SNV',header=2)
    rows=[]
    for i,r in d.iterrows():
        code=clean(r.get('CÃ³digo')) or clean(r.get('Código')) or clean(r.get('BR'))
        if not code: continue
        def fl(k):
            try:return float(str(r.get(k,'')).replace(',','.'))
            except:return None
        ext=fl('ExtensÃ£o') or fl('Extensão')
        uf=clean(r.get('UF ')) or clean(r.get('UF'))
        rows.append({'source_system':'DNIT','source_key':f'SNV202407A:{i}:{code}','network_type':'FEDERAL_ROAD','route':f"BR-{clean(r.get('BR'))}" if clean(r.get('BR')) else None,'uf':uf,'segment':f"{clean(r.get('Local de InÃ­cio')) or clean(r.get('Local de Início'))} -> {clean(r.get('Local de Fim')) or clean(r.get('Local de Fim'))}",'length_km':ext,'paved_km':ext if (clean(r.get('SuperfÃ­cie')) or '').upper() in {'PAV','PAVIMENTADA'} else 0,'surface':clean(r.get('SuperfÃ­cie')),'condition_index':None,'competence':202407})
    dump('dnit_snv.json',{'source_file':str(p),'source_sha256':sha(p),'source_rows':len(rows),'rows':rows}); return len(rows)

def pavement():
    out=[]
    for fn in ['dnit_pavimentada_2026_09.csv','dnit_nao_pavimentada_2026_09.csv']:
        p=ROOT/fn
        with open(p,encoding='utf-8-sig',newline='') as f:
            rd=csv.DictReader(f,delimiter=';')
            for i,r in enumerate(rd):
                key=clean(r.get('id_malha')) or str(i)
                try:
                    a=float(str(r.get('Km_Inicial','')).replace(',','.')); b=float(str(r.get('Km_Final','')).replace(',','.')); ext=abs(b-a)
                except: ext=None
                try: icm=float(str(r.get('ICM_Unificado','')).replace(',','.'))
                except:
                    try: icm=float(str(r.get('ICM','')).replace(',','.'))
                    except: icm=None
                out.append({'source_system':'DNIT','source_key':f'PAV202609:{key}:{r.get("Sentido") or ""}:{i}','network_type':'FEDERAL_ROAD_CONDITION','route':clean(r.get('Rodovia')),'uf':clean(r.get('UF')),'segment':f"{r.get('Km_Inicial')}->{r.get('Km_Final')}",'length_km':ext,'paved_km':ext if 'pavimentada' in fn else 0,'surface':clean(r.get('Superfície')),'condition_index':icm,'competence':202609})
    dump('dnit_pavement.json',{'source_rows':len(out),'rows':out,'files':[{'file':fn,'sha256':sha(ROOT/fn)} for fn in ['dnit_pavimentada_2026_09.csv','dnit_nao_pavimentada_2026_09.csv']]}); return len(out)

if __name__=='__main__': print({'aerodromes':aerodromes(),'snv':snv(),'pavement':pavement()})
