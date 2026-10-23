# -*- coding: utf-8 -*-
"""Extrator SIM → óbitos por acidentes de transporte (V01–V99) e sequela Y85.0, por município de residência e de ocorrência (P9.2).
Somente contagens por (código de município, código CID de 3 caracteres; Y85 separa Y850 de Y85x). Nenhum registro individual é gravado.
Uso: python sim_transito_extract.py <arquivo.dbc> <saida.json> --year AAAA [--tmp DIR]"""
import sys, os, json, collections
from pyreaddbc import dbc2dbf
from dbfread import DBF

def key(c):
    c = (c or '').strip().upper()
    if len(c) >= 3 and c[0] == 'V' and c[1:3].isdigit(): return c[:3]
    if c.startswith('Y85'): return 'Y850' if c.startswith('Y850') else 'Y85x'
    return None

def main(path, out, year, tmp):
    base = os.path.join(tmp, 'tr_' + os.path.basename(path).rsplit('.', 1)[0] + '.dbf')
    dbc2dbf(path.encode(), base.encode())
    res = collections.defaultdict(collections.Counter); occ = collections.defaultdict(collections.Counter); st = collections.Counter()
    try:
        for r in DBF(base, encoding='latin-1', load=False, ignorecase=True):
            st['rows_read'] += 1
            if str(r.get('TIPOBITO', '')).strip() != '2': st['fetal_or_other'] += 1; continue
            st['nonfetal'] += 1
            dt = str(r.get('DTOBITO', '')).strip()
            if len(dt) == 8 and dt[4:].isdigit() and int(dt[4:]) != year: st['year_mismatch'] += 1
            k = key(r.get('CAUSABAS'))
            if k is None: continue
            st['transport_' + ('seq' if k.startswith('Y85') else 'V')] += 1
            mr = str(r.get('CODMUNRES', '')).strip(); mo = str(r.get('CODMUNOCOR', '')).strip()
            if not (len(mr) == 6 and mr.isdigit()): st['res_invalid'] += 1; mr = ''
            if not (len(mo) == 6 and mo.isdigit()): st['occ_invalid'] += 1; mo = ''
            res[mr][k] += 1; occ[mo][k] += 1
    finally:
        try: os.remove(base)
        except OSError: pass
    json.dump(dict(kind='sim_transito', source=os.path.basename(path), year=year, stats=dict(st), res={m: dict(c) for m, c in res.items()}, occ={m: dict(c) for m, c in occ.items()}), open(out, 'w', encoding='utf-8'))
    print(json.dumps(dict(rows_read=st['rows_read'], V=st['transport_V'], seq=st['transport_seq'])))

if __name__ == '__main__':
    a = sys.argv[1:]; tmp = a[a.index('--tmp') + 1] if '--tmp' in a else os.environ.get('TEMP', '.')
    os.makedirs(tmp, exist_ok=True); main(a[0], a[1], int(a[a.index('--year') + 1]), tmp)
