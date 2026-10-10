import json, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

root=Path(__file__).resolve().parents[1]
out=root/'.tmp_p23_6_rr_pdfs'; out.mkdir(exist_ok=True)
rows=json.loads((root/'.tmp_p23_6_rr_commission_files.json').read_text(encoding='utf-8-sig'))
def one(item):
    i,row=item
    name=(f'{i+138:03d}_{row["folder"]}_{row["name"]}').replace(' ','_')
    name=re.sub(r'[^A-Za-z0-9_.-]','_',name); path=out/name
    if path.exists() and path.stat().st_size>10000: return i, path.stat().st_size
    req=Request(row['href'],headers={'User-Agent':'Mozilla/5.0'})
    try:
        with urlopen(req,timeout=60) as r: path.write_bytes(r.read())
        return i, path.stat().st_size
    except Exception as e: print('ERR',i,e,flush=True)
    return i, 0
with ThreadPoolExecutor(max_workers=8) as ex:
    futs=[ex.submit(one,(i,row)) for i,row in enumerate(rows,1)]
    for f in as_completed(futs):
        print(*f.result(),flush=True)
print('downloaded',len(list(out.glob('*.pdf'))))
