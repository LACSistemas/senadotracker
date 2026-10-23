# -*- coding: utf-8 -*-
"""Extrator do Sinesp VDE (bancovde-{ANO}.xlsx) para civica_exec. Leitura em fluxo (sem pandas/openpyxl); saída: JSON AGREGADO.
Não grava nenhum registro individual (o VDE já é agregado por evento, território e mês). Uso: python vde_extract.py <arquivo.xlsx> <saida.json>

Regras de agregação (contrato P9.1):
  * chave de saída = (uf, municipio, evento, competência AAAAMM, abrangência); as dimensões agente/arma/faixa etária/sexo são somadas;
  * linhas repetidas na mesma chave (DF informa por região administrativa sob o nome BRASÍLIA) são SOMADAS; a contagem fica em `dup`;
  * vítimas (total_vitima), ocorrências/unidades (total) e peso (total_peso) são medidas distintas e nunca somadas entre si;
  * valor ausente (célula vazia) ≠ zero: `None` permanece `None`; só valores não-nulos entram nas somas;
  * a saída lista apenas chaves com algum valor ≠ 0 (`rows`); o universo (inclusive zeros) vai em `cov` por (uf, evento, competência, abrangência).
"""
import sys, re, json, zipfile, datetime, unicodedata, collections
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REQUIRED = ['uf', 'municipio', 'evento', 'data_referencia', 'total_vitima', 'total', 'total_peso', 'abrangencia']

def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower().strip()
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_')

def col_idx(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0): n = n * 26 + ord(ch) - 64
    return n - 1

def shared_strings(z):
    out = []
    try: f = z.open('xl/sharedStrings.xml')
    except KeyError: return out
    for _, el in ET.iterparse(f):
        if el.tag == NS + 'si':
            out.append(''.join(t.text or '' for t in el.iter(NS + 't'))); el.clear()
    return out

def first_sheet(z):
    names = [n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', n)]
    if not names: raise SystemExit('planilha sem abas')
    return sorted(names, key=lambda n: int(re.findall(r'\d+', n)[0]))[0]

def to_ym(v, kind):
    if v is None: return None
    if kind == 'n':
        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(v)))
        return d.year * 100 + d.month
    m = re.match(r'(\d{4})-(\d{2})', v) or None
    if m: return int(m.group(1)) * 100 + int(m.group(2))
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', v)
    if m: return int(m.group(3)) * 100 + int(m.group(2))
    return None

def num(v):
    if v is None or v == '': return None
    try: return float(v)
    except ValueError: return None

def main(src, out):
    z = zipfile.ZipFile(src); ss = shared_strings(z)
    header = None; cols = {}
    rows_raw = 0; bad = collections.Counter()
    agg = {}      # chave -> [vit, tot, peso, nlinhas, dup, has_vit, has_tot, has_peso]
    seen_comp = collections.Counter(); events = collections.Counter(); abrang = collections.Counter(); cols_found = None
    with z.open(first_sheet(z)) as f:
        for _, el in ET.iterparse(f):
            if el.tag != NS + 'row': continue
            cells = {}
            for c in el.findall(NS + 'c'):
                t = c.get('t'); v = c.find(NS + 'v')
                if t == 's' and v is not None: val, kind = ss[int(v.text)], 's'
                elif t == 'inlineStr': val, kind = ''.join(x.text or '' for x in c.iter(NS + 't')), 's'
                elif v is not None: val, kind = v.text, ('s' if t in ('str', 'e') else 'n')
                else: val, kind = None, 's'
                cells[col_idx(c.get('r'))] = (val, kind)
            el.clear()
            if header is None:
                header = {norm(v[0]): i for i, v in cells.items() if v[0] is not None}
                cols_found = sorted(header)
                miss = [k for k in REQUIRED if k not in header]
                if miss: raise SystemExit(f'colunas ausentes: {miss}; encontradas: {cols_found}')
                continue
            rows_raw += 1
            g = lambda k: cells.get(header[k], (None, 's')) if k in header else (None, 's')
            uf = (g('uf')[0] or '').strip(); mun = (g('municipio')[0] or '').strip(); ev = (g('evento')[0] or '').strip(); ab = (g('abrangencia')[0] or '').strip()
            ym = to_ym(*g('data_referencia'))
            if not uf or not ev or ym is None: bad['linha_sem_chave'] += 1; continue
            vit, tot, peso = num(g('total_vitima')[0]), num(g('total')[0]), num(g('total_peso')[0])
            seen_comp[ym] += 1; events[ev] += 1; abrang[ab] += 1
            k = (uf, mun, ev, ym, ab); a = agg.get(k)
            if a is None: a = agg[k] = [0.0, 0.0, 0.0, 0, 0, False, False, False]
            a[3] += 1
            if vit is not None: a[0] += vit; a[5] = True
            if tot is not None: a[1] += tot; a[6] = True
            if peso is not None: a[2] += peso; a[7] = True
    nz = []; cov = {}
    for (uf, mun, ev, ym, ab), a in agg.items():
        ck = (uf, ev, ym, ab); c = cov.get(ck)
        if c is None: c = cov[ck] = dict(uf=uf, evento=ev, comp=ym, abr=ab, mun=0, lin=0, nz=0, dup=0, vit=0.0, tot=0.0, peso=0.0)
        c['mun'] += 1; c['lin'] += a[3]; c['dup'] += a[3] - 1; c['vit'] += a[0]; c['tot'] += a[1]; c['peso'] += a[2]
        if a[0] != 0 or a[1] != 0 or a[2] != 0:
            c['nz'] += 1
            nz.append([uf, mun, ev, ym, ab, a[0] if a[5] else None, a[1] if a[6] else None, a[2] if a[7] else None, a[4] + a[3] - 1])
    pairs = collections.defaultdict(lambda: [0, 0])      # (uf, município) → [chaves distintas, chaves com valor ≠ 0]; auditoria do crosswalk (universo do arquivo)
    for (uf, mun, ev, ym, ab), v in agg.items():
        p = pairs[uf + '|' + mun]; p[0] += 1
        if v[0] != 0 or v[1] != 0 or v[2] != 0: p[1] += 1
    payload = dict(kind='vde', source=src.replace('\\', '/').split('/')[-1], rows_read=rows_raw, columns=cols_found, bad=dict(bad), keys=len(agg),
                   competences=sorted(seen_comp), events=dict(events), abrangencias=dict(abrang), rows=nz, cov=list(cov.values()), pairs={k: v for k, v in pairs.items()})
    with open(out, 'w', encoding='utf-8') as fh: json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps(dict(rows_read=rows_raw, keys=len(agg), nonzero=len(nz), comps=len(seen_comp))))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
