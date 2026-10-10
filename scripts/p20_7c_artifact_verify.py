import json,hashlib
from pathlib import Path
for n in ['P20_7C.json','P20_7C_implementation_matrix.json','P20_7C_source_contracts.json','P20_7C_type_catalog.json','P20_7C_terminal_exceptions.json','P20.json']:
 p=Path('artifacts')/n; x=json.loads(p.read_text(encoding='utf-8-sig')); print(n,'OK')
r=json.loads(Path('artifacts/P20_7C.json').read_text(encoding='utf-8')); assert r['readyForP20_FINAL_REVIEW'] and not r['readyForP21']; assert r['proposalsOperational']=='22/27'; print('gate fields OK')
