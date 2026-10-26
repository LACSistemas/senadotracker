"""P10/G16 — modelo de estimativa de armazenamento da Educação (3 cenários), com premissas explícitas e unidades medidas no banco/RAW atuais.
Uso: python -I -X utf8 estimativa_armazenamento.py <saida.csv> <resumo.json>
Medidas reais usadas (2026-10-24): exec_ind_value 14.172.050 linhas = 2.414 MB (170 B/linha com 1.256 MB de índices); exec_fin_fact 5.481.475 = 562 MB (102 B/linha);
exec_change_log 15.086.184 linhas = 3.288 MB (218 B/linha); log/dados ≈ 0,46; exec_fin_contract 165.150 = 38 MB (235 B/linha); dump pg_dump -Fc por onda 0,3–0,5 GB."""
import csv, json, sys
LOG_B = 218
SC = ('conservador', 'provavel', 'pessimista')
LOGF = dict(zip(SC, (0.25, 0.5, 1.0)))
Y = dict(zip(SC, (9, 19, 31)))                 # anos do Censo Escolar usados (2017–25 | 2007–25 | 1995–25)
SCH = 215_000                                   # escolas/ano (Censo 2021–2025: 214–225 mil)
MUN = 5_598                                     # entes (Brasil + UFs + municípios)
GB = 1e9

def rows():
    out = []
    def add(wave, item, kind, sc, nrows=0, bytes_row=0, raw_gb=0.0, note=''):
        data_gb = nrows * bytes_row / GB
        log_gb = nrows * LOGF[sc] * LOG_B / GB if kind == 'db' else 0.0
        out.append({'onda': wave, 'item': item, 'tipo': kind, 'cenario': sc, 'linhas': int(nrows), 'bytes_por_linha': bytes_row, 'raw_gb': round(raw_gb, 3), 'banco_gb': round(data_gb, 3), 'change_log_gb': round(log_gb, 3), 'premissa': note})
    for sc in SC:
        y = Y[sc]; snap = SCH * y
        # P10.1 escolas
        add('P10.1', 'exec_edu_school + snapshot + name + identity', 'db', sc, snap + 240_000 + 350_000 + 300_000, 130, 0, f'{y} edições × ~215 mil escolas; 130 B/linha com índices')
        add('P10.1', 'RAW Censo Escolar (ZIPs)', 'raw', sc, 0, 0, {'conservador': 0.30, 'provavel': 1.01, 'pessimista': 1.53}[sc], '2017–2025 | 2007–2025 | 1995–2025 (ZIPs medidos por HEAD)')
        add('P10.1', 'staging TSV (whitelist) + temporários', 'stg', sc, 0, 0, {'conservador': 0.3, 'provavel': 0.6, 'pessimista': 1.2}[sc], '14 MB/ano compactado + 2× o maior arquivo em fluxo')
        # P10.2 matrículas
        add('P10.2', 'exec_edu_school_offer_year', 'db', sc, snap, 160, 0, '≈20 colunas inteiras + PK')
        ind2 = {'conservador': 20 * MUN * 9, 'provavel': 30 * MUN * 19, 'pessimista': 45 * MUN * 19}[sc]
        add('P10.2', 'exec_ind_value (município/UF/Brasil)', 'db', sc, ind2, 170, 0, '20–45 indicadores × 5.598 entes × anos')
        add('P10.2', 'RAW Sinopses (reconciliação)', 'raw', sc, 0, 0, {'conservador': 0.23, 'provavel': 0.23, 'pessimista': 2.9}[sc], 'Sinopse 2025 = 232 MB; todas as edições ≈ 2,9 GB (extrapolação)')
        # P10.3 infra e docentes
        add('P10.3', 'exec_edu_school_infra_year', 'db', sc, snap, 120, 0, '≈25 colunas smallint + PK')
        ind3 = {'conservador': 30 * MUN * 9, 'provavel': 45 * MUN * 19, 'pessimista': 70 * MUN * 19}[sc]
        add('P10.3', 'exec_ind_value (infra/docentes)', 'db', sc, ind3, 170, 0, '30–70 indicadores × 5.598 entes × anos')
        add('P10.3', 'RAW INEP Indicadores (docentes, ATU, HAD, TDI, rendimento, ICG…)', 'raw', sc, 0, 0, {'conservador': 0.51, 'provavel': 3.39, 'pessimista': 6.67}[sc], '2025 | 2019+ | todos os anos (HEAD de 494 arquivos)')
        # P10.4 aprendizagem
        sch_ind = {'conservador': 5_500_000, 'provavel': 18_400_000, 'pessimista': 80_000_000}[sc]
        add('P10.4', 'exec_edu_school_indicator (Ideb/N/P + indicadores INEP por escola)', 'db', sc, sch_ind, 78, 0, 'cons.: só Ideb; prov.: Ideb + 6 indicadores 2021–25; pess.: 9 indicadores 2013–25')
        ind4 = {'conservador': 60 * MUN * 11, 'provavel': 100 * MUN * 15, 'pessimista': 150 * MUN * 19}[sc]
        add('P10.4', 'exec_ind_value (Ideb/Saeb/rendimento territoriais)', 'db', sc, ind4, 170, 0, '')
        add('P10.4', 'RAW Ideb 2025 + Saeb 2025', 'raw', sc, 0, 0, 0.30 if sc != 'pessimista' else 0.60, 'Ideb 2025 ≈ 270 MB + Saeb 24 MB (+ edições antigas no pessimista)')
        # P10.5 finanças
        fin = {'conservador': 800_000, 'provavel': 1_300_000, 'pessimista': 3_300_000}[sc]
        add('P10.5', 'exec_fin_fact (subfunções 12.xxx)', 'db', sc, fin, 102, 0, '5.570 entes × 12 anos × subfunções presentes × 5 colunas')
        siope = {'conservador': 3_000_000, 'provavel': 6_000_000, 'pessimista': 31_000_000}[sc]
        add('P10.5', 'exec_edu_siope_* (sem Remuneração)', 'db', sc, siope, 60, 0, 'prov.: Dados Gerais + Função + Indicadores + Info. Complementares 2017–2026; pess. inclui Receita')
        add('P10.5', 'exec_ind_value (finanças)', 'db', sc, 40 * MUN * 12, 170, 0, '40 indicadores × entes × 12 anos')
        add('P10.5', 'RAW SIOPE (JSONL gz)', 'raw', sc, 0, 0, {'conservador': 0.1, 'provavel': 0.2, 'pessimista': 1.5}[sc], 'prov.: 1,6 GB JSON ≈ 0,16 GB gz; pess.: com Receita (~8 GB JSON ≈ 1,5 GB gz)')
        add('P10.5', 'RAW Siconfi', 'raw', sc, 0, 0, 0.0, 'reuso do RAW existente (260 MB), sem download')
        # P10.6 programas
        tr = {'conservador': 3_000_000, 'provavel': 6_000_000, 'pessimista': 10_000_000}[sc]
        add('P10.6', 'exec_edu_transfer (Portal, função 12)', 'db', sc, tr, 80, 0, '≈ 62 mil linhas/mês em 2025 × 153 meses (anos antigos menores)')
        pd = {'conservador': 1_000_000, 'provavel': 3_300_000, 'pessimista': 10_000_000}[sc]
        add('P10.6', 'exec_edu_pdde + uex', 'db', sc, pd, 70, 0, 'escolas × programas × anos (PDDE Info)')
        add('P10.6', 'RAW Portal Transferências + PDDE Info', 'raw', sc, 0, 0, {'conservador': 0.3, 'provavel': 1.5, 'pessimista': 2.5}[sc], 'Portal 514 MB (2014–2026) + PDDE por município/UF')
        # P10.7 contratos e obras
        add('P10.7', 'exec_fin_contract (+Educação) + class', 'db', sc, {'conservador': 290_000, 'provavel': 613_000, 'pessimista': 1_000_000}[sc], 235, 0, 'núcleo 286.736 (+ superior 326.461 no provável)')
        add('P10.7', 'exec_edu_work + RAW Obrasgov', 'db', sc, 30_000, 120, 0.1, '')
        add('P10.7', 'RAW PNCP incremental', 'raw', sc, 0, 0, {'conservador': 0.1, 'provavel': 0.4, 'pessimista': 0.8}[sc], '≈ 31 MB/mês')
        # P10.8 superior
        sup = {'conservador': 3_400_000, 'provavel': 6_700_000, 'pessimista': 20_000_000}[sc]
        add('P10.8', 'exec_edu_course_offer_year + ies', 'db', sc, sup, 120, 0, '672 mil linhas/ano × 5 | 10 | 30 anos')
        add('P10.8', 'RAW Censo Superior', 'raw', sc, 0, 0, {'conservador': 0.5, 'provavel': 0.75, 'pessimista': 1.2}[sc], '30 ZIPs = 750 MB (+ sinopses)')
    return out

r = rows()
with open(sys.argv[1], 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(r[0].keys())); w.writeheader(); w.writerows(r)
summ = {}
for sc in SC:
    sel = [x for x in r if x['cenario'] == sc]
    waves = {}
    for x in sel:
        d = waves.setdefault(x['onda'], {'raw_gb': 0, 'banco_gb': 0, 'change_log_gb': 0})
        if x['tipo'] != 'stg': d['raw_gb'] += x['raw_gb']      # staging é temporário: não entra no total de RAW
        d['banco_gb'] += x['banco_gb']; d['change_log_gb'] += x['change_log_gb']
    tot_db = sum(d['banco_gb'] + d['change_log_gb'] for d in waves.values()); tot_raw = sum(d['raw_gb'] for d in waves.values())
    stg_peak = max(x['raw_gb'] for x in sel if x['tipo'] == 'stg')
    summ[sc] = {'staging_pico_gb': round(stg_peak, 2), 'ondas': {k: {kk: round(vv, 2) for kk, vv in v.items()} for k, v in waves.items()}, 'banco_total_gb': round(tot_db, 2), 'raw_total_gb': round(tot_raw, 2),
                'wal_pico_gb': round(min(max(tot_db * 0.15, 2.0), 12.0), 1), 'backups_gb': round(0.5 * 8 + tot_db * 0.25, 1)}
json.dump(summ, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for sc, v in summ.items(): print(sc, 'banco+log', v['banco_total_gb'], 'GB | RAW', v['raw_total_gb'], 'GB | WAL pico', v['wal_pico_gb'], '| backups', v['backups_gb'])
