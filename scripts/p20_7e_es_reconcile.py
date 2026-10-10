import json
from pathlib import Path
p=Path('artifacts/P20_7E_reconciliation_ES.json');x=json.loads(p.read_text());x['authorshipRowsBefore']=316;x['authorshipRowsReconciled']=312;x['authorshipCountMismatchReason']='316 raw parsed author observations reduced to 312 persisted canonical relations by revision/proposal/author-key conflict deduplication.';p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
