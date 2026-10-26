"""P10/G7 — invariante contábil sobre o RAW do Siconfi (DCA I-E): Σ subfunções 12.xxx = função 12, por ente × exercício × estágio (tolerância R$ 1,00).
Também compara função 12 × total de despesas (exceto intra). Somente leitura. Uso: python -I -X utf8 siconfi_fn12_invariantes.py <saida.json>"""
import collections, glob, gzip, json, sys
base = 'D:/Civica/raw/siconfi/dca/DCA_Anexo_I_E'
STAGE = {'Despesas Empenhadas': 'EMP', 'Despesas Liquidadas': 'LIQ', 'Despesas Pagas': 'PAG'}
TOL = 100
res = {}
for year in range(2014, 2026):
    ok = bad = entes_ok = entes_bad = 0; no_subs = 0; ex = []; share = []
    for f in sorted(glob.glob(f'{base}/{year}/uf*.jsonl.gz')):
        with gzip.open(f, 'rt', encoding='utf-8') as fh:
            for line in fh:
                r = json.loads(line); b = json.loads(r['b']); items = b.get('items', [])
                fn = {}; subs = collections.defaultdict(float); tot = {}
                for it in items:
                    code = str(it.get('conta', '')).split(' - ')[0].strip(); st = STAGE.get(str(it.get('coluna')))
                    if not st or it.get('valor') is None: continue
                    v = round(float(it['valor']) * 100)
                    if code == '12': fn[st] = v
                    elif code.startswith('12.') or code == 'FU12': subs[st] += v   # FU12 = "Demais subfunções" (mesma convenção FU06 usada na Segurança)
                    elif str(it.get('conta', '')).startswith('Despesas Exceto'): tot[st] = v
                if not fn: continue
                good = True
                for st, v in fn.items():
                    if st not in subs: no_subs += 1; continue
                    if abs(subs[st] - v) <= TOL: ok += 1
                    else:
                        bad += 1; good = False
                        if len(ex) < 6: ex.append({'ente': r['e'], 'estagio': st, 'funcao12': v, 'soma_subfuncoes': subs[st]})
                entes_ok += good; entes_bad += (not good)
                if 'EMP' in fn and tot.get('EMP'): share.append(fn['EMP'] / tot['EMP'])
    share.sort()
    res[year] = {'estagios_conferidos_ok': ok, 'estagios_divergentes': bad, 'estagios_sem_subfuncoes': no_subs, 'entes_todos_ok': entes_ok, 'entes_com_divergencia': entes_bad, 'exemplos': ex,
                 'participacao_funcao12_no_total_EMP': {'n': len(share), 'p10': round(share[int(.1 * len(share))], 4) if share else None, 'mediana': round(share[len(share) // 2], 4) if share else None, 'p90': round(share[int(.9 * len(share))], 4) if share else None}}
    print(year, ok, bad, no_subs, entes_ok, entes_bad, flush=True)
json.dump(res, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
