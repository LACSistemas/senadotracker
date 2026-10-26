"""Mostra o começo (ementa) e o fim (conclusão) de um texto e os trechos em volta de palavras-chave. Uso: python -X utf8 grep_ctx.py <arquivo.txt> <início> <fim> <regex> [largura]"""
import re, sys
t = re.sub(r'\s+', ' ', open(sys.argv[1], encoding='utf-8').read())
a, b, rx = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]; w = int(sys.argv[5]) if len(sys.argv) > 5 else 220
print('--- INÍCIO ---'); print(t[:a]); print('--- FIM ---'); print(t[-b:]); print('--- TRECHOS ---')
last = -1000
for m in re.finditer(rx, t, flags=re.I):
    if m.start() - last < w: continue
    last = m.start(); print('•', t[max(0, m.start() - w):m.start() + w]); print()
