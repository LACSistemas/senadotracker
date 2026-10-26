"""P10.2 — quais verificações de partição falham no TSV de oferta (staging), por edição. Somente leitura. Uso: python -X utf8 checks_tsv.py <pasta_staging> <ano> [ano...]"""
import csv, glob, collections, sys
stg = sys.argv[1]
for y in map(int, sys.argv[2:]):
    f = sorted(glob.glob(f'{stg}/oferta_{y}_*.tsv'))[-1]
    c = collections.Counter(); n = 0; ex = {}
    for r in csv.DictReader(open(f, encoding='utf-8'), delimiter='\t'):
        n += 1
        g = lambda k: int(r[k]) if r[k].isdigit() else None
        z = lambda k: g(k) or 0
        def chk(name, total, *parts):
            t = g(total)
            if t is not None and t != sum(z(p) for p in parts):
                c[name] += 1; ex.setdefault(name, (r['inep'], t, [z(p) for p in parts]))
        chk('MAT_INF', 'v_mat_inf', 'mat_inf_cre', 'mat_inf_pre'); chk('MAT_FUND', 'v_mat_fund', 'mat_fund_ai', 'mat_fund_af'); chk('MAT_EJA', 'v_mat_eja', 'mat_eja_fund', 'mat_eja_med'); chk('MAT_ESP', 'v_mat_esp', 'mat_esp_cc', 'mat_esp_ce')
        chk('TUR_INF', 'v_tur_inf', 'tur_inf_cre', 'tur_inf_pre'); chk('TUR_FUND', 'v_tur_fund', 'tur_fund_ai', 'tur_fund_af'); chk('TUR_EJA_FM', 'tur_eja', 'tur_eja_fund', 'tur_eja_med'); chk('TUR_ESP', 'v_tur_esp', 'tur_esp_cc', 'tur_esp_ce')
        st = sum(z(k) for k in ('mat_inf_cre', 'mat_inf_pre', 'mat_fund_ai', 'mat_fund_af', 'mat_med', 'mat_eja_fund', 'mat_eja_med'))
        tt = sum(z(k) for k in ('tur_inf_cre', 'tur_inf_pre', 'tur_fund_ai', 'tur_fund_af', 'tur_med', 'tur_eja'))
        if z('mat_bas') < st: c['RESTO_MAT_NEG'] += 1; ex.setdefault('RESTO_MAT_NEG', (r['inep'], z('mat_bas'), st))
        if z('tur_bas') < tt: c['RESTO_TUR_NEG'] += 1; ex.setdefault('RESTO_TUR_NEG', (r['inep'], z('tur_bas'), tt))
        if z('mat_esp_cc') + z('mat_esp_ce') > z('mat_bas'): c['ESP>BAS'] += 1
    print(y, n, dict(c), {k: v for k, v in ex.items()})
