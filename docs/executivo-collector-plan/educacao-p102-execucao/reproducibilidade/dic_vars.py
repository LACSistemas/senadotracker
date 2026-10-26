"""P10.2/G2 — extrai do dicionário oficial (xlsx do ZIP de 2025) as linhas das abas de Matrícula e Turma: nome, descrição, tipo, categorias e a coleta por ano (colunas de anos).
Uso: python -I -X utf8 dic_vars.py <dicionario.xlsx> <saida.json> [VAR ...]   (sem VAR: salva todas; com VAR: imprime só essas)"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'educacao-p101-execucao', 'reproducibilidade'))
from sinopse_reader import Book

b = Book(sys.argv[1]); out = {}
want = set(sys.argv[3:])
for name in b.sheets:
    if 'Matr' not in name and 'Turma' not in name: continue
    rows = list(b.rows(name)); out[name] = rows
    if want:
        for r in rows:
            if any(str(v).strip() in want for v in r.values()):
                print('##', name); print(json.dumps(r, ensure_ascii=False)[:900])
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print({k: len(v) for k, v in out.items()})
