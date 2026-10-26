"""P10.2/G2 — quarta rodada: partições de turno (D+N+EAD), resíduo de turmas, ESP ≤ BAS, unicidade de CO_ENTIDADE nas tabelas de 2025 e disponibilidade de tempo integral por edição. Somente leitura."""
import glob, json, os, sys, zipfile
import pandas as pd

root = sys.argv[1]
num = lambda s: pd.to_numeric(s, errors='coerce').fillna(0)
COLS = ['QT_MAT_BAS', 'QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_EJA', 'QT_MAT_ESP', 'QT_MAT_ESP_CC', 'QT_MAT_ESP_CE', 'QT_MAT_BAS_D', 'QT_MAT_BAS_N', 'QT_MAT_BAS_EAD', 'QT_MAT_INF_INT', 'QT_MAT_FUND_INT', 'QT_MAT_MED_INT', 'QT_MAT_BAS_INT',
        'QT_TUR_BAS', 'QT_TUR_INF', 'QT_TUR_FUND', 'QT_TUR_MED', 'QT_TUR_EJA', 'QT_TUR_PROF', 'QT_TUR_ESP', 'QT_TUR_BAS_D', 'QT_TUR_BAS_N', 'QT_TUR_BAS_EAD', 'QT_TUR_INF_INT', 'QT_TUR_FUND_INT', 'QT_TUR_MED_INT', 'QT_MAT_PROF', 'QT_MAT_PROF_TEC']
out = {}
for y in range(2007, 2026):
    if y == 2025:
        m = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Matricula_*.csv'))[0], sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
        t = pd.read_csv(glob.glob(os.path.join(root, '2025', 'Tabela_Turma_*.csv'))[0], sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
        dupm, dupt = int(m.CO_ENTIDADE.duplicated().sum()), int(t.CO_ENTIDADE.duplicated().sum())
        d = m.merge(t, on='CO_ENTIDADE', how='outer')
    else:
        z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0]); i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
        with z.open(i) as fh: d = pd.read_csv(fh, sep=';', encoding='latin-1', usecols=lambda c: c == 'CO_ENTIDADE' or c in COLS, low_memory=False)
        dupm = dupt = int(d.CO_ENTIDADE.duplicated().sum())
    g = lambda c: num(d[c]) if c in d else None
    um = g('QT_MAT_BAS') > 0; ut = g('QT_TUR_BAS') > 0
    r = {'dup_mat': dupm, 'dup_tur': dupt, 'esc_com_mat': int(um.sum()), 'esc_com_tur': int(ut.sum()), 'escolas_tur_sem_mat': int((ut & ~um).sum()), 'escolas_mat_sem_tur': int((um & ~ut).sum())}
    if g('QT_MAT_BAS_D') is not None: r['turno_BAS=D+N+EAD'] = int(((g('QT_MAT_BAS') == g('QT_MAT_BAS_D') + g('QT_MAT_BAS_N') + g('QT_MAT_BAS_EAD')) & um).sum())
    if g('QT_TUR_BAS_D') is not None: r['turno_TUR=D+N+EAD'] = int(((g('QT_TUR_BAS') == g('QT_TUR_BAS_D') + g('QT_TUR_BAS_N') + g('QT_TUR_BAS_EAD')) & ut).sum())
    rt = g('QT_TUR_BAS') - (g('QT_TUR_INF') + g('QT_TUR_FUND') + g('QT_TUR_MED') + g('QT_TUR_EJA'))
    r['res_tur_negativo'] = int(((rt < 0) & ut).sum()); r['res_tur_soma'] = int(rt[ut].sum()); r['res_tur_igual_PROF'] = int(((rt == g('QT_TUR_PROF')) & ut).sum())
    r['esp_maior_que_bas'] = int(((g('QT_MAT_ESP') > g('QT_MAT_BAS')) & um).sum()); r['esp_cc_maior_que_bas'] = int(((g('QT_MAT_ESP_CC') > g('QT_MAT_BAS')) & um).sum())
    for c in ('QT_MAT_INF_INT', 'QT_MAT_FUND_INT', 'QT_MAT_MED_INT', 'QT_MAT_BAS_INT'):
        if g(c) is not None: r['soma_' + c] = int(g(c).sum()); r['vazio_' + c] = int(d[c].isna().sum())
    r['int_maior_que_etapa'] = int(((g('QT_MAT_FUND_INT') > g('QT_MAT_FUND')) | (g('QT_MAT_INF_INT') > g('QT_MAT_INF')) | (g('QT_MAT_MED_INT') > g('QT_MAT_MED'))).sum())
    r['vazios_QT_MAT_BAS'] = int(d['QT_MAT_BAS'].isna().sum()); r['vazios_QT_TUR_BAS'] = int(d['QT_TUR_BAS'].isna().sum())
    out[y] = r; print(y, r, flush=True)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
