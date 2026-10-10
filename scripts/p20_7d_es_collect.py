import hashlib, json, re, time
from datetime import datetime, timezone
from pathlib import Path
import requests
from bs4 import BeautifulSoup

URL = 'https://www3.al.es.gov.br/spl/consulta-producao.aspx?tipo=18&ano_proposicao=2026'
OUT = Path('artifacts/P20_7D_ES_type18_corpus.json')
RAW_DIR = Path('artifacts/P20_7D_ES_type18_pages')
RAW_DIR.mkdir(parents=True, exist_ok=True)

def form_data(soup):
    data = {}
    for x in soup.select('form input, form select, form textarea'):
        name = x.get('name')
        if not name: continue
        if x.name == 'select':
            option = x.find('option', selected=True) or x.find('option')
            data[name] = option.get('value', '') if option else ''
        elif x.get('type') in (None, 'hidden', 'text'):
            data[name] = x.get('value', '')
    return data

def clean(text):
    return re.sub(r'\s+', ' ', text or '').strip()

def parse_total(soup):
    text = clean(soup.get_text(' ', strip=True))
    m = re.search(r'Localizada\(s\)\s*([0-9.]+)\s+proposi', text, re.I)
    if not m: m = re.search(r'Localizada.*?([0-9.]+)\s+proposi', text, re.I)
    return int(m.group(1).replace('.', '')) if m else None

def parse_card(card):
    title = card.select_one('a.kt-widget5__title')
    desc = card.select_one('a.kt-widget5__desc')
    href = title.get('href', '') if title else ''
    mm = re.search(r'[?&]id=(\d+)', href); sid = mm.group(1) if mm else None
    values = {}
    info = card.select_one('div.kt-widget5__info')
    if info:
        raw = clean(info.get_text(' ', strip=True))
        patterns = {
          'process': r'Processo\s+N[^:]*:\s*([^\s]+)',
          'protocol': r'Protocolo\s+N[^:]*:\s*([^\s]+)',
          'id': r'ID:\s*(\d+)',
          'date': r'Data:\s*([0-9/: ]+?)(?=Situa|$)',
          'status': r'Situa[^:]*:\s*(.*?)(?=Atividade Atual:|$)',
          'activity': r'Atividade Atual:\s*(.*)$',
        }
        for key, pattern in patterns.items():
            x = re.search(pattern, raw, re.I)
            if x: values[key] = clean(x.group(1))
    authors = []
    for a in card.select('div.kt-widget5__info a[href*="consulta-producao.aspx?autor="]'):
        name = clean(a.get_text(' ', strip=True))
        hm = re.search(r'[?&]autor=([^&]+)', a.get('href', ''))
        if name: authors.append({'name': name, 'sourceAuthorId': hm.group(1) if hm else None})
    return {'source_id': sid, 'title': clean(title.get_text(' ', strip=True)) if title else None,
      'summary': clean(desc.get_text(' ', strip=True)) if desc else None,
      'process_number': values.get('process'), 'protocol_number': values.get('protocol'),
      'date': values.get('date'), 'status_raw': values.get('status'),
      'current_activity_raw': values.get('activity'), 'authors': authors,
      'url': 'https://www3.al.es.gov.br/spl/' + href.lstrip('./')}

def parse_page(body):
    soup = BeautifulSoup(body, 'html.parser', from_encoding='utf-8')
    rows = [parse_card(c) for c in soup.select('div.kt-widget5__content.consulta--listagem')]
    controls = {}
    for a in soup.select('#ContentPlaceHolder1_rptPaging a'):
        t = clean(a.get_text(' ', strip=True))
        mm = re.search(r"__doPostBack\('([^']+)'", a.get('href', ''))
        if t.isdigit() and mm: controls[int(t)] = mm.group(1)
    return [r for r in rows if r['source_id']], controls, parse_total(soup)

session = requests.Session()
session.headers.update({'User-Agent': 'Mozilla/5.0 (Civica P20.7A)', 'Accept': 'text/html,application/xhtml+xml'})
r = session.get(URL, timeout=90); r.raise_for_status()
soup = BeautifulSoup(r.content, 'html.parser', from_encoding='utf-8')
d = form_data(soup); d['__EVENTTARGET'] = 'ctl00$ContentPlaceHolder1$ddl_ItensExibidos'; d['__EVENTARGUMENT'] = ''; d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos'] = '100'
r = session.post(URL, data=d, timeout=120); r.raise_for_status()
page = 1; all_rows = []; page_evidence = []
while True:
    raw_path = RAW_DIR / f'{page:03d}.html'; raw_path.write_bytes(r.content)
    rows, controls, announced = parse_page(r.content)
    print(f'page={page} rows={len(rows)} announced={announced} controls={sorted(controls)}', flush=True)
    all_rows.extend(rows)
    page_evidence.append({'page': page, 'status': r.status_code, 'bytes': len(r.content), 'sha256': hashlib.sha256(r.content).hexdigest(), 'url': r.url, 'rawPath': str(raw_path)})
    if announced and len({x['source_id'] for x in all_rows}) >= announced: break
    next_page = page + 1; target = controls.get(next_page)
    if not target:
        candidates = [(n,t) for n,t in controls.items() if n > page]
        if candidates: next_page,target = min(candidates)
        else: raise RuntimeError(f'pagination stopped at page {page}; controls={controls}')
    d = form_data(BeautifulSoup(r.content, 'html.parser', from_encoding='utf-8'))
    d['__EVENTTARGET'] = target; d['__EVENTARGUMENT'] = ''; d['ctl00$ContentPlaceHolder1$ddl_ItensExibidos'] = '100'
    time.sleep(0.15); r = session.post(URL, data=d, timeout=120); r.raise_for_status(); page = next_page
    if page > 100: raise RuntimeError('safety page limit')

by_id = {}; duplicates = []
for row in all_rows:
    if row['source_id'] in by_id: duplicates.append(row['source_id'])
    else: by_id[row['source_id']] = row
rows = list(by_id.values())
result = {'house':'ES','provider':'ales_spl','contract':URL,'year':2026,'source_total_announced':announced,'pages_fetched':len(page_evidence),
 'source_rows':len(all_rows),'distinct_ids':len(rows),'duplicate_ids':sorted(set(duplicates)),'rows':rows,'page_evidence':page_evidence,'collected_at':datetime.now(timezone.utc).isoformat()}
OUT.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print(json.dumps({k:result[k] for k in ['source_total_announced','pages_fetched','source_rows','distinct_ids','duplicate_ids']}, ensure_ascii=False))


