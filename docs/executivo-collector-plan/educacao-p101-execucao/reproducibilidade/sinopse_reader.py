"""P10.1 — leitor mínimo (sem dependências) das planilhas da Sinopse Estatística da Educação Básica (xlsx). Somente leitura.
Uso: python -I -X utf8 sinopse_reader.py <arquivo.xlsx> sheets                  -> lista abas e título (A1..A4)
     python -I -X utf8 sinopse_reader.py <arquivo.xlsx> dump <aba> [linhas]     -> imprime as primeiras linhas da aba"""
import re, sys, zipfile
from xml.etree import ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


class Book:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        wb = ET.fromstring(self.z.read('xl/workbook.xml'))
        rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))}
        self.sheets = {}
        for s in wb.find('m:sheets', NS):
            t = rels[s.get('{%s}id' % NS['r'])]; self.sheets[s.get('name')] = t.lstrip('/') if t.startswith('/') else 'xl/' + t
        self.shared = []
        if 'xl/sharedStrings.xml' in self.z.namelist():
            for si in ET.fromstring(self.z.read('xl/sharedStrings.xml')): self.shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))

    def rows(self, name, limit=None):
        n = 0
        with self.z.open(self.sheets[name]) as fh:
            for _, el in ET.iterparse(fh, events=('end',)):
                if el.tag != '{%s}row' % NS['m']: continue
                out = {}
                for c in el.findall('m:c', NS):
                    ref = re.match(r'([A-Z]+)', c.get('r')).group(1); t = c.get('t'); v = c.find('m:v', NS)
                    if t == 'inlineStr': val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                    elif v is None: continue
                    elif t == 's': val = self.shared[int(v.text)]
                    else: val = v.text
                    out[ref] = val
                el.clear(); yield out; n += 1
                if limit and n >= limit: return


def title(book, name):
    for r in book.rows(name, 6):
        for v in r.values():
            if len(v) > 25: return v
    return ''


if __name__ == '__main__':
    b = Book(sys.argv[1])
    if sys.argv[2] == 'sheets':
        for n in b.sheets: print(n, '|', title(b, n)[:150])
    elif sys.argv[2] == 'dump':
        for r in b.rows(sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 30): print(r)
