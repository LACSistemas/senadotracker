# Relatório de execução — P9.7 Crime organizado, narcotráfico e atuação do Estado

Data: 23/10/2026. Sem commit e sem push. Não existe `CLAUDE.md` na raiz do repositório (a leitura obrigatória foi feita nas investigações P9 e nos relatórios P9.1–P9.6).

## Resultado em uma frase
A investigação dirigida **não encontrou fonte oficial nova que sustente indicador numérico** de operações, lavagem de dinheiro ou organizações criminosas. As medidas que existem e são sólidas — tráfico, apreensões de drogas, armas apreendidas, mandados e prisões — **já estavam publicadas** (VDE na P9.1; ISP-RJ, SSP-RS e SSP-SP na P9.6). A P9.7 entregou o que faltava: uma **camada de leitura com semântica de crime organizado** sobre ids existentes (9 famílias, 22 indicadores, nenhum id novo), o inventário completo do domínio Segurança e o contrato para a P9.8. Nenhum dado foi inventado e nenhum território foi atribuído a organização criminosa.

## PNCP da P9.5 (bloco separado)
**PNCP_P95_STATUS: PUBLISHED · RECONCILED · NO_CHANGE_VERIFIED.** Coleta terminada (jan–out/2026), publicação feita pelo mecanismo persistente existente: 2025 = 69.733 retidos = 69.733 no banco; 2026 (parcial) = 52.279 = 52.279; republicações `NO_CHANGE`. Tarefa agendada desabilitada ao final. Detalhes em `PNCP_P95_STATUS_FINAL.md`. Relatórios da P9.5 regenerados; G8 da P9.5 → PASS_WITH_CAVEATS.

## Resumo executivo
| Família | Fonte | Brasil | UFs | Municípios | Histórico | Indicadores | Estado |
|---|---|---|---|---|---|---|---|
| Apreensões de drogas (massa) | VDE (Estadual e PF/PRF) | Σ 27 UFs do mesmo indicador | 27 | não (só UF) | 2015-01..2026-09 | 4 (3124–3127) | PASS_WITH_CAVEATS (reuso P9.1; unidade do peso não declarada) |
| Registros de tráfico/posse/apreensão | VDE, ISP-RJ, SSP-RS, SSP-SP | só VDE | 27 (VDE); 3 estaduais | RJ 92, RS 494, SP 639 | 2012-01..2026-09 | 10 | PASS_WITH_CAVEATS (reuso P9.1/P9.6) |
| Armas e munições | VDE (armas apreendidas); RS/SP (delitos com armas) | só VDE | 27; RS, SP | RS 494, SP 619 | 2015-01..2026-09 | 4 | PARTIAL (**munições: sem fonte**; armas só como contagem) |
| Prisões e mandados | VDE, ISP-RJ | só VDE | 27 | VDE 5.184 (mandados), RJ 92 | 2014-01..2026-09 | 4 | PASS_WITH_CAVEATS |
| Operações policiais | PF/DAMAZ-2024, SSPs | — | — | — | — | 0 | DISCOVERY_ONLY (sem série estruturada) |
| Criminalidade financeira | COAF | — | — | — | — | 0 | DISCOVERY_ONLY (só totais nacionais em PDF) |
| Organizações criminosas — documentos | SENAPPEN (resumo), IVCO (OBID/UNODC/CDESC), Senad/Ipea | — | — | — | 2024–2026 | 0 | PASS_WITH_CAVEATS só como catálogo documental |
| Reaproveitados P9.x | ver `catalogo_indicadores_p97.csv` | | | | | 22 | PASS |

Fontes investigadas: 16 (`fontes_crime_organizado.json`). Operacionais (reuso): 4 (VDE, ISP-RJ, SSP-RS, SSP-SP). Não operacionalizáveis: 12 (`fontes_nao_operacionalizaveis.md`). Registros novos carregados: **0**. Medidas agregadas publicadas: as já existentes (3.856.129 linhas na faixa P9.6 + faixa P9.1).

## Gates
| Gate | Resultado | Evidência |
|---|---|---|
| G_PNCP_CONTINUITY | PASS | coletor nunca interrompido; publicação concluída e reconciliada |
| G0_INFRASTRUCTURE_SAFETY | PASS | dump 521 MB + sha256, restauração isolada com exit 0, fingerprints idênticos; C: 56 GiB livres; P9.3 verificada (lacuna da P9.6 fechada) |
| G1_ORGANIZED_CRIME_SEMANTICS | PASS | `taxonomia_crime_organizado.md`; teste de colunas proibidas |
| G2_OFFICIAL_SOURCE_CATALOG | PASS_WITH_CAVEATS | 16 fontes classificadas; CNJ/DataJud **não testado**; PF EPOL e PRF sem acesso operacional; investigação por busca e sondagem de páginas, não exaustiva |
| G3_DRUG_SEIZURES | PASS_WITH_CAVEATS | massa e contagem separadas, Estadual × PF/PRF sem soma; unidade do peso não declarada (consistente com kg: PR 2024) |
| G4_WEAPONS_SEIZURES | PARTIAL | armas apreendidas só do VDE (sem tipos); munições e dados municipais de apreensão: sem fonte |
| G5_POLICE_OPERATIONS | DISCOVERY_ONLY | nenhum indicador numérico criado |
| G6_FINANCIAL_CRIME | DISCOVERY_ONLY | COAF só em totais nacionais |
| G7_OFFICIAL_ORGANIZATION_EVIDENCE | PASS_WITH_CAVEATS | catálogo documental; nenhum mapa/inferência |
| G8_EXISTING_SECURITY_REUSE | PASS | 22 indicadores reutilizados, 0 duplicados, 0 ids novos |
| G9_TERRITORIAL_CONTRACT | PASS | UF/município por IBGE; federal não vai ao município sede |
| G10_TEMPORAL_AND_COVERAGE | PASS | SP posse/apreensão/porte só desde 2023 (ausência ≠ zero); último mês preliminar; ano corrente parcial marcado |
| G11_PRIVACY_AND_SECURITY | PASS | nenhum dado individual/operacional coletado; RAW de fontes anteriores permanece fora do banco |
| G12_INDICATOR_CONTRACT | PASS | `catalogo_indicadores_p97.csv`; ids estáveis por código de família (texto), sem posição |
| G13_BACKFILL | PARTIAL | Onda A (reuso) e B/C parciais por reuso; D, E: sem fonte; F: catálogo documental |
| G14_SOURCE_RECONCILIATION | PASS_WITH_CAVEATS | Σ municípios = UF com 0 divergências em 14 indicadores; Estadual × PF/PRF não reconciliável (sobreposição) |
| G15_PERSISTENCE | PASS | nenhuma migration, tabela ou linha criada |
| G16_SERVING | PASS | `getOrganizedCrimeNational/State/Municipality`; 0,3–27 ms (mediana) |
| G17_TESTS_AND_REGRESSION | PASS_WITH_CAVEATS | 472 testes, 442 passam, 0 falham, 30 ignorados (não contados como aprovados); fingerprints antes × depois idênticos em todas as ondas; build isolado do Next não executado (sem mudança de UI) |
| G18_STORAGE_AND_PERFORMANCE | PASS | `armazenamento_execucao.csv`, `desempenho_consultas.json` |
| G19_FRONTEND_READINESS | PASS_WITH_CAVEATS | `PRONTIDAO_FRONTEND_SEGURANCA_P98.md`, matriz de 462 indicadores, contratos, 10 casos testados |

## Decisões e riscos
- **IDs estáveis:** por exigência desta etapa, a P9.7 não criou ids; as famílias apontam ids existentes por código de família. Um teste confere a ligação por código de origem (não por posição). Os ids posicionais da P9.6 continuam como estão (regra: novas naturezas sempre no fim).
- **Peso das drogas:** o VDE não declara a unidade; mantive "peso informado" sem conversão. A corroboração com imprensa (PR 2024) não é prova oficial.
- **Não houve cobertura municipal de crime organizado**: é o que as fontes sustentam.
- **Incidente de processo:** o supervisor do PNCP foi cancelado por um terminal fechado; recuperado sem perda (ver `PNCP_P95_STATUS_FINAL.md`).

## Correção de processo descoberta nesta etapa
O script `npm test` não listava `tests/integration/crime-p96.test.ts`: a P9.6 reportou 463 testes sem ele (o arquivo havia sido rodado à parte e passou). Agora ele e o teste da P9.7 estão no script (472 testes). Além disso, o cluster de teste novo herdou mensagens do Postgres em português e três testes antigos falharam até `lc_messages=C` — era ambiente, não regressão.
