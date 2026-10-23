# -*- coding: utf-8 -*-
import json, csv, os, sys, collections, re
sys.path.insert(0, os.path.dirname(__file__))
from build_sources import SOURCES, OK, CAV, VAL, LOC, DISC, NOTF
from build_tests import TESTS
from build_indicators import IND

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
J = lambda p: json.load(open(os.path.join(os.path.dirname(__file__), p), encoding='utf-8'))
mat = J('uf_matrix_vde_sim.json'); sis = J('sisdepen_uf.json'); sen = J('senatran_uf.json'); est = J('estadic_uf.json'); mgm = J('munic_gm_uf.json')
fb = J('fbsp_tabela2.json'); ren = J('nat/renaest_resumo.json'); det = {o['tag']: o for o in J('probe_detran.json')}
DMAP = {}
UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split()
NOMES = dict(AC='Acre', AL='Alagoas', AM='Amazonas', AP='Amapá', BA='Bahia', CE='Ceará', DF='Distrito Federal', ES='Espírito Santo', GO='Goiás', MA='Maranhão', MG='Minas Gerais', MS='Mato Grosso do Sul', MT='Mato Grosso', PA='Pará', PB='Paraíba', PE='Pernambuco', PI='Piauí', PR='Paraná', RJ='Rio de Janeiro', RN='Rio Grande do Norte', RO='Rondônia', RR='Roraima', RS='Rio Grande do Sul', SC='Santa Catarina', SE='Sergipe', SP='São Paulo', TO='Tocantins')

# ---------- fontes.json
status_count = collections.Counter(s['estado_operacional'] for s in SOURCES)
tested = [s for s in SOURCES if s['testes']]
json.dump({'gerado_em': '2026-10-21', 'total_fontes': len(SOURCES), 'por_estado': dict(status_count), 'fontes': SOURCES}, open(f'{OUT}/investigacao_executivo_p9_fontes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'gerado_em': '2026-10-21', 'total_testes': len(TESTS), 'nota': 'Nenhum dado pessoal foi gravado: leituras amostrais, agregações em memória e arquivos temporários fora do repositório (data/p9, ignorado pelo git).', 'testes': TESTS}, open(f'{OUT}/investigacao_executivo_p9_testes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---------- indicadores.csv
cols = ['id', 'eixo', 'indicador', 'definicao', 'formula', 'unidade', 'fonte', 'campos', 'brasil', 'uf', 'municipio', 'unidade_local', 'historico', 'cobertura', 'comparabilidade', 'status', 'risco', 'proximo_gate']
with open(f'{OUT}/investigacao_executivo_p9_indicadores.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for r in IND: w.writerow(r)
ind_status = collections.Counter(r['status'] for r in IND)

# ---------- cobertura_ufs.csv
STATE = {'RJ': ('S20', OK, 'município IBGE mensal 2014-01..2026-09 (62 colunas) + CISP 2003+'), 'MG': ('S22', CAV, 'município (IBGE 6 díg.) mensal 2012..2026; truncar zero futuro'),
         'RS': ('S23', CAV, 'município (nome) mensal 2011..2026-09 (XLSX) + ZIP de ocorrências'), 'ES': ('S24', CAV, 'ocorrência→município×tipo×mês 2018-01..2026-09 (patrimônio, estelionato, informáticos)'),
         'SP': ('S25', LOC, 'BO com município e coordenadas 2022..2026 (XLSX 200 MB/ano)'), 'CE': ('S26', CAV, 'CVLI/CVP/etc. por município (XLSX mensal 2026)'), 'PE': ('S27', CAV, 'CVLI por município 2004-01..2026-09'),
         'AL': ('S28', CAV, 'CVLI por cidade 2012-01..2026-08'), 'BA': ('S29', VAL, 'XLSX de mortes violentas 2023, anuário e microdados CVLI (a validar série mensal)'), 'DF': ('S30', CAV, 'Região Administrativa e RISP 2014..2026 (XLSX)'),
         'GO': ('S31', VAL, 'PDF anual 2018..2025; CKAN (CBM, Delegacia Virtual, Detran)'), 'PR': ('S32', VAL, 'PDF (drogas por município; estatísticas 2007..2025) e BI'), 'PA': ('S33', VAL, 'dashboard e exportação em codec.segup.pa.gov.br (não testada)'),
         'PI': ('S34', VAL, 'DataSSP (painel, trimestral, feminicídios): sem arquivo localizado'), 'MT': ('S35', VAL, 'RISP em abas incorporadas; anuários'), 'MS': ('S36', VAL, 'portal recusou conexão a partir deste ponto de rede'),
         'TO': ('S37', VAL, 'PDF por ano 2019..2021'), 'AM': ('S37', VAL, 'Anuário 2026 em PDF'), 'MA': ('S37', VAL, 'apenas Grande São Luís')}
for u in ('SC', 'SE', 'AC', 'AP', 'RN', 'PB', 'RO', 'RR'): STATE[u] = ('S38', VAL, 'nenhum arquivo estruturado localizado nas páginas testadas (não prova inexistência)')
lack_renaest = {'AP', 'MA', 'PA', 'RN'}
rows = []
def R(uf, fam, src, status, ev, gran, hist): rows.append(dict(uf=uf, familia=fam, fonte=src, estado=status, evidencia=ev, granularidade=gran, periodo=hist))
for u in UFS:
    v = mat['vde_2025'][u]; s = mat['sim_prelim_2025'][u]
    R(u, 'crime_nacional_vde', 'S01', CAV, f"2025: homicídio doloso {int(v['homicidio_doloso'])} vítimas; latrocínio {int(v['latrocinio'])}; lesão seguida de morte {int(v['lesao_morte'])}; mortes a esclarecer {int(v['esclarecer'])}; {v['municipios_com_homicidio']} municípios com ≥ 1 vítima; mortes por intervenção {int(v['interv_estado'])}", 'UF (todos os eventos) + município por nome (11 eventos)', '2015-01..2026-09')
    R(u, 'mortes_violentas_sim', 'S04', OK, f"2025 prelim: agressões X85–Y09 {s['agressoes']}; intervenção Y35 {s['interv_legal']}; causa indeterminada Y10–Y34 {s['indeterminada']}; {s['mun_com_agressao']} municípios com ≥ 1 óbito", 'município (código IBGE) por residência e ocorrência', '2013..2024 + 2025 prelim (RAW local)')
    src, st, ev = STATE[u]
    R(u, 'crime_estadual', src, st, ev, 'município' if st in (OK, CAV) else ('RA' if u == 'DF' else 'a validar'), 'ver fonte')
    pmfb = fb.get(u); pm = (pmfb[0] if pmfb and len(pmfb) == 11 and u not in ('SP', 'RS') else 'extração manual necessária (linha da tabela 2 não separável)')
    e = est.get(u, {})
    R(u, 'efetivo_uf', 'S06+S07', CAV, f"FBSP 2025 PM {pm}; ESTADIC 2022: PM {e.get('pm')} e PC {e.get('pc')}" + ('; RO não informou ao IBGE' if u == 'RO' else ''), 'UF (sem município nem unidade)', '2022 e 2025')
    g = mgm.get(u, {})
    R(u, 'guarda_municipal', 'S08', OK, f"{g.get('com_guarda')} de {g.get('municipios')} municípios com guarda; efetivo {g.get('efetivo_gm')} (31/12/2022)", 'município (IBGE)', '2023')
    R(u, 'unidades_prisionais', 'S50', CAV, f"{sis[u]['estab']} estabelecimentos no 19º ciclo (2025-2S)", 'estabelecimento (Código IBGE em 99,8 %)', '2016-2S..2025-2S')
    R(u, 'frota', 'S70', CAV, f"{sen[u]['municipios']} municípios; {sen[u]['frota']} veículos (set/2026)", 'município (nome)', '2026-09')
    if u not in ren['uf_2024']:
        R(u, 'sinistros_renaest', 'S72', VAL, 'sem relato no RENAEST em 2024 (nenhuma linha com uf_acidente = %s)' % u, 'município (IBGE)', '2018-01..2026-05')
    else:
        r = ren['uf_2024'][u]
        R(u, 'sinistros_renaest', 'S72', CAV, f"2024: {r['acid']} sinistros; {r['obit']} óbitos; {r['mun']} municípios com registro" + ('; apenas 1 município (DF) — não comparável' if u == 'DF' else '') + ('; só sinistros fatais reportados' if u == 'RS' else ''), 'município (IBGE)', '2018-01..2026-05')
    R(u, 'sinistros_prf', 'S43', CAV, 'datatran 2026 contém a UF (27 UFs; 48.712 ocorrências até 31/08/2026)', 'município (nome) + BR/km + delegacia/UOP', '2007..2026')
    d = det.get('D-' + u, {})
    d = dict(d, title=(d.get('title', '') or '').encode('latin1', 'ignore').decode('utf-8', 'ignore') if False else (d.get('title', '') or ''))
    R(u, 'detran', 'S74', 'LOCAL_INTEGRATION_REQUIRED' if d.get('status') == '200' else VAL, f"portal HTTP {d.get('status')} ({d.get('title', '')[:50]})", 'UF', 'n/a')
    R(u, 'financas_seguranca', 'S80', OK if u == 'ES' else CAV, 'RREO anexo 02 (função 06) lido para ES 2024: R$ 2,54 bi empenhados; demais UFs: API acessível, não consultadas' if u == 'ES' else 'API Siconfi acessível (testada para ES e Vitória); consulta por ente não executada nesta fase', 'ente×exercício×bimestre', '2015..2026')
    R(u, 'organizacoes_criminosas', 'S60', NOTF, 'sem dado estruturado público por UF (mapa oficial é sigiloso; só versão resumida nacional)', 'n/a', '2022..2024')
with open(f'{OUT}/investigacao_executivo_p9_cobertura_ufs.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['uf', 'familia', 'fonte', 'estado', 'evidencia', 'granularidade', 'periodo']); w.writeheader(); [w.writerow(r) for r in rows]

# ---------- armazenamento.csv
B_VAL, B_LOG = 196, 227   # bytes/linha medidos em civica_exec: exec_ind_value 796.958.720 B / 4.071.624 linhas; exec_change_log 3.428.687.872 B / 15.086.184 linhas
comp = [
 # cenário, componente, linhas, B/linha, fórmula, premissas
 ('A', 'SIM agregado (agressão, indeterminada, intervenção, trânsito, suicídio) por município×ano', 5570 * 13 * 5, B_VAL, '5.570 municípios × 13 anos × 5 medidas', 'tabela de indicadores existente (exec_ind_value)'),
 ('A', 'VDE não-zero (município e UF), 2015–2026', 103377 * 12, B_VAL, '≈ 103 mil linhas não-zero/ano (12,4 % de 832 mil) × 12 anos', 'zeros não persistidos; marcador de universo por UF×mês'),
 ('A', 'RJ ISP município/mês', 14076 * 50 * 0.4, B_VAL, '14.076 linhas × ~50 medidas × 40 % não-zero', 'fatos esparsos'),
 ('A', 'MG crimes violentos e patrimônio', 399204 / 3 * 15 * 0.15, B_VAL, '133 mil linhas/ano × 15 anos × 15 % não-zero', 'zero-fill descartado'),
 ('A', 'ES SESP ocorrências município×tipo×mês', 78 * 10 * 105 * 0.6, B_VAL, '78 × 10 tipos × 105 meses × 60 %', ''),
 ('A', 'RS indicadores município/mês', 497 * 12 * 12 * 15 * 0.25, B_VAL, '497 × 12 medidas × 12 meses × 15 anos × 25 %', ''),
 ('A', 'CE/PE/AL/DF agregados', 200_000, B_VAL, 'estimativa de 200 mil linhas', 'extrapolação sem teste completo'),
 ('A', 'Frota Senatran (total + 6 tipos) município, dezembro/ano + último mês', 5572 * 7 * 14, B_VAL, '5.572 × 7 × 14 pontos', ''),
 ('A', 'RENAEST município×mês (3 medidas)', 2800 * 3 * 100, B_VAL, '2.800 municípios médios × 3 × 100 meses', 'medido: 79 municípios ES em 2024; 854 em MG'),
 ('A', 'PRF município×mês (4 medidas)', 1600 * 4 * 12 * 13, B_VAL, '1.600 municípios × 4 × 12 × 13 anos', 'estimado'),
 ('A', 'Siconfi função 06 (4 subfunções × 3 colunas × 10 exercícios × 5.600 entes)', 5600 * 4 * 3 * 10, 70, '672 mil linhas em exec_fin_fact (BIGINT valor; 70 B/linha medida do desenho)', 'compartilhado com Saúde/Educação'),
 ('A', 'Efetivo, guarda municipal, delegacias (MUNIC/ESTADIC/FBSP)', 12_000, B_VAL, '27 UF × 20 + 1.322 × 5 + 5.570 × 1', ''),
 ('B', 'RJ por CISP/delegacia (38.410 linhas × 50 medidas × 40 %)', 38410 * 50 * 0.4, B_VAL, '', ''),
 ('B', 'Unidades policiais e prisionais (cadastros) + SISDEPEN largo (1.532 × 19 ciclos × ~60 colunas)', 1532 * 19, 600, '29 mil linhas largas de ~600 B', 'tabela especializada'),
 ('B', 'SP por delegacia/seccional (1.200 × 60 rubricas × 57 meses × 25 %)', 1200 * 60 * 57 * 0.25, B_VAL, '', ''),
 ('B', 'Estrutura Detran e fluxos de infrações por UF/mês', 27 * 60 * 20, B_VAL, '', ''),
 ('C', 'SP município×rubrica×mês completo', 645 * 60 * 57 * 0.3, B_VAL, '', 'inclui rubricas raras'),
 ('C', 'RENAEST por tipo de acidente, condições e via', 3_500_000, B_VAL, '3,5 milhões', 'estimativa'),
 ('C', 'PRF por BR×km×mês', 2_000_000, B_VAL, '', 'estimativa'),
 ('C', 'Contratos e recursos relacionáveis (P3/P4) filtrados por órgão de segurança', 1_000_000, 150, '', 'estimativa'),
 ('C', 'Outras UFs com microdados agregados (CE, PE, AL, BA, GO…) em nível de bairro/AIS', 1_500_000, B_VAL, '', 'bairro apenas se política de privacidade permitir'),
]
raw = [
 ('A', 'VDE (12 anos) + 12 versões do ano corrente', 0.29 + 0.56), ('A', 'SP SPDados 2022–2026', 0.94 + 1.5), ('A', 'RENAEST (3 snapshots iniciais + 4/ano)', 3 * 0.52 + 2.1),
 ('A', 'MG CSV (4 arquivos × versões mensais)', 0.094 + 1.1), ('A', 'ES S3 (3 arquivos, versões mensais)', 0.15 + 1.8), ('A', 'RS XLSX + ZIPs', 0.3), ('A', 'SISDEPEN 21 ciclos (CSV+XLSX)', 0.4),
 ('A', 'Senatran frota/infrações mensais', 0.4), ('A', 'PRF 13 anos', 0.04), ('A', 'RJ ISP + DF + CE + PE + AL', 0.15), ('A', 'Portal da Transparência SIAPE (mensal, 83 MB)', 1.0),
 ('A', 'Siconfi função 06 (RREO/RGF por UF×ano; estimativa, reaproveita coleta de Saúde)', 1.0),
]
growth_rows = []
sums = collections.defaultdict(float); rowsum = collections.defaultdict(float)
with open(f'{OUT}/investigacao_executivo_p9_armazenamento.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['cenario', 'tipo', 'componente', 'linhas', 'bytes_por_linha', 'bytes_dados_indices', 'formula', 'premissas'])
    for sc, name, rws, bpl, formula, prem in comp:
        by = rws * bpl; sums[sc] += by; rowsum[sc] += rws
        w.writerow([sc, 'postgres', name, int(rws), bpl, int(by), formula, prem])
    for sc in ('A', 'B', 'C'):
        cum_rows = sum(rowsum[x] for x in 'ABC' if x <= sc)
        cum = sum(sums[x] for x in 'ABC' if x <= sc)
        w.writerow([sc, 'postgres', f'TOTAL acumulado cenário {sc} (dados+índices)', int(cum_rows), '', int(cum), 'soma dos componentes', 'sem exec_change_log'])
        w.writerow([sc, 'postgres', f'exec_change_log do carregamento inicial (retenção completa)', int(cum_rows), B_LOG, int(cum_rows * B_LOG), 'linhas × 227 B (medido: 3,43 GB / 15,09 M)', 'a retenção de 12 meses planejada limita o crescimento; ainda é o maior consumidor do schema (78 %)'])
        w.writerow([sc, 'postgres', f'exec_ind_latest + exec_story + manifestos', 0, '', int(cum * 0.08), '8 % do cenário', 'medido: ind_latest 61 MB / 4,07 M linhas de ind_value = 1,5 %; folga para stories e proveniência'])
    for sc, name, gb in raw: w.writerow([sc, 'raw_ssd', name, '', '', int(gb * 1024 ** 3), 'tamanhos medidos nos testes; Siconfi e versões futuras são estimativas', 'versões preservadas por hash'])
    w.writerow(['A-C', 'staging', 'Decodificação em streaming (RENAEST, SPDados, SIAPE)', '', '', 2 * 1024 ** 3, 'sem extração em disco; pandas/zip stream; pico por arquivo ≤ 2 GiB', 'DBC do SIM já tem staging do P1'])
    w.writerow(['A-C', 'wal', 'WAL do carregamento inicial', '', '', int(1.5 * (sums['A'] + sums['B'] + sums['C']) * 0.7), '≈ 1× a 2× o volume de linhas escritas (max_wal_size = 1 GiB medido; premissa de projeção, não medida)', 'não exige mudar parâmetros; monitorar'])
    w.writerow(['A-C', 'backup', 'pg_dump -Fc do acréscimo (premissa: compressão 4×)', '', '', int((sums['A'] + sums['B'] + sums['C']) / 4), 'premissa; o banco hoje ocupa 20,4 GiB medidos', 'no SSD'])
    w.writerow(['crescimento', 'postgres', 'Atualização mensal (VDE + MG + ES + RJ + RENAEST + Senatran + PRF)', 150_000, B_VAL, int(150_000 * B_VAL * 12), '≈ 150 mil linhas/mês × 12', 'sem log: 0,35 GiB/ano; com log: 0,8 GiB/ano'])
    w.writerow(['crescimento', 'raw_ssd', 'Versões mensais preservadas', '', '', int(7.5 * 1024 ** 3), 'SP, RENAEST, MG, ES, VDE', '≈ 7,5 GiB/ano'])
GB = lambda b: round(b / 1024 ** 3, 2)
storage = {sc: {'linhas': int(sum(rowsum[x] for x in 'ABC' if x <= sc)), 'pg_gib_sem_log': GB(sum(sums[x] for x in 'ABC' if x <= sc)),
                'pg_gib_com_log': GB(sum(sums[x] + rowsum[x] * B_LOG for x in 'ABC' if x <= sc))} for sc in 'ABC'}
raw_total = round(sum(g for _, _, g in raw), 1)

# ---------- results.json
fontes_ok = [s for s in SOURCES if s['estado_operacional'] in (OK, CAV)]
results = {
 'gerado_em': '2026-10-21', 'escopo': 'investigação somente leitura; nenhum collector, tabela, migration, frontend ou commit',
 'fontes': {'total': len(SOURCES), 'testadas_com_leitura_real': len([s for s in SOURCES if any(t.startswith('T') for t in s['testes'])]), 'por_estado': dict(status_count),
            'operacionais': len([s for s in SOURCES if s['estado_operacional'] == OK]), 'operacionais_com_ressalva': len([s for s in SOURCES if s['estado_operacional'] == CAV]),
            'a_validar': len([s for s in SOURCES if s['estado_operacional'] == VAL]), 'integracao_local': len([s for s in SOURCES if s['estado_operacional'] == LOC]), 'somente_descoberta': len([s for s in SOURCES if s['estado_operacional'] == DISC]),
            'inviaveis': len([s for s in SOURCES if s['estado_operacional'] == NOTF]), 'bloqueio_externo_provado': 0},
 'testes': {'total': len(TESTS), 'reutilizados_de_investigacoes_anteriores': len([t for t in TESTS if t['id'].startswith('P')])},
 'indicadores': {'candidatos': len(IND), 'por_status': dict(ind_status), 'por_eixo': dict(collections.Counter(r['eixo'][0] for r in IND)), 'prontos_para_contrato': ind_status[OK], 'prontos_com_ressalvas': ind_status[CAV], 'dependem_de_integracao_estadual_ou_local': ind_status[LOC] + ind_status[VAL]},
 'cobertura': {'municipal_nacional_comprovada': {'homicidio_sim': '5.570 municípios (código IBGE) — 27 UFs, 2013–2024 + 2025 prelim', 'homicidio_vde': '5.564 de 5.570 por nome (99,9 %) — 27 UFs', 'guarda_municipal': '5.570 municípios (MUNIC 2023)', 'frota': '5.529 de 5.572 por nome (99,2 %)'},
               'estadual_municipal_operacional': ['RJ (IBGE nativo)', 'MG (IBGE 6 díg.)', 'RS', 'ES', 'CE', 'PE', 'AL', 'SP (BO)', 'DF (RA)'], 'ufs_sem_fonte_estadual_estruturada_localizada': ['SC', 'SE', 'AC', 'AP', 'RN', 'PB', 'RO', 'RR'],
               'roubo_furto_municipal': 'não nacional: só RJ (62 colunas), MG, ES, RS, SP; nacional por UF no VDE (veículos, carga, instituição financeira)'},
 'reuso': {'SIM_RAW_local': '324 definitivos + 27 preliminares; zero download', 'exec_entity': '5.571 municípios + UF', 'exec_story/exec_ind_*/exec_publication/exec_raw_manifest': 'reutilizáveis', 'exec_fin_fact': 'reutilizável (função 06 do Siconfi)', 'collector_financeiro': 'único para todos os domínios'},
 'armazenamento': {'postgres': storage, 'raw_ssd_gib_carga_inicial_e_primeiro_ano': raw_total, 'bytes_por_linha_medidos': {'exec_ind_value': B_VAL, 'exec_change_log': B_LOG}, 'banco_hoje_gib': 20.4},
 'riscos': ['dados pessoais em BO/microdados (SP, RS, ES, CE, PE, AL): agregar sem persistir linha', 'zero-fill de meses futuros (MG)', 'crosswalk por nome (VDE, Senatran, RS, ES, PRF)', 'cobertura desigual do RENAEST entre UFs', 'exec_change_log domina o tamanho do schema', 'denominador populacional ausente em 2022–2023', 'organizações criminosas: sem fonte estruturada e risco de exposição'],
 'gates': {},
}
json.dump(results, open(f'{OUT}/results.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({k: results[k] for k in ('fontes', 'indicadores', 'armazenamento')}, ensure_ascii=False)[:2500])
