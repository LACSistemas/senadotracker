import concurrent.futures, hashlib, json, os, re, time
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import openpyxl

BASE = 'https://transparencia.assembleia.pr.leg.br/plenario/atividade-por-parlamentar'
ROOT = Path('artifacts/P20_7A_PR_xlsx')
ROOT.mkdir(parents=True, exist_ok=True)
html = Path('artifacts/P20_7A_PR_activity.html').read_text(encoding='utf-8', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')
data = json.loads(soup.find(attrs={'data-deputados': True})['data-deputados'])
items = []
for dep in data:
    for typ in dep.get('tipos', []):
        if typ.get('tipo') not in ('Autoria_Proposicoes', 'Relatoria_Proposicoes'):
            continue
        for leg in typ.get('legislaturas', []):
            for doc in leg.get('documentos', []):
                # Only documents explicitly identified as 2026.
                if '2026' not in (doc.get('titulo', '') + doc.get('subtitulo', '')):
                    continue
                for a in doc.get('arquivos', []):
                    if a.get('tipo') != 'xlsx':
                        continue
                    items.append({'house': 'PR', 'provider': 'alep_activity', 'category': typ['tipo'], 'depId': dep['id'], 'depName': dep['nome'], 'period': doc.get('titulo'), 'url': a['url']})
assert items

def fetch(item):
    name = hashlib.sha256(item['url'].encode()).hexdigest() + '.xlsx'
    path = ROOT / name
    if not path.exists():
        last = None
        for attempt in range(4):
            try:
                r = requests.get(item['url'], timeout=90)
                r.raise_for_status()
                path.write_bytes(r.content)
                break
            except Exception as e:
                last = e
                time.sleep(1 + attempt)
        if not path.exists():
            raise last
    item = dict(item, path=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return item

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    manifest = list(ex.map(fetch, items))
Path('artifacts/P20_7A_PR_xlsx_manifest.json').write_text(json.dumps({'source': BASE, 'year': 2026, 'items': manifest}, ensure_ascii=False, indent=2), encoding='utf-8')

def clean(v):
    return re.sub(r'\s+', ' ', str(v or '').replace('\x00', '')).strip()
prop_re = re.compile(r'^\s*\(([^)]+)\)\s*-\s*(.*?)\s*-\s*(\d+)\s*/\s*(\d{4})\s*$')
prop_rel_re = re.compile(r'^\s*([^\-]+?)\s*-\s*(\d+)\s*/\s*(\d{4})\s*$')
rows = []
for m in manifest:
    wb = openpyxl.load_workbook(m['path'], read_only=True, data_only=True)
    ws = wb.active
    if m['category'] == 'Autoria_Proposicoes':
        for row in ws.iter_rows(values_only=True):
            vals = [clean(v) for v in row]
            if len(vals) < 8 or not vals[0] or not vals[1]: continue
            mm = prop_re.match(vals[0])
            if not mm: continue
            rows.append({'category':'authorship','depId':m['depId'],'depName':m['depName'],'period':m['period'],'proposalRaw':vals[0],'type':mm.group(2),'number':mm.group(3),'year':int(mm.group(4)),'date':vals[1],'protocol':vals[2],'authorsRaw':vals[3],'subject':vals[4],'location':vals[5],'lastAction':vals[6],'title':vals[7],'sourceUrl':m['url'],'rawXlsx':m['path'],'rawSha256':m['sha256']})
    else:
        for row in ws.iter_rows(values_only=True):
            vals = [clean(v) for v in row]
            if len(vals) < 27 or not vals[4] or not vals[19]: continue
            mm = prop_rel_re.match(vals[4])
            if not mm: continue
            rows.append({'category':'rapporteurship','depId':m['depId'],'depName':m['depName'],'period':m['period'],'proposalRaw':vals[4],'type':mm.group(1).strip(),'number':mm.group(2),'year':int(mm.group(3)),'date':vals[19],'action':vals[22],'observation':vals[26],'title':vals[10],'sourceUrl':m['url'],'rawXlsx':m['path'],'rawSha256':m['sha256']})
    wb.close()
auth = [x for x in rows if x['category']=='authorship']; rel = [x for x in rows if x['category']=='rapporteurship']
proposals = {}
for x in rows:
    key = f"{x['type']}:{x['number']}:{x['year']}"
    proposals.setdefault(key, {'external_id':key,'type':x['type'],'number':x['number'],'year':x['year'],'title':x.get('title'),'dates':set(),'sourceUrls':set()})
    if x.get('date'): proposals[key]['dates'].add(x['date'])
    proposals[key]['sourceUrls'].add(x['sourceUrl'])
for x in proposals.values(): x['dates']=sorted(x['dates']); x['sourceUrls']=sorted(x['sourceUrls'])
out={'house':'PR','provider':'alep_activity','year':2026,'contract':BASE,'manifestItems':len(manifest),'authorshipRows':len(auth),'rapporteurshipRows':len(rel),'distinctAuthoredProposalKeys':len({f"{x['type']}:{x['number']}:{x['year']}" for x in auth}),'distinctRapporteurProposalKeys':len({f"{x['type']}:{x['number']}:{x['year']}" for x in rel}),'proposalKeys':list(proposals.values()),'rows':rows,'enumeration':'all 2026 XLSX exports exposed in official data-deputados index'}
Path('artifacts/P20_7A_PR_corpus.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:out[k] for k in ('manifestItems','authorshipRows','rapporteurshipRows','distinctAuthoredProposalKeys','distinctRapporteurProposalKeys')},indent=2))
