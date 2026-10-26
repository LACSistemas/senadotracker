"""P10.3 — monta o TSV de docentes OFICIAIS (Sinopse Estatística da Educação Básica, tabelas 2.1 e 2.2) de uma edição a partir dos JSON extraídos das planilhas
(sinopse_tabela.py). Uma linha por Brasil / UF / município. Colunas escolhidas pelo RÓTULO (os índices de coluna da planilha mudam de edição para edição).
Docentes distintos são contados UMA vez em cada nível de agregação: o total do município NÃO é a soma das etapas nem das redes (um docente que atua em duas redes ou etapas conta nas duas).
Uso: python -I -X utf8 sinopse_docentes_tsv.py <ano> <t21.json> <t22.json> <saida.tsv>
Saída: cabeçalho `key kind doc_total doc_inf doc_cre doc_pre doc_fun doc_ai doc_af doc_med doc_pub doc_fed doc_est doc_mun doc_priv doc_urb doc_rur` (kind = brasil | uf | mun; vazio = a edição não tem a coluna)."""
import json, re, sys

T21 = [('doc_total', r'^Total$'), ('doc_inf', r'Educação Infantil\|Total$'), ('doc_cre', r'Educação Infantil\|Creche$'), ('doc_pre', r'Educação Infantil\|Pré-Escola$'),
       ('doc_fun', r'Ensino Fundamental\|Total$'), ('doc_ai', r'Ensino Fundamental\|Anos Iniciais$'), ('doc_af', r'Ensino Fundamental\|Anos Finais$'), ('doc_med', r'Ensino Médio\|Total$')]
T22 = [('doc_pub', r'^(Rede Pública\|Total|Localização e Dependência Administrativa\|Dependência Administrativa\|Pública)$'), ('doc_fed', r'(Rede Pública\|Federal|Dependência Administrativa\|Federal)$'),
       ('doc_est', r'(Rede Pública\|Estadual|Dependência Administrativa\|Estadual)$'), ('doc_mun', r'(Rede Pública\|Municipal|Dependência Administrativa\|Municipal)$'),
       ('doc_priv', r'^(Rede Privada\|Total|Localização e Dependência Administrativa\|Dependência Administrativa\|Privada)$'),
       ('doc_urb', r'Urbana\|Total$'), ('doc_rur', r'Rural\|Total(\||$)')]
COLS = ['doc_total', 'doc_inf', 'doc_cre', 'doc_pre', 'doc_fun', 'doc_ai', 'doc_af', 'doc_med', 'doc_pub', 'doc_fed', 'doc_est', 'doc_mun', 'doc_priv', 'doc_urb', 'doc_rur']


def pick(d, spec, total_key=None):
    """{código_coluna: rótulo} → {nome: código_coluna} escolhendo a primeira coluna cujo rótulo casa."""
    out = {}
    for name, rx in spec:
        for c, lab in d['columns'].items():
            if re.search(rx, lab):
                out[name] = c; break
    if total_key and total_key not in out and 'E' in d['columns']: out[total_key] = 'E'
    return out


def main():
    year, f21, f22, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    a = json.load(open(f21, encoding='utf-8')); b = json.load(open(f22, encoding='utf-8'))
    m21 = pick(a, T21, 'doc_total'); m22 = pick(b, T22)
    rows = {}
    def put(src, mp, kind, key, vals):
        r = rows.setdefault((kind, key), {})
        for name, col in mp.items():
            v = vals.get(col)
            if v is not None: r[name] = v
    put(a, m21, 'brasil', 'Brasil', a['brasil']); put(b, m22, 'brasil', 'Brasil', b['brasil'])
    for n, v in a['ufs'].items(): put(a, m21, 'uf', n, v)
    for n, v in b['ufs'].items(): put(b, m22, 'uf', n, v)
    for n, v in a['municipios'].items(): put(a, m21, 'mun', n, v)
    for n, v in b['municipios'].items(): put(b, m22, 'mun', n, v)
    with open(out, 'w', encoding='utf-8', newline='') as o:
        o.write('key\tkind\t' + '\t'.join(COLS) + '\n')
        for (kind, key), r in rows.items():
            o.write(f'{key}\t{kind}\t' + '\t'.join('' if r.get(c) is None else str(r[c]) for c in COLS) + '\n')
    print(json.dumps({'year': int(year), 'rows': len(rows), 'cols21': sorted(m21), 'cols22': sorted(m22), 'brasil': rows[('brasil', 'Brasil')]}))


main()
