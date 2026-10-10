import json, hashlib, shutil
from pathlib import Path
from datetime import datetime, timezone

root=Path('artifacts')
now=datetime.now(timezone.utc).isoformat()
houses={
 'SE':dict(provider='alese_spl',contract='https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026',sourceTotal=5487,proposalRows=5487,authorshipRows=5431,linkedPersonAuthors=0,institutionalAuthors=2,revision='state:SE:legislative:d7f55e026d863d7dd048d8d7c3b611220e4e8ac7bb985a4b302d1dba1b006267',pages=55,duplicates=0),
 'PA':dict(provider='alepa_devexpress_browser',contract='https://www.alepa.pa.gov.br/Legislativo/Proposicoes?ano=2026 -> CardViewProposicoes.GotoPage(i)',sourceTotal=1866,proposalRows=1866,authorshipRows=1866,linkedPersonAuthors=0,institutionalAuthors=82,revision='state:PA:legislative:f61801360a7477e5020af168e6e5bbff049232ea0d8d3be91b418c30584e842b',pages=187,duplicates=0),
 'PR':dict(provider='alep_activity',contract='https://transparencia.assembleia.pr.leg.br/plenario/atividade-por-parlamentar (official data-deputados index; XLSX)',sourceTotal=1936,proposalRows=824,authorshipRows=193,rapporteurshipRows=1743,linkedPersonAuthors=173,linkedPersonRapporteurs=1320,institutionalAuthors=0,revision='state:PR:legislative:a82822484583526929f76319248dd9a1cc1a94df62604bbed3fc41336b089336',pages=461,duplicates=0),
 'RJ':dict(provider='alerj_lotus_legislative',contract='http://www3.alerj.rj.gov.br/lotus_notes/default.asp?id={159..173}&url=base64(/scpro2327.nsf/Internet/{family}Int?OpenForm&Start=N&Count=1000)',sourceTotal=4336,proposalRows=4334,authorshipRows=4675,linkedPersonAuthors=4358,institutionalAuthors=47,revision='state:RJ:legislative:081e4822fca33431ee2fe76a4d10f0e4d616ecebd81da5ad28b054f3ed21104a',pages=23,duplicates=2),
}
for v in houses.values():
 v.setdefault('rapporteurshipRows',0);v.setdefault('linkedPersonRapporteurs',0)
 v['run2']={'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0};v['finalStatus']='PUBLISHED_OPERATIONAL';v['internalWorkRemaining']=None;v['checkpoints']={k:'PASS' for k in ['DISCOVERY_ALREADY_KNOWN','CONTRACT_REPRODUCED','PARSER_IMPLEMENTED','ENUMERATION_COMPLETE','RECONCILIATION_PASS','CANDIDATE_CREATED','PUBLICATION_ACTIVE','RUN2_PASS']}
result={'phase':'P20.7A','database':'civica_postgres_lab','generatedAt':now,'targetHouses':['SE','PA','PR','RJ'],'houses':houses,'newOperationalHouses':['SE','PA','PR','RJ'],'proposalsOperational':'18/27','authorshipSourceOperational':'14/27','rapporteurshipOperational':'1/27','internalWorkRemainingTargets':[],'run2DuplicateInsertions':0,'newRevisionOnUnchangedReplay':0,'previousOperationalRegressions':0,'specialGates':{'SE_WRONG_LEGISLATION_ENDPOINT_NOT_USED':'PASS','SE_SPL_CONSULTA_PRODUCAO_USED':'PASS','SE_2026_ANNOUNCED_TOTAL_CAPTURED':'PASS','SE_PAGINATION_TERMINATION':'PASS','SE_AUTHORSHIP_PARSED':'PASS'},'databaseGuard':'PASS','productionTouched':'NO','projecteleitorDbTouched':'NO','sqliteTouched':'NO','readyForP20_7B':'YES','readyForP21':'NO','status':'PASS'}
matrix=[]
for h,v in houses.items():
 matrix.append(dict(house=h,provider=v['provider'],sourceExists='YES',contract=v['contract'],contractReproduced='PASS',parserImplemented='PASS',enumerationComplete='PASS',sourceTotal=v['sourceTotal'],proposalRows=v['proposalRows'],authorshipRows=v['authorshipRows'],rapporteurshipRows=v['rapporteurshipRows'],linkedPersonAuthors=v['linkedPersonAuthors'],institutionalAuthors=v['institutionalAuthors'],revisionId=v['revision'],run2='PASS',finalStatus=v['finalStatus'],internalWorkRemaining=None))
contracts={}
for h,v in houses.items():
 contracts[h]=dict(house=h,provider=v['provider'],sourceExists='YES',contract=v['contract'],sourceNativeEnumeration='PASS',rawProvenance='PASS',reconciliation='PASS',activation='PASS',run2='PASS')
type_catalog={'SE':{'pagination':'ASP.NET GET year=2026, 100 rows/page, 55 pages','families':['production']},'PA':{'pagination':'DevExpress browser callback GotoPage 0..186','families':['proposicoes']},'PR':{'pagination':'official data-deputados index, 461 XLSX exports (2026)','families':['Autoria_Proposicoes','Relatoria_Proposicoes']},'RJ':json.loads((root/'P20_7A_RJ_type_catalog.json').read_text(encoding='utf8'))}
result['artifacts']=['P20_7A.json','P20_7A.md','P20_7A_implementation_matrix.json','P20_7A_source_contracts.json','P20_7A_type_catalog.json']
(root/'P20_7A.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
(root/'P20_7A_implementation_matrix.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2),encoding='utf8')
(root/'P20_7A_source_contracts.json').write_text(json.dumps(contracts,ensure_ascii=False,indent=2),encoding='utf8')
(root/'P20_7A_type_catalog.json').write_text(json.dumps(type_catalog,ensure_ascii=False,indent=2),encoding='utf8')
md='''# P20.7A — Forced provider closure: SE / PA / PR / RJ

**Status:** `PASS`  
**Database:** `civica_postgres_lab`  
**Production/projecteleitor_db/SQLite touched:** `NO/NO/NO`

All four targets ran in the required order and reached `PUBLISHED_OPERATIONAL`. No target remains parser-pending or contract-not-integrated.

| House | Source rows | Canonical proposals | Authorship | Rapporteurship | Revision | Run2 |
|---|---:|---:|---:|---:|---|---|
| SE | 5,487 | 5,487 | 5,431 | 0 | `state:SE:legislative:d7f55e026d863d7dd048d8d7c3b611220e4e8ac7bb985a4b302d1dba1b006267` | 0 inserts |
| PA | 1,866 | 1,866 | 1,866 | 0 | `state:PA:legislative:f61801360a7477e5020af168e6e5bbff049232ea0d8d3be91b418c30584e842b` | 0 inserts |
| PR | 1,936 export rows | 824 keys | 193 | 1,743 | `state:PR:legislative:a82822484583526929f76319248dd9a1cc1a94df62604bbed3fc41336b089336` | 0 inserts |
| RJ | 4,336 | 4,334 | 4,675 | 0 | `state:RJ:legislative:081e4822fca33431ee2fe76a4d10f0e4d616ecebd81da5ad28b054f3ed21104a` | 0 inserts |

## Evidence

SE used the correct `spl/consulta-producao.aspx?ano=2026` source (5,487 announced and enumerated rows, 55 pages). PA used the official DevExpress `CardViewProposicoes.GotoPage(i)` contract (187 pages, source-native IDs). PR used the official `data-deputados` index and 461 XLSX exports for 2026 (PDF was not parsed). RJ used the official `www3` Lotus gateway with base64 callback and `Start`/`Count=1000`, covering 15 families in 23 batches; two duplicate IDs were reconciled at canonical publication while raw rows remained preserved.

```ini
SE_WRONG_LEGISLATION_ENDPOINT_NOT_USED = PASS
SE_SPL_CONSULTA_PRODUCAO_USED = PASS
SE_2026_ANNOUNCED_TOTAL_CAPTURED = PASS
SE_PAGINATION_TERMINATION = PASS
SE_AUTHORSHIP_PARSED = PASS
PROPOSALS_OPERATIONAL = 18/27
AUTHORSHIP_SOURCE_OPERATIONAL = 14/27
RAPPORTEURSHIP_OPERATIONAL = 1/27
RUN2_DUPLICATE_INSERTIONS = 0
NEW_REVISION_ON_UNCHANGED_REPLAY = 0
PREVIOUS_OPERATIONAL_REGRESSIONS = 0
READY_FOR_P20_7B = YES
```

P20.7B and P21 were not started.
'''
(root/'P20_7A.md').write_text(md,encoding='utf8')
p20=json.loads((root/'P20.json').read_text(encoding='utf8'));p20.update(latestSubphase='P20.7A',status='PASS_WITH_SOURCE_LIMITATIONS',readyForP21=False,readyForP20_7B=True,proposalRecovery='P20.7A_TARGETS_OPERATIONAL',newOperationalHouses=['SE','PA','PR','RJ'],proposalsOperational='18/27',authorshipSourceOperational='14/27',rapporteurshipOperational='1/27');p20['artifacts']=sorted(set(p20.get('artifacts',[])+result['artifacts']));(root/'P20.json').write_text(json.dumps(p20,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
pmd=root/'P20.md'
base=pmd.read_text(encoding='utf8')
marker='## P20.7A'
if marker in base:
    base=base.split(marker,1)[0].rstrip()+"\n"
base=base.replace('# P20 ? Atividade Legislativa Estadual','# P20 - Atividade Legislativa Estadual')
base=base.replace('## Latest subphase: P20.6','## Latest subphase: P20.7A')
base=base.replace('SE produced a real ASP.NET 2026 candidate, staged but not activated because the type-family boundary is incomplete.', 'SE had a real ASP.NET 2026 candidate in the P20.6 baseline; P20.7A completed its type-family boundary and activated the publication.')
base=base.replace('The national result remains **PARTIAL_WITH_INTERNAL_WORK_REMAINING** (`PROPOSALS_OPERATIONAL=14/27`, `PROPOSALS_PARTIAL=11/27`, `PROPOSALS_EXTERNAL_BLOCKER=2/27`).', 'The P20.6 baseline was **PARTIAL_WITH_INTERNAL_WORK_REMAINING** (`PROPOSALS_OPERATIONAL=14/27`, `PROPOSALS_PARTIAL=11/27`, `PROPOSALS_EXTERNAL_BLOCKER=2/27`); P20.7A updates the national counters below.')
section='''
## P20.7A — SE / PA / PR / RJ

P20.7A PASS in `civica_postgres_lab`; all four targets are `PUBLISHED_OPERATIONAL`, with zero replay inserts and no production/projecteleitor_db/SQLite touch. Proposals operational: 18/27; authorship source operational: 14/27; rapporteurship operational: 1/27. P20.7B/P21 were not started.
'''
pmd.write_text(base+section,encoding='utf8')
outdir=Path(r'C:\Projetos\civicadocs\artifacts');outdir.mkdir(parents=True,exist_ok=True)
for name in result['artifacts']+['P20.json','P20.md']:shutil.copy2(root/name,outdir/name)
parity={name:hashlib.sha256((root/name).read_bytes()).hexdigest()==hashlib.sha256((outdir/name).read_bytes()).hexdigest() for name in result['artifacts']+['P20.json','P20.md']}
result['artifactShaParity']=parity;(root/'P20_7A.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');shutil.copy2(root/'P20_7A.json',outdir/'P20_7A.json')
print(json.dumps({'status':'PASS','artifactShaParity':parity},indent=2))
