"""Extrai as propostas e convênios do MJSP (concedente) da Plataforma +Brasil / Transferegov (P9.5).

  python -I scripts/exec/siconv_extract.py <siconv_proposta.csv.zip> <siconv_convenio.csv.zip> <saida.json>

Recorte: COD_ORGAO_SUP = 30000 (Ministério da Justiça e Segurança Pública) e COD_ORGAO ∈ {30000, 30907 FUNPEN, 30911 FNSP, 30912 FUNAD}: concedente identificado
(NÃO é função orçamentária). Guarda só campos institucionais: nenhum endereço, CEP, banco, agência ou conta do proponente; o CNPJ é de pessoa jurídica.
Textos de situação saem normalizados (sem acento, maiúsculas); valores em centavos. A codificação (situação → código) é feita no TypeScript.
"""
import csv, io, json, sys, unicodedata, zipfile
from decimal import Decimal

KEEP = {'30000', '30907', '30911', '30912'}


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ' '.join(''.join(c for c in s if unicodedata.category(c) != 'Mn').upper().split())


def cents(s):
    s = (s or '').strip()
    if not s:
        return None
    return int((Decimal(s.replace('.', '').replace(',', '.')) * 100).to_integral_value())


def iso(d):
    d = (d or '').strip()
    return f'{d[6:10]}-{d[3:5]}-{d[0:2]}' if len(d) == 10 and d[2] == '/' else None


def table(path):
    z = zipfile.ZipFile(path)
    rd = csv.reader(io.TextIOWrapper(z.open(z.namelist()[0]), encoding='latin-1', newline=''), delimiter=';')
    h = [c.replace('﻿', '').replace('ï»¿', '').strip() for c in next(rd)]
    return {c: i for i, c in enumerate(h)}, rd


def main():
    prop_zip, conv_zip, out = sys.argv[1:4]
    ix, rd = table(prop_zip)
    props = {}
    n_in = 0
    for r in rd:
        n_in += 1
        if r[ix['COD_ORGAO_SUP']] == '30000' and r[ix['COD_ORGAO']] in KEEP:
            props[r[ix['ID_PROPOSTA']]] = r
    jx, rd2 = table(conv_zip)
    convs = {}
    for r in rd2:
        pid = r[jx['ID_PROPOSTA']]
        if pid in props:
            convs[pid] = r
    rows = []
    for pid, p in sorted(props.items(), key=lambda kv: int(kv[0])):
        c = convs.get(pid)
        signed = iso(c[jx['DIA_ASSIN_CONV']]) if c else None
        year = int(signed[:4]) if signed else int(p[ix['ANO_PROP']] or 0)
        rows.append({
            'proposal_id': int(pid), 'year': year, 'uf': p[ix['UF_PROPONENTE']].strip().upper(), 'cnpj': p[ix['IDENTIF_PROPONENTE']].strip(),
            'natureza': norm(p[ix['NATUREZA_JURIDICA']]), 'concedente': int(p[ix['COD_ORGAO']]), 'modalidade': norm(p[ix['MODALIDADE']]), 'prop_status': norm(p[ix['SIT_PROPOSTA']]),
            'conv_status': norm(c[jx['SIT_CONVENIO']]) if c else None,
            'v_global_prop': cents(p[ix['VL_GLOBAL_PROP']]) or 0, 'v_repasse_prop': cents(p[ix['VL_REPASSE_PROP']]) or 0,
            'v_global_conv': cents(c[jx['VL_GLOBAL_CONV']]) if c else None, 'v_repasse_conv': cents(c[jx['VL_REPASSE_CONV']]) if c else None,
            'v_empenhado_conv': cents(c[jx['VL_EMPENHADO_CONV']]) if c else None, 'v_desembolsado_conv': cents(c[jx['VL_DESEMBOLSADO_CONV']]) if c else None, 'signed': signed,
        })
    json.dump({'proposals_in_file': n_in, 'kept': len(rows), 'convenios': len(convs), 'rows': rows}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
