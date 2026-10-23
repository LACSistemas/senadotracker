# -*- coding: utf-8 -*-
"""Extrator SIM → mortes violentas por município (Segurança Pública, P9.1). Lê o DBC preservado no RAW e escreve JSON AGREGADO.
Nenhum registro individual (nome, data de nascimento, endereço, identificador) é lido além do necessário nem gravado: apenas contagens por
(município de residência, grupo de causa) e (município de ocorrência, grupo de causa). Não altera os extratores da Saúde.
Uso: python sim_seg_extract.py <arquivo.dbc> <saida.json> --year AAAA [--tmp DIR]

Grupos (causa básica CID-10, 3 primeiros caracteres; só óbitos não fetais, TIPOBITO = 2):
  AGR X85–Y09 | IND Y10–Y34 | INT Y35 | GUE Y36
"""
import sys, os, json, collections
from pyreaddbc import dbc2dbf
from dbfread import DBF

def group(c):
    c = (c or '').strip().upper()
    if len(c) < 3 or not c[1:3].isdigit(): return None
    l, n = c[0], int(c[1:3])
    if l == 'X' and 85 <= n <= 99: return 'AGR'
    if l == 'Y' and 0 <= n <= 9: return 'AGR'
    if l == 'Y' and 10 <= n <= 34: return 'IND'
    if l == 'Y' and n == 35: return 'INT'
    if l == 'Y' and n == 36: return 'GUE'
    return None

def main(path, out, year, tmp):
    base = os.path.join(tmp, os.path.basename(path).rsplit('.', 1)[0] + '.dbf')
    dbc2dbf(path.encode(), base.encode())
    res = collections.defaultdict(lambda: collections.Counter()); occ = collections.defaultdict(lambda: collections.Counter())
    stats = collections.Counter()
    try:
        for r in DBF(base, encoding='latin-1', load=False, ignorecase=True):
            stats['rows_read'] += 1
            if str(r.get('TIPOBITO', '')).strip() != '2': stats['fetal_or_other'] += 1; continue
            stats['nonfetal'] += 1
            dt = str(r.get('DTOBITO', '')).strip()
            if len(dt) == 8 and dt[4:].isdigit() and int(dt[4:]) != year: stats['year_mismatch'] += 1
            g = group(r.get('CAUSABAS'))
            if g is None: continue
            stats['violent_' + g] += 1
            mr = str(r.get('CODMUNRES', '')).strip(); mo = str(r.get('CODMUNOCOR', '')).strip()
            if not (len(mr) == 6 and mr.isdigit()): stats['res_invalid'] += 1; mr = ''
            if not (len(mo) == 6 and mo.isdigit()): stats['occ_invalid'] += 1; mo = ''
            res[mr][g] += 1; occ[mo][g] += 1
    finally:
        try: os.remove(base)
        except OSError: pass
    payload = dict(kind='sim_seg', source=os.path.basename(path), year=year, stats=dict(stats),
                   res={k: dict(v) for k, v in res.items()}, occ={k: dict(v) for k, v in occ.items()})
    with open(out, 'w', encoding='utf-8') as fh: json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps(dict(rows_read=stats['rows_read'], violent=sum(v for k, v in stats.items() if k.startswith('violent_')))))

if __name__ == '__main__':
    a = sys.argv[1:]
    year = int(a[a.index('--year') + 1]); tmp = a[a.index('--tmp') + 1] if '--tmp' in a else os.environ.get('TEMP', '.')
    os.makedirs(tmp, exist_ok=True)
    main(a[0], a[1], year, tmp)
