"""Extrai o texto dos PDFs jurídicos do INEP (somente leitura). Uso: python -X utf8 pdf_text.py <pasta_pdfs> <pasta_saida>"""
import fitz, os, sys
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.lower().endswith('.pdf'): continue
    d = fitz.open(os.path.join(src, f)); t = '\n'.join(p.get_text() for p in d)
    open(os.path.join(out, f[:-4] + '.txt'), 'w', encoding='utf-8').write(t); print(f, len(d), 'páginas', len(t), 'caracteres')
