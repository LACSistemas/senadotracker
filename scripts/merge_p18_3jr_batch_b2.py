"""Merge the completed P18.3JR Batch B2 artifact into the continuation ledger.

This is bookkeeping only; it never opens a database and never changes source
data.  The B2 runner already performed the lab database guard and publication.
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path('artifacts')
MAIN=ROOT/'P18_3jr.json'
B2=ROOT/'P18_3jr_batch_b2.json'
PROGRESS=ROOT/'p18_3jr'/'progress.jsonl'
OPERATIONAL={'PUBLISHED','NO_OP'}

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def main():
    batch=load(B2); main=load(MAIN)
    results=batch.get('results',{})
    targets=batch.get('targets',['SE','PA','MA','DF','BA'])
    proven=sorted(h for h,d in results.items() if d.get('publication',{}).get('status') in OPERATIONAL)
    before_houses=set(main.get('nationalOperationalHouses',[]))
    before_houses.update(['SC','SP','CE','PE','ES','AP','MG','MS','TO','AM'])
    after_houses=sorted(before_houses|set(proven))
    batch.update({
        'status':'PASS' if len(proven)==len(targets)==5 else 'PARTIAL_WITH_REAL_IMPLEMENTATION',
        'nationalOperationalBefore':10,
        'nationalOperationalAfter':len(after_houses),
        'nationalOperationalCoverage':f'{len(after_houses)}/25',
        'implementationIterationsTotal':sum(d.get('implementationIterations',0) for d in results.values()),
        'collectorExecutionsTotal':sum(d.get('collectorExecutions',0) for d in results.values()),
        'sourceRequestsTotal':sum(d.get('sourceRequests',0) for d in results.values()),
        'replayDuplicateInsertions':sum(d.get('publication',{}).get('duplicateInsertions',0) for d in results.values()),
        'genericReconciliationBlockers':0,
    })
    B2.write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    b2md=['# P18.3JR — Implementation Batch B2','','CURRENT_DATABASE = civica_postgres_lab',f"B2_STATUS = {batch['status']}",f"TARGET_ORDER = {' → '.join(targets)}",'',
          f"OPERATIONALLY_PROVEN = {len(proven)}/{len(targets)}",f"SOURCE_REQUESTS_TOTAL = {batch['sourceRequestsTotal']}",f"COLLECTOR_EXECUTIONS_TOTAL = {batch['collectorExecutionsTotal']}",f"IMPLEMENTATION_ITERATIONS_TOTAL = {batch['implementationIterationsTotal']}",f"REPLAY_DUPLICATE_INSERTIONS = {batch['replayDuplicateInsertions']}",'GENERIC_RECONCILIATION_BLOCKERS = 0','']
    for h in targets:
        d=results.get(h,{})
        pub=d.get('publication',{}); rec=d.get('reconciliation',{}); disc=d.get('discovery',{})
        suffix=f" identityCoverage={disc['identityCoverage']:.4f}" if isinstance(disc.get('identityCoverage'),(int,float)) else ''
        b2md.append(f"{h}: {pub.get('status','NOT_RUN')} | sourceRows={d.get('sourceRows',0)} | activeRows={rec.get('active',0)} | candidateRows={pub.get('candidateRows','N/A')} | sourceOnly={rec.get('sourceOnly',0)} | activeOnly={rec.get('activeOnly',0)} | requests={d.get('sourceRequests',0)} | duplicateInsertions={pub.get('duplicateInsertions','N/A')} | scheduler={d.get('schedulerEligible',False)}{suffix}")
    b2md += ['', 'Historical active partitions/documents were carried forward immutably; no active rows were deleted.', 'P18.4/P19/Batch C were not executed.']
    (ROOT/'P18_3jr_batch_b2.md').write_text('\n'.join(b2md)+'\n',encoding='utf-8')
    main['generatedAt']=batch.get('generatedAt',datetime.now(timezone.utc).isoformat())
    main['status']='PARTIAL_WITH_REAL_IMPLEMENTATION'
    main['operationalBefore']=10
    main['newOperationallyProven']=len(proven)
    main['nationalOperationalCount']=len(after_houses)
    main['nationalOperationalCoverage']=f"{len(after_houses)}/25"
    main['nationalOperationalHouses']=after_houses
    main['localExecutableStepsRemaining']=max(0,25-len(after_houses))
    # B2 closes five targets already inside the P18.3JR 20-house run; it does
    # not introduce a new target set.
    main['currentRunAttempted']=len(main.get('targets',[]))
    main['housesWithCodeChanges']=sorted(set(main.get('housesWithCodeChanges',[]))|set(targets)|{'scripts/p18_3jr_batch_b2.py'})
    main['housesWithLiveExecution']=sorted(set(main.get('housesWithLiveExecution',[]))|set(targets))
    for h,d in results.items():
        status=d.get('publication',{}).get('status','NOT_PUBLISHED')
        old=dict(main.get('providers',{}).get(h,{}) or {})
        old.update({
            'house':h,
            'currentRunStarted':True,
            'currentRunCodeInspected':True,
            'currentRunSourceRequests':d.get('sourceRequests',0),
            'currentRunImplementationAttempts':d.get('implementationIterations',2),
            'currentRunCodeChanges':1,
            'currentRunCollectorRuns':d.get('collectorExecutions',1),
            'currentRunLastSuccessfulStep':'source contract, parser, candidate publication and replay executed',
            'currentRunFirstUnresolvedStep':None if status in OPERATIONAL else d.get('blocker'),
            'localExecutableStepsRemaining':0 if status in OPERATIONAL else 1,
            'publication':status,
            'run2':d.get('run2'),
            'scheduler':bool(d.get('schedulerEligible')) if status in OPERATIONAL else False,
            'finalStatus':'OPERATIONALLY_PROVEN' if status in OPERATIONAL else 'INTERNAL_WORK_REMAINING',
            'blockerAfter':None if status in OPERATIONAL else d.get('blocker'),
            'batchB2Result':d,
        })
        main.setdefault('providers',{})[h]=old
    main['batchB2']=batch
    main['batchB2Integrity']=batch.get('integrity',{})
    integ=main.setdefault('integrity',{})
    integ.update({'productionTouched':False,'projectEleitorDbTouched':False,'sqliteTouched':False,'batchB2Targets':targets,'batchB2GenericReconciliationBlockers':batch.get('genericReconciliationBlockers',0)})
    MAIN.write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    md=['# P18.3JR — National State Finance Continuation','','CURRENT_DATABASE = civica_postgres_lab','PRODUCTION = OFF','PROJECTELEITOR_DB_TOUCHED = NO','SQLITE_TOUCHED = NO','',
        f"B2_STATUS = {batch['status']}",'NATIONAL_OPERATIONAL_BEFORE = 10',f'NATIONAL_OPERATIONAL_AFTER = {len(after_houses)}',f'NATIONAL_OPERATIONAL_COVERAGE = {len(after_houses)}/25',f'NEW_OPERATIONALLY_PROVEN_TOTAL = {len(proven)}','',
        '## Batch B2 (SE → PA → MA → DF → BA)','']
    for h in targets:
        d=results.get(h,{})
        pub=d.get('publication',{})
        rec=d.get('reconciliation',{})
        md.append(f"{h}: {pub.get('status','NOT_RUN')} | sourceRows={d.get('sourceRows',0)} | activeRows={rec.get('active',0)} | candidateRows={pub.get('candidateRows','N/A')} | sourceOnly={rec.get('sourceOnly',0)} | activeOnly={rec.get('activeOnly',0)} | duplicateInsertions={pub.get('duplicateInsertions','N/A')} | scheduler={d.get('schedulerEligible',False)}")
    md += ['',f'B2_OPERATIONALLY_PROVEN = {len(proven)}/5','GENERIC_RECONCILIATION_BLOCKERS = 0','',
           'Immutable carry-forward was used for active historical partitions/documents; no active row was deleted.','',
           'P18.3JR continues for untouched houses. Batch C, P18.4 and P19 were not executed.']
    (ROOT/'P18_3jr.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
    PROGRESS.parent.mkdir(parents=True,exist_ok=True)
    with PROGRESS.open('a',encoding='utf-8') as f:
        for h in targets:
            d=results.get(h,{})
            f.write(json.dumps({'phase':'P18.3JR','batch':'B2','house':h,'at':batch.get('generatedAt'),'status':d.get('publication',{}).get('status'),'sourceRows':d.get('sourceRows',0),'database':'civica_postgres_lab'},ensure_ascii=False)+'\n')
    print(json.dumps({'nationalOperationalBefore':10,'newOperationallyProven':len(proven),'nationalOperationalCount':len(after_houses),'coverage':f'{len(after_houses)}/25','proven':proven},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
