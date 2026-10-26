"""P10.4 — extrai das planilhas oficiais do INSE (Indicador de Nível Socioeconômico, Inep; Saeb 2019, 2021, 2023) as linhas AGREGADAS por escola, município, UF e Brasil para um TSV compacto.
Uso: python -I -X utf8 inse_extract.py <ano> <brasil|estados|municipios|escolas> <saida.tsv> <arquivo.xlsx>
Saída (TSV): row year level uf_code uf ibge7 inep dep loc cap qtd media cls nv1..nv8 (texto como veio; "Nível IV" → cls em romano no texto). Nenhum dado de aluno: só agregados do Inep.
Última linha de stdout: JSON {year, level, rows, cells:{numeric, empty}, lossy_x100, header_row}."""
import json, os, re, sys, warnings

import openpyxl

warnings.filterwarnings('ignore')
year, level, out, path = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
NV = [f'PC_NIVEL_{i}' for i in range(1, 9)]


def norm(v):
    if v is None: return ''
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e12: return str(int(v))
        return repr(round(v, 6))
    return str(v).strip()


wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = next(w for w in wb.worksheets if w.title.lower() not in ('dicionário', 'dicionario'))
rows = iter(ws.iter_rows(values_only=True))
head = None; hrow = 0
for i, r in enumerate(rows, 1):
    names = [re.sub(r'[*\s]+$', '', str(c)).strip().upper() if c is not None else '' for c in r]
    if any(n in ('CO_UF', 'CO_ESCOLA', 'ID_ESCOLA', 'TP_TIPO_REDE', 'NU_ANO_SAEB') for n in names) and sum(1 for n in names if n) >= 5:
        head = names; hrow = i; break
if head is None: raise SystemExit('cabeçalho não encontrado')
ix = {n: j for j, n in enumerate(head) if n}
def col(*names):
    for n in names:
        if n in ix: return ix[n]
    return None
c_uf, c_sg = col('CO_UF'), col('SG_UF', 'SIGLA_UF'); c_mun = col('CO_MUNICIPIO'); c_inep = col('ID_ESCOLA', 'CO_ESCOLA')
c_dep = col('TP_TIPO_REDE', 'TP_DEPENDENCIA'); c_loc = col('TP_LOCALIZACAO'); c_cap = col('TP_CAPITAL', 'ID_AREA'); c_qtd = col('QTD_ALUNOS_INSE')
c_med = col('MEDIA_INSE', 'INSE_VALOR_ABSOLUTO'); c_cls = col('INSE_CLASSIFICACAO'); c_nv = [col(n) for n in NV]
n = 0; cells = {'numeric': 0, 'empty': 0}; lossy = 0
with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
    o.write('\t'.join(['row', 'year', 'level', 'uf_code', 'uf', 'ibge7', 'inep', 'dep', 'loc', 'cap', 'qtd', 'media', 'cls'] + [f'nv{i}' for i in range(1, 9)]) + '\n')
    for r in rows:
        if not r or all(c in (None, '') for c in r): continue
        g = lambda c: norm(r[c]) if c is not None and c < len(r) else ''
        # linhas de nota de rodapé ou sem identificação não entram
        if level == 'escolas' and not g(c_inep).isdigit(): continue
        if level == 'municipios' and not g(c_mun).isdigit(): continue
        if level == 'estados' and not g(c_uf).isdigit(): continue
        if level == 'brasil' and not g(c_dep).isdigit(): continue
        y = g(col('NU_ANO_SAEB')) or str(year)
        if y.isdigit() and int(y) != year: continue
        vals = [g(c) for c in [c_qtd, c_med]] + [g(c_cls)] + [g(c) for c in c_nv]
        for k, v in enumerate(vals):
            if k == 2: continue
            try:
                x = float(v); cells['numeric'] += 1
                if k == 1 and abs(x * 100 - round(x * 100)) > 1e-6: lossy += 1
                if k >= 3 and abs(x * 100 - round(x * 100)) > 1e-6: lossy += 1
            except ValueError: cells['empty'] += 1
        n += 1
        o.write('\t'.join([str(n), str(year), level, g(c_uf), g(c_sg), g(c_mun), g(c_inep), g(c_dep), g(c_loc), g(c_cap)] + vals) + '\n')
os.replace(out + '.part', out)
print(json.dumps({'year': year, 'level': level, 'rows': n, 'cells': cells, 'lossy_x100': lossy, 'header_row': hrow}))
