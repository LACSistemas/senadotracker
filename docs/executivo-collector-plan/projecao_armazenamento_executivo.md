# Projeção de armazenamento do Executivo no PostgreSQL

Linha de base medida em 2026-10-13 (somente leitura). Valores em GiB (2^30). "Adicional" = dados novos; o banco atual não é recontado. Fórmulas: `TOTAL_ROWS = entidades × registros por entidade × períodos × cobertura` (ou contagem medida); `DATA_GB = TOTAL_ROWS × bytes/linha ÷ 2^30`; `TOTAL_PG_GB = DATA + ÍNDICE + TOAST + HISTÓRICO`.

## 1. Baseline do PostgreSQL

| Medida | Valor |
|---|---|
| BASELINE_POSTGRES_GB | 14.973 |
| BASELINE_TABLES_GB (heap) | 8.124 |
| BASELINE_INDEXES_GB | 4.382 |
| BASELINE_TOAST_GB | 2.447 |
| BASELINE_ROW_COUNTS | 15.976.931 |
| BASELINE_MEASUREMENT_DATE | 2026-10-13 |


Maior schema: `civica_state` (11,69 GB, 73%). `raw_objects` sozinho tem 2,5 GB (TOAST de documentos). Revisões duplicam linhas (proposals 2,0×; expenses 2,6×). Ver tabela de calibração no plano diretor, seção 4.

## 2. Metodologia

1) **Âncoras empíricas** (contagens reais): PNCP contratos 2023/2024/2025 = 242.956 / 1.087.189 / 2.023.064; contratações 2024/2025 = 1.230.637 / 1.462.709; TCE-RS 26.932.626 linhas (E 6,62 mi, L 8,59 mi, P 11,72 mi); TCE-ES 942.247 linhas agregadas (2024) e 5 partições de empenhos (3,26 GB); RS estadual dez/2025 351.323 linhas; MG 2025 63.293 empenhos; Siconfi DCA (Vitória 2.072 linhas em 7 anexos, município pequeno 1.016; I-C+I-D = 509/273), RREO A01 489, RGF A01 198; Portal da Transparência despesas 66.525 linhas/mês, CPGF 15.237/mês, viagens 814.395/ano; DOM/SC 5.488.834 atos; SAPL-PI 449 normas de 2025 todas com matéria; SIH ES 77.995 AIH em 3 meses; BNAFAR ES 53.999 linhas; PDDE 247.863 linhas; Censo 468.099 setores; Fala.BR ≈1,56 mi/ano. 2) **Extrapolações** só quando declaradas (população de referência, fórmula e confiança em cada linha do CSV). 3) **Bytes por linha** pela fórmula de heap + chaves de índice por tabela + TOAST (validada contra `civica_state.movements`). 4) **Sem percentual fixo de índice**: cada tabela tem suas chaves; o índice vai de 0 a mais de 100% do heap.

## 3. Resumo dos cenários

|  | A — Enxuto | B — Granularidade completa útil (recomendado) | C — Máxima preservação |
|---|---|---|---|
| Datasets estimados / NOT_ESTIMATED / excluídos | 93 / 6 / 14 | 100 / 10 / 3 | 101 / 12 / 0 |
| Linhas de backfill | 60,29 mi | 703,92 mi | 1.130,13 mi |
| Linhas novas por ano | 6,02 mi | 87,30 mi | 281,84 mi |
| Dados (heap) GB | 10,70 | 123,5 | 262,0 |
| Índices GB | 2,87 | 52,35 | 86,61 |
| TOAST GB | 0,02 | 9,94 | 176,2 |
| Histórico/versões GB | 0,59 | 6,91 | 54,02 |
| **ADDITIONAL_STORAGE_GB (backfill)** | **14,18** | **192,7** | **578,8** |
| Crescimento anual PG (GB/ano) | 1,88 | 25,00 | 99,48 |
| **PROJECTED_TOTAL_DATABASE_GB** após backfill (atual + adicional) | 29,15 | 207,7 | 593,8 |
| RAW fora do PostgreSQL (GB) | 54,99 | 515,7 | 1.056,8 |


Quebra do B: dados 123,5 GB (64%), índices 52,35 (27%), TOAST 9,94 (5%), histórico 6,91 (4%).

## 4. Projeção de 1, 3 e 5 anos (backfill concluído no ano 0; crescimento constante)

|  | ADDITIONAL +0 | +1 ano | +3 anos | +5 anos | PROJECTED_TOTAL_DATABASE_GB +0 | +1 | +3 | +5 |
|---|---|---|---|---|---|---|---|---|
| A | 14,18 | 16,06 | 19,83 | 23,60 | 29,15 | 31,03 | 34,80 | 38,57 |
| B | 192,7 | 217,7 | 267,7 | 317,7 | 207,7 | 232,7 | 282,7 | 332,7 |
| C | 578,8 | 678,3 | 877,2 | 1.076,2 | 593,8 | 693,2 | 892,2 | 1.091,2 |

Não inclui o crescimento do legislativo já existente nem a retirada dos schemas `*_poc` (−2,2 GB). RAW em object storage por ano: A +4,90 GB/ano; B +62,35 GB/ano; C +198,0 GB/ano.

## 5. Por domínio (cenário B; fecha com o total)

| Domínio | PG GB | % do B | Crescimento GB/ano | Linhas backfill | RAW GB | Datasets | NOT_ESTIMATED |
|---|---|---|---|---|---|---|---|
| FINANCAS_SUBNACIONAL | 110,9 | 57.5% | 12,23 | 401,31 mi | 45,60 | 12 | 4 |
| POLITICA_EXECUTIVO | 28,13 | 14.6% | 3,36 | 51,97 mi | 360,1 | 31 | 1 |
| SAUDE | 20,26 | 10.5% | 3,44 | 115,14 mi | 55,70 | 13 | 2 |
| CONTRATOS | 10,04 | 5.2% | 3,93 | 20,41 mi | 13,70 | 5 | 0 |
| EDUCACAO | 5,54 | 2.9% | 0,46 | 28,96 mi | 15,00 | 9 | 0 |
| ATENDIMENTO | 4,06 | 2.1% | 0,57 | 11,20 mi | 4,50 | 1 | 1 |
| TERRITORIO | 3,28 | 1.7% | 0,09 | 17,30 mi | 5,25 | 7 | 0 |
| FINANCAS_FEDERAIS | 2,88 | 1.5% | 0,25 | 9,30 mi | 1,20 | 1 | 0 |
| SOCIAL | 2,31 | 1.2% | 0,20 | 19,51 mi | 5,00 | 4 | 1 |
| SEGURANCA | 2,21 | 1.1% | 0,19 | 12,55 mi | 2,40 | 5 | 1 |
| INFRAESTRUTURA | 1,69 | 0.9% | 0,15 | 9,54 mi | 3,90 | 7 | 0 |
| TRANSFERENCIAS | 1,39 | 0.7% | 0,15 | 6,66 mi | 2,00 | 3 | 0 |
| CONTROLE | 0,03 | 0.0% | 0,00 | 75,0 mil | 1,30 | 2 | 0 |
| **Total** | **192,7** | 100% | 25,00 | 703,92 mi | 515,7 | 100 | 10 |


A (enxuto) por domínio: SAUDE 3,36; POLITICA_EXECUTIVO 3,22; FINANCAS_SUBNACIONAL 3,04; CONTRATOS 2,46; EDUCACAO 0,48; SEGURANCA 0,43; TERRITORIO 0,40; SOCIAL 0,26; INFRAESTRUTURA 0,22; TRANSFERENCIAS 0,15; ATENDIMENTO 0,09; FINANCAS_FEDERAIS 0,04; CONTROLE 0,03. C (preservação) por domínio: FINANCAS_SUBNACIONAL 349,5; POLITICA_EXECUTIVO 105,0; SAUDE 66,13; CONTRATOS 29,29; EDUCACAO 10,18; TERRITORIO 6,73; ATENDIMENTO 4,06; SEGURANCA 2,48; SOCIAL 2,31; INFRAESTRUTURA 1,69; TRANSFERENCIAS 1,39; CONTROLE 0,03; FINANCAS_FEDERAIS 0,00.

## 6. Por esfera (B)

| Esfera | PG GB | Crescimento GB/ano | Linhas backfill |
|---|---|---|---|
| Municipal | 111,5 | 12,75 | 344,85 mi |
| Nacional (multiesfera) | 41,90 | 8,18 | 207,47 mi |
| Federal | 15,05 | 1,39 | 53,05 mi |
| Estadual | 12,54 | 1,45 | 37,65 mi |
| Multiesfera | 11,71 | 1,23 | 60,89 mi |
| **Total** | **192,7** | 25,00 | 703,92 mi |


## 7. Por fonte (B, 20 maiores)

| Fonte | PG GB | GB/ano | Linhas |
|---|---|---|---|
| SRC-TCE-RS | 49,34 | 4,90 | 161,00 mi |
| SRC-TCE-SP | 25,51 | 3,09 | 98,18 mi |
| SRC-DATASUS-SIH | 14,07 | 1,50 | 78,54 mi |
| SRC-ESTADO-FIN | 11,48 | 1,36 | 34,02 mi |
| SRC-TCE-ES | 9,79 | 1,29 | 35,06 mi |
| SRC-PNCP | 8,70 | 3,81 | 17,81 mi |
| SRC-TCE-PE | 8,25 | 1,03 | 29,15 mi |
| SRC-PT-VIAGENS | 7,60 | 0,74 | 26,30 mi |
| SRC-SICONFI | 6,52 | 0,56 | 43,90 mi |
| SRC-SIGPUB | 6,27 | 0,70 | 5,90 mi |
| SRC-QD | 4,60 | 0,76 | 4,50 mi |
| SRC-DEMAS-CNES | 4,19 | 0,24 | 22,21 mi |
| SRC-FALABR | 4,06 | 0,57 | 11,20 mi |
| SRC-INEP-CENSO | 3,94 | 0,30 | 19,67 mi |
| SRC-DOMSC | 3,81 | 0,49 | 3,60 mi |
| SRC-PT-DESPESAS | 2,88 | 0,25 | 9,30 mi |
| SRC-SAPL | 2,40 | 0,21 | 5,83 mi |
| SRC-IBGE-CENSO22 | 1,61 | 0,00 | 3,16 mi |
| SRC-IBGE-MUNIC | 1,45 | 0,07 | 12,53 mi |
| SRC-DIOES | 1,33 | 0,24 | 1,40 mi |


## 8. Por granularidade (B)

| Classe | Datasets | Linhas | PG GB |
|---|---|---|---|
| evento/documento individual | 39 | 440,67 mi | 145,3 |
| indicador/agregado por território-período | 30 | 161,09 mi | 28,17 |
| entidade (com ou sem versão) | 31 | 102,17 mi | 19,24 |

Registros individuais de despesa, saúde hospitalar e atos concentram o espaço; indicadores por município-período (a maioria das fontes) somam poucos GB. É exatamente por isso que "5.570 × 12" não serve como estimativa de TCE, SIH, estoque ou diários.

## 9. Maiores datasets (B)

| Dataset | PG GB | Linhas | Domínio | Confiança |
|---|---|---|---|---|
| FIN-TCERS-EMPENHOS | 49,34 | 161,00 mi | FINANCAS_SUBNACIONAL | MEDIUM |
| FIN-TCESP-EVENTOS | 25,51 | 98,18 mi | FINANCAS_SUBNACIONAL | LOW |
| SAU-SIH-AGREG | 14,07 | 78,54 mi | SAUDE | LOW |
| FIN-TCEPE-DESPESAS | 8,25 | 29,15 mi | FINANCAS_SUBNACIONAL | LOW |
| FIN-TCEES-EMPENHOS | 7,13 | 24,50 mi | FINANCAS_SUBNACIONAL | MEDIUM |
| POL-ATOS-MUN-SIGPUB | 6,27 | 5,90 mi | POLITICA_EXECUTIVO | LOW |
| FIN-ESTADO-ES | 6,24 | 18,48 mi | FINANCAS_SUBNACIONAL | LOW |
| FIN-ESTADO-RS | 4,97 | 14,74 mi | FINANCAS_SUBNACIONAL | MEDIUM |
| POL-ATOS-MUN-QD | 4,60 | 4,50 mi | POLITICA_EXECUTIVO | LOW |
| ATD-FALABR | 4,06 | 11,20 mi | ATENDIMENTO | MEDIUM |
| POL-VIAGENS-PAGAMENTOS | 3,82 | 18,00 mi | POLITICA_EXECUTIVO | MEDIUM |
| POL-ATOS-MUN-DOMSC | 3,81 | 3,60 mi | POLITICA_EXECUTIVO | MEDIUM |
| POL-VIAGENS | 3,78 | 8,30 mi | POLITICA_EXECUTIVO | MEDIUM |
| CON-PNCP-CONTRATOS | 3,59 | 5,32 mi | CONTRATOS | HIGH |
| FIN-SICONFI-DCA-CORE | 3,23 | 22,33 mi | FINANCAS_SUBNACIONAL | MEDIUM |
| CON-PNCP-CONTRATACOES | 3,15 | 5,05 mi | CONTRATOS | MEDIUM |
| POL-DESPESAS-FED | 2,88 | 9,30 mi | FINANCAS_FEDERAIS | HIGH |
| SAU-CNES-PROF | 2,79 | 15,30 mi | SAUDE | LOW |
| FIN-TCEES-DESPESAS | 2,59 | 10,40 mi | FINANCAS_SUBNACIONAL | HIGH |
| FIN-SICONFI-RREO-CORE | 2,37 | 15,52 mi | FINANCAS_SUBNACIONAL | LOW |


## 10. Impacto dos índices

Índices somam 52,35 GB no B (39% de heap+TOAST), mas variam por tabela: tabelas de eventos com chave composta e 3 btrees chegam a 60–90% do heap; indicadores com chave única de 14–16 B ficam em 35–45%; geometrias usam GiST (~70–80 B/linha) com a geometria em TOAST. Alternativa medida por simulação (seção 13): trocar 2–3 btrees por 1 btree + BRIN nas 8 tabelas de eventos reduz B para 169,2 GB.

## 11. Impacto do histórico, dos snapshots e do backfill

Histórico/versões (retificações, republicações, SCD) somam 6,91 GB no B (3.6%). Comparação snapshot × delta no plano diretor (9.1): snapshot mensal completo de profissionais CNES custaria 7,87 GB/ano contra 0,16 GB/ano com delta; snapshot diário de estoque custaria 222,7 GB/ano. O backfill concentra 60% do B na Onda 4 (finanças).

## 12. Incertezas principais

| Faixa de confiança | PG GB (B) | Datasets | Fator heurístico |
|---|---|---|---|
| HIGH | 9,45 | 8 | 0.85–1.15 |
| LOW | 94,60 | 63 | 0.35–2.5 |
| MEDIUM | 88,67 | 29 | 0.65–1.5 |

Faixa indicativa do B: **98,78–380,4 GB** (heurística). As maiores incertezas: TCE-SP (2.800 eventos/município-mês; faixa 1.500–4.200), históricos de TCE-RS/SP/PE (não provados antes de 2025), SIH nacional (12 mi AIH/ano é referência externa), CNES nacional (referências externas), SIGPub (662 mil atos/ano medidos em um dia; pode chegar a 3,3 mi por analogia DOM/SC), QD e SAPL (amostra de 12 instâncias).

## 13. Sensibilidades (cenário B)

| Variação | B (GB) | Δ vs base |
|---|---|---|
| B base | 192,7 | — |
| janela de backfill de 5 anos nas fontes de despesa (TCE-RS/SP/PE/ES e estados) | 141,0 | -51,7 |
| TCE-SP: 1.500 eventos/município-mês (faixa baixa) | 180,9 | -11,8 |
| TCE-SP: 4.200 eventos/município-mês (faixa alta) | 205,5 | +12,8 |
| tabelas de eventos com 1 btree + BRIN em vez de 2–3 btrees | 169,2 | -23,5 |


## 14. Datasets que não podem ser estimados sem amostragem adicional

| Dataset | Motivo |
|---|---|
| POL-AGENDAS | NOT_ESTIMATED: fonte HTML sem contagem |
| FIN-SICONFI-MSC | EXCLUDED: não recomendado |
| FIN-TCMSP-CAPITAL | NOT_ESTIMATED: sem contagem |
| FIN-TCE-OUTROS | NOT_ESTIMATED: fontes só documentadas |
| FIN-ESTADO-OUTROS | NOT_ESTIMATED: 24 UFs sem contagem |
| SAU-SIA-AGREG | NOT_ESTIMATED: precisa amostragem adicional |
| SAU-OUTROS | NOT_ESTIMATED: SISVAN/SISAGUA/cirurgias sem contagem |
| SEG-DATAJUD-AGREG | NOT_ESTIMATED: precisa amostragem |
| SOC-OUTROS | NOT_ESTIMATED: fontes marginais |
| ATD-156-CIDADES | NOT_ESTIMATED: sem contagem |

Excluídos do B (só no C): POL-SIAPE-VINCULOS-FUNCAO, POL-VIAGENS-TRECHOS, POL-VIAGENS-PASSAGENS. No cenário C ainda ficam NOT_ESTIMATED: POL-DESPESAS-FED, POL-AGENDAS, FIN-SICONFI-RREO-CORE, FIN-SICONFI-MSC, FIN-TCMSP-CAPITAL, FIN-TCE-OUTROS, FIN-ESTADO-OUTROS, SAU-SIA-AGREG, SAU-OUTROS, SEG-DATAJUD-AGREG, SOC-OUTROS, ATD-156-CIDADES.

## 15. Camadas RAW, NORMALIZED e SERVING (B)

| Camada | GB | Onde |
|---|---|---|
| RAW | 515,7 | object storage (PDFs, ZIPs, JSON, DBC); hash + URL |
| NORMALIZED | 192,7 | PostgreSQL `civica_exec` |
| SERVING | 9,06 | PostgreSQL (materializações; 4–8% do normalizado por domínio) |

SERVING por domínio: FINANCAS_SUBNACIONAL 4,44; POLITICA_EXECUTIVO 1,69; SAUDE 1,01; CONTRATOS 0,50; EDUCACAO 0,33; ATENDIMENTO 0,20; SOCIAL 0,19; SEGURANCA 0,18; TERRITORIO 0,16; FINANCAS_FEDERAIS 0,14; INFRAESTRUTURA 0,14; TRANSFERENCIAS 0,08; CONTROLE 0,00. Calculado sob demanda (não armazenado): agregações por UF/região, rankings, per capita, séries derivadas, junções espaciais ad hoc. Não armazenar: texto livre de manifestações, microdados individuais de escolas/alunos, CPF, AIH identificada. Retenção limitada: RAW de fontes reproduzíveis (24 meses), snapshots de estoque (agregado mensal).

## 16. Recomendações de otimização

1) Backfill de 5 anos nas despesas municipais antes de aprofundar (reduz B em 51,68 GB). 2) Partição por ano + BRIN em data (reduz índices em 23,48 GB). 3) Dicionários inteiros para conta, credor, UO e elemento (já considerados). 4) RAW em object storage com compressão e hash. 5) Geometria simplificada para serving. 6) Fornecedor canônico antes dos eventos. 7) Evitar `revision_id` na chave de tabelas de eventos. 8) Não carregar MSC, SIA detalhado, SISAGUA/SISVAN nem texto livre sem prova de valor.

## 17. Reconciliação

Soma por domínio = soma por esfera = soma por fonte = total em A, B e C (asserções em 1e-6 GB). CSV: 339 linhas = 113 datasets × 3 cenários. Totais do CSV (somente linhas numéricas) = 192,7 GB no B. Datasets contados uma vez; Emendas Pix (já no banco) com 0 linhas de backfill.
