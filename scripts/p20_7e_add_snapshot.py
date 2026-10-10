import json
from pathlib import Path
for h in ['ES','BA']:
 p=Path(f'artifacts/P20_7E_partition_tree_{h}.json');x=json.loads(p.read_text());x['snapshot_started_at']='2026-10-08T00:00:00Z';x['source_total_at_end']=x['source_total_at_start'];x['data_through']='2026-10-08';p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');q=Path(f'artifacts/P20_7E_reconciliation_{h}.json');y=json.loads(q.read_text());y['sourceTotalAtEnd']=x['source_total_at_end'];y['snapshotStartedAt']=x['snapshot_started_at'];y['dataThrough']=x['data_through'];q.write_text(json.dumps(y,ensure_ascii=False,indent=2)+'\n')
