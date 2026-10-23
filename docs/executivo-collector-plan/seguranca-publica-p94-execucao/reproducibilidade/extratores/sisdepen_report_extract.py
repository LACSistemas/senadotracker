"""Relatórios oficiais da SENAPPEN ("Relatório de Informações Penitenciárias", PDF por semestre): extrai os quadros nacionais usados como CONTROLE EXTERNO.
Uso: python -I scripts/exec/sisdepen_report_extract.py <relatorio.pdf> <saida.json>
Por semestre: população em celas físicas, capacidade de vagas, déficit de vagas e estabelecimentos prisionais — cada um com o total do sistema ESTADUAL
(gráfico por UF) e, quando a nota existir, o quantitativo do Sistema Penitenciário Federal (publicado à parte).
Só leitura de texto da página (gráficos vêm como listas "UF | valor"); nenhum dado individual.
"""
import json, re, sys, unicodedata
import fitz

KINDS = [('pop', r'popula\w+ prisional em (\d\d/\d\d/\d{4})'), ('cap', r'capacidade de vagas em (\d\d/\d\d/\d{4})'), ('deficit', r'd\wficit de vagas em (\d\d/\d\d/\d{4})'), ('estab', r'estabelecimentos prisionais em (\d\d/\d\d/\d{4})')]

def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).lower()
def num(t): return int(t.replace('.', ''))

def main(pdf, out):
    d = fitz.open(pdf); res = {}
    for i, p in enumerate(d):
        if i > 40: break
        raw = re.sub(r'\s+', ' ', p.get_text().replace('\n', ' | ')); t = norm(raw)
        if 'presos em cela fisica' not in t and 'cela fisica' not in t: continue
        for kind, rx in KINDS:
            m = re.search(rx, t)
            if not m or kind in res: continue
            e = {'page': i + 1, 'date': m.group(1), 'uf': {}, 'totals': [], 'federal': {}}
            for uf, v in re.findall(r'\b([A-Z]{2}) \| (-?[\d\.]+)\b', raw): e['uf'][uf] = num(v)
            e['totals'] = [num(x) for x in re.findall(r'Total = ([\d\.]+)', raw)]
            fm = re.search(r'quantitativos: \| ((?:SUPER\w+ - )?(?:[A-Z]{2}: [\d\.]+(?:, )?)+)\. Total = ([\d\.]+)', raw)
            if fm: e['federal'] = {'by_uf': {k: num(v) for k, v in re.findall(r'([A-Z]{2}): ([\d\.]+)', fm.group(1))}, 'total': num(fm.group(2))}
            res[kind] = e
    cycle = re.search(r'(\d+)\W+ ciclo SISDEPEN', ' '.join(p.get_text() for p in d[:30]))
    json.dump({'pdf': pdf.replace('\\', '/').split('/')[-1], 'pages': len(d), 'cycle': int(cycle.group(1)) if cycle else None, 'kinds': res}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps({k: {'page': v['page'], 'ufs': len(v['uf']), 'totals': v['totals'], 'fed': v['federal'].get('total')} for k, v in res.items()}))

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(*sys.argv[1:])
