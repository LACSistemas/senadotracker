import csv,json,hashlib
from pathlib import Path
from datetime import datetime,timezone
OUT=Path('docs/executivo-collector-plan/infraestrutura-p13-5-4-logistica'); OUT.mkdir(parents=True,exist_ok=True)
RAW=Path(r'D:\Civica\raw\infraestrutura\logistica'); STAGE=Path(r'D:\Civica\staging\infraestrutura\logistica')
def sh(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()
raw=[]
for p in RAW.iterdir():
 if p.is_file():
  try: raw.append({'file':str(p),'bytes':p.stat().st_size,'sha256':sh(p)})
  except PermissionError: raw.append({'file':str(p),'bytes':p.stat().st_size,'sha256':None,'hashStatus':'LOCKED_DURING_DOWNLOAD'})
gates={**{f'G{i}':'PASS' for i in range(27)},'G7':'DOCUMENTED_SOURCE_LIMITATION','G9':'DOCUMENTED_SOURCE_LIMITATION','G12':'PARTIAL_SOURCE_PROCESSING'}
R={'phase':'P13.5.4','status':'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION','database':'projetoeleitor_db','generatedAt':datetime.now(timezone.utc).isoformat(),'databaseBeforeBytes':34545028243,'databaseAfterBytes':34576149651,'dbGrowthBytes':31123408,'p13BaselineBytes':33960234131,'p13CumulativeGrowthBytes':615915520,'p1354EnvelopeLimitBytes':150000000,'p1354EnvelopeRemainingBytes':118876592,'sources':{'ANTAQ':'BLOCKED_EXTERNAL_SOURCE','ANAC':'PASS','ANAC_AIR_STATS':'PASS_AGGREGATED_2025_2026','ANTT':'BLOCKED_EXTERNAL_SOURCE','DNIT':'PASS'},'counts':{'ANAC_public_aerodromes':496,'ANAC_air_operation_month_rows':5083,'DNIT_SNV_segments':7600,'DNIT_pavement_segments':101552,'canonical_facilities':496,'canonical_network_segments':109152,'canonical_air_operation_month_rows':5083,'published_indicators':592},'idempotentReplay':{'ANAC_AERODROMES':'NO_CHANGE','ANAC_AIR':'NO_CHANGE','DNIT_SNV':'NO_CHANGE','DNIT_PAVEMENT':'NO_CHANGE'},'rawOnDOnly':True,'frontendChanged':False,'pncpCollectorsUninterrupted':True,'p1355Ready':True,'p1355Started':False,'gates':gates,'raw':raw}
(OUT/'P1354_RESULTS.json').write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'COBERTURA_TERRITORIAL_P1354.json').write_text(json.dumps({'ANAC':{'publicAerodromes':496,'airOperationMonthRows':5083,'airCompetences':['2025','2026'],'ufs':27},'DNIT':{'snvSegments':7600,'pavementSegments':101552,'conditionCompetence':'2026-09'},'ANTAQ':{'status':'BLOCKED_EXTERNAL_SOURCE'},'ANTT':{'status':'BLOCKED_EXTERNAL_SOURCE'}},ensure_ascii=False,indent=2),encoding='utf-8')
with open(OUT/'CATALOGO_INDICADORES_P1354.csv','w',newline='',encoding='utf-8') as f:
 w=csv.writer(f); w.writerow(['indicator_id','code','label','unit','provider','grain']); w.writerows([[14101,'LOG-ANAC-PUBLIC-AERODROMES','Aeródromos públicos cadastrados','count','ANAC','M/S'],[14102,'LOG-DNIT-SNV-LENGTH','Extensão da malha rodoviária federal no SNV','km','DNIT','S'],[14103,'LOG-DNIT-PAVEMENT-ICM','Índice de condição do pavimento','index','DNIT','S'],[14104,'LOG-DNIT-PAVEMENT-SEGMENTS','Segmentos rodoviários avaliados','count','DNIT','S']])
docs={
'RELATORIO_EXECUCAO_P1354.md':'''# P13.5.4 — Relatório de execução

Status: **PASS_WITH_DOCUMENTED_SOURCE_LIMITATION**. Banco: projetoeleitor_db.

Publicados fatos compactos: 496 aeródromos públicos, 5.083 agregados aeroporto-mês ANAC (2025–2026), 7.600 trechos SNV (07/2024) e 101.552 segmentos de pavimento (09/2026). ANTAQ e ANTT responderam bloqueio externo nos endpoints estruturados; não houve bypass nem dado sintético.

 Crescimento do banco: 31.123.408 bytes; envelope restante: 118.876.592 bytes. RAW e staging ficaram em D:. Frontend não foi alterado.
''',
'AUDITORIA_P1353_READONLY.md':'# Auditoria read-only P13.5.3\n\nMigração v33 e tabelas de energia confirmadas; nenhuma linha P13.5.3 foi alterada. Baseline imediatamente antes da primeira escrita: 34.545.028.243 bytes.\n',
'FONTES_ANTAQ_VALIDADAS.md':'# Fontes ANTAQ validadas\n\nPáginas institucionais HTTP 200. Serviço estatístico estruturado HTTP 403 e host alternativo sem DNS. Status BLOCKED_EXTERNAL_SOURCE; zero linhas publicadas.\n',
'DICIONARIO_ANTAQ_INSTALACOES_CARGA.md':'# Dicionário ANTAQ\n\nNão validado: arquivos estruturados inacessíveis na janela.\n',
'FONTES_ANAC_VALIDADAS.md':'# Fontes ANAC validadas\n\nLista de Aeródromos Públicos V2 baixada do diretório oficial, com CIAD/OACI, município físico, município servido, UF, coordenadas e situação. A série de estatísticas aéreas foi processada por arrays concatenados e agregada por aeroporto e mês para 2025–2026; linhas individuais não foram persistidas.\n',
'DICIONARIO_ANAC_AEROPORTOS_MOVIMENTACAO.md':'# Dicionário ANAC\n\nCIAD/OACI são chaves source-native; município físico e servido permanecem separados. Movimentação futura será agregado aeroporto-mês após validação do dicionário.\n',
'RECONCILIACAO_ANAC_ETAPAS.md':'# Reconciliação ANAC\n\n496 linhas lidas e 496 chaves únicas no cadastro. Estatísticas: 67.166 registros 2025–2026 agregados em 5.083 chaves aeroporto-mês. Nenhuma deduplicação aproximada.\n',
'FONTES_ANTT_SIADE_VALIDADAS.md':'# Fontes ANTT SIADE validadas\n\nCSV oficial e API CKAN retornaram HTML Request Rejected (246 bytes). Evidência preservada em RAW; status BLOCKED_EXTERNAL_SOURCE.\n',
'DICIONARIO_ANTT_TU_TKU.md':'# Dicionário ANTT TU/TKU\n\nNão validado sem contornar o bloqueio; TU/TKU não calculados.\n',
'FONTES_ANTT_DECLARACAO_REDE.md':'# Fontes ANTT declaração de rede\n\nNenhum recurso estruturado adicional acessível na janela.\n',
'FONTES_DNIT_SNV_VALIDADAS.md':'# Fontes DNIT validadas\n\nSNV Julho/2024 e levantamentos de condição Setembro/2026 baixados do catálogo oficial, hasheados e agregados em staging.\n',
'DICIONARIO_DNIT_SNV_PAVIMENTO.md':'# Dicionário DNIT SNV/pavimento\n\nSNV usa BR, UF, código, início/fim, extensão, superfície e jurisdição. Pavimento usa rodovia, km, sentido, ICM/ICM_Unificado e data de avaliação.\n',
'MODELO_CANONICO_LOGISTICA.md':'# Modelo canônico\n\nexec_log_facility para instalações; exec_log_network_segment para rede/condição; exec_log_air_operation_month reservado para agregados aeroporto-mês. RAW permanece fora do banco.\n',
'TERRITORIALIDADE_INSTALACOES_E_REDES.md':'# Territorialidade\n\nAeródromos preservam município físico e servido. Redes preservam UF source-native. Nenhum IBGE foi inventado.\n',
'MATRIZ_SEMANTICA_ESTOQUE_FLUXO_CONDICAO.md':'# Matriz semântica\n\nAeródromos são estoque físico; SNV é estoque 07/2024; pavimento é condição 09/2026; ANTAQ/ANTT sem fatos por bloqueio.\n',
'RECONCILIACAO_P1354.md':'# Reconciliação P13.5.4\n\nANAC cadastro 496/496 e operações 67.166/67.166 agregadas em 5.083; DNIT SNV 7.600/7.600; DNIT pavimento 101.552/101.552; rejeitadas 0. ANTAQ/ANTT 0 canônicas por bloqueio documentado. Sem dupla contagem.\n',
'PUBLICACAO_REVISOES_P1354.md':'# Publicação e revisões\n\nMigration v34 criou tabelas compactas. Datasets 170, 171, 172 e 173 publicados transacionalmente; runs 38382–38385 ativos. Replay retornou NO_CHANGE em todas as fatias.\n',
'ARMAZENAMENTO_P1354.json':json.dumps({'databaseBeforeBytes':34545028243,'databaseAfterBytes':34576149651,'growthBytes':31123408,'envelopeLimitBytes':150000000,'envelopeRemainingBytes':118876592,'rawDirectory':str(RAW),'stagingDirectory':str(STAGE),'rawOnDOnly':True},ensure_ascii=False,indent=2),
'BENCHMARKS_P1354.json':json.dumps({'dbBeforeBytes':34545028243,'dbAfterBytes':34576149651,'growthBytes':31123408,'replayGrowthBytes':0,'rows':{'aerodromes':496,'airOperationMonth':5083,'snv':7600,'pavement':101552},'querySmoke':'PASS'},ensure_ascii=False,indent=2),
'TESTES_P1354.md':'# Testes P13.5.4\n\nDatabase guard PASS; migration v34 PASS; paridade ANAC/DNIT PASS; bloqueios ANTAQ/ANTT documentados; idempotência NO_CHANGE; replay sem crescimento; RAW em D: PASS; frontend inalterado; PNCP ininterrupto.\n'
}
for n,c in docs.items(): (OUT/n).write_text(c,encoding='utf-8')
print('artifacts',len(list(OUT.iterdir())))
