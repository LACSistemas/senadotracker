# -*- coding: utf-8 -*-
"""Extratores DBC/DBF do DATASUS para o schema civica_exec. Saída: JSON em arquivo (linhas já normalizadas e AGREGADAS).
Nenhum identificador individual é escrito: CPF, CNS e nome de profissionais são lidos apenas em memória para contagem distinta.
Uso: python dbc_extract.py <tipo> <arquivo.dbc> <saida.json> [--tmp DIR]   tipos: st lt eq pf sim sinasc sih
"""
import sys, os, json, hashlib, tempfile, collections, shutil
from pyreaddbc import dbc2dbf
from dbfread import DBF

def read_dbf(path_dbc, tmp):
    base = os.path.join(tmp, os.path.basename(path_dbc).rsplit('.', 1)[0] + '.dbf')
    dbc2dbf(path_dbc.encode(), base.encode())
    return base

def table(path_dbf):
    return DBF(path_dbf, encoding='latin-1', load=False, ignorecase=True)

def to_int(v, d=0):
    try: return int(str(v).strip() or d)
    except Exception: return d

GESTAO = {'M': 1, 'E': 2, 'D': 3, 'S': 0}
def flags_st(r):
    f = 0
    for bit, col in ((1, 'ATENDHOS'), (2, 'URGEMERG'), (4, 'ATENDAMB'), (8, 'CENTRCIR'), (16, 'CENTROBS'), (32, 'CENTRNEO')):
        if str(r.get(col, '0')).strip() == '1': f |= bit
    return f

def cbo_group(cbo):
    c = (cbo or '').strip()
    if c.startswith('225'): return 1      # médicos
    if c.startswith('2235'): return 2     # enfermeiros
    if c.startswith('3222'): return 3     # técnicos e auxiliares de enfermagem
    if c.startswith('5151'): return 4     # agentes comunitários e de endemias
    if c.startswith('2232'): return 5     # cirurgiões-dentistas
    if c.startswith('2234'): return 6     # farmacêuticos
    if c.startswith('2236'): return 7     # fisioterapeutas e afins
    if c.startswith('2515'): return 8     # psicólogos
    if c.startswith('2516'): return 9     # assistentes sociais
    if c.startswith('2237'): return 10    # nutricionistas
    if c.startswith('2238'): return 11    # fonoaudiólogos
    if c.startswith('3224'): return 12    # técnicos de saúde bucal
    if c.startswith(('223', '2241', '2242', '2243', '2244')): return 13   # outras categorias de saúde de nível superior
    return 99

def run(kind, src, out, tmp):
    os.makedirs(tmp, exist_ok=True)
    dbf = read_dbf(src, tmp)
    rows = []; n = 0
    try:
        if kind == 'st':
            for r in table(dbf):
                n += 1
                rows.append(dict(cnes=to_int(r['CNES']), codufmun=str(r['CODUFMUN']).strip(), tp_unid=to_int(r['TP_UNID']), nat_jur=to_int(r.get('NAT_JUR')), gestao=GESTAO.get(str(r.get('TPGESTAO', '')).strip(), 0), vinc_sus=str(r.get('VINC_SUS', '')).strip() == '1', flags=flags_st(r)))
        elif kind == 'lt':
            agg = collections.OrderedDict()
            for r in table(dbf):
                n += 1
                k = (to_int(r['CNES']), to_int(r['TP_LEITO']), to_int(r['CODLEITO']))
                a = agg.setdefault(k, dict(cnes=k[0], codufmun=str(r['CODUFMUN']).strip(), tp_leito=k[1], cod_leito=k[2], qt_exist=0, qt_sus=0, qt_nsus=0))
                a['qt_exist'] += to_int(r['QT_EXIST']); a['qt_sus'] += to_int(r['QT_SUS']); a['qt_nsus'] += to_int(r['QT_NSUS'])
            rows = list(agg.values())
        elif kind == 'eq':
            agg = collections.OrderedDict()
            for r in table(dbf):
                n += 1
                k = (to_int(r['CNES']), to_int(r['TIPEQUIP']), to_int(r['CODEQUIP']))
                sus = (1 if str(r.get('IND_SUS', '')).strip() == '1' else 0) + (2 if str(r.get('IND_NSUS', '')).strip() == '1' else 0)
                a = agg.setdefault(k, dict(cnes=k[0], codufmun=str(r['CODUFMUN']).strip(), tp_equip=k[1], cod_equip=k[2], qt_exist=0, qt_uso=0, sus_flag=sus))
                a['qt_exist'] += to_int(r['QT_EXIST']); a['qt_uso'] += to_int(r['QT_USO']); a['sus_flag'] |= sus
            rows = list(agg.values())
        elif kind == 'pf':
            vinc = collections.Counter(); pess = collections.defaultdict(set)
            for r in table(dbf):
                n += 1
                key = (str(r['CODUFMUN']).strip(), cbo_group(r.get('CBO')))
                vinc[key] += 1
                ident = str(r.get('CNS_PROF') or '').strip() or str(r.get('CPF_PROF') or '').strip()
                if ident: pess[key].add(hashlib.sha1(ident.encode('latin-1', 'ignore')).digest()[:8])   # só para contagem distinta; nada é gravado
            rows = [dict(codufmun=k[0], cbo_group=k[1], vinculos=v, pessoas=len(pess[k])) for k, v in vinc.items()]
        else:
            raise SystemExit(f'tipo desconhecido: {kind}')
    finally:
        try: os.remove(dbf)
        except OSError: pass
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(dict(kind=kind, source=os.path.basename(src), rows_read=n, rows=rows), fh, ensure_ascii=False)
    return n, len(rows)

if __name__ == '__main__':
    a = sys.argv[1:]
    tmp = a[a.index('--tmp') + 1] if '--tmp' in a else tempfile.gettempdir()
    n, m = run(a[0], a[1], a[2], tmp)
    print(json.dumps(dict(kind=a[0], rows_read=n, rows_out=m)))
