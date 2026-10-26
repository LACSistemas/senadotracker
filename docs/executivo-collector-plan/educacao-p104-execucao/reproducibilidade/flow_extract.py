"""P10.4 — extrai das planilhas oficiais dos Indicadores Educacionais do INEP (ZIPs com .xlsx/.xls) as taxas de rendimento (TXR: aprovação, reprovação, abandono) e a distorção idade-série (TDI)
para um TSV compacto, por segmento escolar (fun, ai, af, f1..f9, med, m1..m4, mns).
Uso: python -I -X utf8 flow_extract.py <TXR|TDI> <escolas|municipios|uf> <ano> <saida.tsv> <zip> [<zip> ...]
 - Planilhas com linha de códigos técnicos (2016+; tap_/tre_/tab_, {1|2|3}_CAT_*, TDI_*, *_CAT_0) usam os códigos; planilhas anteriores (sem códigos) usam os rótulos de cabeçalho
   (Aprovação na 3ª série/4º Ano, Total Aprovação Médio Não-Seriado…). Em ambos os casos o segmento é o do ENSINO FUNDAMENTAL DE 9 ANOS (1ª série/2º Ano → f2).
 - Valores como vieram; "--", "-", "*" e vazio ficam como texto/vazio (a interpretação é do build). Só indicadores de escola, município ou território: nenhum dado pessoal.
Saída (TSV): escolas = row, inep, uf (sigla do arquivo), loc, dep, <medidas>; municipios = row, ibge7, loc, dep, <medidas>; uf = row, geo, loc, dep, <medidas>.
Última linha de stdout: JSON {family, level, year, files, sheets, rows, cells:{numeric, dash, empty}, lossy_x100, unmapped}."""
import hashlib, io, json, os, re, sys, unicodedata, zipfile

import openpyxl
import xlrd

FAM = sys.argv[1] if len(sys.argv) > 1 else ''
SEGS = ['fun', 'ai', 'af'] + [f'f{i}' for i in range(1, 10)] + ['med'] + [f'm{i}' for i in range(1, 5)] + ['mns']
METRICS = {'TXR': ['ap', 'rp', 'ab'], 'TDI': ['td'], 'TRN': ['pro', 'rep', 'eva', 'mej']}
TOK = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_]*$')


def wanted_cols(fam):
    segs = [s for s in SEGS if not (fam in ('TDI', 'TRN') and s == 'mns') and not (fam == 'TRN' and s == 'm4')]
    return [f'{m}_{s}' for m in METRICS[fam] for s in segs]


def plain(s):
    return ''.join(ch for ch in unicodedata.normalize('NFD', str(s)) if unicodedata.category(ch) != 'Mn').lower()


def seg_tech(c):
    t = c.upper()
    if t in ('FUN', 'FUN_AI', 'FUN_AF', 'MED'): return {'FUN': 'fun', 'FUN_AI': 'ai', 'FUN_AF': 'af', 'MED': 'med'}[t]
    if t in ('F14',): return 'ai'
    if t in ('F58',): return 'af'
    m = re.match(r'^F0([0-8])$', t)
    if m: return f'f{int(m.group(1)) + 1}'
    m = re.match(r'^FUN_0([1-9])$', t)
    if m: return f'f{m.group(1)}'
    m = re.match(r'^M0([1-4])$', t) or re.match(r'^MED_0([1-4])$', t)
    if m: return f'm{m.group(1)}'
    if t in ('MNS', 'MED_NS'): return 'mns'
    return None


def canon_tech(fam, code):
    c = code.strip()
    if fam == 'TXR':
        m = re.match(r'^(tap|tre|tab)_(.+)$', c, re.I)
        if m: return None if (s := seg_tech(m.group(2))) is None else f"{ {'tap': 'ap', 'tre': 'rp', 'tab': 'ab'}[m.group(1).lower()] }_{s}"
        m = re.match(r'^([123])_CAT_(.+)$', c, re.I)
        if m: return None if (s := seg_tech(m.group(2))) is None else f"{ {'1': 'ap', '2': 'rp', '3': 'ab'}[m.group(1)] }_{s}"
        return None
    m = re.match(r'^TDI_(.+)$', c, re.I) or re.match(r'^(.+)_CAT_0$', c, re.I)
    if m and (s := seg_tech(m.group(1))) is not None and s != 'mns': return f'td_{s}'
    return None


def seg_label(leaf, group):
    """Segmento pelos rótulos (sem acento, minúsculos). Fundamental de 9 anos: '1ª série/2º Ano' → f2."""
    L = plain(leaf); G = plain(group)
    if re.search(r'nao.?seriado', L): return 'mns'
    st = 'med' if 'medio' in L else 'fun' if 'fundament' in L else 'med' if 'medio' in G else 'fun'
    if st == 'fun':
        if re.search(r'iniciais|1[ºª]?\s*a[o]?\s*[45]', L): return 'ai'
        if re.search(r'finais|[56][ºª]?\s*a[o]?\s*[89]', L): return 'af'
        ys = re.findall(r'(\d)[ºª]?\s*ano', L)
        if ys: return f'f{ys[-1]}'
        return 'fun' if ('total' in L or 'fundamental' in L or not re.search(r'\d', L)) else None
    ss = re.findall(r'(\d)[ºª]?\s*serie', L)
    if ss: return f'm{ss[-1]}'
    return 'med' if ('total' in L or 'medio' in L) else None


def metric_label(fam, leaf, group):
    if fam == 'TDI': return 'td'
    if fam == 'TRN':
        g = plain(group)
        for k, v in (('promoc', 'pro'), ('repet', 'rep'), ('evas', 'eva'), ('migra', 'mej')):
            if k in g: return v
        return None
    for t in (plain(leaf), plain(group)):
        if 'reprov' in t: return 'rp'
        if 'aprov' in t: return 'ap'
        if 'abandon' in t: return 'ab'
    return None


def sheets_of(zpath):
    z = zipfile.ZipFile(zpath)
    infos = [i for i in z.infolist() if i.filename.lower().endswith(('.xlsx', '.xls')) and not i.filename.endswith('/') and not os.path.basename(i.filename).startswith('~$')]
    xlsx = [i for i in infos if i.filename.lower().endswith('.xlsx')]
    for i in (xlsx or infos):
        data = z.read(i)
        if i.filename.lower().endswith('.xls'):
            wb = xlrd.open_workbook(file_contents=data)
            for sh in wb.sheets(): yield i.filename, sh.name, (list(sh.row_values(r)) for r in range(sh.nrows))
        else:
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            for ws in wb.worksheets: yield i.filename, ws.title, (list(r) for r in ws.iter_rows(values_only=True))


def norm(v):
    if v is None: return ''
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e12: return str(int(v))
        return repr(v)
    return str(v).strip()


def parse_year(v):
    """Ano da linha: 2013, '2013', '2013.0' ou, nas taxas de transição, '2012/2013' (ano de origem: transição do Censo de 2012 para o de 2013 = 2012)."""
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)): return int(v) if 2000 < v < 2100 else None
    if isinstance(v, str):
        t = v.strip().split('/')[0]
        try: x = float(t)
        except ValueError: return None
        return int(x) if 2000 < x < 2100 else None
    return None


def is_year(v): return parse_year(v) is not None


def digits(v):
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)) and v == int(v): return len(str(int(v)))
    if isinstance(v, str) and v.strip().isdigit(): return len(v.strip())
    return None


def label_map(fam, rows, start, skip=None):
    """Mapeia colunas → medida pelos rótulos do cabeçalho (linhas anteriores à primeira linha de dados)."""
    hdr = rows[:start]
    top = next((i for i, r in enumerate(hdr) if r and plain(r[0]).strip() == 'ano'), None)
    if top is None: top = next((i for i, r in enumerate(hdr) if r and plain(r[0]).startswith('taxa')), 0)
    ncol = max(len(r) for r in rows[:start + 5])
    first_row = max(0, top - 3)
    titles = [''] * ncol; leafs = [''] * ncol; stages = [''] * ncol
    for i in range(first_row, start):
        if i == skip: continue
        r = hdr[i]
        for j in range(ncol):
            v = str(r[j]).strip() if j < len(r) and r[j] is not None else ''
            if v.lower().startswith(('taxa de', 'migra')): titles[j] = v
            elif plain(v).startswith('ensino ') and len(v) < 40: stages[j] = v
            elif v and i >= top: leafs[j] = (leafs[j] + ' ' + v).strip()
    # propaga o título de grupo para a direita até o próximo título
    cur = ''; curst = ''
    for j in range(ncol):
        if titles[j]: cur = titles[j]; curst = ''
        else: titles[j] = cur
        if stages[j]: curst = stages[j]
        else: stages[j] = curst
    out = {}; skipped = []
    for j in range(ncol):
        leaf, grp = leafs[j], titles[j] + ' ' + stages[j]
        pl = plain(leaf)
        if not pl or pl in ('ano', 'regiao', 'uf', 'abrangencia', 'rede', 'localizacao', 'dependencia administrativa') or pl.startswith(('codigo', 'nome', 'unidade')): continue
        m = metric_label(fam, leaf, grp); s = seg_label(leaf, grp)
        if m and s and (not (fam == 'TDI' and s == 'mns')): out[j] = f'{m}_{s}'
        else: skipped.append(leaf[:60])
    return out, skipped, leafs


def id_cols(rows, start, ncols, level, tech):   # noqa
    low = [plain(c) for c in tech] if tech else None
    idc = {'inep': None, 'ibge7': None, 'loc': None, 'dep': None, 'geo': None, 'uf': None}
    if low:
        def find(*names):
            for n in names:
                if n.lower() in low: return low.index(n.lower())
            return None
        idc['uf'] = find('sg_uf', 'uf', 'sigla_uf'); idc['inep'] = find('co_entidade'); idc['ibge7'] = find('co_municipio', 'pk_cod_municipio', 'codigo', 'cod_municipio')
        idc['loc'] = find('no_categoria', 'tipoloca', 'localizacao'); idc['dep'] = find('no_dependencia', 'dependad', 'dependencia', 'rede')
        lim = idc['loc'] if idc['loc'] is not None else len(low)
        cands = [j for j, c in enumerate(low) if c in ('unidgeo', 'no_uf', 'sg_uf', 'uf', 'sigla', 'no_regiao', 'regiao', 'no_cod', 'no_codigo', 'codigo', 'abrang', 'abrang.', 'abrangencia', 'brasil') and 0 < j < lim]
        idc['geo'] = sorted(cands, reverse=True)
        if level == 'uf':
            # arquivos de UF/Brasil/regiões: todas as colunas entre o ano e a localização/rede são território, da mais específica (UF) à menos (região); o rótulo técnico às vezes falta (TXR 2016–2018, TDI 2016)
            b = min(x for x in (idc['loc'], idc['dep']) if x is not None) if (idc['loc'] is not None or idc['dep'] is not None) else None
            if b is not None and b >= 2: idc['geo'] = list(range(b - 1, 0, -1))
    else:
        for r in rows[:start]:
            if r and plain(r[0]).strip() == 'ano':
                t = [plain(c).strip() for c in r]
                idc['loc'] = next((j for j, c in enumerate(t) if c.startswith('localiza')), None)
                idc['dep'] = next((j for j, c in enumerate(t) if c in ('rede', 'dependencia administrativa', 'dependencia') or c.startswith('dep. adm') or c.startswith('dep adm')), None)
                idc['ibge7'] = next((j for j, c in enumerate(t) if c.startswith('codigo do municipio')), None)
                idc['inep'] = next((j for j, c in enumerate(t) if c.startswith('codigo da escola')), None); idc['uf'] = next((j for j, c in enumerate(t) if c == 'uf'), None)
                g = [j for j, c in enumerate(t) if c == 'uf'] + [j for j, c in enumerate(t) if c.startswith(('regiao', 'abrang', 'unidade'))]
                idc['geo'] = g or [1]
                break
    sample = [r for r in rows[start:start + 40] if r and is_year(r[0])]
    def numcol(d):
        for j in range(1, min(12, ncols)):
            vals = [r[j] for r in sample if j < len(r)]
            if vals and all(digits(v) == d for v in vals): return j
        return None
    if level == 'escolas':
        c8 = numcol(8)
        if c8 is not None: idc['inep'] = c8
    if level == 'municipios':
        c7 = numcol(7)
        if c7 is not None: idc['ibge7'] = c7
    return idc


def main():
    fam, level, year, out, zips = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5:]
    wanted = wanted_cols(fam); wset = set(wanted)
    summary = {'family': fam, 'level': level, 'year': year, 'files': [os.path.basename(z) for z in zips], 'sheets': [], 'rows': 0, 'cells': {'numeric': 0, 'dash': 0, 'empty': 0}, 'lossy_x100': 0, 'unmapped': []}
    n = 0; seen_sigs = set()
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        head = {'escolas': 'row\tinep\tuf\tloc\tdep', 'municipios': 'row\tibge7\tloc\tdep', 'uf': 'row\tgeo\tloc\tdep'}[level]
        o.write(head + '\t' + '\t'.join(wanted) + '\n')
        for zp in zips:
            for fname, sname, rowit in sheets_of(zp):
                rows = []; techi = None; start = None
                for r in rowit:
                    rows.append(r)
                    if techi is None and r and str(r[0]).strip().lower() in ('nu_ano_censo', 'ano') and sum(1 for c in r if c not in (None, '') and TOK.match(str(c).strip())) >= 6: techi = len(rows) - 1
                    if start is None and r and is_year(r[0]) and sum(1 for c in r if c not in (None, '')) >= 5 and not (techi is not None and len(rows) - 1 <= techi): start = len(rows) - 1
                    if start is not None and len(rows) > start + 40_000_000: break
                if start is None: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem linhas de dados'}); continue
                tech = None; skipped = []
                if techi is not None and techi < start and fam != 'TRN':
                    tech = [str(c).strip() if c is not None else '' for c in rows[techi]]
                    colmap = {}
                    for j, c in enumerate(tech):
                        k = canon_tech(fam, c) if c else None
                        if k and k in wset: colmap[j] = k
                    start = techi + 1
                    mode = 'tech'
                else:
                    colmap, skipped, _ = label_map(fam, rows, start, techi); mode = 'label'
                if not colmap: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem colunas reconhecidas'}); continue
                dup = len(colmap) != len(set(colmap.values()))
                if dup: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'colunas duplicadas no mapeamento', 'map': {str(j): v for j, v in colmap.items()}}); continue
                if skipped: summary['unmapped'].extend(skipped)
                ncols = max(len(r) for r in rows[:start + 40])
                idcols = id_cols(rows, start, ncols, level, tech)
                if level == 'escolas' and idcols['inep'] is None: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem código da escola'}); continue
                if level == 'municipios' and idcols['ibge7'] is None: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem código do município'}); continue
                cnt = 0; sheet_lines = []; sheet_cells = {'numeric': 0, 'dash': 0, 'empty': 0}; lossy = 0
                for r in rows[start:]:
                    if not r or r[0] in (None, '') or not is_year(r[0]): continue
                    if parse_year(r[0]) != year: continue
                    g = lambda k: norm(r[idcols[k]]) if idcols.get(k) is not None and idcols[k] < len(r) else ''
                    def geo_of():
                        # o território é a coluna mais específica que traz um nome de lugar (nas planilhas antigas a linha de região deixa a UF com 'Total'/'Urbana'/'Rural')
                        for j in (idcols.get('geo') or []):
                            v = norm(r[j]) if j < len(r) else ''
                            if v and plain(v).strip() not in ('total', 'urbana', 'rural', 'publica', 'publico', 'privada', 'particular', 'federal', 'estadual', 'municipal'): return v
                        return ''
                    vals = {}
                    loc_v, dep_v = g('loc'), g('dep')
                    if plain(dep_v) in ('urbana', 'rural') or plain(loc_v) in ('estadual', 'federal', 'municipal', 'privada', 'publica', 'publico', 'particular'): loc_v, dep_v = dep_v, loc_v   # cabeçalho trocado na fonte (TXR 2016)
                    for j, code in colmap.items():
                        v = r[j] if j < len(r) else None
                        s = norm(v)
                        if isinstance(v, (int, float)) and not isinstance(v, bool):
                            sheet_cells['numeric'] += 1
                            if abs(v * 100 - round(v * 100)) > 1e-6: lossy += 1
                        elif s in ('--', '-', '*', '...'): sheet_cells['dash'] += 1
                        elif s == '': sheet_cells['empty'] += 1
                        vals[code] = s
                    cnt += 1
                    if level == 'escolas': pre = ['', g('inep'), g('uf'), loc_v, dep_v]
                    elif level == 'municipios': pre = ['', g('ibge7'), loc_v, dep_v]
                    else: pre = ['', geo_of() or 'Brasil', loc_v, dep_v]
                    sheet_lines.append('\t'.join(pre + [vals.get(c, '') for c in wanted]))
                sig = hashlib.md5('\n'.join('\t'.join('' if c in ('--', '-', '*') else c for c in ln.split('\t')[1:]) for ln in sheet_lines).encode('utf-8')).hexdigest()
                if sheet_lines and sig in seen_sigs:
                    summary['sheets'].append({'file': fname, 'sheet': sname, 'rows': cnt, 'duplicate_of_previous_sheet': True}); continue
                if sheet_lines: seen_sigs.add(sig)
                for ln in sheet_lines:
                    n += 1; o.write(str(n) + ln[ln.index('\t'):] + '\n')
                for k in sheet_cells: summary['cells'][k] += sheet_cells[k]
                summary['lossy_x100'] += lossy
                summary['sheets'].append({'file': fname, 'sheet': sname, 'mode': mode, 'rows': cnt, 'cols': len(colmap)})
    os.replace(out + '.part', out)
    summary['rows'] = n; summary['unmapped'] = sorted(set(summary['unmapped']))[:20]; print(json.dumps(summary))


main()
