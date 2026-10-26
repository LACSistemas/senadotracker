"""P10.2/G2 — testa por linha (escola) quais relações de partição valem entre as medidas de matrícula/turma, por edição. Somente leitura.
Uso: python -X utf8 identidades.py <raw_censo> <saida.json> <ano> [ano...]"""
import glob, json, os, sys, zipfile
import pandas as pd

root, out = sys.argv[1], sys.argv[2]
years = [int(a) for a in sys.argv[3:]]
M = ['QT_MAT_BAS', 'QT_MAT_INF', 'QT_MAT_INF_CRE', 'QT_MAT_INF_PRE', 'QT_MAT_FUND', 'QT_MAT_FUND_AI', 'QT_MAT_FUND_AF', 'QT_MAT_MED', 'QT_MAT_PROF', 'QT_MAT_PROF_TEC', 'QT_MAT_EJA', 'QT_MAT_EJA_FUND', 'QT_MAT_EJA_MED',
     'QT_MAT_ESP', 'QT_MAT_ESP_CC', 'QT_MAT_ESP_CE', 'QT_MAT_BAS_D', 'QT_MAT_BAS_N', 'QT_MAT_BAS_EAD', 'QT_MAT_BAS_FEM', 'QT_MAT_BAS_MASC', 'QT_MAT_BAS_INT', 'QT_MAT_BAS_0_3', 'QT_MAT_BAS_4_5', 'QT_MAT_BAS_6_10',
     'QT_MAT_BAS_11_14', 'QT_MAT_BAS_15_17', 'QT_MAT_BAS_18_MAIS', 'QT_MAT_BAS_BRANCA', 'QT_MAT_BAS_PRETA', 'QT_MAT_BAS_PARDA', 'QT_MAT_BAS_AMARELA', 'QT_MAT_BAS_INDIGENA', 'QT_MAT_BAS_ND', 'QT_MAT_INF_INT',
     'QT_MAT_FUND_INT', 'QT_MAT_MED_INT', 'QT_TUR_BAS', 'QT_TUR_INF', 'QT_TUR_INF_CRE', 'QT_TUR_INF_PRE', 'QT_TUR_FUND', 'QT_TUR_FUND_AI', 'QT_TUR_FUND_AF', 'QT_TUR_MED', 'QT_TUR_PROF', 'QT_TUR_PROF_TEC', 'QT_TUR_EJA',
     'QT_TUR_EJA_FUND', 'QT_TUR_EJA_MED', 'QT_TUR_ESP', 'QT_TUR_ESP_CC', 'QT_TUR_ESP_CE']
PAD = ['QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_PROF', 'QT_MAT_EJA']
TPAD = ['QT_TUR_INF', 'QT_TUR_FUND', 'QT_TUR_MED', 'QT_TUR_PROF', 'QT_TUR_EJA']


def load(y):
    use = lambda c: c == 'CO_ENTIDADE' or c in M
    if y == 2025:
        a = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', usecols=use, low_memory=False)
        b = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Turma_*.csv'))[0], sep=';', encoding='latin-1', usecols=use, low_memory=False)
        return a.merge(b, on='CO_ENTIDADE', how='outer')
    z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0])
    i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
    with z.open(i) as fh:
        return pd.read_csv(fh, sep=';', encoding='latin-1', usecols=use, low_memory=False)


def s(d, cols):
    return d[[c for c in cols if c in d]].fillna(0).sum(axis=1)


res = {}
for y in years:
    d = load(y).apply(pd.to_numeric, errors='coerce')
    r = {'linhas': len(d), 'ausentes': [c for c in M if c not in d]}

    def eq(name, a, b, uni):
        u = d['QT_MAT_BAS'].fillna(0) > 0 if uni == 'mat' else d['QT_TUR_BAS'].fillna(0) > 0
        x, z = s(d, a), s(d, b)
        r[name] = {'universo': int(u.sum()), 'iguais': int(((x == z) & u).sum()), 'dif_soma': int((x - z)[u].sum())}

    eq('BAS=INF+FUND+MED+PROF+EJA+ESP', ['QT_MAT_BAS'], PAD + ['QT_MAT_ESP'], 'mat')
    eq('BAS=INF+FUND+MED+PROF+EJA+ESP_CE', ['QT_MAT_BAS'], PAD + ['QT_MAT_ESP_CE'], 'mat')
    eq('BAS=INF+FUND+MED+PROF+EJA', ['QT_MAT_BAS'], PAD, 'mat')
    eq('BAS=INF+FUND+MED+PROF_TEC+EJA+ESP_CE', ['QT_MAT_BAS'], ['QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_PROF_TEC', 'QT_MAT_EJA', 'QT_MAT_ESP_CE'], 'mat')
    eq('BAS=INF+FUND+MED+EJA', ['QT_MAT_BAS'], ['QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_EJA'], 'mat')
    eq('BAS=D+N+EAD', ['QT_MAT_BAS'], ['QT_MAT_BAS_D', 'QT_MAT_BAS_N', 'QT_MAT_BAS_EAD'], 'mat')
    eq('BAS=FEM+MASC', ['QT_MAT_BAS'], ['QT_MAT_BAS_FEM', 'QT_MAT_BAS_MASC'], 'mat')
    eq('BAS=idade(6 faixas)', ['QT_MAT_BAS'], ['QT_MAT_BAS_0_3', 'QT_MAT_BAS_4_5', 'QT_MAT_BAS_6_10', 'QT_MAT_BAS_11_14', 'QT_MAT_BAS_15_17', 'QT_MAT_BAS_18_MAIS'], 'mat')
    eq('BAS=cor(6)', ['QT_MAT_BAS'], ['QT_MAT_BAS_BRANCA', 'QT_MAT_BAS_PRETA', 'QT_MAT_BAS_PARDA', 'QT_MAT_BAS_AMARELA', 'QT_MAT_BAS_INDIGENA', 'QT_MAT_BAS_ND'], 'mat')
    eq('INF=CRE+PRE', ['QT_MAT_INF'], ['QT_MAT_INF_CRE', 'QT_MAT_INF_PRE'], 'mat')
    eq('FUND=AI+AF', ['QT_MAT_FUND'], ['QT_MAT_FUND_AI', 'QT_MAT_FUND_AF'], 'mat')
    eq('EJA=EJA_FUND+EJA_MED', ['QT_MAT_EJA'], ['QT_MAT_EJA_FUND', 'QT_MAT_EJA_MED'], 'mat')
    eq('ESP=CC+CE', ['QT_MAT_ESP'], ['QT_MAT_ESP_CC', 'QT_MAT_ESP_CE'], 'mat')
    eq('PROF=PROF_TEC', ['QT_MAT_PROF'], ['QT_MAT_PROF_TEC'], 'mat')
    eq('TUR_BAS=INF+FUND+MED+PROF+EJA+ESP', ['QT_TUR_BAS'], TPAD + ['QT_TUR_ESP'], 'tur')
    eq('TUR_BAS=INF+FUND+MED+PROF+EJA+ESP_CE', ['QT_TUR_BAS'], TPAD + ['QT_TUR_ESP_CE'], 'tur')
    eq('TUR_BAS=INF+FUND+MED+PROF+EJA', ['QT_TUR_BAS'], TPAD, 'tur')
    eq('TUR_INF=CRE+PRE', ['QT_TUR_INF'], ['QT_TUR_INF_CRE', 'QT_TUR_INF_PRE'], 'tur')
    eq('TUR_FUND=AI+AF', ['QT_TUR_FUND'], ['QT_TUR_FUND_AI', 'QT_TUR_FUND_AF'], 'tur')
    eq('TUR_ESP=CC+CE', ['QT_TUR_ESP'], ['QT_TUR_ESP_CC', 'QT_TUR_ESP_CE'], 'tur')
    r['totais'] = {c: int(d[c].fillna(0).sum()) for c in ['QT_MAT_BAS', 'QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_PROF', 'QT_MAT_EJA', 'QT_MAT_ESP', 'QT_MAT_ESP_CC', 'QT_MAT_ESP_CE', 'QT_TUR_BAS', 'QT_TUR_INF',
                                                                'QT_TUR_FUND', 'QT_TUR_MED', 'QT_TUR_PROF', 'QT_TUR_EJA', 'QT_TUR_ESP', 'QT_MAT_BAS_INT'] if c in d}
    res[str(y)] = r
    print(y, r['linhas'], 'ausentes', r['ausentes'])
    for k, v in r.items():
        if isinstance(v, dict) and 'iguais' in v: print('   ', k, f"{v['iguais']}/{v['universo']} dif={v['dif_soma']}")
    print('   totais', r['totais'], flush=True)
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
