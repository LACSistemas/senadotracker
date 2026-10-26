"""P10.2/G6 — extrai uma tabela territorial (Brasil, UFs, municípios) da Sinopse Estatística da Educação Básica escolhendo a aba pelo TÍTULO (regex), com os rótulos de coluna lidos dos cabeçalhos.
Uso: python -I -X utf8 sinopse_tabela.py <arquivo.xlsx> <regex_do_titulo> <saida.json>"""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'educacao-p101-execucao', 'reproducibilidade'))
from sinopse_reader import Book
COLS = [chr(c) for c in range(ord('E'), ord('Z') + 1)] + ['A' + chr(c) for c in range(ord('A'), ord('Z') + 1)] + ['B' + chr(c) for c in range(ord('A'), ord('Z') + 1)]
NUM = re.compile(r'-?\d+(\.\d+)?')

def labels(header):
    out = {c: [] for c in COLS}
    for r in header:
        cur = None
        for c in COLS:
            if c in r and r[c].strip(): cur = re.sub(r'\d+(-\d+)?$', '', r[c].strip()).strip() or r[c].strip()
            if cur: out[c].append(cur)
    return {c: '|'.join(dict.fromkeys(v)) for c, v in out.items() if v}

b = Book(sys.argv[1]); rx = re.compile(sys.argv[2], re.I); pick = None
for n in b.sheets:
    if n.strip() == 'Sumário': continue
    try:
        for r in b.rows(n, 6):
            t = ' '.join(r.values())
            if rx.search(t) and re.match(r'^\d', t.strip()): pick = (n, t[:200]); break
    except Exception: continue
    if pick: break
if not pick: raise SystemExit('aba não encontrada')
name = pick[0]; res = {'sheet': name, 'title': pick[1], 'columns': {}, 'brasil': None, 'ufs': {}, 'municipios': {}, 'notes': []}
header, seen = [], False
for r in b.rows(name):
    a = (r.get('A') or '').strip()
    if not seen:
        if a == 'Brasil': seen = True
        else:
            if any(v.strip() == 'Região Geográfica' for v in r.values()) or header: header.append(r)
            continue
    if a == 'Brasil': res['columns'] = labels(header[1:])
    if a.startswith(('Fonte', 'Nota')) or re.match(r'^\d\s*-', a): res['notes'].append(' '.join(v.strip() for v in r.values())[:400]); continue
    vals = {c: (int(float(r[c])) if c in r and NUM.fullmatch(str(r[c]).strip()) else None) for c in COLS if c in r}
    if not any(v is not None for v in vals.values()): continue
    code = (r.get('D') or '').strip(); ufn = (r.get('B') or '').strip(); mun = (r.get('C') or '').strip()
    if a == 'Brasil': res['brasil'] = vals
    elif code.isdigit() and len(code) == 7: res['municipios'][code] = vals
    elif ufn and not mun: res['ufs'][ufn] = vals
res['columns'] = {c: l for c, l in res['columns'].items() if c in (res['brasil'] or {})}
json.dump(res, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)
print(name, 'brasil', res['brasil'] and res['brasil'].get('E'), len(res['ufs']), len(res['municipios']), len(res['columns']))
