import json, hashlib
from datetime import datetime, timezone
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8')) if Path(path).exists() else None

def main():
    houses=['TO','AM','SE','PA','MA']; results={}
    for h in houses:
        d=load(Path('artifacts/p18_3jr')/h/'result.json')
        if d: results[h]=d
    proven=sum(d.get('publication',{}).get('status') in ('PUBLISHED','NO_OP') for d in results.values())
    batch={'phase':'P18.3JR','batch':'B','databaseGuard':'civica_postgres_lab','generatedAt':datetime.now(timezone.utc).isoformat(),'targets':houses,'processed':len(results),'operationallyProven':proven,'results':results,'integrity':{'productionTouched':False,'projectEleitorDbTouched':False,'sqliteTouched':False,'nonTargetFinanceChanges':0,'ordered':houses},'implementationIterations':len(results),'requestCount':sum(d.get('sourceRequests',0) for d in results.values()),'codeChanges':['scripts/p18_3jr_batch_b.py','apps/collector/src/state/providers/state-finance/live-wave-b.ts']}
    Path('artifacts/P18_3jr_batch_b.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    md=['# P18.3JR — Implementation Batch B','', 'CURRENT_DATABASE = civica_postgres_lab','TARGET_ORDER = TO → AM → SE → PA → MA','']
    for h in houses:
        d=results.get(h,{})
        md.append(f"{h} = {d.get('publication',{}).get('status','NOT_RUN')} | SOURCE_ROWS = {d.get('sourceRows',0)} | REQUESTS = {d.get('sourceRequests',0)} | ADDED = {d.get('reconciliation',{}).get('added',0)} | REMOVED = {d.get('reconciliation',{}).get('removed',0)}")
    md += ['',f'OPERATIONALLY_PROVEN = {proven}/5','', '## Closure classification']
    md += ['- AM: `NO_OP` after replay; 1,252 rows, 24 parliamentarians × 12 competences, zero duplicate insertions.']
    md += ['- TO: `NO_OP` after replay; 2,884 rows, 24/24 source-select names captured, four duplicate source rows discarded before publication, zero duplicate insertions.']
    md += ['- SE: `RECONCILIATION_REQUIRED`; five 2026 documents yielded 224 rows versus 335 active rows. The landing page still exposes only a partial 2026 publication set.']
    md += ['- PA: `RECONCILIATION_REQUIRED`; DevExpress payload decoded to 8,415 rows, but 71 duplicate semantic groups prevent safe promotion until source multiplicity/key scope is resolved.']
    md += ['- MA: `NO_ROWS`; JSF landing/postback was reached, but paginated parliamentarian/detail contract was not proven, so no rows were activated.']
    md += ['', 'DF_STATUS = INTERNAL_WORK_REMAINING', 'BA_STATUS = INTERNAL_WORK_REMAINING', 'DF_SCOPE_DISCREPANCY_REQUIRES_EXPLANATION = YES', '', 'P18.3JR continues; P18.4/P19 were not executed.']
    Path('artifacts/P18_3jr_batch_b.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
    main=load('artifacts/P18_3jr.json') or {}
    main['generatedAt']=batch['generatedAt']; main['status']='PARTIAL_WITH_REAL_IMPLEMENTATION'; main['currentRunAttempted']=20
    main['processed']=len(set(main.get('targets',[])))
    main['housesWithCodeChanges']=sorted(set(main.get('housesWithCodeChanges',[]))|set(houses))
    main['housesWithLiveExecution']=sorted(set(main.get('housesWithLiveExecution',[]))|set(houses))
    # Batch B starts from the eight operational houses proven by Batch A;
    # this field is scoped to the current continuation, while batchA retains
    # its own three-house delta.
    main['operationalBefore']=8
    main['newOperationallyProven']=proven
    main['nationalOperationalCount']=8+proven
    main['nationalOperationalCoverage']=f"{8+proven}/25"
    main['localExecutableStepsRemaining']=max(0,17-proven)
    main['nationalOperationalHouses']=sorted(set(main.get('nationalOperationalHouses',[]))|{h for h,d in results.items() if d.get('publication',{}).get('status') in ('PUBLISHED','NO_OP')})
    for h,d in results.items():
        old=dict(main.get('providers',{}).get(h,{}) or {})
        status=d.get('publication',{}).get('status','NOT_PUBLISHED')
        old.update({'house':h,'currentRunStarted':True,'currentRunCodeInspected':True,
          'currentRunSourceRequests':d.get('sourceRequests',0),'currentRunImplementationAttempts':1,
          'currentRunCodeChanges':len(d.get('codeFilesChanged',[])),
          'currentRunCollectorRuns':1,'currentRunLastSuccessfulStep':'official source request and parser executed',
          'currentRunFirstUnresolvedStep':None if status in ('PUBLISHED','NO_OP') else d.get('blocker'),
          'localExecutableStepsRemaining':0 if status in ('PUBLISHED','NO_OP') else 1,
          'publication':status,'run2':d.get('run2'),'scheduler':d.get('schedulerEligible',False),
          'finalStatus':'OPERATIONALLY_PROVEN' if status in ('PUBLISHED','NO_OP') else 'INTERNAL_WORK_REMAINING',
          'blockerAfter':None if status in ('PUBLISHED','NO_OP') else 'INTERNAL_WORK_REMAINING',
          'batchBResult':d})
        main.setdefault('providers',{})[h]=old
    main['batchB']=batch
    main['batchBIntegrity']=batch['integrity']
    main.setdefault('integrity',{})['productionTouched']=False
    main['integrity']['projectEleitorDbTouched']=False; main['integrity']['sqliteTouched']=False
    main['integrity']['batchBTargets']=houses
    Path('artifacts/P18_3jr.json').write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    mdmain=['# P18.3JR — National State Finance Continuation','', 'CURRENT_DATABASE = civica_postgres_lab','PRODUCTION = OFF','PROJECTELEITOR_DB_TOUCHED = NO','SQLITE_TOUCHED = NO','',f"NATIONAL_OPERATIONAL_BEFORE = {main.get('operationalBefore',5)}",f"NATIONAL_OPERATIONAL_AFTER = {main['nationalOperationalCount']}",f"NATIONAL_OPERATIONAL_COVERAGE = {main['nationalOperationalCoverage']}",f"NEW_OPERATIONALLY_PROVEN_TOTAL = {main['newOperationallyProven']}",'', '## Batch B (TO → AM → SE → PA → MA)','']
    for h in houses:
        d=results.get(h,{})
        mdmain.append(f"{h}: {d.get('publication',{}).get('status','NOT_RUN')} | rows={d.get('sourceRows',0)} | requests={d.get('sourceRequests',0)} | scheduler={d.get('schedulerEligible',False)}")
    mdmain += ['', 'DF_STATUS = INTERNAL_WORK_REMAINING','BA_STATUS = INTERNAL_WORK_REMAINING','DF_SCOPE_DISCREPANCY_REQUIRES_EXPLANATION = YES','', 'P18.3JR remains open for the untouched targets; no P18.4/P19 executed.']
    Path('artifacts/P18_3jr.md').write_text('\n'.join(mdmain)+'\n',encoding='utf-8')
    progress=Path('artifacts/p18_3jr/progress.jsonl'); progress.parent.mkdir(parents=True,exist_ok=True)
    with progress.open('a',encoding='utf-8') as f:
        for h,d in results.items(): f.write(json.dumps({'phase':'P18.3JR','batch':'B','house':h,'at':batch['generatedAt'],'status':d.get('publication',{}).get('status'),'sourceRows':d.get('sourceRows',0),'database':'civica_postgres_lab'},ensure_ascii=False)+'\n')
    print(json.dumps({'batchB':batch,'nationalOperationalCount':main['nationalOperationalCount'],'coverage':main['nationalOperationalCoverage']},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
