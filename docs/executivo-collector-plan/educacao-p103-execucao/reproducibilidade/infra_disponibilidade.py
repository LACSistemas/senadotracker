"""P10.3 (G2) — matriz real de disponibilidade das variáveis de infraestrutura: variável × edição, a partir da distribuição de valores medida em cada ZIP do Censo
(evidencias/_infra_dist_AAAA.json, gerado por scripts/exec/censo_infra_extract.py) contra o intervalo de vigência declarado no catálogo (evidencias/catalogo_infra.json).
Estados por célula: M = coluna ausente do cabeçalho; E = coluna presente e 100% em branco; Z = presente, sem nenhum valor positivo (só zeros);
V = presente com valores positivos e (para flags) zeros; ou 1 = só valores positivos.
O ZIP histórico do INEP preenche com 0/branco as colunas que ainda não existiam: por isso 'Z' e 'E' em edições anteriores à vigência são esperados e NÃO significam "não".
Uso: python -I -X utf8 infra_disponibilidade.py <pasta_evidencias> <saida.csv>"""
import csv, json, sys, os

ev, out = sys.argv[1], sys.argv[2]
cat = json.load(open(os.path.join(ev, 'catalogo_infra.json'), encoding='utf-8'))
years = list(range(2007, 2026))
dist = {y: json.load(open(os.path.join(ev, f'_infra_dist_{y}.json'), encoding='utf-8')) for y in years}


def state(y, src):
    d = dist[y]['dist'].get(src)
    if d is None: return 'M'
    tot = d['0'] + d['1'] + d['empty'] + d['other']
    if d['empty'] == tot: return 'E'
    if d['1'] == 0: return 'Z'
    if d['0'] == 0 and d['empty'] == 0: return 'U'      # só valores positivos
    return 'V'


rows = []; mism = []
for x in cat:
    st = {y: state(y, x['src']) for y in years}
    obs_first = next((y for y in years if st[y] in ('V', 'U')), None)
    obs_last = next((y for y in reversed(years) if st[y] in ('V', 'U')), None)
    outside_ok = all(st[y] in ('M', 'E', 'Z') for y in years if y < x['from'] or y > x['to'])
    inside_dead = [y for y in years if x['from'] <= y <= x['to'] and st[y] in ('M', 'E', 'Z')]
    # tolerância: dentro da vigência pode haver ano em que a variável é toda "não" por ser rara; só alerta quando é E/M
    inside_empty = [y for y in years if x['from'] <= y <= x['to'] and st[y] in ('M', 'E')]
    flag = 'OK'
    if not outside_ok: flag = 'VALOR_FORA_DA_VIGENCIA'
    elif inside_empty: flag = 'VAZIA_NA_VIGENCIA'
    elif obs_first is not None and obs_first > x['from']: flag = 'COMECA_DEPOIS_DO_CATALOGO'
    if flag != 'OK': mism.append((x['code'], flag, x['from'], x['to'], obs_first, obs_last, inside_empty))
    rows.append([x['code'], x['src'], x['kind'], x['family'], x['label'], x['from'], x['to'], x['comparability'], obs_first or '', obs_last or '', flag] + [st[y] for y in years] + [x.get('note', '')])
with open(out, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';'); w.writerow(['codigo', 'coluna_oficial', 'tipo', 'familia', 'nome', 'vigencia_de', 'vigencia_ate', 'comparabilidade', 'primeiro_ano_com_valor', 'ultimo_ano_com_valor', 'conferencia'] + [str(y) for y in years] + ['nota'])
    w.writerows(rows)
print(json.dumps({'variaveis': len(rows), 'divergencias': [list(m) for m in mism]}, ensure_ascii=False))
