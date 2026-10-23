import re,json,unicodedata
MES={'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12}
def mes_of(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    # evita 'modelo' (contém 'mod') etc.: procura tokens de mês em ordem de prioridade
    for pat,m in [('janeiro',1),('fevereiro',2),('marco',3),('maro',3),('abril',4),('maio',5),('junho',6),('julho',7),('agosto',8),('setembro',9),('outubro',10),('novembro',11),('dezembro',12)]:
        if pat in s: return m
    for t in re.split(r'[^a-z]+',s):
        if t in MES: return MES[t]
    return None
L=json.load(open('frota_links.json',encoding='utf-8'))
out=[];unres=[]
for y,items in L.items():
    for h,t in items:
        if not re.search(r'@@download',h): continue
        tl=unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode().lower(); fn=h.split('/@@')[0].split('/')[-1]
        hl=h.lower()
        is_mun = ('municipio' in tl and 'tipo' in tl and not re.search(r'combust|fab|cep|cor|pot|restri|eixo',tl)) or (int(y)<=2013 and tl.strip().startswith('frota por municipio')) or (re.search(r'munic',fn.lower()) and re.search(r'tipo|modelo|munic_',fn.lower()) and not re.search(r'combust|ano_fab|cep|_cor|potenc|restri|eixo',hl))
        if not is_mun: continue
        m=mes_of(fn) or mes_of(h.split('/@@')[0])
        if not m: unres.append((y,fn)); continue
        out.append(dict(year=int(y),month=m,url=('https://www.gov.br'+h if h.startswith('/') else h),file=fn,title=t))
print(len(out),'unres',unres[:10])
import collections
c=collections.Counter((o['year'],o['month']) for o in out)
dups=[k for k,v in c.items() if v>1]; print('dups',dups)
miss=[(y,m) for y in range(2013,2027) for m in range(1,13) if (y,m) not in c and (y<2026 or m<=9)]
print('faltando',miss)
json.dump(out,open('frota_inv.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
