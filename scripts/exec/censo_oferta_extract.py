"""P10.2 — extrai do RAW do Censo Escolar SÓ as medidas agregadas de matrícula e turma por escola (whitelist), para um TSV compacto em staging.
Uso: python -I -X utf8 censo_oferta_extract.py <ano> <saida.tsv> <arquivo_raw> [<arquivo_raw> ...]
 - 2007–2024: um ZIP com um CSV (uma linha por escola) que traz matrículas e turmas.  2025+: `Tabela_Matricula_*.csv` e `Tabela_Turma_*.csv` soltos (união externa por CO_ENTIDADE).
Saída: cabeçalho + uma linha por escola do UNIVERSO (QT_MAT_BAS > 0 ou QT_TUR_BAS > 0): row, inep, e as colunas canônicas abaixo (vazio = coluna inexistente no arquivo ou célula vazia).
Nenhum dado individual (aluno, docente, gestor): só contagens por escola. Última linha de stdout: JSON {year, layout, rows_in, rows_out, missing, bytes_in}."""
import csv, io, json, os, re, sys, zipfile

# nome canônico → coluna do arquivo oficial (as colunas v_* só validam partições e não são gravadas)
MAP = [
    ('mat_bas', 'QT_MAT_BAS'), ('mat_inf_cre', 'QT_MAT_INF_CRE'), ('mat_inf_pre', 'QT_MAT_INF_PRE'), ('mat_fund_ai', 'QT_MAT_FUND_AI'), ('mat_fund_af', 'QT_MAT_FUND_AF'), ('mat_med', 'QT_MAT_MED'),
    ('mat_eja_fund', 'QT_MAT_EJA_FUND'), ('mat_eja_med', 'QT_MAT_EJA_MED'), ('mat_prof', 'QT_MAT_PROF'), ('mat_esp_cc', 'QT_MAT_ESP_CC'), ('mat_esp_ce', 'QT_MAT_ESP_CE'),
    ('mat_int_inf', 'QT_MAT_INF_INT'), ('mat_int_fund', 'QT_MAT_FUND_INT'), ('mat_int_med', 'QT_MAT_MED_INT'), ('mat_noturno', 'QT_MAT_BAS_N'), ('mat_ead', 'QT_MAT_BAS_EAD'),
    ('tur_bas', 'QT_TUR_BAS'), ('tur_inf_cre', 'QT_TUR_INF_CRE'), ('tur_inf_pre', 'QT_TUR_INF_PRE'), ('tur_fund_ai', 'QT_TUR_FUND_AI'), ('tur_fund_af', 'QT_TUR_FUND_AF'), ('tur_med', 'QT_TUR_MED'),
    ('tur_eja', 'QT_TUR_EJA'), ('tur_eja_fund', 'QT_TUR_EJA_FUND'), ('tur_eja_med', 'QT_TUR_EJA_MED'), ('tur_prof', 'QT_TUR_PROF'), ('tur_esp_cc', 'QT_TUR_ESP_CC'), ('tur_esp_ce', 'QT_TUR_ESP_CE'),
    ('tur_int_inf', 'QT_TUR_INF_INT'), ('tur_int_fund', 'QT_TUR_FUND_INT'), ('tur_int_med', 'QT_TUR_MED_INT'),
    ('v_mat_inf', 'QT_MAT_INF'), ('v_mat_fund', 'QT_MAT_FUND'), ('v_mat_eja', 'QT_MAT_EJA'), ('v_mat_esp', 'QT_MAT_ESP'), ('v_mat_d', 'QT_MAT_BAS_D'),
    ('v_tur_inf', 'QT_TUR_INF'), ('v_tur_fund', 'QT_TUR_FUND'), ('v_tur_esp', 'QT_TUR_ESP'),
]
SRC = {s for _, s in MAP}


def open_csv(path, name_re):
    if path.lower().endswith('.zip'):
        z = zipfile.ZipFile(path)
        info = max((i for i in z.infolist() if i.filename.lower().endswith('.csv') and re.search(name_re, os.path.basename(i.filename))), key=lambda i: i.file_size)
        fh = z.open(info); size = info.file_size
    else:
        fh = open(path, 'rb'); size = os.path.getsize(path)
    return csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';'), size


def read_table(path, name_re):
    rd, size = open_csv(path, name_re)
    h = next(rd); ix = {c: i for i, c in enumerate(h)}; ci = ix['CO_ENTIDADE']
    keep = [(c, ix[c]) for c in h if c in SRC]
    return rd, ci, keep, size, h


def main():
    year, out, files = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
    mat = [f for f in files if re.search(r'Tabela_Matricula', os.path.basename(f), re.I)]
    tur = [f for f in files if re.search(r'Tabela_Turma', os.path.basename(f), re.I)]
    single = [f for f in files if f.lower().endswith('.zip')]
    data = {}; present = set(); size_in = 0; rows_in = 0
    if single:
        rd, ci, keep, size, h = read_table(single[0], r'microdados_ed_basica'); size_in += size; layout = 'single_csv'
        present = {c for c, _ in keep}
        for r in rd:
            rows_in += 1; data[r[ci].strip()] = {c: r[i].strip() for c, i in keep}
    else:
        if not (mat and tur): raise SystemExit(f'2025+ exige Tabela_Matricula e Tabela_Turma; vieram {files}')
        layout = 'tables'
        for f, rx in ((mat[0], r'Tabela_Matricula'), (tur[0], r'Tabela_Turma')):
            rd, ci, keep, size, h = read_table(f, rx); size_in += size; present |= {c for c, _ in keep}
            for r in rd:
                d = data.setdefault(r[ci].strip(), {})
                for c, i in keep: d[c] = r[i].strip()
        rows_in = len(data)
    def num(d, c):
        v = d.get(c, '')
        return int(v) if v.isdigit() else 0
    n = 0
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        o.write('row\tinep\t' + '\t'.join(k for k, _ in MAP) + '\n')
        for i, (inep, d) in enumerate(data.items(), 1):
            if num(d, 'QT_MAT_BAS') <= 0 and num(d, 'QT_TUR_BAS') <= 0: continue
            o.write(f'{i}\t{inep}\t' + '\t'.join(d.get(s, '') if s in present else '' for _, s in MAP) + '\n'); n += 1
    os.replace(out + '.part', out)
    print(json.dumps({'year': year, 'layout': layout, 'rows_in': rows_in, 'rows_out': n, 'missing': sorted(SRC - present), 'bytes_in': size_in}))


main()
