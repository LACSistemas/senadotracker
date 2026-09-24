# Investigação técnica: emendas e substitutivos

> Auditoria somente leitura concluída em 23/09/2026. Nenhuma tabela, migration, publicação ou coletor foi alterado. **Fato** designa medição direta; **inferência** designa interpretação textual; **não verificado** designa hipótese que não pôde ser testada.

## Resposta direta

**Decisão: D — depende da sigla, com um núcleo comum muito claro: os dados existem parcialmente e os coletores atuais deixam de persistir grande parte deles.** O vínculo estruturado com a matéria-pai existe no arquivo anual oficial para **5.169/5.169 (100%)** registros ativos. No teste ao vivo de 500 emendas, `/tramitacoes` respondeu com ao menos um evento para **500/500**, mas apenas **50/500** tinham mais de um evento; nenhuma teve votação própria. A matéria-pai possuía alguma votação em **366/500**, mas isso não identifica automaticamente o destino de cada emenda. Portanto é possível construir uma timeline curta e comprovável para todas, e uma timeline de resultado apenas onde um evento/votação identifica a emenda de modo inequívoco.

O diagnóstico anterior de “zero movimentos e zero relações” é causado principalmente pela coleta: o catálogo anual já entrega `uriPropPrincipal`, mas `activity.ts` não o persiste; o enriquecimento exclui implicitamente a maioria das siglas porque filtra `payload.year = 2026`, enquanto 3.711 acessórios chegam com `ano` nulo/zero; e o coletor de tramitações só inclui `EMC` por padrão e apenas quando o status parece terminal.

## Parte 1 — O que temos hoje

### Entrada na base e campos descartados

| Etapa | Arquivo/bloco real | Comportamento observado |
| --- | --- | --- |
| Catálogo Câmara | `apps/collector/src/activity.ts:16-22` | Lê `proposicoes-2026.json` e `proposicoesAutores-2026.json`; cria todos os tipos sem filtro de sigla. |
| Classificação | `packages/domain/src/index.ts:68-82` | Mapeia as 11 siglas para `emendas_substitutivos`. |
| Persistência inicial | `activity.ts:20` | Guarda id, tipo, número, ano, ementa, apresentação, descrição da situação, URL e parte do último relator. |
| Perda crítica | `activity.ts:20` | Não transforma `uriPropPrincipal`, `uriPropAnterior`, `uriPropPosterior`, `codTipo`, `descricaoTipo`, `keywords`, despacho e códigos do último status em complementos. |
| Enriquecimento genérico | `proposition-enrichment.ts:7-14` | Exige `CAST(payload.year AS INTEGER)=2026`; acessórios cujo ano oficial é 0/nulo nunca entram. Limite máximo de 500 e ordenação global também não garante cobertura. |
| Detalhe individual | `camara-proposition-details.ts:27-47` | Consulta detalhe, temas, tramitações, relacionadas, autores, votações e HTML. Persistiria os dados se o ID fosse selecionado. |
| Pai no detalhe | `camara-proposition-details.ts:37-41` | Aceita `detail.uriPropPrincipal` e fallback HTML, mas o endpoint individual ao vivo devolveu `uriPropPrincipal:null` em exemplos nos quais o arquivo anual traz o pai. |
| Tramitação em lote | `camara-proposition-movements.ts:17-18` | Defaults: `REQ,RIC,INC,DOC,EMC,PL`; omite dez siglas e restringe candidatos a status terminal por texto. |
| Pauta | `camara-agenda.ts:21-27` | Só associa o ID explicitamente listado em `/eventos/{id}/pauta`; não herda pauta da matéria-pai. |
| Senado | `activity.ts:23-40`; `senate-processes.ts:58-80` | O grupo ativo não contém registros com `source=senado`; os 5.169 são objetos cadastrados pela Câmara, inclusive EMS. |

### Acervo ativo

| Sigla | Total | Pai no arquivo oficial | Ano utilizável no filtro atual | Situação no arquivo | Autor | Inteiro teor |
| --- | --- | --- | --- | --- | --- | --- |
| EMA | 5 | 5 (100,0%) | 0 (0,0%) | 5 (100,0%) | 5 (100,0%) | 5 (100,0%) |
| EMC | 1340 | 1340 (100,0%) | 1338 (99,9%) | 1 (0,1%) | 1340 (100,0%) | 1340 (100,0%) |
| EMC-A | 313 | 313 (100,0%) | 0 (0,0%) | 0 (0,0%) | 313 (100,0%) | 313 (100,0%) |
| EMP | 423 | 423 (100,0%) | 0 (0,0%) | 423 (100,0%) | 423 (100,0%) | 423 (100,0%) |
| EMR | 454 | 454 (100,0%) | 0 (0,0%) | 1 (0,2%) | 454 (100,0%) | 450 (99,1%) |
| EMS | 2 | 2 (100,0%) | 2 (100,0%) | 1 (50,0%) | 2 (100,0%) | 2 (100,0%) |
| ESB | 119 | 119 (100,0%) | 118 (99,2%) | 0 (0,0%) | 119 (100,0%) | 119 (100,0%) |
| SBE-A | 130 | 130 (100,0%) | 0 (0,0%) | 0 (0,0%) | 130 (100,0%) | 130 (100,0%) |
| SBR | 204 | 204 (100,0%) | 0 (0,0%) | 0 (0,0%) | 204 (100,0%) | 196 (96,1%) |
| SBT | 1543 | 1543 (100,0%) | 0 (0,0%) | 1 (0,1%) | 1543 (100,0%) | 1542 (99,9%) |
| SBT-A | 636 | 636 (100,0%) | 0 (0,0%) | 0 (0,0%) | 636 (100,0%) | 636 (100,0%) |

Status persistidos hoje: `Sem status`: 4737; `Aguardando Providências Internas`: 429; `Arquivada`: 1; `Aguardando Encaminhamento`: 1; `Aguardando Recurso`: 1. Complementos ativos ligados ao grupo: `theme`: 2.

## Parte 2 — Amostra real

A tabela usa dez EMC, todas as duas EMS, dez SBT, dez SBT-A e cinco de cada sigla restante. O autor vem do arquivo oficial anual de autores; o pai vem de `uriPropPrincipal`.
| ID | Sigla/número/ano | Casa | Apresentação | Autor(es) | Status | Pai | Movimentos próprios | Votações próprias | Descrição | URI oficial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2628653 | EMA 1/0 | Câmara | 2026-05-27T20:40:01 | Paulo Pimenta, Isnaldo Bulhões Jr. | Aguardando Providências Internas | 2233802 | 2 | 0 | Emenda Aglutinativa Substitutiva Global. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2628653 |
| 2614417 | EMA 2/0 | Câmara | 2026-04-08T12:44:39 | Rodrigo Gambale, Mário Heringer, André Figueiredo | Aguardando Providências Internas | 2162116 | 2 | 0 | Altera a Constituição Federal para garantir recursos mínimos para o financiamento do Sistema Único de Assistência Social (SUAS). | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614417 |
| 2628701 | EMA 3/0 | Câmara | 2026-05-27T22:47:00 | Dr. Fernando Máximo, Paulo Pimenta, Isnaldo Bulhões Jr. | Aguardando Providências Internas | 2351506 | 2 | 0 | "Acrescenta o §4º-A ao Art. 150 da Constituição Federal." | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2628701 |
| 2628703 | EMA 4/0 | Câmara | 2026-05-26T12:59:03 | Antonio Brito | Aguardando Providências Internas | 2351506 | 2 | 0 | EMENDA AGLUTIVATIVA À PEC 5 DE 2023 QUE Acrescenta § 4º-A ao art. 150 da Constituição Federal, para dispor sobre a imunidade tributária de que tratam as suas alíneas “b” e “c” do inciso VI. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2628703 |
| 2614362 | EMA 1/0 | Câmara | 2026-04-08T09:40:03 | Rodrigo Gambale, Mário Heringer, André Figueiredo | Aguardando Providências Internas | 2162116 | 2 | 0 | Altera a Constituição Federal para garantir recursos mínimos para o financiamento do Sistema Único de Assistência Social (SUAS). | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614362 |
| 2633840 | EMC 329/2026 | Câmara | 2026-03-25T00:00:00 | Alceu Moreira | — | 2610975 | 1 | 0 | Dá nova redação à MPV 1343/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2633840 |
| 2635812 | EMC 48/2026 | Câmara | 2026-03-31T00:00:00 | Tião Medeiros | — | 2611652 | 1 | 0 | Dá nova redação à MPV 1345/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2635812 |
| 2622732 | EMC 203/2026 | Câmara | 2025-12-16T00:00:00 | Samuel Viana | — | 2595101 | 1 | 0 | Dá nova redação à MPV 1327/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2622732 |
| 2612088 | EMC 33/2026 | Câmara | 2025-12-05T00:00:00 | Rafael Prudente | — | 2589912 | 1 | 0 | Dá nova redação à MPV 1326/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2612088 |
| 2645824 | EMC 90/2026 | Câmara | 2026-05-18T00:00:00 | Luis Carlos Heinze, Luis Carlos Heinze, Luis Carlos Heinze | — | 2624161 | 1 | 0 | Dá nova redação à MPV 1357/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2645824 |
| 2612103 | EMC 45/2026 | Câmara | 2025-12-08T00:00:00 | Mecias de Jesus, Mecias de Jesus | — | 2589912 | 1 | 0 | Dá nova redação à MPV 1326/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2612103 |
| 2636307 | EMC 15/2026 | Câmara | 2026-04-10T00:00:00 | Plínio Valério, Plínio Valério, Plínio Valério | — | 2613550 | 1 | 0 | Dá nova redação à MPV 1348/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636307 |
| 2622744 | EMC 215/2026 | Câmara | 2025-12-16T00:00:00 | Pompeo de Mattos | — | 2595101 | 1 | 0 | Dá nova redação à MPV 1327/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2622744 |
| 2636301 | EMC 9/2026 | Câmara | 2026-04-09T00:00:00 | Alessandro Vieira, Alessandro Vieira | — | 2613550 | 1 | 0 | Dá nova redação à MPV 1348/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636301 |
| 2642549 | EMC 6/2026 | Câmara | 2026-08-11T13:04:26 | Vinicius Carvalho | — | 2613071 | 1 | 0 | COMISSÃO DE DESENVOLVIMENTO ECONÔMICO  PROJETO DE LEI Nº 1.571, DE 2026  Dispõe sobre o marco regulatório das relações contratuais de correspondência bancária no País, estabelece diretrizes de proteção econômica, paridade de condições comerciais, transparência e devido processo sancionador, e dá outras providências.  EMENDA MODIFICATIVA | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2642549 |
| 2601029 | EMC-A 3/0 | Câmara | 2026-02-05T07:25:50 | Comissão de Finanças e Tributação | — | 2452880 | 1 | 0 | Emenda Adotada pela Comissão ao PL 3162/2024 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2601029 |
| 2616520 | EMC-A 1/0 | Câmara | 2026-04-15T12:01:49 | Comissão de Constituição e Justiça e de Cidadania | — | 2195766 | 1 | 0 | Emenda Adotada pela Comissão ao PL 1827/2019 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2616520 |
| 2643434 | EMC-A 1/0 | Câmara | 2026-08-13T09:17:25 | Comissão de Constituição e Justiça e de Cidadania | — | 2123640 | 1 | 0 | Emenda Adotada pela Comissão ao PL 6897/2017 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2643434 |
| 2629334 | EMC-A 2/0 | Câmara | 2026-06-01T09:29:25 | Comissão de Agricultura, Pecuária, Abastecimento e Desenvolvimento Rural | — | 2589212 | 1 | 0 | Emenda Adotada pela Comissão ao PL 6011/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2629334 |
| 2639760 | EMC-A 1/0 | Câmara | 2026-07-15T15:23:02 | Comissão de Minas e Energia | — | 2354093 | 1 | 0 | Altera o artigo 1º da lei 9.847, de 26 de outubro de 1999, para incluir os § 5º e 6º que versam sobre a criação das diretrizes de combate ao combustível adulterado. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2639760 |
| 2622390 | EMP 70/0 | Câmara | 2026-05-06T17:26:11 | Tarcísio Motta, Marina Silva, Mário Heringer, Pedro Uczai | Aguardando Providências Internas | 2447259 | 2 | 0 | Institui a Política Nacional de Minerais Críticos e Estratégicos (PNMCE), o Comitê de Minerais Críticos e Estratégicos (CMCE), vinculado ao Conselho Nacional de Política Mineral, e dá outras providências. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2622390 |
| 2617863 | EMP 4/0 | Câmara | 2026-04-22T19:34:34 | Tarcísio Motta, Mário Heringer, Pedro Uczai | Aguardando Providências Internas | 2447259 | 2 | 0 | Altera o caput do art. 14 do Projeto de Lei n. 2780/2024 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2617863 |
| 2622443 | EMP 83/0 | Câmara | 2026-05-06T18:12:45 | Marangoni | Aguardando Providências Internas | 2447259 | 2 | 0 | Institui a Política Nacional de Minerais Críticos e Estratégicos (PNMCE), o Comitê de Minerais Críticos e Estratégicos (CMCE), vinculado ao Conselho Nacional de Política Mineral, e dá outras providências. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2622443 |
| 2621331 | EMP 3/0 | Câmara | 2026-05-05T15:42:15 | Gilson Marques, Luiz Lima | Aguardando Providências Internas | 289361 | 1 | 0 | Altera o art. 6º da Lei n° 10.826, de 2003 (Estatuto do Desarmamento). | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2621331 |
| 2617862 | EMP 3/0 | Câmara | 2026-04-22T19:34:34 | Tarcísio Motta, Mário Heringer, Pedro Uczai | Aguardando Providências Internas | 2447259 | 2 | 0 | Altera o caput do art. 20 do Projeto de Lei n. 2780/2024 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2617862 |
| 2615270 | EMR 11/0 | Câmara | 2026-04-10T13:12:00 | Sanderson | — | 1194323 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2615270 |
| 2639354 | EMR 1/0 | Câmara | 2026-07-14T11:46:03 | AJ Albuquerque | — | 2602943 | 1 | 0 | Altera a Lei nº 9.503, de 23 de setembro de 1997, que institui o Código de Trânsito Brasileiro, para dispor sobre infração de trânsito registrada por equipamento audiovisual. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2639354 |
| 2607184 | EMR 6/0 | Câmara | 2026-03-05T14:19:00 | Chris Tonietto | — | 2242638 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2607184 |
| 2642848 | EMR 3/0 | Câmara | 2026-08-12T09:35:00 | Ricardo Ayres | — | 2627579 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2642848 |
| 2626463 | EMR 1/0 | Câmara | 2026-05-20T16:07:55 | Leonardo Monteiro | — | 2506519 | 1 | 0 | Dispõe sobre a vedação à concessão de benefícios fiscais federais a pessoas físicas e jurídicas condenadas por exploração de trabalho em condições análogas à de escravo e trabalho infantil. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2626463 |
| 2614836 | EMS 1/2026 | Câmara | 2026-04-08T21:21:07 | Senado Federal | Aguardando Encaminhamento | 2612289 | 2 | 0 | Emendas do Senado ao Projeto de Lei de Conversão nº 1, de 2026 (Medida Provisória nº 1.323, de 2025), que “Altera a Lei nº 10.779, de 25 de novembro de 2003, para dispor sobre o recebimento dos pedidos de pagamento e da identificação dos beneficiários; estabelece regras de preservação financeira do Fundo de Amparo ao Trabalhador; e dá outras providências”. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614836 |
| 2640273 | EMS 1242/2026 | Câmara | 2026-07-16T18:36:43 | Senado Federal | — | 2168236 | 2 | 0 | Substitutivo do Senado ao Projeto de Lei nº 9.600, de 2018, que “Altera a Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil) e o Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal), para dispor sobre a proteção da imagem, da honra e da dignidade da pessoa e da família vítimas de crime ou acidente, inclusive quanto à divulgação de imagem de cadáver”.  Substitua-se o Projeto pelo seguinte:  Altera a Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil) e o Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal), para dispor sobre a proteção da imagem, da honra e da dignidade da pessoa vítima de crime ou de acidente, bem como de cadáver. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2640273 |
| 2617616 | ESB 2/2026 | Câmara | 2026-04-22T14:40:12 | Rogéria Santos | — | 2615771 | 1 | 0 | Emenda modificativa ao Substitutivo ao PL 3.140, de 2025 que “Institui o Programa Nacional de Ambientes Seguros e Inclusivos para Mulheres e Pessoas em Situação de Vulnerabilidade e cria o Selo BR-Acolhe, com o objetivo de promover ambientes seguros e inclusivos e fomentar o letramento em direitos no setor de serviços, entretenimento e hospitalidade.” | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2617616 |
| 2639394 | ESB 59/2026 | Câmara | 2026-07-13T17:59:01 | Igor Timo | — | 2635538 | 1 | 0 | Acrescenta parágrafo ao art. 90 do Substitutivo ao Projeto de Lei nº 3.080, de 2020. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2639394 |
| 2639388 | ESB 53/2026 | Câmara | 2026-07-13T17:59:01 | Igor Timo | — | 2635538 | 1 | 0 | Modifica o art. 1º do Substitutivo ao Projeto de Lei nº 3.080, de 2020. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2639388 |
| 2636196 | ESB 2/2026 | Câmara | 2026-07-01T11:53:35 | Amom Mandel | — | 2635538 | 1 | 0 | Emenda supressiva ao substitutivo do relator ao Projeto de Lei nº 3.080, de 2020. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636196 |
| 2639680 | ESB 4/2026 | Câmara | 2026-07-15T11:30:27 | Rogéria Santos | — | 2635557 | 1 | 0 | Emenda modificativa ao Substitutivo ao PL 6.191, de 2016 que “Dispõe sobre a publicidade de cunho misógino, sexista ou estimuladora de agressão ou violência sexual.” | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2639680 |
| 2604901 | SBE-A 1/0 | Câmara | 2026-02-25T18:56:00 | Comissão de Saúde | — | 2534512 | 1 | 0 | Subemenda Adotada pela Comissão ao PL 4729/2024 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2604901 |
| 2614755 | SBE-A 1/0 | Câmara | 2026-04-08T18:58:00 | Comissão de Constituição e Justiça e de Cidadania | — | 2572483 | 1 | 0 | Subemenda Adotada pela Comissão ao PL 667/2021 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614755 |
| 2627279 | SBE-A 1/0 | Câmara | 2026-05-22T13:50:04 | Comissão de Finanças e Tributação | — | 2413425 | 1 | 0 | Institui medidas de incentivo à doação e venda de equipamentos de informática usados. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2627279 |
| 2629409 | SBE-A 1/0 | Câmara | 2026-06-01T13:07:48 | Comissão de Finanças e Tributação | — | 2605332 | 1 | 0 | . | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2629409 |
| 2607141 | SBE-A 1/0 | Câmara | 2026-03-05T12:00:53 | Comissão de Constituição e Justiça e de Cidadania | — | 2294100 | 1 | 0 | Subemenda Adotada pela Comissão ao PL 426/2019 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2607141 |
| 2638391 | SBR 1/0 | Câmara | 2026-07-08T17:40:13 | Tarcísio Motta | — | 2534399 | 1 | 0 | Estabelece como conteúdo obrigatório da formação inicial dos professores da educação básica o estudo das características dos alunos com Transtorno do Espectro Autista - TEA e das metodologias apropriadas de ensino para essa clientela. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2638391 |
| 2640252 | SBR 1/0 | Câmara | 2026-07-16T17:54:43 | Erika Hilton | — | 2615156 | 1 | 0 | Institui a Política Nacional de Assistência às Pessoas com Endometriose. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2640252 |
| 2638681 | SBR 8/0 | Câmara | 2026-07-09T16:00:00 | Ana Paula Lima | — | 2528854 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2638681 |
| 2623453 | SBR 1/0 | Câmara | 2026-05-11T10:30:22 | Roberto Duarte | — | 2500151 | 1 | 0 | Altera o Decreto-Lei nº 5.452, de 1º de maio de 1943 (Consolidação das Leis do Trabalho), para estabelecer tratamento favorecido à empresa que observar a proporcionalidade de nacionalização do trabalho | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2623453 |
| 2620102 | SBR 1/0 | Câmara | 2026-04-28T15:16:00 | Laura Carneiro | — | 2575130 | 1 | 0 | Institui a Política Nacional de Diagnóstico e Tratamento da Hipertensão Pulmonar; e altera a Lei nº 13.146, de 6 de julho de 2015 (Lei Brasileira de Inclusão da Pessoa com Deficiência), para reconhecer a hipertensão pulmonar como deficiência. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2620102 |
| 2644765 | SBT 1/0 | Câmara | 2026-08-28T11:09:00 | Laura Carneiro | — | 2296776 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2644765 |
| 2611648 | SBT 1/0 | Câmara | 2026-03-24T20:24:20 | Ana Pimentel | — | 2566205 | 1 | 0 | Altera a Lei nº 11.664, de 29 de abril de 2008, que dispõe sobre a efetivação de ações de saúde que assegurem a prevenção, a detecção, o tratamento e o seguimento dos cânceres do colo uterino, de mama e colorretal no âmbito do Sistema Único de Saúde (SUS), para criar programa nacional de prevenção e enfrentamento do câncer do colo uterino entre mulheres negras e indígenas. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2611648 |
| 2637875 | SBT 1/0 | Câmara | 2026-07-07T19:47:00 | Jandira Feghali | — | 2606313 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2637875 |
| 2645716 | SBT 2/0 | Câmara | 2026-09-03T14:06:28 | Capitão Alden | — | 2374236 | 1 | 0 | Altera a Lei nº 14.133, de 2021, e a Lei nº 9.503, de 1997, para prever a divulgação de relatório de estado veicular antes da realização de leilão de veículo automotor. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2645716 |
| 2629222 | SBT 3/0 | Câmara | 2026-05-29T10:19:47 | Padre João | — | 2231783 | 1 | 0 | Altera os arts. 1º, 2º, 8º e 11 da Lei nº 11.947, de 16 de junho de 2009, para especificar definições referentes ao Programa Nacional de Alimentação Escolar (Pnae). | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2629222 |
| 2632233 | SBT 2/0 | Câmara | 2026-06-12T11:21:00 | Nely Aquino | — | 2561205 | 1 | 0 | — | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2632233 |
| 2637858 | SBT 1/0 | Câmara | 2026-07-07T19:18:31 | Duda Ramos | — | 2347315 | 1 | 0 | Altera a Lei nº 11.124, de 2005, que dispõe sobre o Sistema Nacional de Habitação de Interesse Social – SNHIS e dá outras providências | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2637858 |
| 2610649 | SBT 1/0 | Câmara | 2026-03-18T19:53:46 | Sâmia Bomfim | — | 2524355 | 1 | 0 | Altera a Lei nº 9.394/1996 (Lei de Diretrizes e Bases da Educação Nacional) para dispor sobre a inclusão do tema da violência contra as mulheres nos currículos escolares. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2610649 |
| 2636092 | SBT 2/0 | Câmara | 2026-07-01T11:03:50 | Capitão Alden | — | 2603683 | 1 | 0 | Institui o Marco Legal de Integridade e Fiscalização de Pessoas Expostas Politicamente, estabelece diretrizes para identificação, monitoramento e auditoria baseados em risco, e dá outras providências | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636092 |
| 2624936 | SBT 1/0 | Câmara | 2026-05-14T11:07:40 | Rodrigo Valadares | — | 2482914 | 1 | 0 | Institui a Política Nacional de Infraestruturas de Cabos Subaquáticos (PNICS) e dá outras providências. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2624936 |
| 2636669 | SBT-A 1/0 | Câmara | 2026-07-02T09:31:38 | Comissão de Cultura | — | 2520700 | 1 | 0 | Reconhece a panelada, prato típico do Estado do Ceará, como manifestação da cultura nacional. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636669 |
| 2621593 | SBT-A 1/0 | Câmara | 2026-05-05T17:44:21 | Comissão de Ciência, Tecnologia e Inovação | — | 2441318 | 1 | 0 | Altera a Lei nº 15.211, de 17 de setembro de 2025 (Estatuto Digital da Criança e do Adolescente), para incluir a obrigação de que produtos e serviços de tecnologia da informação disponham de funcionalidades destinadas a prevenir e a facilitar a denúncia de casos de exploração, violência e abuso sexual, de sequestro e de aliciamento. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2621593 |
| 2617197 | SBT-A 1/0 | Câmara | 2026-04-16T15:40:25 | Comissão de Saúde | — | 2503579 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 2063/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2617197 |
| 2624803 | SBT-A 1/0 | Câmara | 2026-05-14T11:02:35 | Comissão de Meio Ambiente e Desenvolvimento Sustentável | — | 2486448 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 885/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2624803 |
| 2631685 | SBT-A 1/0 | Câmara | 2026-06-10T19:42:12 | Comissão de Educação | — | 2602520 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 480/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2631685 |
| 2614388 | SBT-A 1/0 | Câmara | 2026-04-08T11:44:54 | Comissão de Defesa dos Direitos das Pessoas com Deficiência | — | 2599428 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 6825/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614388 |
| 2614937 | SBT-A 1/0 | Câmara | 2026-04-09T14:29:54 | Comissão da Amazônia e dos Povos Originários e Tradicionais | — | 2358498 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 2156/2023 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2614937 |
| 2630126 | SBT-A 1/0 | Câmara | 2026-06-08T10:57:15 | Comissão de Segurança Pública e Combate ao Crime Organizado | — | 2611694 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 1383/2026 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2630126 |
| 2620524 | SBT-A 1/0 | Câmara | 2026-04-30T16:51:42 | Comissão de Desenvolvimento Econômico | — | 2508836 | 1 | 0 | Substitutivo adotado pela Comissão ao PL 2302/2025 | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2620524 |
| 2636839 | SBT-A 1/0 | Câmara | 2026-07-02T14:59:56 | Comissão de Comunicação | — | 2594447 | 1 | 0 | Substitutivo adotado pela Comissão de Comunicação ao PL 6260/2025. | https://dadosabertos.camara.leg.br/api/v2/proposicoes/2636839 |

## Parte 3 — Consulta direta às fontes oficiais

Teste ao vivo: **500 emendas**, **333 pais únicos**, **2499 requisições**, zero falhas. Endpoints: `/proposicoes/{id}/tramitacoes`, `/relacionadas` e `/votacoes`, tanto para a emenda quanto para o pai. A documentação oficial descreve esses recursos em [Swagger/API](https://dadosabertos.camara.leg.br/swagger/api.html) e explica as limitações das relações de votação em [Como usar dados de votações](https://dadosabertos.camara.leg.br/howtouse/2020-02-07-dados-votacoes.html).

Payload observado para EMC 2645674: o detalhe individual trouxe `uriPropPrincipal:null`; `/tramitacoes` trouxe `dataHora=2026-09-03T10:47`, `descricaoTramitacao=Apresentação de Proposição`, `siglaOrgao=CAPADR` e o despacho; `/votacoes` e `/relacionadas` vieram vazios. Já o registro do mesmo ID no arquivo oficial `proposicoes-2026.json` contém `uriPropPrincipal=https://.../2610158`. No pai 2610158, `/relacionadas` inclui 2645674 e `/votacoes` contém 2610158-24, “Aprovado o Parecer”. Isso comprova vínculo e contexto, mas não comprova isoladamente aprovação da EMC 2645674.

| Campo investigado | Fonte observada | Resultado |
| --- | --- | --- |
| A–E pai, relação, data, órgão, autores | Arquivo anual; detalhe; autores | Pai estruturado 100%; data/órgão/autor amplamente disponíveis. |
| F–H movimentos/situação/histórico | `/{id}/tramitacoes` | 100% com evento; 10% com 2+ eventos na amostra. Situação frequentemente nula. |
| I relator | `uriUltimoRelator` em tramitação | Disponível quando publicado; não apareceu como histórico autônomo para a maioria. |
| J parecer | Tramitação e relacionadas do pai | Textual/relacional; exige relacionar PRL/PAR ao pai, não à emenda automaticamente. |
| K votação própria | `/{id}/votacoes` | 0/500. |
| L–T destino na matéria-pai | Tramitações/votações/relacionadas do pai | Parcial; informação pode existir, mas frequentemente é agregada ou não identifica a emenda. |
| U–Y texto/documentos/relações/destaque/data | Inteiro teor, relacionadas, tramitação e votação | Texto e relação são fortes; destaque/resultado individual permanecem parciais. |

## Parte 4 — Proposição-pai

| Sigla | Testado ao vivo | Pai identificado | Método | Cobertura no acervo | Confiabilidade | Endpoint/campo |
| --- | --- | --- | --- | --- | --- | --- |
| EMA | 5 | 5 | ESTRUTURADO | 5/5 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| EMC | 116 | 116 | ESTRUTURADO | 1340/1340 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| EMC-A | 35 | 35 | ESTRUTURADO | 313/313 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| EMP | 44 | 44 | ESTRUTURADO | 423/423 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| EMR | 52 | 52 | ESTRUTURADO | 454/454 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| EMS | 2 | 2 | ESTRUTURADO | 2/2 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| ESB | 25 | 25 | ESTRUTURADO | 119/119 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| SBE-A | 23 | 23 | ESTRUTURADO | 130/130 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| SBR | 27 | 27 | ESTRUTURADO | 204/204 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| SBT | 110 | 110 | ESTRUTURADO | 1543/1543 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |
| SBT-A | 61 | 61 | ESTRUTURADO | 636/636 (100,0%) | Alta | Arquivo `proposicoes-2026.json`: `uriPropPrincipal`; confirmação: pai `/relacionadas` |

**Fato:** 5169/5.169 pais estão estruturados no arquivo anual; 500/500 foram confirmados reciprocamente ao vivo. Não é necessário regex no título. O endpoint de detalhe individual não é substituto confiável para esse campo porque retornou `null` em exemplos testados.

## Parte 5 — Tramitação

| Sigla | Amostra | Com evento próprio | Com 2+ eventos | Evento original predominante | Timestamp | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| EMA | 5 | 5 (100,0%) | 5 (100,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| EMC | 116 | 116 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| EMC-A | 35 | 35 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| EMP | 44 | 44 (100,0%) | 43 (97,7%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| EMR | 52 | 52 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| EMS | 2 | 2 (100,0%) | 2 (100,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| ESB | 25 | 25 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| SBE-A | 23 | 23 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| SBR | 27 | 27 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| SBT | 110 | 110 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |
| SBT-A | 61 | 61 (100,0%) | 0 (0,0%) | Apresentação de Proposição | Sim | `GET /proposicoes/{id}/tramitacoes` |

Eventos adicionais observados nas siglas com múltiplos registros incluem `Relatório de Conferência de Assinaturas`, sobretudo EMA/EMP, e `Publicação de Documento` em EMS. Para EMC, EMC-A, EMR, ESB, SBE-A, SBR, SBT e SBT-A, a amostra mostrou essencialmente uma apresentação individual; a sequência posterior aparece, quando existe, no processo da matéria-pai.

## Parte 6 — Resultado da emenda

A busca conservadora só aceita texto do evento do pai quando ele menciona **sigla e número exatos** da emenda. Menção genérica a “emendas”, aprovação do parecer ou votação da matéria não foi convertida em resultado individual.

| Emenda | Pai | Resultado original/trecho | Normalização proposta | Fonte | Timestamp | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| EMP 60 · 2622291 | 2447259 | Retirada pelo Autor(a) (Plenário) Aguardando Envio ao Senado Federal Retirado o DTQ 6 (UNIÃO, PP, PSD, REPUBLICANOS, MDB, Federação PSDB CIDADANIA, PODE): Destaque de Emenda do(a) EMP 79/2026, apresentado ao PL 2.780/2024 (161, II).  | retirada | Tramitação própria/pai | 2026-05-06T13:55 | Textual com identificação exata |

Taxonomia sugerida somente para textos observados e futuros: preservar `resultado_original`; normalizar depois para aprovada, aprovada parcialmente, rejeitada, prejudicada, retirada, inadmitida, incorporada ou pendente. Não inferir “incorporada” a partir de parecer aprovado.

## Parte 7 — Votações e destaques

| Sigla | Votação própria | Pai com alguma votação | O que isso prova |
| --- | --- | --- | --- |
| EMA | 0/5 | 5/5 | Contexto do pai; não o resultado individual |
| EMC | 0/116 | 111/116 | Contexto do pai; não o resultado individual |
| EMC-A | 0/35 | 33/35 | Contexto do pai; não o resultado individual |
| EMP | 0/44 | 44/44 | Contexto do pai; não o resultado individual |
| EMR | 0/52 | 36/52 | Contexto do pai; não o resultado individual |
| EMS | 0/2 | 1/2 | Contexto do pai; não o resultado individual |
| ESB | 0/25 | 0/25 | Contexto do pai; não o resultado individual |
| SBE-A | 0/23 | 0/23 | Contexto do pai; não o resultado individual |
| SBR | 0/27 | 0/27 | Contexto do pai; não o resultado individual |
| SBT | 0/110 | 76/110 | Contexto do pai; não o resultado individual |
| SBT-A | 0/61 | 60/61 | Contexto do pai; não o resultado individual |

A documentação oficial adverte que votações de proposições acessórias podem ser registradas como votações da principal e que o objeto real pode ser impossível de identificar. A reconstrução só é segura quando `/votacoes/{id}` ou seus `proposicoesAfetadas`/`objetosPossiveis`, descrição ou apresentação imediatamente anterior identificam a emenda. O coletor atual já lê `proposicoesAfetadas` e `objetosPossiveis` em `camara-proposition-details.ts:44-45`, mas só para proposições efetivamente enriquecidas.

## Parte 8 — Substitutivos

| Tipo | Comportamento observado | Pai | Adoção/resultado |
| --- | --- | --- | --- |
| SBT | Objeto acessório do parecer/relator; apresentação própria | Estruturado 100% | A adoção precisa ser comprovada no parecer, deliberação ou SBT-A; não inferir pela mera existência. |
| SBT-A | “Substitutivo adotado pela Comissão” no tipo/ementa | Estruturado 100% | A própria categoria comprova adoção pela comissão, mas não aprovação final da matéria. |
| SBR | Substitutivo reformulado | Estruturado 100% | Resultado individual não apareceu na votação própria da amostra. |
| SBE-A | Subemenda adotada pela comissão | Estruturado 100% | Categoria comprova adoção naquele colegiado, não resultado final. |
| ESB | Emenda a substitutivo | Estruturado 100% | Necessita resultado identificado no pai/parecer. |
| EMS | Emenda/substitutivo recebido do Senado | Estruturado 100% | Histórico próprio com publicação/apresentação; destino posterior deve ser ligado ao processo principal. |

Exemplo real: SBT-A 2640141 aparece em `/proposicoes/2610158/relacionadas` como “Substitutivo adotado pela Comissão ao PL 1248/2026”. SBT 2632572 aparece como substitutivo do relator e PRL 2632567 declara aprovação do PL e de três emendas “com substitutivo”. Esses textos conectam o contexto, mas a normalização deve manter separadas proposta do relator, adoção em comissão e resultado final.

## Parte 9 — Dados recebidos e descartados

| Endpoint/arquivo | Campo original | Existe | Persistido hoje | Uso |
| --- | --- | --- | --- | --- |
| `proposicoes-2026.json` | `uriPropPrincipal` | SIM (5.169/5.169) | NÃO | Relação pai estruturada |
| Mesmo | `uriPropAnterior` / `uriPropPosterior` | SIM quando publicado | NÃO | Versões/encadeamento |
| Mesmo | `codTipo`, `descricaoTipo` | SIM | NÃO | Semântica da espécie |
| Mesmo | `ultimoStatus.despacho`, códigos, órgão, URL | SIM | Só descrição de situação e relator parcial | Evento inicial e contexto |
| Mesmo | `urlInteiroTeor`, `keywords` | SIM | NÃO no `Proposal` | Documento e busca |
| `/{id}/tramitacoes` | evento completo | SIM | NÃO para 5.167/5.169 na base ativa | Timeline própria |
| Pai `/relacionadas` | lista de acessórios | SIM | NÃO herdado para a emenda | Confirmação recíproca |
| Pai `/votacoes` + `/votacoes/{id}` | afetadas/objetos/descrição | PARCIAL | Somente quando pai enriquecido | Destino quando identificável |

## Parte 10 — Endpoints e fontes não aproveitados plenamente

| Fonte | Parâmetros/paginação | Siglas | Campos úteis | Limitação | Custo |
| --- | --- | --- | --- | --- | --- |
| Arquivo anual `proposicoes-{ano}.json` | Download diário; sem paginação | Todas | Pai, anterior/posterior, status, órgão, inteiro teor | Snapshot, não histórico completo | 1 arquivo/ano |
| `GET /proposicoes/{id}/tramitacoes` | ID; suporta datas; links de paginação | Todas testadas | Data, órgão, relator, despacho, situação | Maioria tem só apresentação | 1+ páginas/emenda |
| `GET /proposicoes/{pai}/relacionadas` | ID do pai | Todas | Acessórios do processo | Não informa natureza/resultado em campo separado | 1 por pai |
| `GET /proposicoes/{pai}/votacoes` | ID do pai | Todas por contexto | Votações relacionadas | Ter votação não identifica a emenda | 1 por pai + detalhe/votação |
| `GET /votacoes/{id}` | ID da votação | Quando houver | Possíveis objetos, afetadas, descrição, aprovação | Objeto pode ser ambíguo | 1 por votação |
| `GET /eventos/{id}/pauta` e `/votacoes` | ID do evento | Quando pautada | Pauta e decisões do evento | Pode listar só a principal | 1–2 por evento |

Rate limit oficial: **NÃO VERIFICADO**; a documentação consultada não publicou um limite numérico. Não foi necessário scraping HTML para o pai, pois o arquivo anual oficial resolve de forma estruturada.

## Parte 11 — Teste em lote

| Sigla | n | Pai | Pai confirma filha | Histórico | 2+ eventos | Votação própria | Pai com votação | Resultado individual inequívoco | Sem enriquecimento possível |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EMA | 5 | 5 (100,0%) | 5 (100,0%) | 5 (100,0%) | 5 (100,0%) | 0 (0,0%) | 5 (100,0%) | 0 (0,0%) | 0 (0,0%) |
| EMC | 116 | 116 (100,0%) | 116 (100,0%) | 116 (100,0%) | 0 (0,0%) | 0 (0,0%) | 111 (95,7%) | 0 (0,0%) | 0 (0,0%) |
| EMC-A | 35 | 35 (100,0%) | 35 (100,0%) | 35 (100,0%) | 0 (0,0%) | 0 (0,0%) | 33 (94,3%) | 0 (0,0%) | 0 (0,0%) |
| EMP | 44 | 44 (100,0%) | 44 (100,0%) | 44 (100,0%) | 43 (97,7%) | 0 (0,0%) | 44 (100,0%) | 1 (2,3%) | 0 (0,0%) |
| EMR | 52 | 52 (100,0%) | 52 (100,0%) | 52 (100,0%) | 0 (0,0%) | 0 (0,0%) | 36 (69,2%) | 0 (0,0%) | 0 (0,0%) |
| EMS | 2 | 2 (100,0%) | 2 (100,0%) | 2 (100,0%) | 2 (100,0%) | 0 (0,0%) | 1 (50,0%) | 0 (0,0%) | 0 (0,0%) |
| ESB | 25 | 25 (100,0%) | 25 (100,0%) | 25 (100,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) |
| SBE-A | 23 | 23 (100,0%) | 23 (100,0%) | 23 (100,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) |
| SBR | 27 | 27 (100,0%) | 27 (100,0%) | 27 (100,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) | 0 (0,0%) |
| SBT | 110 | 110 (100,0%) | 110 (100,0%) | 110 (100,0%) | 0 (0,0%) | 0 (0,0%) | 76 (69,1%) | 0 (0,0%) | 0 (0,0%) |
| SBT-A | 61 | 61 (100,0%) | 61 (100,0%) | 61 (100,0%) | 0 (0,0%) | 0 (0,0%) | 60 (98,4%) | 0 (0,0%) | 0 (0,0%) |

“Pai com votação” não equivale a “emenda apreciada”. “Sem enriquecimento possível” exige simultaneamente ausência de pai e de histórico próprio; foi 0/500. Documentos foram avaliados no banco atual, não por download do inteiro teor: o URL de inteiro teor está disponível no arquivo para praticamente todo o acervo.

## Parte 12 — Matriz de enriquecimento

### EMA
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### EMC
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### EMC-A
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### EMP
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 2,3% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 2,3% na amostra |
### EMR
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### EMS
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### ESB
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### SBE-A
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### SBR
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### SBT
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |
### SBT-A
| Informação | Disponível na fonte? | Já coletamos? | Podemos coletar? | Fonte/endpoint | Cobertura estimada |
| --- | --- | --- | --- | --- | --- |
| matéria-pai | SIM | NÃO | SIM | Arquivo anual `uriPropPrincipal` | 100,0% |
| tramitação | SIM | NÃO | SIM | `/{id}/tramitacoes` | 100,0% na amostra |
| resultado | PARCIAL | NÃO | PARCIAL | Pai: tramitações/votações/pareceres | 0,0% inequívoco na amostra |
| votação | PARCIAL | NÃO | PARCIAL | `/{id}/votacoes`; pai/votação detalhe | 0,0% própria |
| relator | PARCIAL | NÃO | SIM quando publicado | `uriUltimoRelator` da tramitação | Não mensurado isoladamente |
| parecer | PARCIAL | NÃO | PARCIAL | Relacionadas/tramitação do pai | Não há vínculo emenda→parecer garantido |
| documento | SIM | NÃO | SIM | `urlInteiroTeor` | Quase integral no arquivo |
| pauta | PARCIAL | NÃO | PARCIAL | Evento/pauta do pai | Não identifica sempre a emenda |
| timestamp resultado | PARCIAL | NÃO | PARCIAL | Evento/votação inequívoco | 0,0% na amostra |

## Parte 13 — Mudanças necessárias nos coletores — sem implementação

1. Em `activity.ts:20`, criar `relationship` para `uriPropPrincipal` (e anterior/posterior quando houver), `document` para `urlInteiroTeor` e preservar o status bruto relevante. Reutilizar `legislative_complements`; não é necessária tabela nova.
2. Em `proposition-enrichment.ts:7-14`, selecionar pelo ano de `presentedAt` quando `year` é nulo/zero e priorizar explicitamente o grupo; não usar o ano nominal do acessório como único critério.
3. Em `camara-proposition-details.ts`, aceitar uma relação pai fornecida pelo catálogo anual, pois o detalhe individual pode devolver `null`; consultar o pai uma vez e compartilhar relacionadas/votações entre todas as filhas.
4. Em `camara-proposition-movements.ts`, remover o filtro terminal para este backfill e incluir as 11 siglas; depois coletar incrementalmente apenas IDs novos/alterados.
5. Persistir `movement` com chave `movement:{id}:{sequencia}`; `relationship` com `relationship:{id}:principal:{pai}`; `document` pelo URL/código; `vote_effect` por `{emenda}:{votacao}:{efeito}:{alvo}`. Essas chaves já seguem o padrão existente e são idempotentes.
6. Resultado: manter `resultado_original`, fonte, timestamp e nível de evidência. Só normalizar quando a emenda for identificada de modo inequívoco. Uma votação do pai sem identificação deve permanecer contexto herdado, não resultado.
Volume mínimo estimado: 5.169 relações pai, cerca de 5.169 eventos de apresentação, documentos do inteiro teor e eventos adicionais; mais relações/votações compartilhadas entre pais. O teste encontrou 333 pais para 500 emendas, razão de 0.666 pai por emenda.

## Parte 14 — Custo de enriquecimento

| Fase | Estratégia | Chamadas estimadas | Atualização |
| --- | --- | --- | --- |
| Backfill mínimo | Arquivo anual + autores | 1–2 downloads | Uma vez; reaproveitar snapshots |
| Backfill de movimentos próprios | `/tramitacoes` por emenda | ≈5.169 + paginação | Uma vez; repetir apenas pendentes |
| Contexto dos pais | relacionadas + votações por pai único | Estimativa amostral ≈3.443 pais × 2, não 5.169 × 2 | Compartilhar por pai |
| Detalhe das votações | Somente votações candidatas | Depende das votações dos pais; deduplicar ID | Imutáveis/finalizadas podem ser cacheadas |
| Incremental diário | Arquivo anual detecta novos/alterados; busca seletiva | Novos IDs + pais alterados | Diária |

O teste executou 2.499 chamadas em aproximadamente dois minutos com concorrência 12 e zero falhas neste ambiente. Isso não constitui garantia de SLA nem de limite oficial. Um backfill completo deve usar concorrência moderada, cache e retomada; estimativa operacional prudente: dezenas de minutos, sujeita à paginação e latência. Rate limit: NÃO VERIFICADO.

## Parte 15 — Timeline possível

### Timeline comprovável hoje com a base atual
| Etapa | Prova atual | Timestamp | Cobertura |
| --- | --- | --- | --- |
| Apresentada | `Proposal.presentedAt` do arquivo anual | Sim | 5.169/5.169 |
| Situação atual | `Proposal.status` | Sem data própria persistida | 432/5.169 |
| Demais etapas | Não persistidas | Não | Praticamente zero |

### Timeline comprovável após enriquecimento testado
| Etapa normalizada | Evento/campo oficial | Timestamp | Cobertura estimada |
| --- | --- | --- | --- |
| Apresentada | Primeiro `/tramitacoes`: “Apresentação de Proposição” | Sim | 500/500 |
| Vinculada à matéria | `uriPropPrincipal` + confirmação em pai `/relacionadas` | Não no vínculo; apresentação dá contexto | 500/500 |
| Documento publicado | `urlInteiroTeor` / “Publicação de Documento” | URL sempre; evento quando publicado | Alta, a medir |
| Conferência de assinaturas | Evento literal | Sim | EMA/EMP, parcial |
| Apreciada | Votação/andamento que identifica a emenda exata | Sim quando existe | Baixa na amostra |
| Resultado | Texto/efeito/votação que identifica a emenda exata | Sim quando existe | Baixa e dependente da sigla |
| Adotada pela comissão | Tipo oficial SBT-A/SBE-A e/ou evento correlato | Data de apresentação; evento de adoção precisa ser ligado | Estrutural para tipos “-A”, sem equivaler a resultado final |

## Parte 16 — Decisão final

**D — depende da sigla.** Para todas as siglas, pai, apresentação, autoria e documento são recuperáveis. EMA e EMP exibem mais histórico próprio; EMS tem dois exemplos com mais de um evento; SBT-A/SBE-A carregam semântica oficial de adoção pela comissão. Para EMC, EMC-A, EMR, ESB, SBR e SBT, a timeline própria tende a parar na apresentação e deve ser complementada por eventos inequívocos dentro da matéria-pai. Resultado e votação individual continuam parciais para todas.

| Sigla | Matéria-pai | Histórico | Resultado | Votação | Timeline viável? | Principal fonte |
| --- | --- | --- | --- | --- | --- | --- |
| EMA | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| EMC | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| EMC-A | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| EMP | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| EMR | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| EMS | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| ESB | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| SBE-A | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| SBR | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| SBT | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |
| SBT-A | SIM | SIM, geralmente curta | PARCIAL | PARCIAL; 0 próprias na amostra | SIM para apresentação/vínculo; resultado parcial | Arquivo anual + tramitação própria + contexto do pai |

### Respostas objetivas

1. **A qual proposição pertence?** Sim: 5.169/5.169 por `uriPropPrincipal`, confirmado em 500/500 no pai `/relacionadas`.
2. **Foi apreciada?** Parcialmente. A existência de votação do pai não basta; é preciso identificação inequívoca da emenda.
3. **Qual foi o resultado?** Parcialmente e com cobertura baixa; preservar o texto oficial e o grau de evidência.
4. **Quando ocorreu?** Sim quando existe evento/votação identificável; apresentação tem timestamp integral na amostra.
5. **Reconstrução retroativa?** Sim para apresentação, pai, autoria, documento e movimentos publicados; parcial para apreciação/resultado.
6. **Atualização diária?** Sim, usando o arquivo diário como detector e chamadas incrementais deduplicadas.
7. **Melhor cobertura?** EMA e EMP para múltiplos movimentos; SBT-A/SBE-A para semântica de adoção; EMS para histórico documental. A amostra por sigla é explicitada acima.
8. **Sem solução completa?** Todas permanecem sem garantia universal de resultado individual; EMC, EMC-A, EMR, ESB, SBR e SBT mostraram sobretudo apresentação própria.
9. **Timeline própria ou no pai?** Modelo híbrido: a emenda tem timeline própria curta; eventos herdados ficam embutidos como contexto da matéria-pai e só viram resultado da emenda quando a fonte a identifica inequivocamente.

## Evidências oficiais e limitações

- [Documentação Swagger da API da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html): endpoints e schemas usados.
- [Tutorial oficial de votações](https://dadosabertos.camara.leg.br/howtouse/2020-02-07-dados-votacoes.html): explica proposições afetadas, objetos possíveis e a ambiguidade de acessórios.
- [Nota oficial sobre `/relacionadas`](https://dadosabertos.camara.leg.br/news/noticias/2017-11-09-versao0_2_8.html): o endpoint foi criado para acessórios, pareceres, requerimentos, destaques e apensados.
- Os payloads ao vivo foram lidos em 23/09/2026. A API pode mudar; os números do teste têm os denominadores mostrados.
- Não foi feito scraping como fonte principal. O HTML só foi auditado como fallback já existente no código.

---

## Parte 17 — Resolução de votações das emendas pela matéria-pai

### Escopo e método

A mesma amostra estratificada de **500 emendas** foi mantida. Foram consultadas **333 matérias-pai**, suas listas de votações, tramitações e relacionadas, além de **813 detalhes distintos de votação**. Uma requisição falhou após as tentativas; os cálculos não tratam essa ausência como resposta vazia nem como inexistência de votação.

Para cada votação, foram examinados recursivamente `proposicoesAfetadas`, `objetosPossiveis`, IDs, URIs, última apresentação, descrições, ementas e resultados. As referências foram validadas contra as filhas oficiais de cada pai. Sigla/número sozinhos não foram aceitos quando havia colisão dentro do mesmo pai; órgão e timestamp foram preservados como discriminadores quando publicados.

**Resultado central:** a API criou muitos vínculos candidatos, mas nenhum resultado individual passou pelo padrão estrito de alta confiança nesta amostra. Isso não significa que nenhuma emenda tenha sido apreciada; significa que os payloads examinados não provaram de modo determinístico o resultado individual.

### Sinais encontrados
| Sinal | Ocorrência observada | Interpretação segura |
| --- | --- | --- |
| A. ID em `proposicoesAfetadas` | 0 ocorrências | Seria uma relação estruturada relevante, mas ainda exigiria ler a descrição do efeito. |
| B. ID em `objetosPossiveis` | 346 ocorrências de votação, cobrindo 142 emendas | Apenas candidatura a objeto. Não prova que aquela votação decidiu a emenda. |
| C. URI em campo estruturado | As mesmas ocorrências de `objetosPossiveis` | Mesma limitação: URI identifica o candidato, não o objeto real. |
| D. Sigla + número + ano no texto | 2 matches mecânicos | Ambos estavam em ementas de pareceres listados como objetos possíveis; a votação tratava de requerimento. |
| E. Número + tipo + órgão | Nenhum match conclusivo adicional | Útil para desambiguar, insuficiente sem referência conclusiva. |
| F. “Destaque de...” associado | Ocorrências textuais contextuais | O destino do destaque não equivale automaticamente ao destino da emenda. |
| G. Votação imediatamente relacionada | 0 MATCH_C validado | Proximidade temporal não bastou para identificar o mesmo objeto. |
| H. Parecer/deliberação menciona emenda | Encontrado, inclusive listas de EMP | Parecer pode recomendar; votação de requerimento/parecer não vira resultado individual. |
| I. Redação final/substitutivo incorpora | Nenhuma incorporação individual inequívoca validada | Não inferir incorporação pela aprovação do texto ou do parecer. |

### Níveis de match após validação
| Nível | Emendas sinalizadas | Eventos candidatos | Validade após revisão |
| --- | --- | --- | --- |
| MATCH_A_ESTRUTURADO | 142 | 346 | Todos os casos observados eram `objetosPossiveis`; mantê-los como candidatos estruturados, não como correspondência confirmada. |
| MATCH_B_EXATO | 2 | 2 | 2/2 rejeitados como prova: texto estava na ementa de parecer possível e a votação tratava de requerimento. |
| MATCH_C_PROCEDURAL | 0 | 0 | Nenhum caso satisfez identificação explícita + votação imediatamente ligada ao mesmo objeto. |
| MATCH_D_AMBÍGUO | 74 | 159 | Contexto apenas. |

A nomenclatura `MATCH_A_ESTRUTURADO` descreve a forma do sinal solicitado, mas, nos dados observados, a estrutura era exclusivamente `objetosPossiveis`. Por isso o match A não recebe automaticamente confiança alta nem resultado. Um futuro A em `proposicoesAfetadas` também deverá carregar e interpretar o efeito; a mera presença do ID não informa aprovação ou rejeição.

### Cobertura da amostra
| Sigla | n | Pai com votação | MATCH_A | MATCH_B | MATCH_C | Ambígua | Colisão sigla+número | Resultado alto confiança |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EMC | 116 | 111 | 2 | 0 | 0 | 66 | 0 | 0 |
| EMP | 44 | 44 | 41 | 2 | 0 | 1 | 0 | 0 |
| EMA | 5 | 5 | 5 | 0 | 0 | 1 | 0 | 0 |
| EMR | 52 | 36 | 31 | 0 | 0 | 2 | 4 | 0 |
| ESB | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SBT | 110 | 76 | 55 | 0 | 0 | 0 | 11 | 0 |
| SBT-A | 61 | 60 | 3 | 0 | 0 | 2 | 7 | 0 |
| SBR | 27 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| SBE-A | 23 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| EMS | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| EMC-A | 35 | 33 | 5 | 0 | 0 | 1 | 2 | 0 |

- Alguma votação na matéria-pai: **366/500 (73,2%)**.
- Ligação candidata A/B/C: **142/500 (28,4%)**. Todas dependem de `objetosPossiveis` ou texto interno a objetos possíveis; após validação, não são ligações conclusivas.
- MATCH_A: **142/500 (28,4%)**; MATCH_B: **2/500 (0,4%)**; MATCH_C: **0/500**.
- Contexto ambíguo adicional: **74/500 (14,8%)**.
- Resultado individual atribuível com alta confiança: **0/500 (0%)**.

### Colisões

A amostra contém filhos com a mesma sigla e número sob um mesmo pai, inclusive EMC-A, EMR, SBT, SBT-A, SBR e SBE-A. Além disso, descrições de votação podem dizer apenas “Emenda nº 1”, enquanto o processo contém EMC 1, EMP 1, SBT 1 ou objetos de órgãos diferentes. A chave de resolução deve sempre combinar `child_id`, `parent_id`, sigla, número, ano oficial quando utilizável, órgão e proximidade temporal. Se o ID estruturado não for o objeto confirmado e a referência textual não produzir um único filho, o caso permanece D.

### Tipo do objeto votado

A classificação deve descrever o ato efetivamente decidido: votação direta da emenda; destaque referente à emenda; parecer que menciona emenda; substitutivo que incorpora/menciona emenda; matéria-pai apenas; outro. Na amostra, vários IDs de emenda foram listados em `objetosPossiveis` de votações cuja descrição dizia “Aprovada a Redação Final”, “Aprovada a PEC”, “Aprovado o Requerimento” ou “Aprovado o Parecer”. Esses casos não são votação direta da emenda. Da mesma forma, “destaque rejeitado” só informa o resultado do destaque; o efeito jurídico sobre a emenda exige texto/efeito oficial adicional.

### Inventário de todos os matches encontrados
| emenda_id | emenda | pai_id | votação_id | tipo_match | tipo_objeto_votado | texto_original | resultado_original | resultado da emenda inferível? | resultado normalizado | confiança | justificativa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2628653 | EMA 1/0 | 2233802 | 2233802-440 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Leo Prates (REPUBLIC/BA). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-438 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 221, de 2019. . Sim: 461; Não: 19; Total: 480. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-437 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento nº 3.230/2026, dos Senhores Líderes, que solicita a quebra de interstício de 5 sessões previsto no § 6º do art. 202 do RICD, para apreciação do segundo turno da PEC 221, de 2019. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-424 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 221, de 2019. Sim: 472; Não: 22; Total: 494. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-421 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Preferência. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-416 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. Sim: 372; Não: 101; Total: 473. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628653 | EMA 1/0 | 2233802 | 2628423-9 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovado o Requerimento nº 3.223/2026, dos Senhores Líderes, que solicita a dispensa de interstício de 2 sessões previsto no parágrafo único do art. 150 do RICD, para a inclusão da Proposta de Emenda à Constituição nº 221, de 2019, na Ordem do Dia. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628653 | EMA 1/0 | 2233802 | 2233802-401 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovado o Parecer,  ressalvado(s) o(s) Destaque(s) com o seguinte resultado: 34 votos "Sim", 4 votos "Não". Quórum de votação: 38 votos, apresentou voto em separado o Deputado Gilson Marques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-183 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. André Figueiredo (PDT/CE). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-181 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 4. Sim: 386; Não: 1; Total: 387. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-178 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 383, de 2017. Sim: 444; Não: 12; Total: 456. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-169 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 383, de 2017, na forma da Emenda Aglutinativa nº 2. Sim: 464; Não: 16; Total: 480. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-165 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Preferência. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614417 | EMA 2/0 | 2162116 | 2162116-161 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 36; Não: 409; Total: 445. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-124 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Dr. Fernando Máximo (UNIÃO-RO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-122 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 5, de 2023. Sim: 368; Não: 96; Abstenção: 7; Total: 471. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-121 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento nº 4.491/2024, dos Senhores Líderes, que solicita a quebra de interstício de 5 sessões previsto no § 6º do art. 202 do RICD, para apreciação do segundo turno da PEC 5, de 2023. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-115 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 335; Não: 117; Abstenção: 5; Total: 457. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-112 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 342; Não: 113; Abstenção: 5; Total: 460. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-108 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 340; Não: 110; Abstenção: 7; Total: 457. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-104 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 5, de 2023, na forma da Emenda Aglutinativa Substitutiva nº 3. Sim: 385; Não: 93; Abstenção: 7; Total: 485. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-102 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a preferência. Sim: 467; Não: 4; Abstenção: 1; Total: 472. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628701 | EMA 3/0 | 2351506 | 2351506-95 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 102; Não: 322; Abstenção: 1; Total: 425. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-124 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Dr. Fernando Máximo (UNIÃO-RO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-122 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 5, de 2023. Sim: 368; Não: 96; Abstenção: 7; Total: 471. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-121 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento nº 4.491/2024, dos Senhores Líderes, que solicita a quebra de interstício de 5 sessões previsto no § 6º do art. 202 do RICD, para apreciação do segundo turno da PEC 5, de 2023. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-115 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 335; Não: 117; Abstenção: 5; Total: 457. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-112 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 342; Não: 113; Abstenção: 5; Total: 460. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-108 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 340; Não: 110; Abstenção: 7; Total: 457. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-104 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 5, de 2023, na forma da Emenda Aglutinativa Substitutiva nº 3. Sim: 385; Não: 93; Abstenção: 7; Total: 485. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-102 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a preferência. Sim: 467; Não: 4; Abstenção: 1; Total: 472. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628703 | EMA 4/0 | 2351506 | 2351506-95 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 102; Não: 322; Abstenção: 1; Total: 425. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-183 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. André Figueiredo (PDT/CE). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-181 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 4. Sim: 386; Não: 1; Total: 387. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-178 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 383, de 2017. Sim: 444; Não: 12; Total: 456. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-169 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 383, de 2017, na forma da Emenda Aglutinativa nº 2. Sim: 464; Não: 16; Total: 480. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-165 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Preferência. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614362 | EMA 1/0 | 2162116 | 2162116-161 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 36; Não: 409; Total: 445. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633840 | EMC 329/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633840 | EMC 329/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635812 | EMC 48/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635812 | EMC 48/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635812 | EMC 48/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612088 | EMC 33/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645824 | EMC 90/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645824 | EMC 90/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645824 | EMC 90/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645824 | EMC 90/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645824 | EMC 90/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612103 | EMC 45/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612159 | EMC 93/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635795 | EMC 31/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635795 | EMC 31/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635795 | EMC 31/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612273 | EMC 35/2026 | 2581700 | 2581700-52 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitadas as Emendas do Senado Federal ao Projeto de Lei de Conversão nº 1, de 2026. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612273 | EMC 35/2026 | 2581700 | 2581700-28 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.323, de 2025, na forma do Projeto de Lei de Conversão, ressalvado o destaque. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612171 | EMC 103/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633647 | EMC 142/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633647 | EMC 142/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612098 | EMC 41/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633728 | EMC 222/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633728 | EMC 222/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633669 | EMC 163/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633669 | EMC 163/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2616520 | EMC-A 1/0 | 2195766 | 2195766-138 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2611363 | EMC-A 1/0 | 2427043 | 2427043-35 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622390 | EMP 70/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617863 | EMP 4/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622443 | EMP 83/0 | 2447259 | 2447259-73 | MATCH_B_EXATO | votação de parecer que menciona a emenda | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | Referência apareceu em ementa de parecer possível; o resultado da votação descreve outro objeto. |
| 2621331 | EMP 3/0 | 289361 | 289361-85 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Subemenda da Comissão de Constituição e Justiça e de Cidadania. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621331 | EMP 3/0 | 289361 | 289361-83 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Rejeitadas as Emendas ao Substitutivo. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621331 | EMP 3/0 | 289361 | 289361-79 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Jonas Donizette (PSB-SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621331 | EMP 3/0 | 289361 | 289361-76 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovado o Substitutivo ao Projeto de Lei nº 5.415, de 2005, da Comissão de Segurança Pública e Combate ao Crime Organizado. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617862 | EMP 3/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621659 | EMP 39/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601757 | EMP 2/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601757 | EMP 2/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601757 | EMP 2/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617638 | EMP 2/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604260 | EMP 51/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604260 | EMP 51/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604260 | EMP 51/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605568 | EMP 1/0 | 2181415 | 2181415-166 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Rafael Simoes (UNIÃO/MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605568 | EMP 1/0 | 2181415 | 2181415-164 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605568 | EMP 1/0 | 2181415 | 2181415-162 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Rejeitadas as Emendas ao Substitutivo. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605568 | EMP 1/0 | 2181415 | 2181415-158 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 10.556, de 2018, adotado pelo relator da Comissão de Indústria, Comércio e Serviços, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605568 | EMP 1/0 | 2181415 | 2181415-150 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622291 | EMP 60/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622224 | EMP 52/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605751 | EMP 3/0 | 2181415 | 2181415-166 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Rafael Simoes (UNIÃO/MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605751 | EMP 3/0 | 2181415 | 2181415-164 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605751 | EMP 3/0 | 2181415 | 2181415-162 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Rejeitadas as Emendas ao Substitutivo. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605751 | EMP 3/0 | 2181415 | 2181415-158 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 10.556, de 2018, adotado pelo relator da Comissão de Indústria, Comércio e Serviços, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605751 | EMP 3/0 | 2181415 | 2181415-150 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623591 | EMP 10/0 | 2481715 | 2481715-70 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. José Priante (MDB/PA). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623591 | EMP 10/0 | 2481715 | 2481715-68 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623591 | EMP 10/0 | 2481715 | 2481715-66 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623591 | EMP 10/0 | 2481715 | 2481715-63 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Projeto de Lei nº 3.278, de 2021. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623591 | EMP 10/0 | 2481715 | 2481715-51 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-81 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Silvye Alves (UNIÃO/GO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-79 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 232; Não: 151; Abstenção: 1; Total: 384. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-73 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Rejeitado o Recurso nº 6/2026 contra parecer terminativo da Comissão de Constituição e Justiça e de Cidadania à Emenda de Plenário de nº 3 oferecida ao Projeto de Lei nº 3.880, de 2024 (Art. 132, § 2º C/C Art. 144, Caput, RICD). Sim: 152; Não: 254; Abstenção: 1; Total: 407. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-70 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 3.880, de 2024, adotado pela relatora da Comissão de Constituição e Justiça e de Cidadania, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2610645-5 | MATCH_D_AMBÍGUO | votação de parecer que menciona a emenda | Rejeitado o Recurso nº 6/2026 contra parecer terminativo da Comissão de Constituição e Justiça e de Cidadania à Emenda de Plenário de nº 3 oferecida ao Projeto de Lei nº 3.880, de 2024 (Art. 132, § 2º C/C Art. 144, Caput, RICD). Sim: 152; Não: 254; Abstenção: 1; Total: 407. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-60 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 125; Não: 297; Total: 422. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604852 | EMP 1/0 | 2462009 | 2462009-57 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 116; Não: 311; Abstenção: 2; Total: 429. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622378 | EMP 64/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622414 | EMP 77/0 | 2447259 | 2447259-73 | MATCH_B_EXATO | votação de parecer que menciona a emenda | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | Referência apareceu em ementa de parecer possível; o resultado da votação descreve outro objeto. |
| 2617584 | EMP 4/0 | 949094 | 949094-184 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela Relatora, Dep. Duda Salabert (PSOL-MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617584 | EMP 4/0 | 949094 | 949094-181 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovada a Subemenda Substitutiva ao Projeto de Lei nº 466, de 2015, adotada pela Relatora da Comissão de Viação e Transportes. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604124 | EMP 35/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604124 | EMP 35/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604124 | EMP 35/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601850 | EMP 4/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601850 | EMP 4/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2601850 | EMP 4/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2615270 | EMR 11/0 | 1194323 | 1194323-99 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovadas as Emendas de nºs 1 a 4 da Comissão de Finanças e Tributação. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2615270 | EMR 11/0 | 1194323 | 1194323-75 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. Com voto contrário dos Dep. Kim Kataguiri e Sidney Leite. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2639354 | EMR 1/0 | 2602943 | 2602943-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2615310 | EMR 1/0 | 2430657 | 2430657-60 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2615310 | EMR 1/0 | 2430657 | 2430657-44 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618774 | EMR 1/0 | 2479650 | 2479650-49 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617796 | EMR 6/0 | 2308863 | 2308863-68 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617796 | EMR 6/0 | 2308863 | 2308863-53 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2626249 | EMR 1/0 | 2570847 | 2570847-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617203 | EMR 1/0 | 2525732 | 2525732-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer do Relator, Deputado Luiz Lima (Novo-RJ) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2639444 | EMR 1/0 | 2607741 | 2607741-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2640273 | EMS 1242/2026 | 2168236 | 2168236-63 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 9.600, de 2018, da Comissão de Constituição e Justiça e de Cidadania, ressalvado o destaque. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2611648 | SBT 1/0 | 2566205 | 2566205-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637875 | SBT 1/0 | 2606313 | 2606313-40 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Jandira Feghali (PCdoB/RJ). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637875 | SBT 1/0 | 2606313 | 2606313-36 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovado o Substitutivo ao Projeto de Lei Complementar nº 41, de 2026, adotado pela relatora da Comissão de Defesa dos Direitos da Mulher. Sim: 470; Não: 1; Total: 471. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629222 | SBT 3/0 | 2231783 | 2231783-51 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2632233 | SBT 2/0 | 2561205 | 2561205-34 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer da Relatora, Deputada Nely Aquino (Podemos-MG) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2630236 | SBT 1/0 | 2598546 | 2598546-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622777 | SBT 1/0 | 2545048 | 2545048-55 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Delegada Ione (AVANTE/MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622777 | SBT 1/0 | 2545048 | 2545048-51 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Emenda de Plenário nº 3. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622777 | SBT 1/0 | 2545048 | 2545048-48 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Global ao Projeto de Lei nº 3.984, de 2025, adotada pela relatora da Comissão de Constituição e Justiça e de Cidadania, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618238 | SBT 3/0 | 2418296 | 2418296-35 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2613611 | SBT 1/0 | 2563307 | 2563307-26 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2634917 | SBT 1/0 | 2506391 | 2506391-45 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618433 | SBT 1/0 | 2599626 | 2599626-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2613579 | SBT 1/0 | 2583724 | 2583724-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633835 | EMC 324/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633835 | EMC 324/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628911 | EMR 1/0 | 2465935 | 2465935-33 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602275 | EMP 2/0 | 2483732 | 2483732-69 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Alceu Moreira (MDB/RS). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602275 | EMP 2/0 | 2483732 | 2483732-66 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 7. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602275 | EMP 2/0 | 2483732 | 2483732-64 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602275 | EMP 2/0 | 2483732 | 2483732-60 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 399, de 2025, adotado pelo relator da Comissão de Minas e Energia, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614879 | EMC-A 1/0 | 2474116 | 2474116-41 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612056 | EMC 7/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2610032 | SBT 1/0 | 2476886 | 2476886-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623617 | SBT 2/0 | 2122125 | 2122125-97 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer, apresentaram votos em separado os Deputados Arnaldo Faria de Sá e Hissa Abrahão. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2641778 | EMR 4/0 | 2599622 | 2599622-21 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612208 | EMC-A 1/0 | 2409757 | 2409757-54 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629601 | EMP 8/0 | 2618177 | 2618177-84 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Marussa Boldrin (REPUBLIC/GO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629601 | EMP 8/0 | 2618177 | 2618177-82 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 1. Sim: 105; Não: 233; Total: 338. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629601 | EMP 8/0 | 2618177 | 2618177-73 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. Sim: 108; Não: 275; Abstenção: 1; Total: 384. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629601 | EMP 8/0 | 2618177 | 2618177-71 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo Reformulado ao Projeto de Lei Complementar nº 114, de 2026, adotado pela relatora da Comissão de Minas e Energia, ressalvado o destaque. Sim: 318; Não: 113; Abstenção: 1; Total: 432. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2629601 | EMP 8/0 | 2618177 | 2618177-60 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604187 | EMP 46/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604187 | EMP 46/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604187 | EMP 46/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625806 | SBT 1/0 | 2599034 | 2599034-31 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2615530 | SBT 2/0 | 2481268 | 2481268-45 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer da Relatora, Deputada Lídice da Mata (PSB-BA). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625985 | SBT 1/0 | 2565441 | 2565441-41 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Rodrigo Gambale (PODE/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625985 | SBT 1/0 | 2565441 | 2565441-39 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625985 | SBT 1/0 | 2565441 | 2565441-36 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625985 | SBT 1/0 | 2565441 | 2565441-32 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 4.822, de 2025, adotado pelo relator da Comissão de Constituição e Justiça e de Cidadania, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2615346 | SBT 1/0 | 2569135 | 2569135-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617154 | SBT 2/0 | 2479417 | 2479417-38 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633585 | EMC 85/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633585 | EMC 85/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2605541 | EMC 1/2026 | 2582484 | 2582484-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2630022 | EMC 1/2026 | 2538258 | 2538258-51 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633799 | EMC 291/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633799 | EMC 291/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2634889 | EMR 1/0 | 2525272 | 2525272-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2645801 | EMC 69/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645801 | EMC 69/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645801 | EMC 69/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645801 | EMC 69/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645801 | EMC 69/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2604152 | EMP 40/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604152 | EMP 40/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604152 | EMP 40/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628466 | SBT-A 1/0 | 2233802 | 2233802-438 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada, em segundo turno, a Proposta de Emenda à Constituição n° 221, de 2019. . Sim: 461; Não: 19; Total: 480. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628466 | SBT-A 1/0 | 2233802 | 2233802-424 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 221, de 2019. Sim: 472; Não: 22; Total: 494. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628466 | SBT-A 1/0 | 2233802 | 2628423-9 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovado o Requerimento nº 3.223/2026, dos Senhores Líderes, que solicita a dispensa de interstício de 2 sessões previsto no parágrafo único do art. 150 do RICD, para a inclusão da Proposta de Emenda à Constituição nº 221, de 2019, na Ordem do Dia. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628466 | SBT-A 1/0 | 2233802 | 2233802-401 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovado o Parecer,  ressalvado(s) o(s) Destaque(s) com o seguinte resultado: 34 votos "Sim", 4 votos "Não". Quórum de votação: 38 votos, apresentou voto em separado o Deputado Gilson Marques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645805 | EMC 73/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645805 | EMC 73/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645805 | EMC 73/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645805 | EMC 73/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645805 | EMC 73/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2621284 | SBT 1/0 | 2600256 | 2600256-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633750 | EMC 242/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633750 | EMC 242/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Marx Beltrão (PP/AL). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-71 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-68 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-65 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-62 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 4. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-59 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-53 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Global ao Projeto de Lei nº 3.025, de 2023, adotada pelo relator da Comissão de Minas e Energia, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-51 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitada a Preferência. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-49 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 119; Não: 241; Total: 360. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-43 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 120; Não: 270; Total: 390. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617711 | EMP 6/0 | 2368697 | 2368697-38 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 117; Não: 278; Total: 395. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635782 | EMC 18/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635782 | EMC 18/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635782 | EMC 18/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633626 | EMC 123/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633626 | EMC 123/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2611161 | SBT 1/0 | 2582052 | 2582052-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618587 | SBT 2/0 | 2418048 | 2418048-35 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633804 | EMC 296/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633804 | EMC 296/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2608405 | EMR 4/0 | 2463655 | 2463655-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612100 | EMC 43/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645789 | EMC 57/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645789 | EMC 57/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645789 | EMC 57/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645789 | EMC 57/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645789 | EMC 57/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2626287 | SBT 1/0 | 2524891 | 2524891-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622410 | EMP 75/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2631361 | EMP 13/0 | 2618177 | 2618177-84 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Marussa Boldrin (REPUBLIC/GO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2631361 | EMP 13/0 | 2618177 | 2618177-82 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 1. Sim: 105; Não: 233; Total: 338. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2631361 | EMP 13/0 | 2618177 | 2618177-73 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. Sim: 108; Não: 275; Abstenção: 1; Total: 384. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2631361 | EMP 13/0 | 2618177 | 2618177-71 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo Reformulado ao Projeto de Lei Complementar nº 114, de 2026, adotado pela relatora da Comissão de Minas e Energia, ressalvado o destaque. Sim: 318; Não: 113; Abstenção: 1; Total: 432. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2631361 | EMP 13/0 | 2618177 | 2618177-60 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2639462 | EMP 2/0 | 2638483 | 2638483-34 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 2. Sim: 134; Não: 285; Abstenção: 2; Total: 421. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2639462 | EMP 2/0 | 2638483 | 2638483-31 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2639462 | EMP 2/0 | 2638483 | 2638483-29 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Projeto de Lei nº 3.085, de 2026, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623909 | SBT 1/0 | 2602433 | 2602433-27 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer da Relatora, Deputada Maria Rosas (Republicanos-SP) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625255 | EMR 2/0 | 2599660 | 2599660-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2610117 | EMR 3/0 | 2308863 | 2308863-68 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2610117 | EMR 3/0 | 2308863 | 2308863-53 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633938 | EMC 421/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633938 | EMC 421/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612257 | EMC 22/2026 | 2581700 | 2581700-52 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitadas as Emendas do Senado Federal ao Projeto de Lei de Conversão nº 1, de 2026. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612257 | EMC 22/2026 | 2581700 | 2581700-28 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.323, de 2025, na forma do Projeto de Lei de Conversão, ressalvado o destaque. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633621 | EMC 119/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633621 | EMC 119/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2622034 | EMP 41/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633870 | EMC 355/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633870 | EMC 355/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633582 | EMC 82/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633582 | EMC 82/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2637851 | SBT 1/0 | 2625767 | 2625767-40 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Antonio Brito (PSD/BA). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637851 | SBT 1/0 | 2625767 | 2625767-37 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovado o Substitutivo ao Projeto de Lei nº 2.465, de 2026, adotado pelo relator da Comissão de Saúde. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625653 | EMR 2/0 | 2541030 | 2541030-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614080 | SBT 4/0 | 2267779 | 2267779-74 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612243 | EMC 16/2026 | 2581700 | 2581700-52 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitadas as Emendas do Senado Federal ao Projeto de Lei de Conversão nº 1, de 2026. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612243 | EMC 16/2026 | 2581700 | 2581700-28 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.323, de 2025, na forma do Projeto de Lei de Conversão, ressalvado o destaque. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2620944 | SBT 3/0 | 2325768 | 2325768-60 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625588 | SBT 2/0 | 2566420 | 2566420-30 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612061 | EMC 12/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2629704 | SBT 1/0 | 2467639 | 2467639-29 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612094 | EMC 37/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2625712 | SBT 3/0 | 2464691 | 2464691-40 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617528 | EMR 2/0 | 2555390 | 2555390-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer da Relatora, Deputada Lídice da Mata (PSB-BA) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633709 | EMC 203/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633709 | EMC 203/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2608946 | EMR 1/0 | 2575488 | 2575488-32 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2608946 | EMR 1/0 | 2575488 | 2575488-17 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633742 | EMC 234/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633742 | EMC 234/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633927 | EMC 411/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633927 | EMC 411/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2628690 | EMP 7/0 | 2618177 | 2618177-84 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela relatora, Dep. Marussa Boldrin (REPUBLIC/GO). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628690 | EMP 7/0 | 2618177 | 2618177-82 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 1. Sim: 105; Não: 233; Total: 338. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628690 | EMP 7/0 | 2618177 | 2618177-73 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. Sim: 108; Não: 275; Abstenção: 1; Total: 384. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628690 | EMP 7/0 | 2618177 | 2618177-71 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo Reformulado ao Projeto de Lei Complementar nº 114, de 2026, adotado pela relatora da Comissão de Minas e Energia, ressalvado o destaque. Sim: 318; Não: 113; Abstenção: 1; Total: 432. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628690 | EMP 7/0 | 2618177 | 2618177-60 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2626479 | EMR 1/0 | 2602594 | 2602594-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2619121 | SBT 3/0 | 2416919 | 2416919-51 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614892 | SBT-A 1/0 | 2348972 | 2348972-67 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635805 | EMC 41/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635805 | EMC 41/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635805 | EMC 41/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612133 | EMC 72/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2643298 | SBT 1/0 | 2416877 | 2416877-92 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Fred Costa (PRD-MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2643298 | SBT 1/0 | 2416877 | 2416877-89 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovado o Substitutivo ao Projeto de Lei nº 25, de 2024, adotado pelo relator da Comissão de Constituição e Justiça e de Cidadania. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2609790 | EMP 5/0 | 2481715 | 2481715-70 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. José Priante (MDB/PA). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2609790 | EMP 5/0 | 2481715 | 2481715-68 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2609790 | EMP 5/0 | 2481715 | 2481715-66 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitadas as Emendas de Plenário. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2609790 | EMP 5/0 | 2481715 | 2481715-63 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Projeto de Lei nº 3.278, de 2021. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2609790 | EMP 5/0 | 2481715 | 2481715-51 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2611245 | SBT 2/0 | 2259294 | 2259294-54 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602181 | EMP 14/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602181 | EMP 14/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602181 | EMP 14/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633807 | EMC 299/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633807 | EMC 299/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633712 | EMC 206/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633712 | EMC 206/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2619885 | EMR 1/0 | 2443770 | 2443770-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer do Relator, Deputado PR. Marco Feliciano (PL-SP) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-104 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-102 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 63. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-99 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. Sim: 343; Não: 97; Abstenção: 1; Total: 441. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-84 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Reformulada ao Projeto de Lei nº 2.780, de 2024, adotada pelo relator da Comissão Especial, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-77 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovado o Requerimento. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621023 | EMP 12/0 | 2447259 | 2447259-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612126 | EMC 67/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633680 | EMC 174/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633680 | EMC 174/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633862 | EMC 348/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633862 | EMC 348/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2608571 | SBT 1/0 | 2531512 | 2531512-38 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2605107 | SBT 1/0 | 2566412 | 2566412-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635811 | EMC 47/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635811 | EMC 47/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635811 | EMC 47/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2618081 | EMR 1/0 | 2455812 | 2455812-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637724 | SBT 2/0 | 2610665 | 2610665-27 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2627115 | EMR 2/0 | 2259342 | 2259342-40 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618940 | SBT 1/0 | 2491321 | 2491321-29 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633336 | SBT-A 1/0 | 2458742 | 2458742-97 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovado o requerimento nº 24/2025,do Sr. Geraldo Resende que requer a realização de Seminário Regional no Estado de Mato Grosso do Sul, na cidade de Campo Grande/MS, para debater a Proposta de Emenda à Constituição nº 34, de 2024 “que "inclui a primeira infância como beneficiária de direitos e garantias, no texto constitucional" (PEC da Primeira Infância) | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2625729 | SBT 3/0 | 2497586 | 2497586-37 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2632561 | SBT 1/0 | 2601000 | 2601000-42 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2611216 | SBT-A 1/0 | 2487068 | 2487068-31 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633717 | EMC 211/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633717 | EMC 211/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612175 | EMC 106/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612095 | EMC 38/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2623965 | SBT 1/0 | 2592176 | 2592176-26 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2630803 | EMR 1/0 | 2495622 | 2495622-56 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2628145 | EMR 2/0 | 2598569 | 2598569-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600514 | EMP 12/0 | 2585316 | 2585316-47 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Átila Lira (PP/PI). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600514 | EMP 12/0 | 2585316 | 2585316-45 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600514 | EMP 12/0 | 2585316 | 2585316-44 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Rejeitadas as Emendas ao Substitutivo. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600514 | EMP 12/0 | 2585316 | 2585316-39 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 5.874, de 2025, adotado pelo relator da Comissão de Administração e Serviço Público, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2645796 | EMC 64/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645796 | EMC 64/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645796 | EMC 64/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645796 | EMC 64/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645796 | EMC 64/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633786 | EMC 278/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633786 | EMC 278/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612148 | EMC 84/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2634422 | SBT 1/0 | 2610393 | 2610393-22 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2645825 | EMC 91/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645825 | EMC 91/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645825 | EMC 91/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645825 | EMC 91/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645825 | EMC 91/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635831 | EMC 66/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635831 | EMC 66/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635831 | EMC 66/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2617361 | SBT 1/0 | 2459320 | 2459320-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2640027 | EMR 2/0 | 2610701 | 2610701-25 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633674 | EMC 168/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633674 | EMC 168/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2611512 | EMR 1/0 | 2234584 | 2234584-62 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637597 | SBT 3/0 | 2506898 | 2506898-40 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer do Relator, Deputado A J Albuquerque (PP-CE) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-73 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Marx Beltrão (PP/AL). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-71 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-68 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-65 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-62 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 4. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-59 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-53 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva Global ao Projeto de Lei nº 3.025, de 2023, adotada pelo relator da Comissão de Minas e Energia, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-51 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitada a Preferência. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-49 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 119; Não: 241; Total: 360. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-43 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 120; Não: 270; Total: 390. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617789 | EMP 14/0 | 2368697 | 2368697-38 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 117; Não: 278; Total: 395. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618207 | SBT 1/0 | 2534202 | 2534202-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633702 | EMC 196/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633702 | EMC 196/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2608624 | EMC-A 1/0 | 2192588 | 2192588-57 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625808 | SBT 1/0 | 2555654 | 2555654-30 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2614865 | SBT 1/0 | 2599617 | 2599617-23 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600527 | SBT 1/0 | 2585316 | 2585316-47 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Átila Lira (PP/PI). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600527 | SBT 1/0 | 2585316 | 2585316-45 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600527 | SBT 1/0 | 2585316 | 2585316-44 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Rejeitadas as Emendas ao Substitutivo. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2600527 | SBT 1/0 | 2585316 | 2585316-39 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 5.874, de 2025, adotado pelo relator da Comissão de Administração e Serviço Público, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2645785 | EMC 53/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645785 | EMC 53/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645785 | EMC 53/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645785 | EMC 53/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645785 | EMC 53/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633906 | EMC 391/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633906 | EMC 391/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2617798 | EMR 7/0 | 2308863 | 2308863-68 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617798 | EMR 7/0 | 2308863 | 2308863-53 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623381 | EMC-A 1/0 | 1194323 | 1194323-99 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovadas as Emendas de nºs 1 a 4 da Comissão de Finanças e Tributação. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2627544 | SBT 2/0 | 2547365 | 2547365-41 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2612076 | EMC 25/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2639185 | SBT 2/0 | 2481373 | 2481373-36 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617150 | SBT 1/0 | 2205269 | 2205269-64 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2623412 | SBT 1/0 | 2495653 | 2495653-26 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer do Relator, Deputado Patrus Ananias (PT-MG) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617723 | EMP 6/0 | 949094 | 949094-184 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela Relatora, Dep. Duda Salabert (PSOL-MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617723 | EMP 6/0 | 949094 | 949094-181 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovada a Subemenda Substitutiva ao Projeto de Lei nº 466, de 2015, adotada pela Relatora da Comissão de Viação e Transportes. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635783 | EMC 19/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635783 | EMC 19/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635783 | EMC 19/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612138 | EMC 77/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612182 | EMC 110/2026 | 2589912 | 2589912-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda de Redação nº 1. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612247 | EMC 19/2026 | 2581700 | 2581700-52 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitadas as Emendas do Senado Federal ao Projeto de Lei de Conversão nº 1, de 2026. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2612247 | EMC 19/2026 | 2581700 | 2581700-28 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.323, de 2025, na forma do Projeto de Lei de Conversão, ressalvado o destaque. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2607587 | EMR 1/0 | 2495726 | 2495726-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Aprovada a Emenda nº 1 da Comissão de Constituição e Justiça e de Cidadania. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2607587 | EMR 1/0 | 2495726 | 2495726-34 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2645786 | EMC 54/2026 | 2624161 | 2624161-49 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 97. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645786 | EMC 54/2026 | 2624161 | 2624161-46 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 96. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645786 | EMC 54/2026 | 2624161 | 2624161-43 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 2. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645786 | EMC 54/2026 | 2624161 | 2624161-25 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 99. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2645786 | EMC 54/2026 | 2624161 | 2624161-22 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.357, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2625432 | EMR 1/0 | 2550754 | 2550754-24 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer do Relator, Deputado Tarcísio Motta (PSOL-RJ) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635465 | SBT 1/0 | 2577458 | 2577458-35 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2630378 | SBT 1/0 | 2539867 | 2539867-19 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2644727 | EMR 1/0 | 2451296 | 2451296-63 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617585 | EMP 5/0 | 949094 | 949094-184 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pela Relatora, Dep. Duda Salabert (PSOL-MG). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2617585 | EMP 5/0 | 949094 | 949094-181 | MATCH_A_ESTRUTURADO | votação de substitutivo que incorpora/menciona emenda | Aprovada a Subemenda Substitutiva ao Projeto de Lei nº 466, de 2015, adotada pela Relatora da Comissão de Viação e Transportes. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2621661 | EMP 1/0 | 2617160 | 2617160-15 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Alteração do Regime de Tramitação desta proposição em virtude da Aprovação do REQ 2527/2026. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2635793 | EMC 29/2026 | 2611652 | 2611652-31 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 71. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635793 | EMC 29/2026 | 2611652 | 2611652-29 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda nº 24. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2635793 | EMC 29/2026 | 2611652 | 2611652-27 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.345, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633818 | EMC 310/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633818 | EMC 310/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633584 | EMC 84/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633584 | EMC 84/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2604171 | EMP 43/0 | 2600838 | 2600838-48 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604171 | EMP 43/0 | 2600838 | 2600838-46 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 68. Sim: 105; Não: 232; Total: 337. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604171 | EMP 43/0 | 2600838 | 2600838-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 278, de 2026, adotado pelo relator da Comissão de Meio Ambiente e Desenvolvimento Sustentável, ressalvado o destaque. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602279 | EMP 5/0 | 2483732 | 2483732-69 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Alceu Moreira (MDB/RS). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602279 | EMP 5/0 | 2483732 | 2483732-66 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 7. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602279 | EMP 5/0 | 2483732 | 2483732-64 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2602279 | EMP 5/0 | 2483732 | 2483732-60 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovado o Substitutivo ao Projeto de Lei nº 399, de 2025, adotado pelo relator da Comissão de Minas e Energia, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2611383 | SBT 1/0 | 2599597 | 2599597-28 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2604945 | SBT-A 1/0 | 2345653 | 2345653-82 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2633729 | EMC 223/2026 | 2610975 | 2610975-23 | MATCH_D_AMBÍGUO | votação direta/citação de emenda | Rejeitada a Emenda n° 102. Sim: 22; Não: 378; Abstenção: 1; Total: 401. | 0 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2633729 | EMC 223/2026 | 2610975 | 2610975-19 | MATCH_D_AMBÍGUO | votação de destaque referente à emenda | Aprovada a Medida Provisória nº 1.343, de 2026, na forma do Projeto de Lei de Conversão, ressalvados os destaques. | 1 | NÃO | — | insuficiente | Texto genérico ou número incompatível/ambíguo; contexto apenas. |
| 2630804 | EMR 2/0 | 2495622 | 2495622-56 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2637761 | SBT 3/0 | 2561205 | 2561205-34 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer da Relatora, Deputada Nely Aquino (Podemos-MG) | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2618003 | SBT 1/0 | 2376445 | 2376445-35 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-65 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Resultado. Sim: 182; Não: 182; Abstenção: 2; Total: 366. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-56 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Aprovada a Redação Final assinada pelo relator, Dep. Merlong Solano (PT/PI). | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-52 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Mantido o texto. | — | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-47 | MATCH_A_ESTRUTURADO | votação direta/citação de emenda | Rejeitada a Emenda de Plenário nº 2. Sim: 196; Não: 200; Abstenção: 1; Total: 397. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-42 | MATCH_A_ESTRUTURADO | votação de destaque referente à emenda | Aprovada a Subemenda Substitutiva ao Projeto de Lei nº 1.625, de 2026, adotada pelo relator da Comissão de Defesa do Consumidor, ressalvados os destaques. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-39 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-33 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-29 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. Sim: 115; Não: 313; Total: 428. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2625636 | EMP 4/0 | 2613731 | 2613731-26 | MATCH_A_ESTRUTURADO | votação da matéria-pai apenas | Rejeitado o Requerimento. | 0 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |
| 2611712 | EMR 1/0 | 2529556 | 2529556-19 | MATCH_A_ESTRUTURADO | votação de parecer que menciona a emenda | Aprovado o Parecer. | 1 | NÃO | — | insuficiente | ID/URI apareceu somente em objetosPossiveis; não confirma o objeto real nem o efeito individual. |

### Validação manual

Foram revistos os payloads oficiais completos já carregados: 20 MATCH_A escolhidos aleatoriamente com seed fixa, todos os 2 MATCH_B e todos os MATCH_C disponíveis (zero). O critério de verdadeiro positivo foi estrito: a votação precisava corresponder comprovadamente à emenda específica, não apenas listá-la como objeto possível.
| Nível | Emenda ID | Emenda | Pai | Votação | Descrição oficial | Veredito | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MATCH_A_ESTRUTURADO | 2616520 | EMC-A 1/0 | 2195766 | 2195766-138 | Aprovada a Redação Final. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2617862 | EMP 3/0 | 2447259 | 2447259-102 | Rejeitada a Emenda de Plenário nº 63. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2611383 | SBT 1/0 | 2599597 | 2599597-28 | Aprovado o Parecer. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2625636 | EMP 4/0 | 2613731 | 2613731-33 | Rejeitado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2622034 | EMP 41/0 | 2447259 | 2447259-104 | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2609790 | EMP 5/0 | 2481715 | 2481715-70 | Aprovada a Redação Final assinada pelo relator, Dep. José Priante (MDB/PA). | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2640027 | EMR 2/0 | 2610701 | 2610701-25 | Aprovado o Parecer. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2617789 | EMP 14/0 | 2368697 | 2368697-53 | Aprovada a Subemenda Substitutiva Global ao Projeto de Lei nº 3.025, de 2023, adotada pelo relator da Comissão de Minas e Energia, ressalvados os destaques. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2621659 | EMP 39/0 | 2447259 | 2447259-77 | Aprovado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2625432 | EMR 1/0 | 2550754 | 2550754-24 | Aprovado o Parecer do Relator, Deputado Tarcísio Motta (PSOL-RJ) | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2622443 | EMP 83/0 | 2447259 | 2447259-104 | Aprovada a Redação Final assinada pelo relator, Dep. Arnaldo Jardim (CIDADANIA/SP). | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2625729 | SBT 3/0 | 2497586 | 2497586-37 | Aprovado o Parecer. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2623412 | SBT 1/0 | 2495653 | 2495653-26 | Aprovado o Parecer do Relator, Deputado Patrus Ananias (PT-MG) | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2601850 | EMP 4/0 | 2600838 | 2600838-48 | Aprovada a Redação Final assinada pelo relator, Dep. Aguinaldo Ribeiro (PP/PB). | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2605568 | EMP 1/0 | 2181415 | 2181415-150 | Rejeitado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2602275 | EMP 2/0 | 2483732 | 2483732-64 | Mantido o texto. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2628701 | EMA 3/0 | 2351506 | 2351506-121 | Aprovado o Requerimento nº 4.491/2024, dos Senhores Líderes, que solicita a quebra de interstício de 5 sessões previsto no § 6º do art. 202 do RICD, para apreciação do segundo turno da PEC 5, de 2023. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2602275 | EMP 2/0 | 2483732 | 2483732-66 | Rejeitada a Emenda de Plenário nº 7. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2621659 | EMP 39/0 | 2447259 | 2447259-73 | Rejeitado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_A_ESTRUTURADO | 2628701 | EMA 3/0 | 2351506 | 2351506-95 | Rejeitado o Requerimento. Sim: 102; Não: 322; Abstenção: 1; Total: 425. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_B_EXATO | 2622443 | EMP 83/0 | 2447259 | 2447259-73 | Rejeitado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |
| MATCH_B_EXATO | 2622414 | EMP 77/0 | 2447259 | 2447259-73 | Rejeitado o Requerimento. | Falso positivo para correspondência exata | Objeto apenas possível ou texto pertencente a outro objeto da votação. |

- MATCH_A: **0 verdadeiros positivos, 20 falsos positivos, precisão 0%** para a afirmação forte “esta votação corresponde a esta emenda”. Isso não invalida o vínculo como candidato.
- MATCH_B: **0 verdadeiros positivos, 2 falsos positivos, precisão 0%**.
- MATCH_C: **nenhum candidato; precisão não calculável**.
- A validação favorece precisão em vez de recall. Os matches rejeitados continuam úteis para navegação investigativa como “votação possivelmente relacionada”, nunca para resultado.

### Respostas finais
1. **Qual percentual das 500 conseguimos ligar a alguma votação?** Como candidatos A/B/C, 142/500 (28,4%). Como ligação conclusiva após validação, **0/500 (0%)**.
2. **Qual percentual recebe resultado com alta confiança?** **0/500 (0%)**.
3. **Qual método encontrou mais resultados?** `objetosPossiveis` encontrou mais candidatos (MATCH_A), mas não resultados comprovados.
4. **Existem padrões por sigla?** Sim: EMA, EMP, EMR e SBT aparecem mais em objetos possíveis; EMC gera muito contexto ambíguo; ESB, SBE-A e SBR não tiveram pais com votação na amostra; os denominadores completos estão na tabela.
5. **É implementável deterministicamente?** Sim para gerar candidatos e contexto. Para atribuir resultado, somente quando surgir objeto/efeito inequívoco ou uma cadeia procedural que passe pelos critérios estritos; a amostra atual não produziu caso aprovado.
6. **O que permanece contexto?** Todo `objetosPossiveis` isolado, votação genérica do pai, aprovação de parecer/PL/substitutivo, listas genéricas de emendas, resultado de destaque sem efeito individual e qualquer colisão não resolvida.
## Parte 18 — Semântica segura por sigla

Esta seção usa os valores de `siglaTipo`, `descricaoTipo`, `ementa` e `uriPropPrincipal` do arquivo oficial `proposicoes-2026.json`. A semântica abaixo descreve o **tipo documental**. Ela não substitui um evento de tramitação nem autoriza inferir o destino final do documento.

### Resultado da verificação dos tipos “-A”

- **EMC-A:** 313/313 registros têm `descricaoTipo = "Emenda Adotada pela Comissão"`.
- **SBE-A:** 130/130 registros têm `descricaoTipo = "Subemenda Adotada pela Comissão"`.
- **SBT-A:** 636/636 registros têm `descricaoTipo = "Substitutivo adotado pela Comissão"`.

Nos três casos, o tipo oficial permite afirmar **adoção pela comissão**. A comissão pode ser identificada por campos do registro/evento quando publicada. O tipo não prova aprovação final pela Casa, incorporação integral ao texto final, transformação em norma, sanção ou vigência.

| Sigla | Significado oficial observado | Pai normalmente identificado | Tipo implica resultado? | Resultado seguro inferível somente pelo tipo | Resultado que NÃO pode ser inferido |
| --- | --- | --- | --- | --- | --- |
| EMA | Emenda Aglutinativa | Proposição principal à qual a emenda aglutina textos ou conteúdos | NÃO | É uma emenda apresentada como aglutinativa | Aprovação, rejeição, incorporação, prejudicialidade ou retirada |
| EMC | Emenda na Comissão; em 2/1.340 registros, Emenda à PEC | Proposição analisada pela comissão | NÃO | Foi apresentada como emenda no âmbito indicado pelo tipo | Aprovação pela comissão, acolhimento pelo relator, incorporação ao substitutivo ou resultado final |
| EMC-A | Emenda Adotada pela Comissão | Proposição deliberada pela comissão que adotou a emenda | **SIM, limitado ao colegiado** | **Adotada pela comissão** | Aprovação final pela Casa, incorporação ao texto final, transformação em norma ou sanção |
| EMP | Emenda de Plenário; principalmente Emenda de Plenário a Projeto com Urgência | Proposição principal apreciada em Plenário | NÃO | Foi apresentada como emenda de Plenário; “com urgência” descreve o contexto da proposição, não o resultado | Destaque, votação, aprovação, rejeição, retirada ou incorporação |
| EMR | Emenda de Relator | Proposição sobre a qual o relator apresentou a emenda | NÃO | A origem funcional é o relator | Acolhimento pelo colegiado, aprovação, incorporação ou prevalência sobre outras emendas |
| EMS | Emenda/Substitutivo do Senado | Proposição da Câmara à qual chegou texto do Senado | PARCIAL: indica origem e natureza, não o destino na Câmara | O texto foi cadastrado como emenda ou substitutivo proveniente do Senado | Aprovação pela Câmara, rejeição, aceitação integral/parcial, envio à sanção ou conversão em norma |
| ESB | Emenda ao Substitutivo | Substitutivo ligado à proposição principal; o `uriPropPrincipal` observado aponta o processo principal | NÃO | É uma emenda apresentada contra um substitutivo | Aprovação, rejeição, adoção pelo relator, incorporação ao substitutivo ou ao texto final |
| SBE-A | Subemenda Adotada pela Comissão | Proposição principal e, semanticamente, uma emenda/substitutivo examinada pela comissão | **SIM, limitado ao colegiado** | **Adotada pela comissão** | Aprovação final pela Casa, incorporação à redação final, transformação em norma ou sanção |
| SBR | Subemenda de Relator | Proposição principal e a emenda/substitutivo que motivou a subemenda | NÃO | A subemenda foi apresentada pelo relator | Aprovação, adoção pelo colegiado, incorporação ou resultado final |
| SBT | Substitutivo | Proposição cujo texto se pretende substituir | NÃO | O documento propõe substituição do texto | Adoção, aprovação, substituição efetiva, incorporação à redação final ou conversão em norma |
| SBT-A | Substitutivo adotado pela Comissão | Proposição deliberada pela comissão | **SIM, limitado ao colegiado** | **Adotado pela comissão** | Aprovação final pela Casa, prevalência em etapas posteriores, redação final, sanção ou vigência |

### Regras semânticas derivadas

1. `-A` é evidência de adoção **somente** quando `descricaoTipo` oficial também expressa “Adotada/Adotado pela Comissão”. Não se deve derivar a regra apenas do último caractere da sigla.
2. “Adotada pela comissão” é um resultado institucional real, mas de escopo restrito. O resultado normalizado deve carregar `scope = committee`, nunca `scope = house` ou `scope = final`.
3. `EMS` agrupa “emenda” e “substitutivo” do Senado. A distinção interna deve vir da `ementa` ou de outro campo oficial e permanecer textual quando não houver código estruturado específico.
4. `EMR` e `SBR` identificam autoria/função do relator, não adoção pelo órgão.
5. `SBT` descreve a natureza substitutiva do documento. Somente `SBT-A` comprova que uma comissão o adotou.
6. O vínculo `uriPropPrincipal` continua sendo a prova do pai; a semântica da sigla não deve ser usada para adivinhar o ID relacionado.

## Parte 19 — Modelo de dados final recomendado

**NENHUMA MIGRATION NECESSÁRIA.**

`LegislativeComplement` já oferece `kind`, `proposalId`, `deliberationId`, `bodyId`, `occurredAt`, `label`, `value`, `officialUrl` e `rawId`. `publishComplement` também projeta o conteúdo para `proposal_enrichment_items`, inclusive `relatedProposalId` e `inheritedFromProposalId`. O enriquecimento pode ser implementado com os tipos atuais `relationship`, `document`, `movement`, `situation`, `agenda_item` e `vote_effect`.

| Informação | Entity/type existente | Key sugerida | Payload mínimo em `value` | Source | Timestamp | Exemplo |
| --- | --- | --- | --- | --- | --- | --- |
| Emenda → matéria-pai | `LegislativeComplement`, `kind=relationship` | `relationship:{emendaId}:principal:{paiId}` | `{ "relation":"principal", "relatedId":"2610158", "origin":"annual_catalog", "field":"uriPropPrincipal" }` | `proposicoes-{ano}.json` | `null`; não inventar data da relação | EMC 2645674 → PL 2610158 |
| Proposição anterior | `kind=relationship` | `relationship:{id}:previous:{anteriorId}` | `{ "relation":"previous", "relatedId":"...", "origin":"annual_catalog", "field":"uriPropAnterior" }` | Arquivo anual | `null`, salvo evento oficial datado | Encadeamento oficial anterior |
| Proposição posterior | `kind=relationship` | `relationship:{id}:next:{posteriorId}` | `{ "relation":"next", "relatedId":"...", "origin":"annual_catalog", "field":"uriPropPosterior" }` | Arquivo anual | `null`, salvo evento oficial datado | Encadeamento oficial posterior |
| Inteiro teor | `kind=document` | `document:{id}:inteiro-teor:{codteor-ou-hash-url}` | `{ "type":"full_text", "url":"...", "origin":"urlInteiroTeor" }` | Arquivo/detalhe da proposição | `null`, a menos que a fonte publique data do documento | URL `prop_mostrarintegra` |
| Movimento próprio | `kind=movement` | `movement:{id}:{sequencia}` | `{ "code":"100", "situationCode":null, "situation":null, "dispatch":"...", "body":"CAPADR", "url":"..." }` | `/proposicoes/{id}/tramitacoes` | `dataHora` | Apresentação da EMC 2645674 |
| Estado atual publicado | `kind=situation` | `situation:{id}:current:{sequencia-ou-data}` | `{ "classification":"current_state", "code":"...", "description":"...", "sourceSequence":1 }` | Detalhe/último status | `statusProposicao.dataHora` | Aguardando Providências Internas |
| Resultado individual produzido por votação | `kind=vote_effect` | `vote-effect:{id}:{votacaoId}:individual-result` | `{ "effect":"amendment_result", "normalizedResult":"rejeitada", "originalResult":"...", "evidenceLevel":"A", "scope":"committee|plenary", "relatedId":"{id}" }` | `/votacoes/{id}` e relações estruturadas da votação | `dataHoraRegistro` ou `data` | Resultado que identifica o ID da emenda |
| Resultado individual produzido por evento textual | `kind=situation` | `situation:{id}:result:{sourceEventKey}` | `{ "classification":"individual_result", "normalizedResult":"retirada", "originalResult":"Retirada pelo Autor...", "evidenceLevel":"B", "sourceEventKey":"...", "scope":"plenary" }` | Tramitação própria ou do pai | Data do evento | EMP 60/2026 mencionada inequivocamente |
| Adoção implicada pelo tipo oficial `-A` | `kind=situation` | `situation:{id}:type-result:{codTipo}` | `{ "classification":"type_semantics", "normalizedResult":"adotada_pela_comissao", "originalResult":"Substitutivo adotado pela Comissão", "evidenceLevel":"A", "scope":"committee", "basisField":"descricaoTipo" }` | Arquivo oficial | `dataApresentacao` como data do registro; não chamar de data da deliberação | SBT-A 2640141 |
| Evidência do resultado | Mesmo complemento do resultado, mais `rawId` obrigatório | A mesma key do resultado | `originalResult`, `evidenceLevel`, `basisField`/`sourceEventKey`, IDs relacionados e `scope` | Payload bruto salvo em `raw_objects` | O timestamp oficial que sustenta a conclusão | Permite auditoria e reclassificação |
| Contexto herdado do pai | Preferencialmente **não duplicar**; resolver via `relationship:principal` e complementos do pai | Sem nova key no caso normal | Consulta pelo `relatedProposalId`; retornar `{ contextOnly:true, inheritedFromProposalId:paiId }` no DTO | Complementos publicados do pai | Timestamp próprio de cada evento do pai | Votação do PL 2610158 exibida como contexto |
| Contexto explicitamente ligado à emenda | `agenda_item`, `movement` ou `vote_effect` já existente | `inherited:{id}:{paiId}:{kind}:{sourceKey}` | Payload original + `{ "inheritedFromProposalId":"{paiId}", "contextOnly":true, "matchBasis":"structured_id|exact_reference" }` | Evento do pai | Timestamp do evento | Somente quando ID/referência exata liga o evento à emenda |

### Regras de persistência

- O complemento pertence à emenda quando descreve a emenda; `proposalId` recebe o ID da emenda.
- Eventos genéricos do pai permanecem no pai. A UI os busca por meio da relação principal e os marca como contexto.
- Não copiar toda a timeline do pai para cada emenda. Isso multiplicaria registros, criaria falsos eventos próprios e aumentaria o custo de atualização.
- `inheritedFromProposalId` só deve ser usado quando um evento do pai referencia a emenda por ID estruturado ou referência textual inequívoca.
- `rawId` continua obrigatório e aponta para o payload que comprova cada complemento.
- `externalKey` determinística e publicação por escopo garantem idempotência. Rodar novamente o mesmo snapshot deve produzir as mesmas keys.
- O resultado normalizado nunca substitui `originalResult`; ambos devem permanecer disponíveis.

## Parte 20 — Regra determinística de resultado

### Níveis de evidência

| Nível | Definição | Pode gerar resultado normalizado? | Exemplos aceitos |
| --- | --- | --- | --- |
| **A — estruturado/inequívoco** | Campo estruturado associa diretamente o ID da emenda ao efeito/resultado; ou `descricaoTipo` oficial é um tipo de adoção `-A` validado | **SIM** | `proposicoesAfetadas` contém o ID da emenda e o efeito é explícito; votação tem a emenda como objeto inequívoco; `descricaoTipo = Substitutivo adotado pela Comissão` |
| **B — textual inequívoco** | Evento oficial identifica sigla, número e contexto suficientes para resolver uma única emenda filha daquele pai, e usa linguagem conclusiva | **SIM** | “Retirada pelo Autor ... Destaque de Emenda do(a) EMP 60/2026” quando o pai possui uma única EMP 60/2026 correspondente |
| **C — contexto provável, insuficiente** | Evento do pai, parecer ou votação fala genericamente de emendas, usa referência ambígua ou apenas informa aprovação da matéria/parecer | **NÃO** | “Aprovado o parecer”; “foram apresentadas 3 emendas”; “pela aprovação das emendas 1, 2 e 3” sem resolução única dos IDs |

### Algoritmo conservador

```text
entrada: emenda, pai, evento/votação, relacionadas do pai

1. Validar que o pai veio de uriPropPrincipal ou relação oficial equivalente.
2. Se descricaoTipo pertence ao conjunto oficial validado:
     EMC-A -> adotada_pela_comissao
     SBE-A -> adotada_pela_comissao
     SBT-A -> adotada_pela_comissao
   então emitir NÍVEL A, scope=committee, basis=descricaoTipo.
3. Para votação/efeito estruturado:
   a. aceitar NÍVEL A somente se o ID da emenda aparecer como objeto inequívoco
      ou em proposicoesAfetadas com descrição de efeito conclusiva;
   b. não aceitar apenas porque a votação foi retornada por /proposicoes/{pai}/votacoes;
   c. não aceitar objetosPossiveis quando houver mais de um candidato sem resolução.
4. Para movimento, despacho, resultado de pauta ou descrição de votação:
   a. resolver a referência contra as filhas oficiais do pai;
   b. exigir correspondência única por sigla + número e, quando publicado, ano/órgão;
   c. exigir verbo/estado conclusivo, não pedido, proposta, parecer recomendado ou futuro;
   d. se as condições forem satisfeitas, emitir NÍVEL B.
5. Se o texto for genérico, a correspondência não for única ou o evento apenas pertencer
   ao pai, registrar contexto NÍVEL C e não preencher normalizedResult.
6. Persistir texto original, nível, scope, timestamp, rawId e chave do evento.
7. Em conflito, manter todas as evidências e escolher como estado exibido somente a mais
   recente dentro do mesmo escopo; não apagar a história nem promover escopo de comissão
   para resultado final.
```

### Normalizações autorizadas

| Resultado normalizado | Expressão/evento suficiente | Fonte | Nível | Exemplo real/estado da verificação |
| --- | --- | --- | --- | --- |
| `adotada_pela_comissao` | `descricaoTipo` exatamente “Emenda Adotada pela Comissão”, “Subemenda Adotada pela Comissão” ou “Substitutivo adotado pela Comissão” | Arquivo oficial | A | EMC-A, SBE-A e SBT-A; cobertura integral observada em cada sigla |
| `retirada` | Evento conclusivo como “Retirada pelo Autor”, ligado unicamente à emenda | Tramitação própria/pai | B; A se efeito estruturado existir | EMP 60/2026, ID 2622291, no teste auditado |
| `aprovada` | Resultado estruturado que identifica a emenda e diz aprovação; ou texto conclusivo com referência única | Votação/efeito ou evento oficial | A/B | **Nenhum exemplo individual inequívoco na amostra de 500; regra preparada, não afirmar cobertura** |
| `aprovada_parcialmente` | Efeito/texto conclusivo identifica a emenda e explicita aprovação parcial | Votação/efeito ou evento oficial | A/B | **NÃO VERIFICADO na amostra** |
| `rejeitada` | Efeito/texto conclusivo identifica a emenda e explicita rejeição | Votação/efeito ou evento oficial | A/B | **NÃO VERIFICADO na amostra** |
| `prejudicada` | Efeito/texto conclusivo identifica a emenda e explicita prejudicialidade | Votação/efeito ou evento oficial | A/B | **NÃO VERIFICADO na amostra** |
| `inadmitida` | Situação/evento conclusivo identifica a emenda e explicita inadmissão | Tramitação/decisão oficial | A/B | **NÃO VERIFICADO na amostra** |
| `incorporada` | Campo/efeito identifica a emenda e declara incorporação ao texto específico | Documento, parecer ou efeito estruturado | A/B | **NÃO VERIFICADO; não derivar de “parecer aprovado” ou da existência de SBT-A** |
| `incorporada_parcialmente` | Igual ao anterior, com parcialidade explícita | Documento/efeito oficial | A/B | **NÃO VERIFICADO na amostra** |

### Filtros obrigatórios contra falsos positivos

- “Requer a retirada” e “Requerimento de Retirada” descrevem um pedido; não equivalem a `retirada`.
- “Pela aprovação” dentro de parecer é opinião do relator; não equivale a aprovação pelo colegiado.
- “Aprovado o parecer” não distribui automaticamente o resultado por todas as emendas citadas.
- “Foram apresentadas N emendas” comprova quantidade, não resultado.
- Votação da matéria-pai não implica votação de cada filha.
- `SBT`, `EMC`, `ESB`, `EMR` ou `SBR` sem `-A` não implica adoção.
- O ano `0` ou nulo dos acessórios não pode ser usado para construir referência textual; usar o ano de apresentação somente como dado auxiliar, sem reescrever a identificação oficial.

## Parte 21 — Contrato da timeline do Cívica

O contrato deve separar quatro classes visuais e semânticas:

- **EVENTO COMPROVADO:** algo que ocorreu com a própria emenda e possui fonte oficial.
- **ESTADO ATUAL:** fotografia mais recente publicada; não é automaticamente um evento histórico.
- **CONTEXTO HERDADO:** evento da matéria-pai que ajuda a compreender o processo, sem ser atribuído à emenda.
- **RESULTADO COMPROVADO:** conclusão individual sustentada por evidência A ou B.

### Fluxo-base

```text
Apresentada
→ Vinculada à matéria X
→ [eventos próprios publicados, quando existirem]
→ [resultado individual, somente se comprovado]

Contexto da matéria-pai
└── eventos e votações do pai, em camada separada e identificada como contexto
```

| Classe | Nome na UI | Requisito de dados | Fonte | Timestamp | Evidência | Fallback se ausente |
| --- | --- | --- | --- | --- | --- | --- |
| EVENTO COMPROVADO | Apresentada | `movement` de apresentação ou `dataApresentacao` | Tramitação/arquivo oficial | `dataHora`/`dataApresentacao` | A | “Data de apresentação não publicada”; não inventar data |
| EVENTO COMPROVADO | Documento publicado | `document` com URL oficial; evento de publicação quando houver | `urlInteiroTeor`/tramitação | Data do evento, se houver | A | Mostrar link sem afirmar data de publicação |
| EVENTO COMPROVADO | Conferência de assinaturas | Movimento literal correspondente | Tramitação própria | `dataHora` | A | Omitir nó |
| EVENTO COMPROVADO | Outro evento próprio | Movimento oficial cujo `proposalId` é a emenda | Tramitação própria | `dataHora` | A | Omitir nó |
| ESTADO ATUAL | Situação atual | `statusProposicao.descricaoSituacao` ou situação equivalente | Detalhe/arquivo anual | `statusProposicao.dataHora`, quando presente | A | “Situação atual não publicada” fora da sequência histórica |
| EVENTO COMPROVADO | Vinculada a {tipo/número do pai} | Relação principal estruturada | `uriPropPrincipal` | Sem timestamp próprio | A | Não mostrar vínculo; nunca derivar por semelhança de ementa |
| RESULTADO COMPROVADO | Adotada pela comissão | Tipo oficial `EMC-A`, `SBE-A` ou `SBT-A` validado | `descricaoTipo` | Data de apresentação do documento, rotulada como tal; não data da deliberação | A | Omitir resultado se o tipo oficial divergir |
| RESULTADO COMPROVADO | Retirada / aprovada / rejeitada / outro resultado validado | Regra da Parte 20, níveis A ou B | Votação, efeito, movimento ou decisão | Timestamp da evidência | A/B | “Resultado individual não identificado”; não usar resultado do pai |
| CONTEXTO HERDADO | Evento na matéria-pai | Pai estruturado + complemento do pai | Timeline do pai | Timestamp do evento do pai | C por padrão; A/B somente se ligar a emenda | Mostrar em bloco separado “Contexto da matéria principal” |
| CONTEXTO HERDADO | Votação relacionada à matéria-pai | Votação do pai sem identificação individual da emenda | `/proposicoes/{pai}/votacoes` | Data da votação | C | Omitir ou mostrar apenas no contexto, nunca como apreciação da emenda |

Não criar nós genéricos “Em análise”, “Apreciada”, “Incorporada” ou “Concluída” sem o evento específico que os comprove. Uma emenda pode legitimamente exibir somente “Apresentada” e “Vinculada à matéria X”.

## Parte 22 — Plano exato de implementação

### Passo 1 — Preservar relações e documentos do arquivo anual

- **Arquivo:** `apps/collector/src/activity.ts`.
- **Função/bloco:** `collectActivity`, ramo Câmara, leitura de `p.data.dados` em torno das linhas 16–22.
- **Mudança:** além de `Proposal`, emitir complementos determinísticos para `uriPropPrincipal`, `uriPropAnterior`, `uriPropPosterior`, `urlInteiroTeor` e situação atual datada. Se não for conveniente publicar complementos dentro de `publishActivity`, retornar esses registros a um escopo complementar específico, mantendo o mesmo `rawId`.
- **Dados gerados:** `relationship`, `document` e `situation` para os acessórios.
- **Risco:** ativar um escopo amplo e substituir complementos de outro coletor. Usar scope próprio, por exemplo `camara-proposition-catalog-{year}`, e keys estáveis.
- **Validação:** comparar IDs do arquivo com os complementos; exigir 5.169 relações principais no snapshot auditado.
- **Teste recomendado:** teste unitário do parser com EMC 2645674 e SBT-A 2640141; depois coleta `--dry-run`/fixture sem publicação.

### Passo 2 — Corrigir a seleção do enriquecimento

- **Arquivo:** `apps/collector/src/proposition-enrichment.ts`.
- **Função:** `prioritizedProposalIds`.
- **Mudança:** usar `COALESCE(NULLIF(CAST(year AS INTEGER),0), CAST(substr(presentedAt,1,4) AS INTEGER))`; aceitar filtro por grupo/tipos; priorizar registros sem movimentos/relação/documento, não apenas ausência do scope individual.
- **Dados gerados:** lista completa e reproduzível dos acessórios elegíveis.
- **Risco:** ampliar demais a fila e repetir pais compartilhados.
- **Validação:** para 2026, a seleção deve alcançar as 5.169 emendas/substitutivos do snapshot, incluindo tipos com `year=0/null`.
- **Teste recomendado:** teste de consulta com pelo menos um exemplar das 11 siglas e assertiva de que nenhum tipo desaparece pelo ano nulo.

### Passo 3 — Tornar o detalhe individual ciente do catálogo

- **Arquivo:** `apps/collector/src/camara-proposition-details.ts`.
- **Funções:** `collectOne` e parsing das relações nas linhas 24–48.
- **Mudança:** receber o pai conhecido do catálogo; dar precedência a `uriPropPrincipal` anual quando o detalhe individual retornar `null`; consultar o pai uma vez por ID e reutilizar `/relacionadas` e `/votacoes` entre as filhas.
- **Dados gerados:** relação principal confirmada, movimentos próprios, autores, documentos e candidatos a evidência de resultado.
- **Risco:** transformar votação genérica do pai em resultado individual.
- **Validação:** EMC 2645674 deve continuar ligada ao pai 2610158 mesmo com `detail.uriPropPrincipal=null`; a votação 2610158-24 deve aparecer como contexto, não como aprovação da EMC.
- **Teste recomendado:** fixtures dos payloads auditados e teste de cache/deduplicação por pai.

### Passo 4 — Coletar movimentos de todas as siglas sem filtro terminal

- **Arquivo:** `apps/collector/src/camara-proposition-movements.ts`.
- **Funções:** `camaraMovementCandidates` e `collectCamaraPropositionMovements`.
- **Mudança:** adicionar as 11 siglas; para o backfill, selecionar pelo grupo e ano de apresentação, sem exigir texto terminal no status; manter paginação e chave `movement:{id}:{sequencia}`.
- **Dados gerados:** ao menos a apresentação e quaisquer eventos próprios adicionais.
- **Risco:** aproximadamente 5.169 chamadas mais paginação; falha parcial hoje aborta o lote inteiro.
- **Validação:** amostra esperada de 500/500 com ao menos um movimento e cerca de 50/500 com mais de um, sem transformar essa proporção em garantia absoluta do backfill.
- **Comando recomendado após implementação:** `npm run collector -- collect-camara-tramitacoes --year 2026 --types EMA,EMC,EMC-A,EMP,EMR,EMS,ESB,SBE-A,SBR,SBT,SBT-A`, inicialmente com `--limit` pequeno e base de teste.

### Passo 5 — Implementar classificador puro de evidência

- **Arquivo sugerido:** novo módulo pequeno em `apps/collector/src/amendment-results.ts`; nenhuma entidade ou tabela nova.
- **Função:** algo como `classifyAmendmentEvidence(amendment, parent, event, relatedChildren)`.
- **Mudança:** implementar exatamente os níveis A/B/C e filtros da Parte 20. A função não grava dados e retorna resultado somente para A/B.
- **Dados gerados:** `normalizedResult`, `originalResult`, `evidenceLevel`, `scope`, `sourceEventKey` e timestamp.
- **Risco:** colisão de números repetidos entre órgãos ou acessórios; resolver contra as filhas do mesmo pai e exigir unicidade.
- **Validação:** fixtures negativas obrigatórias para “requer a retirada”, “pela aprovação” e “aprovado o parecer”; fixture positiva da EMP 60/2026 e dos três tipos `-A`.
- **Teste recomendado:** testes de tabela cobrindo cada expressão aceita e rejeitada.

### Passo 6 — Persistir somente resultados comprovados

- **Arquivos:** `camara-proposition-details.ts` e/ou um coletor específico que reutilize `publishComplement`; `packages/db/src/index.ts` não precisa mudar se o payload seguir o contrato atual.
- **Mudança:** converter resultados A/B em `vote_effect` ou `situation` conforme a origem, sempre com `rawId`; deixar C como contexto no pai ou projeção marcada `contextOnly`.
- **Dados gerados:** efeitos/situações auditáveis e idempotentes.
- **Risco:** misturar situação atual, evento e resultado. Usar `classification` explícita no payload.
- **Validação:** executar duas vezes contra a mesma fixture e comparar conjunto de `externalKey`; nenhuma duplicata e nenhum resultado novo na segunda execução.
- **Teste recomendado:** teste de integração em SQLite temporário usando `publishComplement` e leitura por `publishedProposalDetail`.

### Passo 7 — Expor o contrato no domínio e na consulta

- **Arquivos:** `packages/domain/src/index.ts` e `packages/db/src/propositions.ts`.
- **Funções/contratos:** `LegislativeComplement` já comporta os dados; criar tipos auxiliares discriminados para o payload de resultado e adaptar `publishedProposalDetail` para separar evento próprio, estado, resultado e contexto.
- **Mudança:** não ampliar `LegislativeComplementKind`; apenas tipar payloads e impedir que complementos `contextOnly` entrem em movimentos próprios.
- **Dados gerados:** DTO com coleções separadas para a UI.
- **Risco:** regressão nas páginas atuais que agrupam `movement` e `situation` juntas.
- **Validação:** snapshots/asserções de consulta garantindo as quatro classes da Parte 21.
- **Teste recomendado:** testes de leitura para uma EMC comum, uma EMP com resultado B e cada tipo `-A`.

### Passo 8 — Backfill controlado e reconciliação

- **Arquivos:** CLI em `apps/collector/src/index.ts` e coletores acima.
- **Mudança:** adicionar comando explícito com `--dry-run`, `--limit`, `--types`, retomada/cache e relatório de reconciliação. Primeiro catálogo, depois movimentos próprios, depois pais/votações deduplicados, finalmente classificação.
- **Dados gerados:** relatório por sigla com solicitadas, cobertas, falhas, relações, movimentos e resultados A/B/C.
- **Risco:** volume, timeout e publicação parcial. Não ativar lote incompleto; permitir retomada pelo cache.
- **Validação:** comparar denominadores antes/depois, inspecionar manualmente exemplos e somente então publicar.
- **Comando/teste recomendado:** começar com base temporária e `--limit 50`; ampliar para a amostra de 500; só depois executar as 5.169.

### Passo 9 — Adaptar a timeline visual

- **Arquivos:** página de proposição e componente de timeline correspondentes em `apps/web`.
- **Mudança:** renderizar nós conforme a Parte 21; contexto do pai em bloco separado; badge “Adoção em comissão” para `-A`; mostrar fonte e evidência; nunca preencher lacunas visualmente.
- **Dados gerados:** nenhum; apenas apresentação do DTO.
- **Risco:** o usuário interpretar contexto como evento próprio.
- **Validação:** rótulos explícitos e testes visuais com emenda sem resultado, tipo `-A` e EMP com resultado comprovado.
- **Teste recomendado:** build, teste de acessibilidade e inspeção das rotas reais selecionadas na auditoria.

### Critérios de aceite

- 5.169/5.169 emendas/substitutivos do snapshot auditado com `relationship` principal derivada de `uriPropPrincipal`.
- 11/11 siglas presentes na seleção de backfill, inclusive as que possuem `ano=0/null`.
- Aproximadamente 100% com movimento de apresentação é a expectativa sustentada por 500/500 na amostra; o aceite operacional deve publicar o denominador real e listar falhas, não mascará-las.
- `uriPropAnterior`, `uriPropPosterior` e inteiro teor preservados quando publicados, sem fabricar valores ausentes.
- Nenhum resultado atribuído somente porque a matéria-pai ou seu parecer foi aprovado.
- Nenhum pedido de retirada classificado como retirada efetiva.
- `EMC-A`, `SBE-A` e `SBT-A` classificados como `adotada_pela_comissao`, com `scope=committee`, sem promoção a aprovação final.
- Resultados normalizados restritos aos níveis A e B; nível C exibido apenas como contexto.
- Timeline própria separada da timeline/contexto da matéria-pai.
- Processo idempotente: duas execuções sobre o mesmo snapshot produzem as mesmas `externalKey` e contagens.
- Payload original e `rawId` preservados para toda conclusão importante.
- Nenhuma migration criada; tabelas e tipos de complemento atuais reutilizados.
- Backfill completo só pode ser publicado se o relatório de reconciliação informar solicitadas, cobertas, falhas e cobertura por sigla.
