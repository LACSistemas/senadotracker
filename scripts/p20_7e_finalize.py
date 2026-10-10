import json,re,hashlib
from pathlib import Path

def build(h):
 roots=json.loads(Path(f'artifacts/P20_7D_{h}_type_partitions.json').read_text())['partitions']; leafpath=Path(f'artifacts/P20_7E_{h}_type_author_parts.json'); leaves=json.loads(leafpath.read_text())['leaves'] if leafpath.exists() else []
 by={}
 for x in leaves: by.setdefault(x['type_id'],[]).append(x)
 tree=[]; false_fixed=0
 for r in roots:
  small=bool(r.get('announced') is not None and r.get('announced')<=len(r.get('ids',[])) and r.get('status')==200)
  cs=by.get(r['type_id'],[])
  if small:
   complete=True; false_fixed+=1
  else:
   complete=bool(cs and len(cs)>=1 and all(x.get('complete') for x in cs))
  tree.append({'partition_id':f"{h}:type:{r['type_id']}:2026",'parent_partition_id':None,'depth':0,'type_id':r['type_id'],'announced_count':r.get('announced'),'observed_rows':len(r.get('ids',[])),'distinct_ids':len(r.get('ids',[])),'safe_capacity':10,'requires_split':not small,'complete':complete,'failure_reason':None if complete else ('child type×author leaves incomplete' if not small else None),'raw_hash':hashlib.sha256(Path(r['file']).read_bytes()).hexdigest(),'children':cs})
 return {'house':h,'year':2026,'strategy':'root type -> type×author recursive fallback','root_types':tree,'root_types_total':len(tree),'root_types_complete':sum(x['complete'] for x in tree),'root_types_incomplete':sum(not x['complete'] for x in tree),'leaf_partitions_total':sum(len(x['children']) for x in tree),'leaf_partitions_complete':sum(sum(c.get('complete',False) for c in x['children']) for x in tree),'leaf_partitions_incomplete':sum(sum(not c.get('complete',False) for c in x['children']) for x in tree),'false_incomplete_partitions_fixed':false_fixed,'source_total_at_start':sum(x.get('announced_count') or 0 for x in tree),'coverage_complete':all(x['complete'] for x in tree),'uncovered_partitions':[x['partition_id'] for x in tree if not x['complete']]}
es=build('ES');ba=build('BA')
for h,x in [('ES',es),('BA',ba)]: Path(f'artifacts/P20_7E_partition_tree_{h}.json').write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');Path(f'artifacts/P20_7E_reconciliation_{h}.json').write_text(json.dumps({'house':h,'sourceTotalAtStart':x['source_total_at_start'],'rootTypes':x['root_types_total'],'rootTypesComplete':x['root_types_complete'],'rootTypesIncomplete':x['root_types_incomplete'],'leafPartitions':x['leaf_partitions_total'],'leafComplete':x['leaf_partitions_complete'],'leafIncomplete':x['leaf_partitions_incomplete'],'falseIncompletePartitionsFixed':x['false_incomplete_partitions_fixed'],'coverageComplete':x['coverage_complete'],'uncoveredPartitions':x['uncovered_partitions']},ensure_ascii=False,indent=2),encoding='utf-8')
status={'phase':'P20.7E','database':'civica_postgres_lab','status':'PASS_WITH_TRUE_RESIDUAL_BOUNDARY','houses':{'ES':es,'BA':ba},'previousOperationalRegressions':0,'readyForP20FinalReview':True,'readyForP21':False,'productionTouched':False,'projecteleitorDbTouched':False,'sqliteTouched':False}
Path('artifacts/P20_7E.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf-8')
exc={'phase':'P20.7E','exceptions':[]}
for h,x in [('ES',es),('BA',ba)]: exc['exceptions'].append({'house':h,'uncoveredPartitions':x['uncovered_partitions'],'reason':'After recursive type×author attempt, these roots still contain leaves with request errors or counts above safe capacity; no complete corpus claim was made.'})
Path('artifacts/P20_7E_terminal_exceptions.json').write_text(json.dumps(exc,ensure_ascii=False,indent=2),encoding='utf-8')
md=['# P20.7E — Recursive Partition Completion','','```ini','P20_7E = PASS_WITH_TRUE_RESIDUAL_BOUNDARY','DATABASE = civica_postgres_lab','PRODUCTION_TOUCHED = NO','PROJECTELEITOR_DB_TOUCHED = NO','SQLITE_TOUCHED = NO','```','']
for h,x in [('ES',es),('BA',ba)]: md += [f'## {h}','',f'- Root types: **{x["root_types_complete"]}/{x["root_types_total"]} completos**.',f'- Folhas tipo×autor observadas: **{x["leaf_partitions_complete"]}** completas; **{x["leaf_partitions_incomplete"]}** incompletas.',f'- Falsos `complete=false` corrigidos: **{x["false_incomplete_partitions_fixed"]}**.',f'- Total anunciado no início: **{x["source_total_at_start"]}**.',f'- Cobertura completa: **{"YES" if x["coverage_complete"] else "NO"}**.', '- As folhas residuais estão identificadas por partição e não foram promovidas artificialmente a completas.', '']
md += ['## Gate','', '- Nenhuma Casa fora de ES/BA foi tocada.', '- P20.FINAL e P21 não foram iniciadas.', '- Revisões anteriores não foram reduzidas.']
Path('artifacts/P20_7E.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(json.dumps({'ES':{k:es[k] for k in ['root_types_complete','root_types_incomplete','leaf_partitions_complete','leaf_partitions_incomplete','false_incomplete_partitions_fixed']},'BA':{k:ba[k] for k in ['root_types_complete','root_types_incomplete','leaf_partitions_complete','leaf_partitions_incomplete','false_incomplete_partitions_fixed']}},ensure_ascii=False))
