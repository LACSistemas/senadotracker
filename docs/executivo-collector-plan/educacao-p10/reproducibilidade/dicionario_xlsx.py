"""P10/G2 — extrai o dicionário de dados (XLSX) do ZIP remoto do Censo Escolar (lendo só a entrada do dicionário por Range) e salva linhas por aba.
Uso: python -I -X utf8 dicionario_xlsx.py <url_zip> <trecho_do_nome_da_entrada> <saida.json>"""
import io, json, re, sys, os, zipfile, xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from zip_remote_listing import RangeFile
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
url, needle, out = sys.argv[1:4]
rf = RangeFile(url); br = io.BufferedReader(rf, buffer_size=1 << 16)
with zipfile.ZipFile(br) as z:
    name = next(i.filename for i in z.infolist() if needle.lower() in i.filename.lower() and i.filename.lower().endswith('.xlsx') and '~$' not in i.filename)
    data = z.read(name)
x = zipfile.ZipFile(io.BytesIO(data))
shared = []
if 'xl/sharedStrings.xml' in x.namelist():
    for si in ET.fromstring(x.read('xl/sharedStrings.xml')).findall('m:si', NS):
        shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
wb = ET.fromstring(x.read('xl/workbook.xml')); rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(x.read('xl/_rels/workbook.xml.rels'))}
sheets = {}
for s in wb.find('m:sheets', NS):
    target = rels[s.get('{%s}id' % NS['r'])]; path = 'xl/' + target.lstrip('/').replace('xl/', '')
    rows = []
    for row in ET.fromstring(x.read(path)).iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            col = re.match(r'[A-Z]+', c.get('r')).group(0); v = c.find('m:v', NS); t = c.get('t')
            if v is None:
                isn = c.find('m:is', NS); val = ''.join(tt.text or '' for tt in isn.iter('{%s}t' % NS['m'])) if isn is not None else ''
            else: val = shared[int(v.text)] if t == 's' else v.text
            cells[col] = val
        if any(cells.values()): rows.append(cells)
    sheets[s.get('name')] = rows
json.dump({'url': url, 'entrada': name, 'bytes_rede': rf.bytes, 'abas': {k: len(v) for k, v in sheets.items()}, 'linhas': sheets}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(name, 'abas', {k: len(v) for k, v in sheets.items()}, 'bytes de rede', rf.bytes)
