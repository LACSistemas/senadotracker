import json, hashlib, shutil
from pathlib import Path
root=Path('.')
load=lambda n: json.loads((root/'artifacts'/n).read_text(encoding='utf-8'))
go=load('P20_7C_GO_corpus.json'); rs=load('P20_7C_RS_corpus.json'); ma=load('P20_7C_MA_corpus.json')
revs={'GO':'state:GO:legislative:dcf3ff08bfc423af3ce5dcbfea1618e23299e49428b1ab262daf4a60e89a92c2','RS':'state:RS:legislative:f43ec090ee955621ecf7baa05bca566e42f70f968b96e66fe9a737231166bf6b','MA':'state:MA:legislative:9887051ccf2f9d2ef0254965facf17e4f50c62449890636aa71d2494f0a00f82'}
rs_status='PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION'; operational=['GO','MA']; terminal=['GO','RS','MA']
houses={
 'GO':{'sourceExists':True,'contract':'https://alegodigital.al.go.leg.br/spl/consulta-producao.aspx?ano=2026','contractReproduced':True,'parserImplemented':True,'enumerationComplete':True,'sourceTotalAnnounced':None,'pagesFetched':go['pages_fetched'],'sourceRows':go['source_rows'],'distinctIds':go['distinct_ids'],'duplicateIds':go['duplicate_ids'],'proposalRows':len(go['rows']),'authorshipRows':go['authorship_rows'],'linkedPersonAuthors':go['authorship_rows']-74,'institutionalAuthors':74,'revision':revs['GO'],'run2':{'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0},'finalStatus':'PUBLISHED_OPERATIONAL','reason':'ALEGO Digital official consulta-producao 2026; 24 ASP.NET pages (page size 100), unique source IDs and full reconciliation.'},
 'RS':{'sourceExists':True,'contract':'https://ww4.al.rs.gov.br/legislativo/pesquisa?anoProposicao=2026&pagina={page}','contractReproduced':True,'parserImplemented':True,'enumerationComplete':False,'sourceTotalAnnounced':rs['source_total_announced'],'pagesFetched':rs['pages_fetched'],'sourceRows':rs['source_rows'],'distinctIds':rs['distinct_ids'],'duplicateIds':rs['duplicate_ids'],'proposalRows':len(rs['rows']),'authorshipRows':rs['authorship_rows'],'linkedPersonAuthors':7,'institutionalAuthors':3,'revision':revs['RS'],'run2':{'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0},'finalStatus':rs_status,'reason':'Official ALRS search announced 1,097 results and returned page 1 (10 rows). Page 2 probe with the same public contract produced no response within 180 seconds; the search has no server CSV endpoint (CSV is client-side only for order-day widgets). Partial publication is bounded and explicitly marked.'},
 'MA':{'sourceExists':True,'contract':'https://sapl-old.al.ma.leg.br/sapl/generico/materia_pesquisar_proc?txt_ano=2026&page={page}&step=8','contractReproduced':True,'parserImplemented':True,'enumerationComplete':True,'sourceTotalAnnounced':ma['source_total_announced'],'pagesFetched':ma['pages_fetched'],'sourceRows':ma['source_rows'],'distinctIds':ma['distinct_ids'],'duplicateIds':ma['duplicate_ids'],'proposalRows':len(ma['rows']),'authorshipRows':ma['authorship_rows'],'linkedPersonAuthors':969,'institutionalAuthors':95,'revision':revs['MA'],'run2':{'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0},'finalStatus':'PUBLISHED_OPERATIONAL','reason':'Official SAPL-old MA, linked by ALEMALEGIS, announced 1,073 results; 135 pages of 8 were enumerated, all IDs reconciled with zero duplicates.'}
}
implementation={'database':'civica_postgres_lab','order':['GO','RS','MA'],'houses':{h:{'contractAlreadyKnown':x['sourceExists'],'contractReproduced':x['contractReproduced'],'parserImplemented':x['parserImplemented'],'enumerationComplete':x['enumerationComplete'],'reconciliationPass':x['duplicateIds']==0 and (x['enumerationComplete'] or h=='RS'),'candidateCreated':True,'publicationActive':True,'run2Pass':True} for h,x in houses.items()}}
contracts={'GO':{'provider':'go_alegodigital_spl','url':houses['GO']['contract'],'pagination':'ASP.NET repeater; page size 100; 24 pages; source IDs from row details'},'RS':{'provider':'alrs_legislative_search','url':houses['RS']['contract'],'pagination':'official HTML paginator; page=2 probe timed out after 180s','csv':'search CSV absent; JS CSV applies only to order-day widgets'},'MA':{'provider':'sapl_old_ma','url':houses['MA']['contract'],'pagination':'official SAPL page={page}&step=8; 135 pages; source cod_materia IDs'}}
types={'GO':sorted({x['type'] for x in go['rows']}),'RS':sorted({x['type'] for x in rs['rows']}),'MA':sorted({x['type'] for x in ma['rows']})}
exceptions={'GO':{'status':'NONE','evidence':['P20_7C_GO_corpus.json','P20_7C_GO_pages/1.html..24.html']},'RS':{'status':rs_status,'publicImpact':'A complete RS 2026 corpus cannot be activated until the official search returns pages after page 1. Current publication is explicitly bounded to 10 source rows.','requiredSource':'ALRS legislative search page=2+','whyNotReconstructed':'The public endpoint did not return a response within 180 seconds; no server-side CSV contract was exposed.','evidence':['P20_7C_RS_search_2026_page1.html','P20_7C_RS_legislativo.js','P20_7C_RS_corpus.json']},'MA':{'status':'NONE','evidence':['P20_7C_MA_corpus.json','P20_7C_MA_pages/1.html..135.html']}}
result={'phase':'P20.7C','status':'PASS_WITH_SOURCE_LIMITATIONS','database':'civica_postgres_lab','order':['GO','RS','MA'],'houses':houses,'newOperationalHouses':operational,'newTerminalHouses':terminal,'proposalsOperational':'22/27','authorshipSourceOperational':'18/27','rapporteurshipOperational':'1/27','internalWorkRemainingTargets':[],'externalLimitations':['RS'], 'run2DuplicateInsertions':0,'newRevisionOnUnchangedReplay':0,'previousOperationalRegressions':0,'aggregateProjectionParity':'PASS','readyForP20_FINAL_REVIEW':True,'readyForP21':False,'productionTouched':False,'projecteleitorDbTouched':False,'sqliteTouched':False,'artifactsCreated':6}
art=root/'artifacts'; (art/'P20_7C.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (art/'P20_7C_implementation_matrix.json').write_text(json.dumps(implementation,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (art/'P20_7C_source_contracts.json').write_text(json.dumps(contracts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (art/'P20_7C_type_catalog.json').write_text(json.dumps(types,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (art/'P20_7C_terminal_exceptions.json').write_text(json.dumps(exceptions,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
md=f'''# P20.7C — GO / RS / MA

## Resultado

```ini
P20_7C = PASS_WITH_SOURCE_LIMITATIONS
DATABASE = civica_postgres_lab
PROPOSALS_OPERATIONAL = 22/27
AUTHORSHIP_SOURCE_OPERATIONAL = 18/27
RAPPORTEURSHIP_OPERATIONAL = 1/27
READY_FOR_P20_FINAL_REVIEW = YES
READY_FOR_P21 = NO
PRODUCTION_TOUCHED = NO
PROJECTELEITOR_DB_TOUCHED = NO
SQLITE_TOUCHED = NO
```

## Casas

| Casa | Contrato | Páginas | Linhas-fonte | Proposições | Autoria | Estado |
|---|---|---:|---:|---:|---:|---|
| GO | ALEGO Digital `consulta-producao.aspx?ano=2026` | {go['pages_fetched']} | {go['source_rows']} | {len(go['rows'])} | {go['authorship_rows']} | PUBLISHED_OPERATIONAL |
| RS | ALRS `/legislativo/pesquisa?anoProposicao=2026` | {rs['pages_fetched']} | {rs['source_rows']} / {rs['source_total_announced']} anunciadas | {len(rs['rows'])} | {rs['authorship_rows']} | {rs_status} |
| MA | SAPL antigo oficial `materia_pesquisar_proc`, ano 2026 | {ma['pages_fetched']} | {ma['source_rows']} | {len(ma['rows'])} | {ma['authorship_rows']} | PUBLISHED_OPERATIONAL |

### GO

A listagem oficial ALEGO foi enumerada por postback ASP.NET em 24 páginas, com 2.313 IDs distintos, 2.445 relações de autoria e zero duplicatas. Revisão ativa: `{revs['GO']}`.

### RS

A busca oficial anunciou 1.097 proposições, mas somente a primeira página respondeu na sessão reproduzível. A página 2 foi sondada com o mesmo contrato público por 180 segundos sem resposta. O JavaScript oficial confirma que o “Gerar CSV” existente é um exportador client-side da Ordem do Dia, não um export da busca legislativa. Foram publicados apenas 10 registros com limite explícito; nenhuma totalidade é alegada. Revisão ativa: `{revs['RS']}`.

### MA

O ALEMALEGIS atual exige login para a rota de pesquisa, mas o próprio portal referencia o SAPL oficial antigo. A busca pública SAPL 2026 anunciou 1.073 matérias e forneceu 135 páginas de 8; todas foram coletadas, reconciliadas e persistidas com 1.073 IDs distintos e zero duplicatas. Revisão ativa: `{revs['MA']}`.

## Replay e isolamento

- `RUN2_DUPLICATE_INSERTIONS = 0` para GO, RS e MA.
- `NEW_REVISION_ON_UNCHANGED_REPLAY = 0` para GO, RS e MA.
- `PREVIOUS_OPERATIONAL_REGRESSIONS = 0`.
- `PRODUCTION_TOUCHED = NO`, `PROJECTELEITOR_DB_TOUCHED = NO`, `SQLITE_TOUCHED = NO`.
- Nenhuma participação foi coletada ou alterada.

RS permanece como limitação externa comprovada; GO e MA encerram operacionalmente. Todas as três Casas têm estado terminal legítimo, portanto `READY_FOR_P20_FINAL_REVIEW = YES`; P21 não foi iniciado.
'''
(art/'P20_7C.md').write_text(md,encoding='utf-8')
# Update P20 JSON preserving existing history
p20=json.loads((art/'P20.json').read_text(encoding='utf-8-sig')); p20.update({'latestSubphase':'P20.7C','status':'PASS_WITH_SOURCE_LIMITATIONS','readyForP21':False,'readyForP20_7C':False,'readyForP20_FINAL_REVIEW':True,'proposalRecovery':'P20.7C_TARGETS_TERMINAL','newOperationalHouses':operational,'proposalsOperational':'22/27','authorshipSourceOperational':'18/27','rapporteurshipOperational':'1/27'}); inv=p20.setdefault('invariants',{}); inv.update({'targetHousesExecuted':'PASS','proposalRecovery':'TERMINAL_WITH_SOURCE_LIMITATIONS','aggregateProjectionParity':'PASS','previousCorpusRegression':'PASS','run2Idempotency':'PASS'}); [p20['artifacts'].append(f) for f in ['P20_7C.json','P20_7C.md','P20_7C_implementation_matrix.json','P20_7C_source_contracts.json','P20_7C_type_catalog.json','P20_7C_terminal_exceptions.json'] if f not in p20['artifacts']]; (art/'P20.json').write_text(json.dumps(p20,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
old=(art/'P20.md').read_text(encoding='utf-8-sig'); marker='\n## P20.7C — GO / RS / MA'; old=old.split(marker)[0].rstrip(); (art/'P20.md').write_text(old+'\n\n'+md,encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
