# -*- coding: utf-8 -*-
"""Extratores de epidemiologia/atividade hospitalar (SINASC, SIM, SIH-RD, PNI) para civica_exec. Saída: JSON AGREGADO por município.
Nenhum registro individual (AIH, nascido, óbito) é escrito. Uso: python epi_extract.py <tipo> <arquivo> <saida.json> [--uf XX] [--tmp DIR]
tipos: sinasc sim sih pni
"""
import sys, os, json, re, collections, unicodedata
from pyreaddbc import dbc2dbf
from dbfread import DBF

# Lista Brasileira de ICSAP (Portaria SAS/MS 221/2008): códigos de 3 dígitos cobrem qualquer 4º dígito; os de 4 dígitos só o próprio.
_RAW = "A37;A36;A33-A35;B26;B06;B05;A95;B16;G00.0;A17.0;A19;A15-A16;A17.1-A17.9;A18;I00-I02;A51-A53;B50-B54;B77;E86;A00-A09;D50;E40-E46;E50-E64;H66;J00;J01;J02;J03;J06;J31;J13;J14;J15.3;J15.4;J15.8;J15.9;J18.1;J45;J46;J20;J21;J40;J41;J42;J43;J47;J44;I10;I11;I20;I50;J81;I63-I67;I69;G45-G46;E10.0;E10.1;E11.0;E11.1;E12.0;E12.1;E13.0;E13.1;E14.0;E14.1;E10.2-E10.8;E11.2-E11.8;E12.2-E12.8;E13.2-E13.8;E14.2-E14.8;E10.9;E11.9;E12.9;E13.9;E14.9;G40;G41;N10;N11;N12;N30;N34;N39.0;A46;L01;L02;L03;L04;L08;N70;N71;N72;N73;N75;N76;K25-K28;K92.0;K92.1;K92.2;O23;A50;P35.0"
C3, C4 = set(), set()
for t in _RAW.split(';'):
    t = t.strip().replace('.', '')
    if '-' in t and len(t) > 7:
        a, b = t.split('-'); pre = a[:3]
        for d in range(int(a[3]), int(b[3]) + 1): C4.add(pre + str(d))
    elif '-' in t:
        a, b = t.split('-')
        for i in range(int(a[1:]), int(b[1:]) + 1): C3.add(f'{a[0]}{i:02d}')
    elif len(t) == 3: C3.add(t)
    else: C4.add(t)
def icsap(d):
    d = (d or '').strip().upper()
    return d[:3] in C3 or d[:4] in C4

def to_int(v, d=0):
    try: return int(str(v).strip() or d)
    except Exception: return d
def read(path, tmp):
    base = os.path.join(tmp, os.path.basename(path).rsplit('.', 1)[0] + '.dbf')
    dbc2dbf(path.encode(), base.encode()); return base

def sinasc(path, tmp):
    dbf = read(path, tmp); agg = collections.defaultdict(lambda: [0, 0, 0, 0, 0]); n = 0
    try:
        for r in DBF(dbf, encoding='latin-1', load=False, ignorecase=True):
            n += 1; m = str(r['CODMUNRES']).strip(); a = agg[m]; a[0] += 1
            p = str(r.get('PARTO', '')).strip()
            if p in ('1', '2'): a[1] += 1; a[2] += 1 if p == '2' else 0
            c = str(r.get('CONSPRENAT', '')).strip()
            if c.isdigit() and int(c) < 99:
                a[3] += 1; a[4] += 1 if int(c) >= 6 else 0
    finally: os.remove(dbf)
    return n, [dict(codufmun=m, nascidos=a[0], partos_validos=a[1], cesareas=a[2], pn_validos=a[3], pn6=a[4]) for m, a in agg.items()]

def sim(path, tmp):
    dbf = read(path, tmp); agg = collections.defaultdict(lambda: [0, 0]); n = 0
    try:
        for r in DBF(dbf, encoding='latin-1', load=False, ignorecase=True):
            n += 1
            if str(r.get('TIPOBITO', '')).strip() != '2': continue
            m = str(r['CODMUNRES']).strip(); a = agg[m]; a[0] += 1
            if str(r.get('IDADE', '')).strip()[:1] in ('0', '1', '2', '3'): a[1] += 1
    finally: os.remove(dbf)
    return n, [dict(codufmun=m, obitos=a[0], obitos_menor1=a[1]) for m, a in agg.items()]

def sih(path, tmp):
    """Agrega a AIH reduzida (RD) por hospital×subgrupo e por município de residência. Deduplicação: uma ocorrência por (N_AIH, IDENT) na competência."""
    dbf = read(path, tmp); seen = set(); dup = 0; n = 0
    hosp = collections.defaultdict(lambda: [0, 0.0, 0, 0, 0]); mun = collections.defaultdict(lambda: [0, 0, 0, 0.0, 0, 0]); comp = None
    try:
        for r in DBF(dbf, encoding='latin-1', load=False, ignorecase=True):
            n += 1
            key = (str(r['N_AIH']).strip(), str(r.get('IDENT', '')).strip(), str(r.get('ANO_CMPT')), str(r.get('MES_CMPT')))
            if key in seen: dup += 1; continue
            seen.add(key)
            comp = to_int(r['ANO_CMPT']) * 100 + to_int(r['MES_CMPT'])
            val = float(r.get('VAL_TOT') or 0); dias = to_int(r.get('DIAS_PERM')); morte = 1 if to_int(r.get('MORTE')) else 0
            ic = 1 if icsap(r.get('DIAG_PRINC')) else 0
            h = hosp[(to_int(r['CNES']), to_int(str(r.get('PROC_REA', '0'))[:4]))]
            h[0] += 1; h[1] += val; h[2] += dias; h[3] += morte; h[4] += ic
            res = str(r['MUNIC_RES']).strip(); fora = 1 if res != str(r.get('MUNIC_MOV', '')).strip() else 0
            m = mun[res]; m[0] += 1; m[1] += ic; m[2] += fora; m[3] += val; m[4] += dias; m[5] += morte
    finally: os.remove(dbf)
    return n, dict(competence=comp, duplicates_dropped=dup,
                   hosp=[dict(cnes=k[0], subgrupo=k[1], n_aih=v[0], valor_cents=int(round(v[1] * 100)), dias_perm=v[2], obitos=v[3], n_icsap=v[4]) for k, v in hosp.items()],
                   mun=[dict(codufmun=k, n_aih=v[0], n_icsap=v[1], n_fora_mun=v[2], valor_cents=int(round(v[3] * 100)), dias_perm=v[4], obitos=v[5]) for k, v in mun.items()])

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_'); return s

def pni(path, uf_code):
    import pandas as pd
    d = pd.read_parquet(path)
    d['mun'] = d['CO_MUNICIPIO'].astype(str)
    if str(uf_code) != 'all': d = d[d['mun'].str[:2] == str(uf_code)]
    rows = []
    for r in d.itertuples(index=False):
        rows.append(dict(codufmun=r.mun, year=int(r.CO_ANO), label=r.NU_IMUNO, slug=slug(r.NU_IMUNO), doses=int(r.QT_DOSE), pop=int(r.NU_POPULACAO), dt_carga=str(r.DT_CARGA)))
    return len(d), rows

if __name__ == '__main__':
    a = sys.argv[1:]; kind, src, out = a[0], a[1], a[2]
    tmp = a[a.index('--tmp') + 1] if '--tmp' in a else os.environ.get('TEMP', '.')
    uf = a[a.index('--uf') + 1] if '--uf' in a else None
    os.makedirs(tmp, exist_ok=True)
    if kind == 'sinasc': n, rows = sinasc(src, tmp); payload = dict(rows=rows)
    elif kind == 'sim': n, rows = sim(src, tmp); payload = dict(rows=rows)
    elif kind == 'sih': n, p = sih(src, tmp); payload = p
    elif kind == 'pni': n, rows = pni(src, uf); payload = dict(rows=rows)
    else: raise SystemExit('tipo desconhecido')
    payload.update(kind=kind, source=os.path.basename(src), rows_read=n)
    with open(out, 'w', encoding='utf-8') as fh: json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps(dict(kind=kind, rows_read=n)))
