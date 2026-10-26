"""Cabeçalhos de todas as edições do Censo Escolar no RAW local (CSV único 2007–2024; tabelas 2025) para o contrato de colunas da P10.2. Somente leitura.
Uso: python -I -X utf8 headers_all.py <raw_censo> <saida.json>"""
import csv, glob, io, json, os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]; res = {}
def hdr(fh):
    return next(csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';'))
for y in range(2007, 2025):
    z = zipfile.ZipFile(glob.glob(os.path.join(root, str(y), '*.zip'))[0])
    i = max((i for i in z.infolist() if i.filename.lower().endswith('.csv')), key=lambda i: i.file_size)
    with z.open(i) as fh: res[str(y)] = {'esc': hdr(fh)}
for t in ('Escola', 'Matricula', 'Turma'):
    p = glob.glob(os.path.join(root, '2025', f'Tabela_{t}_*.csv'))
    if p:
        with open(p[0], 'rb') as fh: res.setdefault('2025', {})[t] = hdr(fh)
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
for y, v in res.items(): print(y, {k: len(c) for k, c in v.items()})
