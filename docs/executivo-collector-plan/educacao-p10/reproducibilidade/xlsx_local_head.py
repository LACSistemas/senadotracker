"""P10 — lê as primeiras linhas de cada aba de um XLSX local (sem openpyxl). Uso: python -I -X utf8 xlsx_local_head.py <arquivo.xlsx> <n_linhas> [saida.json]"""
import io, json, re, sys, zipfile
path, n = sys.argv[1], int(sys.argv[2])
x = zipfile.ZipFile(path)
shared = []
if 'xl/sharedStrings.xml' in x.namelist():
    sx = x.read('xl/sharedStrings.xml').decode('utf-8')
    shared = [re.sub(r'<[^>]+>', '', s) for s in re.findall(r'<si>(.*?)</si>', sx, flags=re.S)]
wb = x.read('xl/workbook.xml').decode('utf-8'); names = re.findall(r'<sheet [^>]*name="([^"]+)"', wb)
sheets = sorted((k for k in x.namelist() if k.startswith('xl/worksheets/sheet')), key=lambda s: int(re.search(r'(\d+)', s.split('/')[-1]).group(1)))
out = {}
for i, sh in enumerate(sheets):
    with x.open(sh) as fh: xml = fh.read(4_000_000).decode('utf-8', 'ignore')
    dim = re.search(r'<dimension ref="([^"]+)"', xml)
    rows = []
    for r in re.findall(r'<row[^>]*>(.*?)</row>', xml, flags=re.S)[:n]:
        cells = {}
        for attrs, body in re.findall(r'<c ([^>]*?)(?:/>|>(.*?)</c>)', r, flags=re.S):
            ref = re.search(r'r="([A-Z]+)\d+"', attrs).group(1); t = re.search(r't="(\w+)"', attrs); v = re.search(r'<v>(.*?)</v>', body or '')
            if v is None:   # strings embutidas (inlineStr), usadas por geradores PHP/Oracle como o PDDE Info
                isn = re.search(r'<is>(.*?)</is>', body or '', flags=re.S)
                if isn: cells[ref] = re.sub(r'<[^>]+>', '', isn.group(1))
                continue
            cells[ref] = shared[int(v.group(1))] if t and t.group(1) == 's' else v.group(1)
        rows.append(cells)
    out[names[i] if i < len(names) else sh] = {'dimensao': dim.group(1) if dim else None, 'linhas': rows}
if len(sys.argv) > 3: json.dump(out, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in out.items(): print(k, v['dimensao'], len(v['linhas']))
