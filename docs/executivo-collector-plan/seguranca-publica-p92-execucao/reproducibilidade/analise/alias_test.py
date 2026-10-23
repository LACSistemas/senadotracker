import json,re,unicodedata,collections,os
def key(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().upper(); return re.sub(r'[^A-Z0-9]','',s)
ib=json.load(open('../p9/ibge_munis.json',encoding='utf-8')); K={}
for r in ib: K[(r['uf'],key(r['name']))]=r
ALI={('BA','LAGEDODOTABOCAL'):'Lajedo do Tabocal',('BA','SANTATERESINHA'):'Santa Terezinha',('GO','BOMJESUS'):'Bom Jesus de Goiás',('MG','AMPARODASERRA'):'Amparo do Serra',('MG','BARAOD0MONTEALTO'):'Barão do Monte Alto',('MG','QUELUZITA'):'Queluzito',('MT','SANTOANTONIODOLEVERGER'):'Santo Antônio de Leverger',('MT','VILABELADASANTISSIMATRINDA'):'Vila Bela da Santíssima Trindade',('PA','ELDORADODOSCARAJAS'):'Eldorado do Carajás',('PA','SANTAISABELDOPARA'):'Santa Izabel do Pará',('PB','SANTAREM'):'Joca Claudino',('PB','SAODOMINGOSDEPOMBAL'):'São Domingos',('PE','BELEMDESAOFRANCISCO'):'Belém do São Francisco',('PE','IGUARACI'):'Iguaracy',('PE','LAGOADOITAENGA'):'Lagoa de Itaenga',('PI','SAOFRANCISCODEASSISDOPIAU'):'São Francisco de Assis do Piauí',('PR','BELAVISTADOCAROBA'):'Bela Vista da Caroba',('PR','MUNHOZDEMELLO'):'Munhoz de Melo',('PR','PINHALDOSAOBENTO'):'Pinhal de São Bento',('PR','SANTACRUZDOMONTECASTELO'):'Santa Cruz de Monte Castelo',('RJ','PARATI'):'Paraty',('RJ','TRAJANODEMORAIS'):'Trajano de Moraes',('RN','ARES'):'Arez',('RN','BOASAUDE'):'Januário Cicco',('RR','SAOLUIZ'):'São Luiz do Anauá',('SC','LAGEADOGRANDE'):'Lajeado Grande',('SC','PRESIDENTECASTELOBRANCO'):'Presidente Castello Branco',('SC','SAOLOURENCODOESTE'):'São Lourenço do Oeste',('SC','SAOMIGUELDOESTE'):'São Miguel do Oeste',('SE','AMPARODESAOFRANCISCO'):'Amparo do São Francisco',('TO','COUTODEMAGALHAES'):'Couto Magalhães',('TO','FORTALEZADOTABOCAO'):'Tabocão',('TO','SAOVALERIODANATIVIDADE'):'São Valério',('MG','GOUVEA'):'Gouveia',('MG','BRASOPOLIS'):'Brazópolis',('SP','EMBU'):'Embu das Artes',('MT','POXOREO'):'Poxoréu',('RO','NOVADOMAMORE'):'Nova Mamoré',('RJ','ARMACAODEBUZIOS'):'Armação dos Búzios',('PB','CAMPODESANTANA'):'Tacima',('SC','BALNEARIODEPICARRAS'):'Balneário Piçarras',('SC','PICARRAS'):'Balneário Piçarras',('CE','ITAPAGE'):'Itapajé',('BA','MUQUEMDESAOFRANCISCO'):'Muquém do São Francisco',('RN','ACU'):'Assú',('RN','AUGUSTOSEVERO'):'Campo Grande',('RO','VILANOVADOMAMORE'):'Nova Mamoré',('SC','BARRADOSUL'):'Balneário Barra do Sul'}
bad=[(k,v) for k,v in ALI.items() if (k[0],key(v)) not in K]; print('canonicos inexistentes',bad)
IGN=('MUNICIPIONAOINFORMADO',)
col=collections.Counter(); unm=collections.Counter(); miss=collections.Counter(); months=0
for f in sorted(os.listdir('fj')):
    if not f.endswith('.json') or f.startswith('202507__copy'): continue
    j=json.load(open('fj/'+f,encoding='utf-8')); months+=1; seen={}
    for r in j['rows']:
        uf,m=r[0],r[1]
        if uf=='UF' or key(m)=='MUNICIPIO': continue
        k=key(m)
        if k in IGN: continue
        e=K.get((uf,k)) or (K.get((uf,key(ALI[(uf,k)]))) if (uf,k) in ALI else None)
        if e is None: unm[(uf,m)]+=1; continue
        if e['entity_id'] in seen: col[(f[:6],e['name'],seen[e['entity_id']],m)]+=1
        seen[e['entity_id']]=m
    for r in ib:
        if r['entity_id'] not in seen: miss[(r['uf'],r['name'])]+=1
print('meses',months,'colisoes',len(col),list(col)[:8]); print('nao conciliados',dict(unm)); print('entidades ausentes por mes (qtd meses)',sorted(miss.items(),key=lambda x:-x[1])[:12])
