# -*- coding: utf-8 -*-
"""Extrator Senatran/RENAINF — infrações com notificação de penalidade (NP) por UF de JURISDIÇÃO DO VEÍCULO e código de infração (csv/xlsx; wide UTF-16, wide UTF-8 ou long).
A UF é a do veículo/jurisdição, NÃO necessariamente o local da infração. Nenhum dado individual existe na fonte.
Uso: python infr_extract.py <arquivo> <saida.json>
Saída: {layout, rows:[[uf_nome_normalizado, cod_infracao, qtde]], blanks}"""
import sys, io, csv, json, re, unicodedata

def norm(s): return unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper().strip()

def qty(v):
    if v is None: return None
    if isinstance(v, (int, float)): return int(v)
    s = str(v).strip().replace('.', '').replace(' ', '')
    return int(s) if re.fullmatch(r'-?\d+', s) else None

def text_of(path):
    raw = open(path, 'rb').read()
    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'): return raw.decode('utf-16'), 'utf16'
    try: return raw.decode('utf-8-sig'), 'utf8'
    except UnicodeDecodeError: return raw.decode('latin-1'), 'latin1'

def rows_csv(path):
    txt, enc = text_of(path)
    NL = chr(10)
    txt = txt.replace(chr(13) + NL, NL).replace(chr(13), NL)
    def parse(t):
        first = t.split(NL, 1)[0]
        dl = max([';', ',', chr(9)], key=first.count)
        return [r for r in csv.reader(io.StringIO(t, newline=''), delimiter=dl)]
    rows = parse(txt)
    if (not rows or len(rows[0]) < 3 or len(rows) < 5) and chr(34) * 2 in txt:   # aspas duplicadas ao redor de cada célula
        q = chr(34)
        fixed = []
        for ln in txt.split(NL):
            if ln.startswith(q) and q + q in ln:
                ln = ln[1:]
                if ln.endswith(q): ln = ln[:-1]
            fixed.append(ln.replace(q + q, q))
        rows = parse(NL.join(fixed))
    return rows, enc

def rows_xlsx(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    return [list(r) for r in ws.iter_rows(values_only=True)], 'xlsx'

def main(src, out):
    rows, enc = (rows_xlsx(src) if src.lower().endswith('.xlsx') else rows_csv(src))
    rows = [r for r in rows if any(c not in (None, '') for c in r)]
    # o cabeçalho pode vir depois de linhas de título (ex.: xlsx de 2020-06): procura nas primeiras linhas
    def is_header(r):
        n = [norm(c) for c in r]
        return ('ACRE' in n) or ('UF' in n and any(x.startswith('COD') for x in n) and any(x.startswith('QUANT') for x in n))
    for k in range(min(len(rows), 12)):
        if is_header(rows[k]):
            rows = rows[k:]; break
    h = [norm(c) for c in rows[0]]; res = []; blanks = 0
    if len(h) == 3 and 'UF' in h and any(x.startswith('COD') for x in h) and any(x.startswith('QUANT') for x in h):
        layout = 'long'   # a ordem das colunas varia entre os arquivos
        iu = h.index('UF'); ic = [i for i, x in enumerate(h) if x.startswith('COD')][0]; iq = [i for i, x in enumerate(h) if x.startswith('QUANT')][0]
        for r in rows[1:]:
            q = qty(r[iq]); cod = str(r[ic]).strip()
            if not re.fullmatch(r'\d{3,5}', cod): continue
            if q is None:
                blanks += 1; continue
            res.append([norm(r[iu]), int(cod), q])
    else:
        layout = 'wide'   # linha 0 = UFs; linha 1 = rótulo; demais = código + valores
        ufs = [norm(c) for c in rows[0][1:]]
        if 'ACRE' not in ufs: raise SystemExit('layout desconhecido: ' + str(h[:4]))
        for r in rows[2:]:
            cod = str(r[0]).strip().replace('.0', '')
            if not re.fullmatch(r'\d{3,5}', cod): continue
            for u, v in zip(ufs, r[1:]):
                q = qty(v)
                if q is None:
                    blanks += 1; continue
                res.append([u, int(cod), q])
    json.dump(dict(layout=layout, encoding=enc, source=src.replace('\\', '/').split('/')[-1], blanks=blanks, rows=res), open(out, 'w', encoding='utf-8'))
    print(json.dumps(dict(layout=layout, rows=len(res), blanks=blanks, total=sum(r[2] for r in res))))

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
