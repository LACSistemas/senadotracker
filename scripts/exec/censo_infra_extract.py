"""P10.3 — extrai do RAW do Censo Escolar SÓ as variáveis de infraestrutura da escola (whitelist do catálogo), para um TSV compacto em staging.
Uso: python -I -X utf8 censo_infra_extract.py <ano> <saida.tsv> <catalogo.json> <arquivo_raw>
 - catalogo.json = lista [{code, src, kind}] gerada a partir de educacao-infra-catalog.ts (fonte única da whitelist).
 - 2007–2024: um ZIP com um CSV (uma linha por escola). 2025+: `Tabela_Escola_*.csv` solto.
Saída: cabeçalho `row inep sit <codes...>` + uma linha por escola do arquivo (vazio = coluna inexistente na edição OU célula em branco; a distinção está no JSON final).
Nenhum dado pessoal ou de contato: só indicadores institucionais da escola. Última linha de stdout: JSON {year, rows, bytes_in, present, missing, dist:{src:{0,1,empty,other}}}."""
import csv, io, json, os, re, sys, zipfile


def open_csv(path, name_re):
    if path.lower().endswith('.zip'):
        z = zipfile.ZipFile(path)
        info = max((i for i in z.infolist() if i.filename.lower().endswith('.csv') and re.search(name_re, os.path.basename(i.filename))), key=lambda i: i.file_size)
        fh = z.open(info); size = info.file_size; closer = lambda: (fh.close(), z.close())
    else:
        fh = open(path, 'rb'); size = os.path.getsize(path); closer = fh.close
    return csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';'), size, closer


def main():
    year, out, cat_path, raw = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    cat = json.load(open(cat_path, encoding='utf-8'))
    rd, size, close = open_csv(raw, r'microdados_ed_basica|Tabela_Escola')
    h = next(rd); ix = {c: i for i, c in enumerate(h)}
    for need in ('CO_ENTIDADE', 'TP_SITUACAO_FUNCIONAMENTO'):
        if need not in ix: raise SystemExit(f'coluna {need} ausente no layout {year}')
    present = [x for x in cat if x['src'] in ix]; missing = [x['src'] for x in cat if x['src'] not in ix]
    dist = {x['src']: {'0': 0, '1': 0, 'empty': 0, 'other': 0} for x in present}
    n = 0
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        o.write('row\tinep\tsit\t' + '\t'.join(x['code'] for x in cat) + '\n')
        for r in rd:
            n += 1
            vals = []
            for x in cat:
                i = ix.get(x['src'])
                if i is None: vals.append(''); continue
                s = r[i].strip() if i < len(r) else ''
                d = dist[x['src']]
                if s == '': d['empty'] += 1
                elif x['kind'] == 'flag':
                    if s in ('0', '1'): d[s] += 1
                    else: d['other'] += 1
                else:
                    if s.isdigit(): d['1' if int(s) > 0 else '0'] += 1
                    else: d['other'] += 1
                vals.append(s)
            o.write('\t'.join([str(n), r[ix['CO_ENTIDADE']].strip(), r[ix['TP_SITUACAO_FUNCIONAMENTO']].strip()] + vals) + '\n')
    close(); os.replace(out + '.part', out)
    print(json.dumps({'year': year, 'rows': n, 'bytes_in': size, 'present': [x['src'] for x in present], 'missing': missing, 'dist': dist}))


main()
