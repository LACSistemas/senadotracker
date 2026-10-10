import json
from pathlib import Path
p=Path('artifacts/P20_7E.json');j=json.loads(p.read_text());j['houses']['ES']['revision']='state:ES:legislative:d009e83316a0f1d632f90adb5f55ea26243c3a314e4825bd83c075e0f98b6153';j['houses']['BA']['revision']='state:BA:legislative:023f6678d50db7efb8c113f4c555a176736ab3ac6cfd409fffa0293036e7d203';j['houses']['ES']['publishedProposals']=270;j['houses']['BA']['publishedProposals']=89;j['houses']['ES']['authorshipRows']=312;j['houses']['BA']['authorshipRows']=89;j['houses']['ES']['run2']={'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0};j['houses']['BA']['run2']={'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0};j['run2']={'duplicateInsertions':0,'newRevisionOnUnchangedReplay':0};p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
for h,rev in [('ES',j['houses']['ES']['revision']),('BA',j['houses']['BA']['revision'])]:
 q=Path(f'artifacts/P20_7E_reconciliation_{h}.json');x=json.loads(q.read_text());x['revision']=rev;x['publishedProposals']=270 if h=='ES' else 89;x['authorshipRows']=312 if h=='ES' else 89;q.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
P=Path('artifacts/P20.json');x=json.loads(P.read_text());x['latestSubphase']='P20.7E';x['status']='PASS_WITH_SOURCE_LIMITATIONS';x['proposalRecovery']='P20.7E_TARGETS_TERMINAL';x['readyForP20_FINAL_REVIEW']=True;x['readyForP21']=False
for n in ['P20_7E.json','P20_7E.md','P20_7E_partition_tree_ES.json','P20_7E_partition_tree_BA.json','P20_7E_reconciliation_ES.json','P20_7E_reconciliation_BA.json','P20_7E_terminal_exceptions.json']:
 if n not in x['artifacts']:x['artifacts'].append(n)
P.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');Path('artifacts/P20.md').write_text(Path('artifacts/P20_7E.md').read_text(encoding='utf-8')+'\n\nAtualização P20: P20.7E executou a árvore recursiva tipo×autor; ES e BA permanecem parciais apenas nas folhas residuais documentadas.\n',encoding='utf-8')
print('updated')
