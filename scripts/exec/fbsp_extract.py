"""Raio-X das Forças de Segurança Pública (FBSP): extrai as tabelas de efetivo do PDF pela POSIÇÃO das palavras na página.
Uso: python -I scripts/exec/fbsp_extract.py <pdf> <saida.json>

Por que posição e não texto corrido: células em branco (ex.: Corpo de Bombeiros de São Paulo, somado à PM por nota de rodapé) somem do texto
extraído e deslocam todas as colunas seguintes. As colunas são ancoradas nos centros dos valores da linha "Brasil" (sempre completa) e cada valor
das demais linhas vai à coluna de centro mais próximo; coluna sem valor é BLANK explícito. Nada é imputado.
Estados de célula: NUM (valor), UNAVAILABLE ("..." = informação não disponível), NONE ("-" = fenômeno inexistente), BLANK (célula vazia).
"""
import json, re, sys, unicodedata
import fitz

VERSION = 'fbsp-raiox-v2'
NUM = re.compile(r'^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$|^-?\d+,\d+$')
MARK = re.compile(r'^\(\d+\)$')
UFS = ['Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná',
       'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins']
SIGLA = dict(zip(UFS, ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']))
SIGLA['Brasil'] = 'BR'
# Tabela → (página, título esperado, colunas)
TABLES = {
    'T2': (14, 'Efetivo da ativa das agências de segurança pública brasileiras, por corporação', ['PM', 'CBM', 'PC', 'PERICIA', 'POLICIA_PENAL', 'PF', 'PRF', 'POLICIA_PENAL_FEDERAL', 'POLICIA_LEGISLATIVA', 'GCM', 'TOTAL']),
    'T3': (22, 'Efetivo previsto e existente das Polícias Militares', ['PREVISTO', 'EXISTENTE', 'RELACAO_PCT']),
    'T4': (24, 'Efetivo previsto e existente das Polícias Civis', ['PREVISTO', 'EXISTENTE', 'RELACAO_PCT']),
    'T5': (28, 'Efetivo previsto e existente das Polícias Penais estaduais', ['PREVISTO', 'EXISTENTE', 'RELACAO_PCT']),
    'T6': (31, 'Taxas de profissionais por 1.000 habitantes, por instituição', ['PM', 'CBM', 'PC']),
    'T15': (74, 'Municípios com Guardas Civis Municipais e quantidade de efetivo, por UF', ['MUN_RAIS2024', 'EF_RAIS2024', 'MUN_MUNIC2023', 'EF_MUNIC2023', 'MUN_SENASP2024', 'MUN_FINAL', 'EF_FINAL']),
}
NOTES = {   # trechos de nota que precisam existir na página (guarda de layout e de semântica)
    'T2': ['Posição dos dados em março/2025', 'Posição dos dados em abril/2025', 'Informação não disponível', 'Fenômeno inexistente', 'o efetivo dos Corpos de Bombeiros já está somado ao da Polícia Militar', 'junho/2023', 'RAIS'],
    'T6': ['Posição dos dados sobre efetivos em março/2025', 'estimativas de população do IBGE'], 'T3': ['março/2022'], 'T4': ['apenas os agentes da Polícia Civil'], 'T5': ['Informação não disponível'], 'T15': ['RAIS', 'Fenômeno inexistente'],
}

def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).lower()

def lines(page):
    ws = [w for w in page.get_text('words')]
    ws.sort(key=lambda w: (round(w[1] / 2.0), w[0]))
    out = []
    for w in ws:
        y = (w[1] + w[3]) / 2
        if out and abs(out[-1]['y'] - y) < 3.0: out[-1]['w'].append(w)
        else: out.append({'y': y, 'w': [w]})
    for l in out: l['w'].sort(key=lambda w: w[0])
    return out

def cell(tok):
    if tok == '...': return {'raw': tok, 'state': 'UNAVAILABLE', 'v': None}
    if tok in ('-', '–', '—'): return {'raw': tok, 'state': 'NONE', 'v': None}
    v = float(tok.replace('.', '').replace(',', '.')); return {'raw': tok, 'state': 'NUM', 'v': int(v) if v == int(v) and ',' not in tok else v}

def parse_table(doc, key):
    page_no, title, cols = TABLES[key]
    page = doc[page_no - 1]; text = page.get_text()
    if norm(title)[:40] not in norm(text.replace('\n', ' ')): raise SystemExit(f'{key}: título esperado não encontrado na página {page_no}: {title}')
    miss = [n for n in NOTES[key] if norm(n) not in norm(text.replace('\n', ' '))]
    if miss: raise SystemExit(f'{key}: notas esperadas ausentes: {miss}')
    rows = {}; centers = None
    for l in lines(page):
        toks = [w for w in l['w'] if not MARK.match(w[4])]
        label_words = []
        for w in toks:
            if NUM.match(w[4]) or w[4] in ('...', '-', '–', '—'): break
            label_words.append(w[4])
        label = ' '.join(label_words).strip()
        if label not in UFS and label != 'Brasil': continue
        vals = [w for w in toks[len(label_words):] if NUM.match(w[4]) or w[4] in ('...', '-', '–', '—')]
        if label == 'Brasil' and 'BR' not in rows:
            if len(vals) != len(cols): raise SystemExit(f'{key}: linha Brasil com {len(vals)} valores (esperado {len(cols)})')
            centers = [(w[0] + w[2]) / 2 for w in vals]
        if label in rows: continue   # (tabela repetida no mesmo texto)
        if centers is None: raise SystemExit(f'{key}: linha {label} antes da linha Brasil')
        got = {c: {'raw': '', 'state': 'BLANK', 'v': None} for c in cols}
        for w in vals:
            x = (w[0] + w[2]) / 2; i = min(range(len(centers)), key=lambda k: abs(centers[k] - x))
            if abs(centers[i] - x) > 0.7 * (centers[1] - centers[0]) + 6: raise SystemExit(f'{key}/{label}: valor {w[4]} fora de qualquer coluna')
            if got[cols[i]]['state'] != 'BLANK': raise SystemExit(f'{key}/{label}: duas células na coluna {cols[i]}')
            got[cols[i]] = cell(w[4])
        rows[SIGLA[label]] = {'label': label, 'cells': got}
    if len(rows) != 28: raise SystemExit(f'{key}: {len(rows)} linhas (esperado 28 = Brasil + 27 UFs)')
    return {'page': page_no, 'title': title, 'columns': cols, 'rows': rows}

def pct_check(t):
    bad = []
    for uf, r in t['rows'].items():
        c = r['cells']; p, e, pct = c['PREVISTO'], c['EXISTENTE'], c['RELACAO_PCT']
        if p['state'] == 'NUM' and e['state'] == 'NUM' and pct['state'] == 'NUM':
            calc = e['v'] / p['v'] * 100
            if abs(calc - pct['v']) > 0.051: bad.append((uf, round(calc, 2), pct['v']))
    return bad

def sum_check(t2):
    bad = []
    cols = ['PM', 'CBM', 'PC', 'PERICIA', 'POLICIA_PENAL', 'PF', 'PRF', 'POLICIA_PENAL_FEDERAL', 'POLICIA_LEGISLATIVA', 'GCM']
    for uf, r in t2['rows'].items():
        c = r['cells']; s = sum(c[k]['v'] or 0 for k in cols)
        if c['TOTAL']['state'] == 'NUM' and s != c['TOTAL']['v']: bad.append((uf, s, c['TOTAL']['v']))
    return bad

def main(pdf, out):
    doc = fitz.open(pdf)
    res = {'version': VERSION, 'pages': len(doc), 'tables': {k: parse_table(doc, k) for k in TABLES}}
    res['checks'] = {
        'T2_row_sum_mismatch': sum_check(res['tables']['T2']),
        'T3_pct_mismatch': pct_check(res['tables']['T3']), 'T4_pct_mismatch': pct_check(res['tables']['T4']), 'T5_pct_mismatch': pct_check(res['tables']['T5']),
    }
    json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps({'tables': list(res['tables']), 'checks': res['checks']}, ensure_ascii=False))

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
