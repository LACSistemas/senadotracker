import glob, json, re
from bs4 import BeautifulSoup

rows = []
for filename in sorted(glob.glob('artifacts/P20_7C_GO_pages/*.html'), key=lambda x: int(re.search(r'(\d+)\.html', x).group(1))):
    soup = BeautifulSoup(open(filename, encoding='utf8').read(), 'html.parser')
    for card in soup.select('.kt-widget5__item'):
        link = next((a for a in card.find_all('a') if re.search(r'processo\.aspx\?id=', a.get('href', ''))), None)
        if not link:
            continue
        match = re.search(r'id=(\d+)', link.get('href', ''))
        if not match:
            continue
        text = ' '.join(card.get_text(' ', strip=True).split())
        heading = card.select_one('h3,h4,.kt-widget5__title') or link
        title = ' '.join(heading.get_text(' ', strip=True).split())

        def capture(pattern):
            found = re.search(pattern, text, re.I)
            return found.group(1).strip() if found else None

        type_match = re.search(r'(.+?)\s+n[^0-9]{0,6}(\d+)\s*/\s*(\d{4})', title, re.I)
        author_match = re.search(r'Autor\(es\) da Proposi.{0,8}:\s*(.*?)(?=\s+(?:ACOMPANHE|Resumo|DETALHES|PROCESSO|$))', text, re.I)
        names = []
        if author_match:
            value = author_match.group(1).strip()
            if value and value not in ('-', '—'):
                names = [{'name': item.strip(' ,;')} for item in re.split(r'\s+E\s+|;|,\s*', value) if item.strip(' ,;')]

        rows.append({
            'source_id': match.group(1), 'title': title,
            'type': type_match.group(1).strip() if type_match else None,
            'number': type_match.group(2) if type_match else None,
            'year': int(type_match.group(3)) if type_match else 2026,
            'process': capture(r'Processo N[^0-9]{0,6}:\s*([\w./-]+)'),
            'protocol': capture(r'Protocolo N[^0-9]{0,6}:\s*([\w./-]+)'),
            'date': capture(r'Data:\s*([0-9/: ]+)'),
            'status': capture(r'Situa.{0,3}o:\s*(.*?)\s+Atividade'),
            'activity': capture(r'Atividade Atual:\s*(.*?)\s+Autor'),
            'authors': names,
            'url': 'https://alegodigital.al.go.leg.br/' + link.get('href', ''),
        })

dedup = {row['source_id']: row for row in rows}
corpus = json.load(open('artifacts/P20_7C_GO_corpus.json', encoding='utf8'))
corpus['rows'] = list(dedup.values())
corpus['source_rows'] = len(rows)
corpus['distinct_ids'] = len(dedup)
corpus['authorship_rows'] = sum(len(row['authors']) for row in dedup.values())
corpus['duplicate_ids'] = len(rows) - len(dedup)
open('artifacts/P20_7C_GO_corpus.json', 'w', encoding='utf8').write(json.dumps(corpus, ensure_ascii=False))
print(json.dumps({'rows': len(rows), 'authors': corpus['authorship_rows'], 'withAuthors': sum(bool(row['authors']) for row in dedup.values()), 'types': len({row['type'] for row in dedup.values() if row['type']})}))
