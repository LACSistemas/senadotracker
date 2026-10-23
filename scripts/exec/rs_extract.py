"""Extrai a função 06 (Segurança Pública) dos empenhos municipais do TCE-RS (P9.5).

  python -I scripts/exec/rs_extract.py <empenhos-AAAA.csv.zip> <saida.json>

Lê o CSV em fluxo (27 milhões de linhas/ano), filtra cd_funcao = 06 e agrega por mês da operação × órgão (UG) × unidade orçamentária × subfunção × programa × projeto ×
categoria × grupo × modalidade, separando operações de empenhos do próprio exercício (empenho, liquidação, pagamento) dos pagamentos de empenhos de exercícios
anteriores (restos a pagar pagos). Não guarda credor, CPF, histórico, número de empenho ou contrato: só valores agregados por unidade.
Controle (todas as linhas): total por classe de órgão (prefeitura 'PM DE', câmara 'CM DE', outros) e por função, para quantificar o que fica fora do recorte.
"""
import csv, io, json, sys, zipfile
from decimal import Decimal


def cents(s):
    s = (s or '').strip()
    if not s:
        return 0
    return int((Decimal(s.replace(',', '.')) * 100).to_integral_value())


def ym(d):
    d = (d or '').strip()
    if len(d) >= 7 and d[4] == '-':
        return d[:7]
    if len(d) >= 10 and d[2] == '/':
        return f'{d[6:10]}-{d[3:5]}'
    return ''


def main():
    src, out = sys.argv[1], sys.argv[2]
    z = zipfile.ZipFile(src)
    name = [n for n in z.namelist() if n.lower().endswith('.csv')][0]
    raw = z.open(name)
    head = raw.read(65536)
    try:
        head.decode('utf-8'); enc = 'utf-8-sig'
    except UnicodeDecodeError as e:
        enc = 'utf-8-sig' if e.start > 60000 else 'latin-1'
    rd = csv.reader(io.TextIOWrapper(z.open(name), encoding=enc, errors='replace', newline=''), delimiter=',')
    h = [c.strip().lower() for c in next(rd)]   # 2013–2015 trazem o cabeçalho em maiúsculas
    ix = {c: i for i, c in enumerate(h)}
    need = ['nome_orgao', 'tipo_operacao', 'ano_empenho', 'ano_operacao', 'dt_operacao', 'cd_funcao', 'cd_subfuncao', 'cd_programa', 'cd_projeto', 'cd_unidade_orcamentaria', 'nome_unidade_orcamentaria', 'cd_rubrica', 'vl_empenho', 'vl_liquidacao', 'vl_pagamento']
    miss = [c for c in need if c not in ix]
    if miss:
        raise SystemExit(f'colunas ausentes: {miss}')
    g = {c: ix[c] for c in need}
    agg = {}
    ctrl = {}
    orgs = {}
    rows_in = rows_kept = 0
    for r in rd:
        if len(r) < len(h):
            continue
        rows_in += 1
        fn = r[g['cd_funcao']].strip().lstrip('0')
        org = r[g['nome_orgao']].strip()
        cls = 'PM' if org.startswith('PM DE ') else 'CM' if org.startswith('CM DE ') else 'OUTROS'
        ay = r[g['ano_operacao']].strip()
        emp, liq, pag = cents(r[g['vl_empenho']]), cents(r[g['vl_liquidacao']]), cents(r[g['vl_pagamento']])
        rp = 1 if (r[g['ano_empenho']].strip() and ay and int(r[g['ano_empenho']]) < int(ay)) else 0
        if fn == '6':
            c = ctrl.setdefault((cls, rp), [0, 0, 0])
            c[0] += emp; c[1] += liq; c[2] += pag
        if fn != '6':
            continue
        rows_kept += 1
        uo = r[g['cd_unidade_orcamentaria']].strip()
        orgs.setdefault((org, uo), r[g['nome_unidade_orcamentaria']].strip())
        rub = ''.join(ch for ch in r[g['cd_rubrica']] if ch.isdigit())
        cat = int(rub[0]) if rub[:1].isdigit() else -1
        gr = int(rub[1]) if len(rub) > 1 else -1
        mod = int(rub[2:4]) if len(rub) >= 4 else -1
        key = (ym(r[g['dt_operacao']]) or f'{ay}-00', org, uo, r[g['cd_subfuncao']].strip().lstrip('0') or '0', r[g['cd_programa']].strip().lstrip('0') or '0', r[g['cd_projeto']].strip(), cat, gr, mod, rp)
        a = agg.get(key)
        if a is None:
            agg[key] = [emp, liq, pag]
        else:
            a[0] += emp; a[1] += liq; a[2] += pag
    rows = [[*k, *v] for k, v in sorted(agg.items())]
    json.dump({'rows_in': rows_in, 'rows_kept': rows_kept, 'rows': rows, 'orgs': [[o, u, n] for (o, u), n in sorted(orgs.items())],
               'ctrl': [[c, rp, *v] for (c, rp), v in sorted(ctrl.items())]}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
