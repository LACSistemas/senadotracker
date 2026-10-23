# -*- coding: utf-8 -*-
"""Extrator do arquivo Senatran "Frota por UF e tipo" (conferência independente do total por UF). Saída: {header, rows:[[nome, total, tipos...]]}.
Uso: python frota_uf_extract.py <arquivo> <saida.json> [--tmp DIR]"""
import sys, os, json, re, tempfile, importlib.util
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('frota_extract', os.path.join(here, 'frota_extract.py')); fe = importlib.util.module_from_spec(spec); spec.loader.exec_module(fe)

def main(src, out, tmp):
    path = fe.unpack(src, tmp); rows = []; header = None
    for name, it in fe.sheets(path):
        for r in it:
            r = list(r)
            if header is None and len(r) > 2 and fe.norm(r[0]).startswith('GRANDES REGI') and 'TOTAL' in [fe.norm(x) for x in r]:
                header = [str(x).strip() for x in r if x not in (None, '')]; continue
            if header is not None and r and r[0] and fe.num(r[1]) is not None and fe.norm(r[0]) not in ('', 'BRASIL %'):
                rows.append([str(r[0]).strip()] + [fe.num(x) for x in r[1:len(header)]])
        if header: break
    if not header: raise SystemExit('cabecalho UF/tipo nao encontrado')
    json.dump(dict(header=header, rows=rows, source=os.path.basename(src)), open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps(dict(rows=len(rows))))

if __name__ == '__main__':
    a = sys.argv[1:]; tmp = a[a.index('--tmp') + 1] if '--tmp' in a else tempfile.gettempdir()
    os.makedirs(tmp, exist_ok=True); main(a[0], a[1], tmp)
