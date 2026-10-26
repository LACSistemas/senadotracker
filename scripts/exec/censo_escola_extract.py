"""P10.1 — extrai do RAW do Censo Escolar SÓ as colunas do cadastro (whitelist, sem gestor/contato/endereço) para um TSV compacto em staging.
Uso: python -I -X utf8 censo_escola_extract.py <ano> <saida.tsv> <arquivo_raw> [<arquivo_raw> ...]
 - 2007–2024: um ZIP com um CSV (uma linha por escola). 2025+: `Tabela_Escola_*.csv` e `Tabela_Matricula_*.csv` soltos (matrícula pelo código da escola).
Saída: cabeçalho + uma linha por linha do arquivo, na ordem original. Colunas: row, inep, ibge7, uf, name, dep, loc, sit, mat (QT_MAT_BAS; vazio = não informado; em 2025+ escola
sem linha na Tabela_Matricula recebe 0, que é o significado da tabela). Valores sem interpretação: a validação e as regras ficam em educacao-build.ts.
Última linha de stdout: JSON {year, layout, rows, header_cols, kept, bytes_in}."""
import csv, io, json, os, re, sys, zipfile

WHITELIST = ['CO_ENTIDADE', 'CO_MUNICIPIO', 'CO_UF', 'NO_ENTIDADE', 'TP_DEPENDENCIA', 'TP_LOCALIZACAO', 'TP_SITUACAO_FUNCIONAMENTO']


def open_csv(path, name_re):
    """Devolve (iterador de linhas, tamanho em bytes, fechador) de um CSV solto ou da entrada que casa com name_re dentro de um ZIP."""
    if path.lower().endswith('.zip'):
        z = zipfile.ZipFile(path)
        info = max((i for i in z.infolist() if i.filename.lower().endswith('.csv') and re.search(name_re, os.path.basename(i.filename))), key=lambda i: i.file_size)
        fh = z.open(info); size = info.file_size; closer = lambda: (fh.close(), z.close())
    else:
        fh = open(path, 'rb'); size = os.path.getsize(path); closer = fh.close
    return csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';'), size, closer


def main():
    year, out, files = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
    esc = [f for f in files if re.search(r'Tabela_Escola|microdados_ed_basica|\.zip$', os.path.basename(f), re.I)]
    mat = [f for f in files if re.search(r'Tabela_Matricula', os.path.basename(f), re.I)]
    if len(esc) != 1: raise SystemExit(f'esperava 1 arquivo de escolas, vieram {esc}')
    layout = 'tables' if mat else 'single_csv'
    mats = {}
    if mat:
        rd, size_m, close = open_csv(mat[0], r'Tabela_Matricula')
        h = next(rd); ci = h.index('CO_ENTIDADE'); mi = h.index('QT_MAT_BAS')
        for r in rd: mats[r[ci]] = r[mi]
        close()
    rd, size, close = open_csv(esc[0], r'microdados_ed_basica|Tabela_Escola')
    h = next(rd); ix = {c: i for i, c in enumerate(h)}
    miss = [c for c in WHITELIST if c not in ix]
    if miss: raise SystemExit(f'colunas ausentes no layout {year}: {miss}')
    if not mat and 'QT_MAT_BAS' not in ix: raise SystemExit(f'QT_MAT_BAS ausente no layout {year}')
    n = 0
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        o.write('row\tinep\tibge7\tuf\tname\tdep\tloc\tsit\tmat\n')
        for r in rd:
            n += 1
            inep = r[ix['CO_ENTIDADE']].strip()
            m = mats.get(inep, '0') if mat else r[ix['QT_MAT_BAS']].strip()
            name = r[ix['NO_ENTIDADE']].replace('\t', ' ').replace('\n', ' ').replace('\r', ' ').strip()
            o.write('\t'.join([str(n), inep, r[ix['CO_MUNICIPIO']].strip(), r[ix['CO_UF']].strip(), name, r[ix['TP_DEPENDENCIA']].strip(), r[ix['TP_LOCALIZACAO']].strip(), r[ix['TP_SITUACAO_FUNCIONAMENTO']].strip(), m]) + '\n')
    close(); os.replace(out + '.part', out)
    print(json.dumps({'year': year, 'layout': layout, 'rows': n, 'header_cols': len(h), 'kept': len(WHITELIST) + 1, 'bytes_in': size + (size_m if mat else 0)}))


main()
