"""P10.2/G2 — segunda rodada: procura a partição exata de QT_MAT_BAS (e QT_TUR_BAS) com os campos de educação profissional de 2023+ e testa a hierarquia das variáveis. Somente leitura."""
import glob, os, sys, zipfile
import pandas as pd

root = sys.argv[1]
ALL = None


def load(y):
    if y == 2025:
        a = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', low_memory=False)
        b = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Turma_*.csv'))[0], sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c.startswith('QT_TUR'), low_memory=False)
        return a.merge(b, on='CO_ENTIDADE', how='outer')
    z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0])
    i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
    with z.open(i) as fh:
        return pd.read_csv(fh, sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c.startswith(('QT_MAT', 'QT_TUR')), low_memory=False)


def tot(d, cols):
    return d[[c for c in cols if c in d]].apply(pd.to_numeric, errors='coerce').fillna(0).sum(axis=1)


for y in (2025, 2024, 2023):
    d = load(y)
    u = pd.to_numeric(d['QT_MAT_BAS'], errors='coerce').fillna(0) > 0
    print('==', y, 'escolas com matrícula', int(u.sum()))
    base = ['QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_EJA']
    combos = {
        'INF+FUND+MED+EJA+PROF_TEC_CONC+PROF_TEC_SUBS+PROF_FIC_CONC+ESP_CE': base + ['QT_MAT_PROF_TEC_CONC', 'QT_MAT_PROF_TEC_SUBS', 'QT_MAT_PROF_FIC_CONC', 'QT_MAT_ESP_CE'],
        'INF+FUND+MED+EJA+PROF_TEC_CONC+PROF_TEC_SUBS+PROF_FIC_CONC': base + ['QT_MAT_PROF_TEC_CONC', 'QT_MAT_PROF_TEC_SUBS', 'QT_MAT_PROF_FIC_CONC'],
        'INF+FUND+MED+EJA+PROF_TEC_CONC+PROF_TEC_SUBS+ESP_CE': base + ['QT_MAT_PROF_TEC_CONC', 'QT_MAT_PROF_TEC_SUBS', 'QT_MAT_ESP_CE'],
        'INF+FUND+MED+EJA+PROF_TEC_SUBS+ESP_CE': base + ['QT_MAT_PROF_TEC_SUBS', 'QT_MAT_ESP_CE'],
        'INF+FUND+MED+EJA+PROF_TEC_SUBS': base + ['QT_MAT_PROF_TEC_SUBS'],
        'INF+FUND+MED+EJA+ESP_CE': base + ['QT_MAT_ESP_CE'],
    }
    bas = tot(d, ['QT_MAT_BAS'])
    for k, cols in combos.items():
        s = tot(d, cols); print('  ', k, int(((bas == s) & u).sum()), '/', int(u.sum()), 'dif', int((bas - s)[u].sum()))
    prof = [c for c in d.columns if c.startswith('QT_MAT_PROF') or c.startswith('QT_MAT_MED') or c.startswith('QT_MAT_EJA')]
    print('  totais PROF/MED/EJA:', {c: int(tot(d, [c]).sum()) for c in prof if c.count('_') <= 4})
