# -*- coding: utf-8 -*-
"""Extrator PRF datatran ("agrupados por ocorrência") → JSON AGREGADO por (UF, município, mês).
Não grava identificador, coordenada, km, BR, horário nem qualquer campo individual: só somas.
Uso: python prf_extract.py <datatranAAAA.zip|csv> <saida.json> --year AAAA
Regras: 1 linha = 1 sinistro (a mesma id repetida — ex.: várias condições meteorológicas — é contada UMA vez; as repetições vão para `dup_ids`);
classificação 'Com Vítimas Fatais' / 'Com Vítimas Feridas' / 'Sem Vítimas' / ausente; datas dd/mm/aaaa, dd/mm/aa e aaaa-mm-dd."""
import sys, io, csv, json, re, zipfile, unicodedata, collections

def nrm(s): return unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower().strip()

def to_ym(d, year):
    d = (d or '').strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', d)
    if m: return int(m.group(1)) * 100 + int(m.group(2))
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2,4})$', d)
    if m:
        y = int(m.group(3)); y = y + 2000 if y < 100 else y
        return y * 100 + int(m.group(2))
    return None

def num(v):
    v = (v or '').strip()
    return int(v) if re.fullmatch(r'-?\d+', v) else 0

def main(src, out, year):
    head = open(src, 'rb').read(4)
    if head[:2] == b'PK':
        z = zipfile.ZipFile(src); raw = z.open(z.namelist()[0]).read()
    else: raw = open(src, 'rb').read()
    try: txt = raw.decode('utf-8')
    except UnicodeDecodeError: txt = raw.decode('latin-1')
    first = txt.split('\n', 1)[0]
    rd = csv.reader(io.StringIO(txt, newline=''), delimiter=';' if first.count(';') >= first.count(',') else ',')
    hdr = [h.strip().lower() for h in next(rd)]; ix = {h: i for i, h in enumerate(hdr)}
    need = ['id', 'data_inversa', 'uf', 'municipio', 'classificacao_acidente', 'pessoas', 'mortos', 'feridos_leves', 'feridos_graves', 'ilesos', 'ignorados', 'veiculos']
    miss = [c for c in need if c not in ix]
    if miss: raise SystemExit(f'colunas ausentes: {miss}; encontradas: {hdr}')
    seen = set(); agg = {}; dup = 0; rows = 0; bad_date = 0; other_year = 0; cls = collections.Counter()
    for r in rd:
        if len(r) < len(need): continue
        rows += 1; rid = r[ix['id']].strip()
        if rid in seen: dup += 1; continue
        seen.add(rid)
        ym = to_ym(r[ix['data_inversa']], year)
        if ym is None: bad_date += 1; continue
        if ym // 100 != year: other_year += 1
        c = nrm(r[ix['classificacao_acidente']])
        k = 'fatal' if 'fatais' in c else 'ferida' if 'feridas' in c else 'sem' if c.startswith('sem') else 'ign'
        cls[k] += 1
        key = (r[ix['uf']].strip().upper(), r[ix['municipio']].strip(), ym)
        a = agg.get(key)
        if a is None: a = agg[key] = [0] * 11
        a[0] += 1
        a[1] += k == 'fatal'; a[2] += k == 'ferida'; a[3] += k == 'sem'; a[4] += k == 'ign'
        a[5] += num(r[ix['mortos']]); a[6] += num(r[ix['feridos_leves']]); a[7] += num(r[ix['feridos_graves']]); a[8] += num(r[ix['ilesos']]); a[9] += num(r[ix['pessoas']]); a[10] += num(r[ix['veiculos']])
    payload = dict(kind='prf', year=year, rows_read=rows, sinistros=len(seen), dup_ids=dup, bad_date=bad_date, other_year=other_year, classes=dict(cls), columns=hdr,
                   cols=['sinistros', 'fatais', 'feridas', 'sem_vitimas', 'class_ign', 'mortos', 'feridos_leves', 'feridos_graves', 'ilesos', 'pessoas', 'veiculos'],
                   rows=[[k[0], k[1], k[2]] + v for k, v in agg.items()])
    json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps(dict(rows_read=rows, sinistros=len(seen), keys=len(agg), dup=dup)))

if __name__ == '__main__':
    a = sys.argv[1:]; main(a[0], a[1], int(a[a.index('--year') + 1]))
