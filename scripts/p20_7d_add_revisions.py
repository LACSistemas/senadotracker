import json
from pathlib import Path
p=Path('artifacts/P20_7D.json');j=json.loads(p.read_text());j['houses']['ES']['revision']='state:ES:legislative:6b756b4c0e14502daafd8ab5f7cc1cde5c2ce7e52e3f91a39723f9a39723f9a9def23d14' if False else 'state:ES:legislative:6b756b4c0e14502daafd8ab5f7cc1cde5c2ce7e52e3f91a39723f9a9def23d14';j['houses']['BA']['revision']='state:BA:legislative:76124287254e5e6e53a4c6edc2342b321075400872201af300852f8ffb1d4832';p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n');
r=Path('artifacts/P20_7D_reconciliation.json');x=json.loads(r.read_text());x['houses']['ES']['revision']=j['houses']['ES']['revision'];x['houses']['BA']['revision']=j['houses']['BA']['revision'];r.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
