"""SISDEPEN/SENAPPEN — base de dados de um ciclo semestral (CSV oficial) → JSON com UMA linha por estabelecimento.
Uso: python -I scripts/exec/sisdepen_extract.py <ciclo.csv> <saida.json>

Lê somente: identificação institucional (nome, âmbito, UF, município, código IBGE, tipo, sexo de destinação, gestão, CEP só para
conferência de identidade), o bloco 1.3 (capacidade) e o bloco 4.1 (população prisional, margens por regime × jurisdição × sexo).
NÃO lê nem grava: endereço, bairro, telefone, quadro de servidores, perfil demográfico, saúde, trabalho, educação ou qualquer campo livre.
Células vazias ficam como null (≠ 0); "0.0" é zero declarado. O CEP sai só como dígitos para casar identidade entre ciclos e NÃO é gravado no banco.
"""
import csv, io, json, re, sys

VERSION = 'sisdepen-v1'
ID_COLS = {'ciclo': 0, 'ano': 1, 'ref': 2, 'tipo': 3, 'preench': 4, 'nome': 5, 'situacao': 6, 'outras': 7, 'cep': 10, 'ambito': 11, 'uf': 12, 'municipio': 13, 'ibge': 14}
EXPECT_HEAD = ['ciclo', 'Ano', 'Referência', None, 'Situação de Preenchimento', 'Nome do Estabelecimento', 'Situação do Estabelecimento', 'Outras Denominações', 'Endereço', 'Bairro', 'CEP', 'Âmbito', 'UF', 'Município', 'Código IBGE']
P_SEX = '1.1 Estabelecimento originalmente destinado a pessoa privadas de liberdade do sexo'
P_TYPE = '1.2 Tipo de estabelecimento - originalmente destinado'
P_GEST = '1.4 Gestão do estabelecimento'

def num(v):
    v = (v or '').strip()
    if v == '': return None
    try:
        f = float(v.replace(',', '.'))
    except ValueError:
        raise SystemExit(f'valor numérico inválido: {v!r}')
    if f != int(f) or f < 0: raise SystemExit(f'valor não inteiro ou negativo: {v!r}')
    return int(f)

def main(src, out):
    raw = open(src, 'rb').read()
    try: txt = raw.decode('utf-8-sig')
    except UnicodeDecodeError: txt = raw.decode('cp1252')
    rd = csv.reader(io.StringIO(txt, newline=''), delimiter=';')
    csv.field_size_limit(10**9)
    head = next(rd)
    for i, e in enumerate(EXPECT_HEAD):
        if e is not None and head[i] != e: raise SystemExit(f'coluna {i}: esperado {e!r}, encontrado {head[i]!r}')
    if head[3] not in ('Tipo do Estabelecimento', 'Tipo de Recolhimento'): raise SystemExit(f'coluna 3 inesperada: {head[3]!r}')
    ix = {c: i for i, c in enumerate(head)}
    cap = [c for c in head if c.startswith('1.3 ') and not c.endswith('Qual(is)?')]
    pop = [c for c in head if c.startswith('4.1 ')]
    for c in (P_SEX, P_TYPE, P_GEST):
        if c not in ix: raise SystemExit(f'coluna ausente: {c}')
    rows = []
    for n, r in enumerate(rd, start=1):
        if len(r) < len(head): continue
        rows.append({
            'row': n, 'ciclo': r[0].strip(), 'ano': r[1].strip(), 'ref': r[2].strip(), 'tipo': r[3].strip(), 'preench': r[4].strip(), 'nome': r[5].strip(), 'situacao': r[6].strip(), 'outras': r[7].strip(),
            'cep': re.sub(r'\D', '', r[10]), 'ambito': r[11].strip(), 'uf': r[12].strip(), 'municipio': r[13].strip(), 'ibge': re.sub(r'\D', '', r[14].replace('.0', '')),
            'sexo': r[ix[P_SEX]].strip(), 'tipo_orig': r[ix[P_TYPE]].strip(), 'gestao': r[ix[P_GEST]].strip(),
            'cap': {c: num(r[ix[c]]) for c in cap}, 'pop': {c: num(r[ix[c]]) for c in pop},
        })
    json.dump({'version': VERSION, 'head_cols': len(head), 'cap_cols': cap, 'pop_cols': pop, 'rows': rows}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps({'rows': len(rows), 'cap_cols': len(cap), 'pop_cols': len(pop), 'cycle': rows[0]['ref'] if rows else None}))

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(*sys.argv[1:])
