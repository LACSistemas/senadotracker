# Relatório de execução — P9.6 Criminalidade estadual municipalizada

Data: 23/10/2026. Sem commit e sem push (regra da etapa). Contrato de dados: `crime-state-v1`; migração v8 (`exec_crime_indicator`); ids `8000 + slot×100 + 1..99`; cobertura reaproveita `exec_seg_cov` com specs próprios (datasets 42+slot).

## Resumo por UF
| UF | Fonte | Status | Município-mês | Período | Observação |
|---|---|---|---|---|---|
| RJ | ISP-RJ | PUBLICADO | 92 municípios, 54 indicadores | 2014-01..2026-09 | CISP separado; 152 divergências estado×município e 1.578 violações de composto são da fonte (documentadas, não ajustadas) |
| MG | SEJUSP (CKAN) | PUBLICADO | 853, 18 naturezas | 2012-01..2026-07 | site oficial indisponível (503); mesmo banco REDS/BISP via dados.mg.gov.br; zeros declarados; meses futuros truncados |
| ES | SESP (S3) | PUBLICADO | 78, 10 tipos | 2018-01..2026-09 | microdados agregados em streaming, sem dado pessoal |
| RS | SSP | PUBLICADO | 494, 15 | 2012-01..2026-09 | só planilhas agregadas; controle "Total RS" sem divergência; <2012 (.xls legado) não carregado |
| PE | SDS | PUBLICADO | 185, 13 | 2004-01..2026-09 | CVLI/CVP/estupro; supressão <3 em sensíveis (16.735 células); VD não publicado |
| CE | SSPDS | PUBLICADO COM RESSALVAS | 173, 5 | só 2026-01..09 | site só expõe o ano corrente; TLS incompleto |
| SP | SSP | PUBLICADO | 645, 25 | 2022-01..2026-08 | XLSX ~200 MB/ano em streaming; endereço/coordenadas descartados; 15.972 células suprimidas |
| AL | SSP-AL | BLOQUEIO EXTERNO PROVADO | – | – | certificado inválido do portal; só PDFs |
| DF | SSP-DF | PRONTO COM RESSALVAS, NÃO PUBLICADO | – | – | Região Administrativa ≠ município |
| BA | SSP-BA | A VALIDAR | – | – | acumulado anual sem mês; microdados com atributos pessoais |
| GO PR PA SC MT MS PI TO AM MA | – | NÃO ENCONTRADO após descoberta direcionada | – | – | descoberta por busca na web, não exaustiva |

Detalhes: `fontes_estaduais_status.csv`, `cobertura_estadual_municipal.csv`, `catalogo_indicadores_estaduais.csv`, `crosswalk_criminalidade_ibge.csv`, `taxonomia_criminalidade.md`, `comparabilidade_estadual.md`, `reconciliacao_estadual.md`, `armazenamento_execucao.csv`, `desempenho_consultas.json`, `results.json`.

## Gates
| Gate | Resultado | Evidência |
|---|---|---|
| G0 infraestrutura | PASS | PNCP intocado; backup/restauração testados (`reproducibilidade/g0_*.json`); C: com 56 GiB livres; nenhuma operação destrutiva |
| G1 semântica | PASS | registro policial ≠ SIM ≠ VDE; unidade por indicador; fonte nunca fundida |
| G2 taxonomia | PASS | `taxonomia_criminalidade.md`; compostos NOT_COMPARABLE |
| G3 identidade territorial | PASS | IBGE7/nome via crosswalk existente; aliases oficiais; não identificados vão ao ignorado; DF/RA não publicado |
| G4 contrato temporal | PASS | mês futuro nunca publicado; último mês preliminar; MG truncado |
| G5 privacidade | PASS COM RESSALVA | nenhuma coluna pessoal/endereço no banco (teste); supressão <3; **os XLSX originais (SP, PE, BA) permanecem no RAW em D:\Civica\raw como cópia da fonte**, fora do banco e do repositório |
| G6 persistência | PASS | publicação transacional, NO_CHANGE, rollback por falha injetada (teste), verificação Σ=UF e contagem |
| G7 estados núcleo | PASS | RJ, MG, ES, RS publicados |
| G8 segunda onda | PARCIAL | PE publicado; CE publicado só 2026; AL bloqueio externo |
| G9 SP/DF | PARCIAL | SP publicado; DF não publicado (RA) |
| G10 demais UFs | PARCIAL | BA a validar; demais não encontrados |
| G11 reconciliação fonte | PASS | `reconciliacao_estadual.md` |
| G12 derivados | PASS | só contagens por fonte; sem taxa (sem população do mesmo ano para 2022–2023; sem interpolação) |
| G13 histórico | PARCIAL | séries completas disponíveis em cada fonte; CE e SP limitados pela fonte; RS <2012 e BA anos anteriores não carregados |
| G14 serviço | PASS | `getStateCrimeState` / `getStateCrimeMunicipality`; 0,4–25 ms (mediana) |
| G15 testes | PASS | 463 testes, 433 passam, 0 falham, 30 pulados; fingerprints de Saúde, P9.1, P9.2 e cobertura P9.1 inalterados |
| G16 armazenamento/desempenho | PASS | `armazenamento_execucao.csv`; ≈3,86 M linhas de valor |
| G17 republicação | PASS | segunda execução → NO_CHANGE |
| G_PNCP_CONTINUITY | PASS (mecanismo) / PENDENTE (publicação) | `PNCP_P95_CONTINUIDADE.md` |

Não verificado: build isolado do Next (nenhuma mudança de UI nesta etapa); fingerprint P9.3 (o script G0 usado não o calcula); a leitura de BA, DF e demais UFs não foi implementada.

## PNCP P9.5 (bloco separado)
Coletor preservado; tarefa agendada `Civica-P95-PNCP-Finish` publica 2025 e 2026 quando a coleta fechar (restam 2026-03 em andamento e 04–09). Publicação **ainda não ocorreu**; não se afirma publicação automática concluída. A errata federal está em `ERRATA_RECONCILIACAO_FEDERAL_P95.md`.

## Lições / riscos
- Ids de indicador são posicionais: acrescentar natureza no meio de um array desloca ids (aconteceu em SP durante a execução, em teste; dados do cluster de teste foram removidos e refeitos; a produção não foi afetada). Regra registrada no código: novas naturezas entram sempre no fim.
- O mês mais recente de fontes de microdado (ES, PE, SP, CE) é preliminar e pode ser revisado.
