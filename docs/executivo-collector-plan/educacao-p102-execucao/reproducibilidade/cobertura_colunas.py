"""P10.2/G5 — para cada coluna candidata do cadastro de oferta, por edição: existe no arquivo? quantas linhas do universo (matrícula ou turma > 0) estão vazias, zero ou positivas? Somente leitura.
Uso: python -X utf8 cobertura_colunas.py <raw_censo> <saida.json>"""
import glob, json, os, sys, zipfile
import pandas as pd

root, out = sys.argv[1], sys.argv[2]
COLS = ['QT_MAT_BAS', 'QT_MAT_INF_CRE', 'QT_MAT_INF_PRE', 'QT_MAT_FUND_AI', 'QT_MAT_FUND_AF', 'QT_MAT_MED', 'QT_MAT_EJA_FUND', 'QT_MAT_EJA_MED', 'QT_MAT_PROF', 'QT_MAT_PROF_TEC', 'QT_MAT_ESP_CC', 'QT_MAT_ESP_CE',
        'QT_MAT_INF_INT', 'QT_MAT_FUND_INT', 'QT_MAT_MED_INT', 'QT_MAT_BAS_D', 'QT_MAT_BAS_N', 'QT_MAT_BAS_EAD', 'QT_MAT_BAS_FEM', 'QT_MAT_BAS_MASC', 'QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_EJA', 'QT_MAT_ESP',
        'QT_TUR_BAS', 'QT_TUR_INF_CRE', 'QT_TUR_INF_PRE', 'QT_TUR_FUND_AI', 'QT_TUR_FUND_AF', 'QT_TUR_MED', 'QT_TUR_EJA_FUND', 'QT_TUR_EJA_MED', 'QT_TUR_PROF', 'QT_TUR_ESP_CC', 'QT_TUR_ESP_CE', 'QT_TUR_INF_INT', 'QT_TUR_FUND_INT',
        'QT_TUR_MED_INT', 'QT_TUR_BAS_D', 'QT_TUR_BAS_N', 'QT_TUR_BAS_EAD', 'QT_TUR_INF', 'QT_TUR_FUND', 'QT_TUR_EJA', 'QT_TUR_ESP']
res = {}
for y in range(2007, 2026):
    if y == 2025:
        m = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
        t = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Turma_*.csv'))[0], sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
        d = m.merge(t, on='CO_ENTIDADE', how='outer')
    else:
        z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0]); i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
        with z.open(i) as fh: d = pd.read_csv(fh, sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
    u = (pd.to_numeric(d['QT_MAT_BAS'], errors='coerce').fillna(0) > 0) | (pd.to_numeric(d['QT_TUR_BAS'], errors='coerce').fillna(0) > 0)
    du = d[u]; r = {'universo': int(u.sum())}
    for c in COLS:
        if c not in d: r[c] = None; continue
        v = pd.to_numeric(du[c], errors='coerce')
        r[c] = [int(v.isna().sum()), int((v == 0).sum()), int((v > 0).sum()), int((v < 0).sum())]
    res[y] = r
    print(y, r['universo'], {c: r[c] for c in ('QT_MAT_BAS_D', 'QT_MAT_BAS_EAD', 'QT_MAT_FUND_INT', 'QT_TUR_INF_INT', 'QT_TUR_BAS_D', 'QT_MAT_PROF', 'QT_TUR_PROF')}, flush=True)
json.dump(res, open(out, 'w', encoding='utf-8'))
