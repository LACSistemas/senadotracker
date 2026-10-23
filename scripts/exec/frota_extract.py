# -*- coding: utf-8 -*-
"""Extrator da frota Senatran por município e tipo (xls, xlsx, zip, rar, csv) → JSON agregado (sem placas nem proprietários: a fonte já é agregada).
Uso: python frota_extract.py <arquivo> <saida.json> [--tmp DIR]
Saída: {title, sheet, header:[...], rows:[[uf, municipio, total, [valores por coluna de tipo]]], formula_total, notes}
Regras: o cabeçalho é a linha cujas duas primeiras células são UF e MUNICIPIO; as colunas de tipo são as seguintes a TOTAL até a primeira célula de cabeçalho vazia;
células vazias ficam None (≠ 0); linhas sem UF de 2 letras não entram (ficam em `skipped`)."""
import sys, os, re, json, zipfile, subprocess, tempfile, glob, csv, io, unicodedata

def norm(s):
    return unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper().strip()

def unpack(path, tmp):
    ext = path.lower().rsplit('.', 1)[-1]
    if ext not in ('zip', 'rar'): return path
    d = tempfile.mkdtemp(dir=tmp)
    if ext == 'zip': zipfile.ZipFile(path).extractall(d)
    else:
        r = subprocess.run(['tar', '-xf', path, '-C', d], capture_output=True)
        if r.returncode != 0: raise SystemExit('rar ilegível: ' + r.stderr.decode('latin-1', 'ignore')[:200])
    fs = [f for f in glob.glob(d + '/**/*', recursive=True) if os.path.isfile(f) and f.lower().rsplit('.', 1)[-1] in ('xls', 'xlsx', 'csv')]
    if not fs: raise SystemExit('pacote sem planilha')
    return fs[0]

def sheets(path):
    ext = path.lower().rsplit('.', 1)[-1]
    if ext == 'xls':
        import xlrd
        wb = xlrd.open_workbook(path)
        for sh in wb.sheets(): yield sh.name, (sh.row_values(i) for i in range(sh.nrows))
    elif ext == 'xlsx':
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=False)
        for ws in wb.worksheets: yield ws.title, (list(r) for r in ws.iter_rows(values_only=True))
    else:
        raw = open(path, 'rb').read().decode('latin-1')
        dlg = ';' if raw.count(';') > raw.count(',') else ','
        yield 'csv', (r for r in csv.reader(io.StringIO(raw), delimiter=dlg))

def num(v):
    if v is None or v == '': return None
    if isinstance(v, (int, float)): return v
    s = str(v).strip().replace('.', '').replace(',', '.') if re.search(r'[.,]', str(v)) and not re.fullmatch(r'-?\d+(\.\d+)?', str(v).strip()) else str(v).strip()
    try: return float(s)
    except ValueError: return None

def main(src, out, tmp):
    path = unpack(src, tmp); title = None; found = None; formula = None
    for name, rows in sheets(path):
        buf = []; hdr = None; title_s = None; data = []; skipped = 0
        for r in rows:
            r = list(r)
            if hdr is None:
                if title_s is None and r and r[0] and 'frota' in norm(r[0]).lower() and 'tipo' in norm(r[0]).lower(): title_s = str(r[0])
                if len(r) > 2 and norm(r[0]) == 'UF' and norm(r[1]).startswith('MUNIC'):
                    hdr = r; continue
                if len(r) > 2 and isinstance(r[2], str) and r[2].startswith('='): formula = r[2]
                continue
            uf = str(r[0] or '').strip().upper() if r else ''
            if not re.fullmatch(r'[A-Z]{2}', uf):
                if any(c not in (None, '') for c in r): skipped += 1
                continue
            data.append(r)
        if hdr is None: continue
        cols = []
        for i in range(2, len(hdr)):
            h = hdr[i]
            if h in (None, ''): break
            cols.append(str(h).strip())
        found = dict(sheet=name, title=title_s, header=cols, formula_total=formula, skipped=skipped)
        rows_out = [[str(r[0]).strip().upper(), str(r[1] or '').strip()] + [num(r[2 + j]) if 2 + j < len(r) else None for j in range(len(cols))] for r in data]
        found['rows'] = rows_out; break
    if not found: raise SystemExit('cabeçalho UF/MUNICIPIO não encontrado')
    found['source'] = os.path.basename(src); found['inner'] = os.path.basename(path)
    json.dump(found, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps(dict(rows=len(found['rows']), cols=len(found['header']))))

if __name__ == '__main__':
    a = sys.argv[1:]; tmp = a[a.index('--tmp') + 1] if '--tmp' in a else tempfile.gettempdir()
    os.makedirs(tmp, exist_ok=True); main(a[0], a[1], tmp)
