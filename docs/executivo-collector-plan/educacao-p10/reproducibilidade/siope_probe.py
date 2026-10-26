"""P10/G8 — provas pequenas e somente leitura do SIOPE (FNDE, Olinda OData). Uso: python -I -X utf8 siope_probe.py <saida.json>
Registra status, tempo, linhas, bytes e campos-chave. NÃO persiste nada além do JSON de prova; campos pessoais (Remuneracao_Siope.NO_PROFISSIONAL,
Dados_Responsaveis) não são solicitados."""
import json, sys, time, urllib.parse, urllib.request, collections
B = 'https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata'
UA = 'civica-exec/1.0 (pesquisa de dados abertos)'
out = []

def call(fn, ano, per, uf, extra='', label=None):
    q = f"{B}/{fn}(Ano_Consulta={ano},Num_Peri={per},Sig_UF='{uf}')?$format=json{extra}"
    t0 = time.time(); status = None; body = b''; err = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(q, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=180) as r: status = r.status; body = r.read(); break
        except urllib.error.HTTPError as e: status = e.code; body = e.read()[:400]; err = f'HTTP {e.code}'; break
        except Exception as e: err = repr(e)[:160]; time.sleep(3 * attempt)
    rec = {'funcao': fn, 'ano': ano, 'periodo': per, 'uf': uf, 'extra': extra, 'status': status, 'segundos': round(time.time() - t0, 2), 'bytes': len(body), 'erro': err, 'label': label}
    try:
        j = json.loads(body); rows = j.get('value', []); rec['linhas'] = len(rows); rec['proxima_pagina'] = '@odata.nextLink' in j
        rec['entes'] = len({(r.get('COD_UF'), r.get('COD_MUNI')) for r in rows})
        rec['_rows'] = rows
    except Exception: rec['linhas'] = None; rec['trecho'] = body[:200].decode('latin-1', 'ignore')
    out.append(rec); return rec

def slim(rec):
    r = {k: v for k, v in rec.items() if k != '_rows'}; print(json.dumps(r, ensure_ascii=False)); return r

# 1) Dados gerais: ES 2024 (período 6 = anual), exercício antigo, último
for (ano, per) in ((2024, 6), (2014, 6), (2020, 6), (2025, 6), (2025, 3), (2026, 1), (2026, 2)):
    slim(call('Dados_Gerais_Siope', ano, per, 'ES', label='cobertura de exercício/período'))
# 2) Vitória 2024
dg = call('Dados_Gerais_Siope', 2024, 6, 'ES', label='Vitória')
vit = [r for r in dg.get('_rows', []) if str(r.get('COD_MUNI')) == '320530']
dg['vitoria'] = [{k: r.get(k) for k in ('NUM_ANO', 'NUM_PERI', 'COD_MUNI', 'NOM_MUNI', 'NUM_POPU', 'VAL_RECE_REAL', 'VAL_DESP_DOTA_ATUA', 'VAL_DESP_EMPE', 'VAL_DESP_LIQU', 'VAL_DESP_PAGA', 'IDN_DECL_RETI', 'IDN_TIPO_DECL', 'DAT_DECL')} for r in vit]
slim(dg)
# 3) Despesas por função educação e indicadores — ES 2024
for fn in ('Despesas_Funcao_Educacao_Siope', 'Indicadores_Siope', 'Despesas_Siope', 'Receita_Siope', 'Informacoes_Complementares_Siope'):
    r = call(fn, 2024, 6, 'ES', label='ES 2024')
    rows = r.get('_rows', [])
    if fn == 'Indicadores_Siope':
        r['amostra_vitoria'] = [{k: x.get(k) for k in ('COD_INDI', 'NOM_INDI', 'NOM_GRUP_INDI', 'VAL_INDI')} for x in rows if str(x.get('COD_MUNI')) == '320530'][:40]
    elif fn == 'Despesas_Funcao_Educacao_Siope':
        r['amostra_vitoria'] = [{k: x.get(k) for k in ('NUM_ORDE', 'DES_SUBF', 'VAL_DESP_EMPE', 'VAL_DESP_LIQU', 'VAL_DESP_PAGA')} for x in rows if str(x.get('COD_MUNI')) == '320530']
    elif fn == 'Despesas_Siope':
        r['amostra_vitoria_n'] = sum(1 for x in rows if str(x.get('COD_MUNI')) == '320530')
        r['campos'] = sorted(rows[0].keys()) if rows else []
    slim(r)
# 4) UF grande e município pequeno
sp = call('Dados_Gerais_Siope', 2024, 6, 'SP', label='São Paulo'); slim(sp)
sp['sp_capital'] = [{k: r.get(k) for k in ('COD_MUNI', 'NOM_MUNI', 'VAL_DESP_PAGA', 'VAL_DESP_EMPE')} for r in sp.get('_rows', []) if str(r.get('COD_MUNI')) == '355030']
small = [r for r in dg.get('_rows', []) if str(r.get('COD_MUNI')) == '320035']   # Alto Rio Novo (IBGE6 320035)
dg['alto_rio_novo'] = [{k: r.get(k) for k in ('COD_MUNI', 'NOM_MUNI', 'VAL_DESP_PAGA', 'VAL_DESP_EMPE', 'NUM_POPU')} for r in small]
# 5) $filter por município e paginação ($top/$skip)
slim(call('Dados_Gerais_Siope', 2024, 6, 'ES', "&$filter=COD_MUNI eq 320530".replace(' ', '%20'), label='$filter COD_MUNI'))
slim(call('Dados_Gerais_Siope', 2024, 6, 'ES', '&$top=5&$skip=5', label='$top/$skip'))
slim(call('Despesas_Siope', 2024, 6, 'ES', "&$filter=COD_MUNI eq 320530".replace(' ', '%20'), label='Despesas $filter município'))
# 6) Remuneração: SÓ metadados (não solicitar linhas; tem nome de profissional) — registramos o aviso
out.append({'funcao': 'Remuneracao_Siope', 'nota': 'NÃO CONSULTADA de propósito: o esquema traz NO_PROFISSIONAL (nome), CO_ESCOLA e salário individual. Fora do escopo de ingestão (privacidade).'})
for r in out: r.pop('_rows', None)
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
