"""Extrai o recorte federal de Segurança dos arquivos abertos do Portal da Transparência (P9.5).

  python -I scripts/exec/fed_extract.py exec <despesas-execucao-AAAAMM.zip> <saida.json>
  python -I scripts/exec/fed_extract.py dot  <orcamento-despesa-AAAA.zip>   <saida.json>

Recorte guardado (detalhe): função 06 OU órgão superior 30000 (Ministério da Justiça e Segurança Pública), agregado por
unidade orçamentária × função × subfunção × programa × ação × categoria × grupo × modalidade de aplicação × UF do localizador de gasto (somando as unidades gestoras e o elemento;
modalidade 30/31/32 = transferência a Estados/DF, 40/41/42 = a Municípios, 50 = a entidades privadas, 90 = aplicação direta, 91 = intra-orçamentária; a UF é a do localizador orçamentário do gasto, nunca município).
Controle (todas as linhas do arquivo): total por função, separado em intra-orçamentário (modalidade 91) e demais, para reconciliar com a DCA.
Valores em centavos (inteiros). Nenhum credor, CPF ou favorecido existe nesses arquivos (são agregados por unidade).
"""
import csv, io, json, sys, zipfile
from decimal import Decimal

SEC = '06'
MJSP = '30000'


def cents(s):
    s = (s or '').strip().replace('"', '')
    if not s:
        return 0
    return int((Decimal(s.replace('.', '').replace(',', '.')) * 100).to_integral_value())


def i(s, d=-1):
    s = (s or '').strip()
    return int(s) if s.lstrip('-').isdigit() else d


def main():
    mode, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    z = zipfile.ZipFile(src)
    name = [n for n in z.namelist() if n.lower().endswith('.csv')][0]
    rd = csv.reader(io.TextIOWrapper(z.open(name), encoding='latin-1', newline=''), delimiter=';')
    head = next(rd)
    h = {c.strip().replace('﻿', '').replace('"', ''): k for k, c in enumerate(head)}
    def col(*names):
        for n in names:
            if n in h:
                return h[n]
        raise KeyError(f'coluna ausente: {names} em {list(h)[:12]}')
    if mode == 'exec':
        c_ym = col('Ano e mês do lançamento'); c_sup = col('Código Órgão Superior'); c_supn = col('Nome Órgão Superior'); c_sub = col('Código Órgão Subordinado'); c_subn = col('Nome Órgão Subordinado')
        c_uo = col('Código Unidade Orçamentária'); c_uon = col('Nome Unidade Orçamentária'); c_fn = col('Código Função'); c_sf = col('Código Subfução', 'Código Subfunção'); c_pr = col('Código Programa Orçamentário'); c_ac = col('Código Ação')
        c_cat = col('Código Categoria Econômica'); c_gr = col('Código Grupo de Despesa'); c_mod = col('Código Modalidade da Despesa'); c_uf = col('UF')
        vals = [col('Valor Empenhado (R$)'), col('Valor Liquidado (R$)'), col('Valor Pago (R$)'), col('Valor Restos a Pagar Inscritos (R$)'), col('Valor Restos a Pagar Cancelado (R$)'), col('Valor Restos a Pagar Pagos (R$)')]
        nv = 6
    else:
        c_ym = col('EXERCÍCIO'); c_sup = col('CÓDIGO ÓRGÃO SUPERIOR'); c_supn = col('NOME ÓRGÃO SUPERIOR'); c_sub = col('CÓDIGO ÓRGÃO SUBORDINADO'); c_subn = col('NOME ÓRGÃO SUBORDINADO')
        c_uo = col('CÓDIGO UNIDADE ORÇAMENTÁRIA'); c_uon = col('NOME UNIDADE ORÇAMENTÁRIA'); c_fn = col('CÓDIGO FUNÇÃO'); c_sf = col('CÓDIGO SUBFUNÇÃO'); c_pr = col('CÓDIGO PROGRAMA ORÇAMENTÁRIO'); c_ac = col('CÓDIGO AÇÃO')
        c_cat = col('CÓDIGO CATEGORIA ECONÔMICA'); c_gr = col('CÓDIGO GRUPO DE DESPESA'); c_mod = None; c_uf = None
        vals = [col('ORÇAMENTO INICIAL (R$)'), col('ORÇAMENTO ATUALIZADO (R$)'), col('ORÇAMENTO EMPENHADO (R$)'), col('ORÇAMENTO REALIZADO (R$)')]
        nv = 4
    agg = {}
    ctrl = {}   # (função, intra) -> [soma]
    orgs = {'sup': {}, 'sub': {}, 'uo': {}}
    rows_in = rows_kept = 0
    yms = set()
    for r in rd:
        if not r or len(r) < len(head):
            continue
        rows_in += 1
        ym = r[c_ym].strip().replace('"', '')
        yms.add(ym)
        fn = r[c_fn].strip()
        sup = r[c_sup].strip()
        v = [cents(r[k]) for k in vals]
        intra = 1 if (c_mod is not None and r[c_mod].strip() == '91') else 0
        cc = ctrl.setdefault((fn, intra), [0] * nv)
        for k in range(nv):
            cc[k] += v[k]
        if fn != SEC and sup != MJSP:
            continue
        rows_kept += 1
        sub = r[c_sub].strip(); uo = r[c_uo].strip()
        orgs['sup'].setdefault(sup, r[c_supn].strip())
        orgs['sub'].setdefault(sub, [r[c_subn].strip(), sup])
        orgs['uo'].setdefault(uo, [r[c_uon].strip(), sub])
        key = (ym, uo, fn, r[c_sf].strip(), i(r[c_pr], 0), r[c_ac].strip(), i(r[c_cat]), i(r[c_gr])) + ((i(r[c_mod]), r[c_uf].strip().upper()) if c_mod is not None else ())
        a = agg.get(key)
        if a is None:
            agg[key] = list(v)
        else:
            for k in range(nv):
                a[k] += v[k]
    rows = [[*k, *v] for k, v in sorted(agg.items())]
    json.dump({'mode': mode, 'periods': sorted(yms), 'rows_in': rows_in, 'rows_kept': rows_kept, 'rows': rows, 'orgs': orgs,
               'ctrl': [[fn, intra, *v] for (fn, intra), v in sorted(ctrl.items())]}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
