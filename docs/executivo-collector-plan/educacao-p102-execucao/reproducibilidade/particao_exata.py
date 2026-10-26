"""P10.2/G2 — prova linha a linha da partição exata de QT_MAT_BAS em 2023, 2024 e 2025 (campos de educação profissional). Somente leitura. Uso: python -X utf8 particao_exata.py <raw_censo> <saida.json>"""
import glob, json, os, sys, zipfile
import pandas as pd
root, out = sys.argv[1], sys.argv[2]; res = {}
for y in (2023, 2024, 2025):
    if y == 2025: d = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', low_memory=False)
    else:
        z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0]); i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
        with z.open(i) as fh: d = pd.read_csv(fh, sep=';', encoding='latin-1', usecols=lambda c: c.startswith('QT_MAT'), low_memory=False)
    g = lambda c: pd.to_numeric(d[c], errors='coerce').fillna(0) if c in d else 0
    u = g('QT_MAT_BAS') > 0
    prof = ['QT_MAT_PROF_TEC_CONC', 'QT_MAT_PROF_TEC_SUBS', 'QT_MAT_PROF_FIC_CONC'] + (['QT_MAT_PROF_TEC_IFTP_CT', 'QT_MAT_PROF_IFTP_QP'] if y == 2025 else [])
    s = g('QT_MAT_INF') + g('QT_MAT_FUND') + g('QT_MAT_MED') + g('QT_MAT_EJA') + sum(g(c) for c in prof)
    res[y] = {'escolas_com_matricula': int(u.sum()), 'partição_exata': int(((g('QT_MAT_BAS') == s) & u).sum()), 'campos_profissionais': prof, 'diferenca_total': int((g('QT_MAT_BAS') - s)[u].sum())}
    print(y, res[y])
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
