"""P10.1/G5 — cabeçalho, primeira linha e contagem de cada edição do Censo Escolar no RAW local (somente leitura).
Uso: python -I -X utf8 layout_probe.py <pasta_raw_censo> <saida.json> [ano ...]"""
import csv, io, json, os, sys, zipfile, glob

root, out = sys.argv[1], sys.argv[2]
years = [int(a) for a in sys.argv[3:]] or list(range(2007, 2025))
res = {}
for y in years:
    zs = glob.glob(os.path.join(root, str(y), '*.zip'))
    if not zs: continue
    with zipfile.ZipFile(zs[0]) as z:
        names = [i.filename for i in z.infolist()]
        csvs = [i for i in z.infolist() if i.filename.lower().endswith('.csv')]
        info = max(csvs, key=lambda i: i.file_size)
        with z.open(info) as fh:
            rd = csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';')
            hdr = next(rd); first = next(rd); n = 1 + sum(1 for _ in rd)
    res[y] = {'zip': os.path.basename(zs[0]), 'entradas_csv': [(i.filename, i.file_size) for i in csvs], 'n_colunas': len(hdr), 'linhas': n, 'cabecalho': hdr[:60], 'primeira': first[:40]}
    print(y, info.filename, len(hdr), n, flush=True)
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
