"""P10.1/G3,G10 — extrai da Sinopse Estatística da Educação Básica a tabela "Número de Estabelecimentos da Educação Básica, por Localização e Dependência Administrativa,
segundo a Região Geográfica, a UF e o Município" (aba 3.2 nas edições recentes): Brasil, UFs e municípios × colunas. Os rótulos das colunas vêm dos cabeçalhos da própria aba
(células mescladas preenchidas para a direita), então a leitura não depende de posições fixas entre edições.
Uso: python -I -X utf8 sinopse_estab.py <arquivo.xlsx> <saida.json>   (somente leitura; ignora abas ilegíveis)"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sinopse_reader import Book

COLS = [chr(c) for c in range(ord('E'), ord('Z') + 1)] + ['A' + chr(c) for c in range(ord('A'), ord('Z') + 1)]
NUM = re.compile(r'-?\d+(\.\d+)?')


def find_sheets(b):
    cands = []
    for name in b.sheets:
        try:
            for r in b.rows(name, 6):
                t = ' '.join(r.values())
                if re.search(r'Estabelecimentos da Educa[çc][ãa]o B[áa]sica, por Localiza[çc][ãa]o', t) and 'onveniad' not in t:
                    cands.append((name, t[:200])); break
        except Exception:
            continue
    return cands


def labels(header_rows):
    """Rótulo por coluna: junta, de cima para baixo, o texto de cada linha de cabeçalho propagado para a direita até o próximo rótulo da mesma linha."""
    out = {c: [] for c in COLS}
    for r in header_rows:
        cur = None
        for c in COLS:
            if c in r and r[c].strip(): cur = re.sub(r'[\d\-,]+$', '', r[c].strip()).strip() or r[c].strip()
            if cur: out[c].append(cur)
    return {c: '|'.join(dict.fromkeys(v)) for c, v in out.items() if v}


def main():
    b = Book(sys.argv[1]); cands = find_sheets(b)
    if not cands: raise SystemExit('aba de estabelecimentos não encontrada')
    name = cands[0][0]; out = {'sheet': name, 'title': cands[0][1], 'candidates': [c[0] for c in cands], 'columns': {}, 'brasil': None, 'ufs': {}, 'municipios': {}, 'notes': []}
    header, seen_header = [], False
    for r in b.rows(name):
        a = (r.get('A') or '').strip()
        if not seen_header:
            if a == 'Brasil': seen_header = True
            else:
                if any(v.strip() in ('Região Geográfica',) for v in r.values()) or header: header.append(r)
                if not seen_header and a != 'Brasil': continue
        if a == 'Brasil': out['columns'] = labels(header[1:] if header else [])
        if a.startswith(('Fonte', 'Nota', 'Notas')) or re.match(r'^\d\s*-', a): out['notes'].append(' '.join(v.strip() for v in r.values())[:400]); continue
        vals = {c: (int(float(r[c])) if c in r and NUM.fullmatch(str(r[c]).strip()) else None) for c in COLS if c in r}
        if not any(v is not None for v in vals.values()): continue
        code = (r.get('D') or '').strip(); ufn = (r.get('B') or '').strip(); mun = (r.get('C') or '').strip()
        if a == 'Brasil': out['brasil'] = vals
        elif code.isdigit() and len(code) == 7: out['municipios'][code] = vals
        elif ufn and not mun and a != 'Brasil': out['ufs'][ufn] = vals
    out['columns'] = {c: l for c, l in out['columns'].items() if c in (out['brasil'] or {})}
    out['n_municipios'] = len(out['municipios']); out['n_ufs'] = len(out['ufs'])
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(os.path.basename(sys.argv[1]), name, 'brasil', out['brasil'] and out['brasil'].get('E'), 'ufs', out['n_ufs'], 'muns', out['n_municipios'], 'cols', len(out['columns']))


main()
