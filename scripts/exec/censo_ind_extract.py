"""P10.3 — extrai das planilhas oficiais dos Indicadores Educacionais do INEP (ZIPs com .xlsx/.xls) SÓ as medidas do catálogo (ATU, HAD, DSU, AFD, IED, IRD, ICG) para um TSV compacto.
Uso: python -I -X utf8 censo_ind_extract.py <familia> <nivel> <ano> <saida.tsv> <zip> [<zip> ...]
 - familia: ATU | HAD | DSU | AFD | IED | IRD | ICG;  nivel: escolas | municipios | uf  (uf inclui Brasil e regiões, que podem vir em planilhas/arquivos separados).
 - A linha de códigos técnicos (NU_ANO_CENSO, ED_INF_CAT_0, ATU_INF…) é localizada em cada planilha; os códigos variam por era (2007–2016, 2017–2018, 2019+) e são normalizados para o código canônico do catálogo.
   Planilhas sem linha técnica (ATU/HAD antigas) usam as etiquetas dos rótulos (Creche, Pré-Escola, Anos Iniciais…).
 - Valores: número como veio; "--", "-", "*" e vazio são preservados como texto/vazio (a interpretação é do build). Nenhum dado pessoal: só indicadores de escola, município ou território.
Saída (TSV): escolas = row, inep, <medidas>; municipios = row, ibge7, loc, dep, <medidas>; uf = row, geo, loc, dep, <medidas>.
Última linha de stdout: JSON {family, level, year, files, sheets, codes, rows, cells:{numeric, dash, empty}, lossy_x100}."""
import hashlib, io, json, os, re, sys, zipfile

import openpyxl
import xlrd

FAMILY = sys.argv[1] if len(sys.argv) > 1 else ''
STAGE = {'ED_INF': 'inf', 'INF': 'inf', 'CRE': 'cre', 'PRE': 'pre', 'FUN': 'fun', 'FUN_AI': 'ai', 'F14': 'ai', 'FUN_AF': 'af', 'F58': 'af', 'MED': 'med',
         'EJA': 'eja', 'EJA_FUN': 'eja_fun', 'EJAF': 'eja_fun', 'EJA_MED': 'eja_med', 'EJAM': 'eja_med', 'EDU_BAS': 'bas', 'ED_BAS': 'bas'}
STAGES = {'ATU': ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med'], 'HAD': ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med'], 'DSU': ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med', 'eja', 'eja_fun', 'eja_med', 'bas']}
GSTAGES = {'AFD': ['inf', 'fun', 'ai', 'af', 'med', 'eja_fun', 'eja_med'], 'IED': ['fun', 'ai', 'af', 'med']}
TOK = re.compile(r'^[A-Za-z][A-Za-z0-9_]*$')
GRP = re.compile(r'^(?:AFD_|IED_)?(ED_INF|INF|FUN_AI|FUN_AF|FUN|F14|F58|MED|EJA_FUN|EJA_MED|EJAF|EJAM)(?:_CAT_?)?([1-6])$')


def measures(fam, level):
    if fam in ('ATU', 'HAD', 'DSU'): return [f'{fam.lower()}_{s}' for s in STAGES[fam]]
    if fam in ('AFD', 'IED'): return [f'{fam.lower()}_{s}{g}' for s in GSTAGES[fam] for g in range(1, 6 if fam == 'AFD' else 7)]
    if fam == 'IRD': return ['ird_media'] if level == 'escolas' else [f'ird_b{i}' for i in range(1, 5)]
    if fam == 'ICG': return ['icg_nivel'] if level == 'escolas' else [f'icg_n{i}' for i in range(1, 7)]
    raise SystemExit('familia desconhecida')


def canon(fam, level, code):
    c = code.strip().upper()
    if fam in ('ATU', 'HAD', 'DSU'):
        t = re.sub(r'^(ATU|HAD|DSU)_', '', c); t = re.sub(r'_CAT_?0$', '', t)
        s = STAGE.get(t)
        return f'{fam.lower()}_{s}' if s and s in STAGES[fam] else None
    if fam in ('AFD', 'IED'):
        mt = GRP.match(c)
        if not mt: return None
        s = STAGE.get(mt.group(1)); g = int(mt.group(2))
        return f'{fam.lower()}_{s}{g}' if s in GSTAGES[fam] and g <= (5 if fam == 'AFD' else 6) else None
    if fam == 'IRD':
        if level == 'escolas': return 'ird_media' if c in ('EDU_BAS_CAT_0', 'MIRD', 'IRD', 'MEDIA_IRD') else None
        mt = re.match(r'^MIRD_(\d)_(\d)$', c)
        if mt: return f'ird_b{int(mt.group(1)) + 1 if mt.group(1) != "0" else 1}' if False else {'0_2': 'ird_b1', '2_3': 'ird_b2', '3_4': 'ird_b3', '4_5': 'ird_b4'}.get(f'{mt.group(1)}_{mt.group(2)}')
        mt = re.match(r'^EDU_BAS_CAT_([1-4])$', c)
        return f'ird_b{mt.group(1)}' if mt else None
    if fam == 'ICG':
        if level == 'escolas': return 'icg_nivel' if c in ('COMPLEX', 'ICG', 'EDU_BAS_CAT_0', 'NIVEL_ICG') else None
        mt = re.match(r'^(?:ICG_|EDU_BAS_CAT_)([1-6])$', c)
        return f'icg_n{mt.group(1)}' if mt else None
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


def fallback_map(fam, rows):
    """Planilhas sem códigos técnicos (ATU/HAD antigas): mapeia as colunas pelas etiquetas (Creche, Pré-Escola, Total, Anos Iniciais, 1ª a 4ª Série…) e pelo grupo (Educação Infantil, Ensino Fundamental,
    Ensino Médio) da linha de cima. Devolve {coluna: código} ou None."""
    lab = None
    for i, r in enumerate(rows[:20]):
        if any(str(c).strip().lower() == 'creche' for c in r): lab = i; break
    if lab is None: return None
    ncol = max(len(r) for r in rows[:lab + 2])
    def cell(r, j): return str(rows[r][j]).strip().lower() if 0 <= r < len(rows) and j < len(rows[r]) and rows[r][j] is not None else ''
    # início de cada grupo: procura nas linhas acima do rótulo
    starts = {}
    for r in range(max(0, lab - 2), lab):
        for j in range(3, ncol):
            t = cell(r, j)
            if len(t) > 70: continue
            if ('infantil' in t or 'educação infantil' in t) and 'inf' not in starts: starts['inf'] = j
            if 'fundamental' in t and 'fun' not in starts and 'infantil' not in t: starts['fun'] = j
            if ('médio' in t or 'medio' in t) and 'fundamental' not in t and 'med' not in starts: starts['med'] = j
    if len(starts) < 3: return None
    order = sorted(starts.items(), key=lambda kv: kv[1])
    def group(j):
        g = None
        for name, st in order:
            if j >= st: g = name
        return g
    out = {}
    for j in range(ncol):
        l = cell(lab, j); l2 = cell(lab + 1, j); g = group(j)
        if l.startswith('creche'): out[j] = 'cre'
        elif l.startswith('pré') or l.startswith('pre-') or l.startswith('pre '): out[j] = 'pre'
        elif l.startswith('total') or l.startswith('total'):
            if g in ('inf', 'fun', 'med') and not any(v == g for v in out.values()): out[j] = g
        elif 'anos iniciais' in l or l.startswith('1ª a 4ª') or l.startswith('1º ao 5º') or 'anos iniciais' in l2 or l2.startswith('1º ao 5º'): out[j] = 'ai'
        elif 'anos finais' in l or l.startswith('5ª a 8ª') or l.startswith('6º ao 9º') or 'anos finais' in l2 or l2.startswith('6º ao 9º'): out[j] = 'af'
    return {j: f'{fam.lower()}_{s}' for j, s in out.items()}


def fallback_ids(rows):
    """Colunas de identificação (geo, loc, dep) pela linha de cabeçalho (primeira célula 'Ano') das planilhas sem códigos técnicos."""
    for r in rows[:20]:
        if r and str(r[0]).strip().lower() == 'ano':
            t = [str(c).strip().lower() for c in r]
            loc = next((j for j, c in enumerate(t) if c.startswith('localiza')), 2)
            dep = next((j for j, c in enumerate(t) if c in ('rede', 'dependência administrativa', 'dependencia administrativa', 'dependência')), 3)
            geo = next((j for j, c in enumerate(t) if c == 'uf'), None)
            if geo is None: geo = next((j for j, c in enumerate(t) if c.startswith(('abrang', 'região', 'regiao', 'unidade'))), 1)
            return {'geo': geo, 'loc': loc, 'dep': dep}
    return {'geo': 1, 'loc': 2, 'dep': 3}


def detect_ids(rows, start, ncols, level, idcols):
    """Os rótulos técnicos de algumas edições (2016–2018) trocam código e nome nas colunas de identificação, e as planilhas antigas trazem números como texto ou float:
    o conteúdo manda (8 dígitos = escola; 7 dígitos = município)."""
    sample = [r for r in rows[start:start + 40] if r and isinstance(r[0], (int, float))]
    def digits(v):
        if isinstance(v, bool): return None
        if isinstance(v, (int, float)) and v == int(v): return len(str(int(v)))
        if isinstance(v, str) and v.strip().isdigit(): return len(v.strip())
        return None
    def numcol(d):
        for j in range(1, min(12, ncols)):
            vals = [r[j] for r in sample if j < len(r)]
            if vals and all(digits(v) == d for v in vals): return j
        return None
    if level == 'escolas':
        c8 = numcol(8)
        if c8 is not None: idcols['inep'] = c8
    if level == 'municipios':
        c7 = numcol(7)
        if c7 is not None: idcols['ibge7'] = c7
    return idcols


def main():
    fam, level, year, out, zips = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5:]
    wanted = measures(fam, level); wset = set(wanted)
    summary = {'family': fam, 'level': level, 'year': year, 'files': [os.path.basename(z) for z in zips], 'sheets': [], 'codes': {}, 'rows': 0, 'cells': {'numeric': 0, 'dash': 0, 'empty': 0}, 'lossy_x10': 0, 'lossy_x100': 0}
    n = 0; seen_sigs = set()
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        head = {'escolas': 'row\tinep', 'municipios': 'row\tibge7\tloc\tdep', 'uf': 'row\tgeo\tloc\tdep'}[level]
        o.write(head + '\t' + '\t'.join(wanted) + '\n')
        for zp in zips:
            for fname, sname, rowit in sheets_of(zp):
                rows = []; techi = None
                for r in rowit:
                    rows.append(r)
                    if techi is None and r and str(r[0]).strip().lower() in ('nu_ano_censo', 'ano') and sum(1 for c in r if c not in (None, '') and TOK.match(str(c).strip())) >= 4: techi = len(rows) - 1
                    if techi is not None and len(rows) > techi + 1 + 30000000: break
                if techi is None:
                    fmap = fallback_map(fam, rows)
                    if not fmap: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem linha técnica e sem rótulos'}); continue
                    start = next((i for i, r in enumerate(rows) if r and isinstance(r[0], (int, float)) and 2000 < r[0] < 2100), None)
                    if start is None: continue
                    colmap = fmap; idcols = detect_ids(rows, start, max(len(r) for r in rows[:start + 40]), level, fallback_ids(rows)); tech = None
                else:
                    tech = [str(c).strip() if c is not None else '' for c in rows[techi]]
                    start = techi + 1
                    colmap = {}
                    for j, c in enumerate(tech):
                        k = canon(fam, level, c) if c else None
                        if k and k in wset: colmap[j] = k
                    low = [c.lower() for c in tech]
                    def find(*names):
                        for nm in names:
                            if nm.lower() in low: return low.index(nm.lower())
                        return None
                    idcols = {'inep': find('CO_ENTIDADE'), 'ibge7': find('CO_MUNICIPIO', 'PK_COD_MUNICIPIO', 'codigo', 'cod_municipio'), 'loc': find('NO_CATEGORIA', 'TIPOLOCA', 'LOCALIZACAO', 'LOCALIZAÇÃO'),
                              'dep': find('NO_DEPENDENCIA', 'Dependad', 'DEPENDENCIA', 'REDE'), 'geo': None}
                    # território: a coluna MAIS ESPECÍFICA antes da localização (região → UF); nos arquivos de UF a região vem antes do nome/sigla da UF
                    geo_names = ('unidgeo', 'no_uf', 'sg_uf', 'uf', 'sigla', 'no_regiao', 'regiao', 'no_cod', 'no_codigo', 'codigo', 'abrang', 'abrang.', 'abrangencia', 'brasil')
                    lim = idcols['loc'] if idcols['loc'] is not None else len(low)
                    import unicodedata
                    plain = [''.join(ch for ch in unicodedata.normalize('NFD', c) if unicodedata.category(ch) != 'Mn') for c in low]
                    cands = [j for j, c in enumerate(plain) if c in geo_names and 0 < j < lim]
                    idcols['geo'] = max(cands) if cands else None
                    idcols = detect_ids(rows, start, len(tech), level, idcols)
                    if level == 'escolas' and fam in ('IRD', 'ICG') and not colmap:
                        colmap = {len(tech) - 1: wanted[0]}   # escola: a última coluna é o valor único do indicador
                    if level == 'escolas' and idcols['inep'] is None: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem CO_ENTIDADE'}); continue
                    if level == 'municipios' and idcols['ibge7'] is None: summary['sheets'].append({'file': fname, 'sheet': sname, 'skipped': 'sem CO_MUNICIPIO'}); continue
                got = sorted(set(colmap.values())); summary['codes'][f'{fname}|{sname}'] = got
                cnt = 0; sheet_lines = []; sheet_cells = {'numeric': 0, 'dash': 0, 'empty': 0}; sheet_lossy = [0, 0]
                for r in rows[start:]:
                    if not r or r[0] in (None, '') or not isinstance(r[0], (int, float)): continue
                    if int(r[0]) != year: continue
                    g = lambda k: norm(r[idcols[k]]) if idcols.get(k) is not None and idcols[k] < len(r) else ''
                    vals = {}
                    for j, code in colmap.items():
                        v = r[j] if j < len(r) else None
                        s = norm(v)
                        if isinstance(v, (int, float)) and not isinstance(v, bool):
                            sheet_cells['numeric'] += 1
                            if abs(v * 10 - round(v * 10)) > 1e-6: sheet_lossy[0] += 1
                            if abs(v * 100 - round(v * 100)) > 1e-6: sheet_lossy[1] += 1
                        elif s in ('--', '-', '*', '...'): sheet_cells['dash'] += 1
                        elif s == '': sheet_cells['empty'] += 1
                        vals[code] = s
                    cnt += 1
                    if level == 'escolas': pre = ['', g('inep')]
                    elif level == 'municipios': pre = ['', g('ibge7'), g('loc'), g('dep')]
                    else: pre = ['', g('geo') or 'Brasil', g('loc'), g('dep')]
                    sheet_lines.append('\t'.join(pre + [vals.get(c, '') for c in wanted]))
                # '--' e branco são o mesmo "nada" ao identificar uma planilha repetida (a AFD 2017 de escolas traz uma cópia, 'Plan1', com branco no lugar de '--')
                sig = hashlib.md5('\n'.join('\t'.join('' if c in ('--', '-', '*') else c for c in ln.split('\t')[1:]) for ln in sheet_lines).encode('utf-8')).hexdigest()
                if sheet_lines and sig in seen_sigs:
                    summary['sheets'].append({'file': fname, 'sheet': sname, 'rows': cnt, 'duplicate_of_previous_sheet': True}); continue
                if sheet_lines: seen_sigs.add(sig)
                for ln in sheet_lines:
                    n += 1; o.write(str(n) + ln[ln.index('\t'):] + '\n')
                for k in sheet_cells: summary['cells'][k] += sheet_cells[k]
                summary['lossy_x10'] += sheet_lossy[0]; summary['lossy_x100'] += sheet_lossy[1]
                summary['sheets'].append({'file': fname, 'sheet': sname, 'tech_row': (techi + 1) if techi is not None else None, 'fallback': techi is None, 'rows': cnt, 'cols': len(colmap)})
    os.replace(out + '.part', out)
    summary['rows'] = n; print(json.dumps(summary))


main()
