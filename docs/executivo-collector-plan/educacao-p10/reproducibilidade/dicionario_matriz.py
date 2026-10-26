"""P10/G2,G4,G5 — transforma o dicionário XLSX do Censo Escolar 2025 em matriz variável × ano (2007–2025).
Uso: python -I -X utf8 dicionario_matriz.py <dicionario.json> <saida.csv> <resumo.json>"""
import csv, json, sys, re, collections
d = json.load(open(sys.argv[1], encoding='utf-8'))['linhas']
out = []; resumo = {}
for aba, rows in d.items():
    hdr_idx = next(i for i, r in enumerate(rows) if r.get('B', '').strip() == 'Nome da Variável')
    years_row = rows[hdr_idx + 1]; ycols = {c: v for c, v in years_row.items() if re.fullmatch(r'\d\d', str(v).strip())}
    ycols = {c: 2000 + int(v) for c, v in ycols.items()}
    note_col = next((c for c, v in rows[hdr_idx].items() if 'Notas' in str(v)), None)
    n = 0; cat = collections.Counter()
    for r in rows[hdr_idx + 2:]:
        name = (r.get('B') or '').strip()
        if not re.fullmatch(r'[A-Z][A-Z0-9_]+', name): continue
        flags = {y: (r.get(c) or '').strip().lower() for c, y in ycols.items()}
        sim = sorted(y for y, v in flags.items() if v == 's')
        gaps = [y for y in range(sim[0], sim[-1] + 1) if flags.get(y) != 's'] if sim else []
        out.append({'tabela': aba.strip(), 'variavel': name, 'descricao': (r.get('C') or '').strip(), 'tipo': (r.get('D') or '').strip(), 'tamanho': (r.get('E') or '').strip(),
                    'categoria': (r.get('F') or '').strip().replace('\n', ' ')[:300], 'primeiro_ano': sim[0] if sim else '', 'ultimo_ano': sim[-1] if sim else '',
                    'anos_coletados': len(sim), 'lacunas': ','.join(map(str, gaps)), 'nota': (r.get(note_col) or '').strip().replace('\n', ' ')[:300] if note_col else ''})
        n += 1
    resumo[aba.strip()] = {'variaveis': n, 'anos': sorted(set(ycols.values()))}
with open(sys.argv[2], 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
json.dump(resumo, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(resumo, len(out))
