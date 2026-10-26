"""P10.2/G2 — terceira rodada: resíduo da partição de QT_MAT_BAS em 2025 e não-negatividade do resíduo derivado (BAS − INF − FUND − MED − EJA) em todas as edições. Somente leitura."""
import glob, json, os, sys, zipfile
import pandas as pd

root = sys.argv[1]
num = lambda s: pd.to_numeric(s, errors='coerce').fillna(0)
a = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', low_memory=False)
b = lambda c: num(a[c]) if c in a else 0
r = num(a['QT_MAT_BAS']) - (b('QT_MAT_INF') + b('QT_MAT_FUND') + b('QT_MAT_MED') + b('QT_MAT_EJA') + b('QT_MAT_PROF_TEC_CONC') + b('QT_MAT_PROF_TEC_SUBS') + b('QT_MAT_PROF_FIC_CONC'))
bad = r != 0
print('2025 linhas com resíduo', int(bad.sum()), 'soma', int(r.sum()), 'min', int(r.min()), 'max', int(r.max()))
cands = []
for c in a.columns:
    if c.startswith('QT_MAT'):
        v = num(a[c])
        hit = int(((v == r) & bad).sum())
        if hit > 50: cands.append((hit, c, int(v[bad].sum())))
print(sorted(cands, reverse=True)[:12])
# colunas novas de 2025 relacionadas a profissional / técnico
print([c for c in a.columns if 'PROF' in c or 'IFTP' in c or 'TEC' in c][:40])
# não-negatividade do resíduo derivado por edição
out = {}
for y in range(2007, 2026):
    if y == 2025: d = a
    else:
        z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0]); i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
        with z.open(i) as fh: d = pd.read_csv(fh, sep=';', encoding='latin-1', usecols=lambda c: c in ('QT_MAT_BAS', 'QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_EJA', 'QT_MAT_PROF', 'QT_MAT_PROF_TEC', 'QT_MAT_PROF_TEC_CONC', 'QT_MAT_PROF_TEC_SUBS', 'QT_MAT_PROF_FIC_CONC'), low_memory=False)
    g = lambda c: num(d[c]) if c in d else 0
    res = g('QT_MAT_BAS') - (g('QT_MAT_INF') + g('QT_MAT_FUND') + g('QT_MAT_MED') + g('QT_MAT_EJA'))
    u = g('QT_MAT_BAS') > 0
    row = {'escolas_com_mat': int(u.sum()), 'residuo_negativo': int(((res < 0) & u).sum()), 'residuo_soma': int(res[u].sum()), 'residuo_max': int(res[u].max()), 'prof_total': int(g('QT_MAT_PROF').sum())}
    if 'QT_MAT_PROF_TEC_CONC' in d:
        alt = g('QT_MAT_PROF_TEC_CONC') + g('QT_MAT_PROF_TEC_SUBS') + g('QT_MAT_PROF_FIC_CONC')
        row['residuo_igual_prof_nao_integrada'] = int(((res == alt) & u).sum())
    out[y] = row; print(y, row, flush=True)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
