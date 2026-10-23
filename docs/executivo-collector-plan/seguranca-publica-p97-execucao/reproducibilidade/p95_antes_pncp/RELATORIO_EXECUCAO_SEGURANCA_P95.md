# P9.5 — Finanças da Segurança Pública: relatório de execução

Execução de 22–23/10/2026. Sem commit nem push. Reprodutibilidade: `reproducibilidade/README.md`. Dados de apoio: `reconciliacao_financeira_seguranca.md`, `cobertura_financeira_seguranca.csv`, `matriz_cobertura_dca_uf_exercicio.md`, `catalogo_indicadores_financeiros.csv`, `matriz_orgaos_seguranca.csv`, `vinculos_pncp_financeiro.csv`, `transferencias_seguranca.csv`, `armazenamento_execucao.csv`, `desempenho_consultas.json`, `results.json`.

## 1. Resumo executivo

O Cívica passa a ter a despesa da função 06 (Segurança Pública) de **toda a União, das 27 UFs e dos 5.570 municípios, 2014–2025**, por estágio (empenhada, liquidada, paga, restos a pagar inscritos), com o histórico de dotação (RREO), e com detalhe por unidade/natureza onde existe fonte aberta comprovada: **União** (2014–2026), **Pernambuco** (2014–2026) e **prefeituras do Rio Grande do Sul** (2016–2026). Contratos do PNCP e transferências do Ministério da Justiça entram como camadas separadas, nunca somadas à despesa.

Tudo foi publicado no schema `civica_exec` reutilizando `exec_fin_fact` (nenhum motor financeiro paralelo), com cobertura explícita por fonte × ente × exercício (ausência ≠ zero), read models por UF, município, União e unidade, e reconciliação publicada linha a linha. Saúde e P9.1–P9.4 não foram tocadas (fingerprints idênticos antes e depois).

| Família | União | UFs | Municípios | Histórico | Valores publicados | Estado |
|---|---|---|---|---|---:|---|
| Siconfi DCA I-E (função 06 e 28 funções, subfunções da 06) | sim | 27/27 | 5.570 (declararam 5.530–5.592 por ano) | 2014–2025 | 5,7 mi de fatos em `exec_fin_fact` (todas as fontes) | PASS_WITH_CAVEATS |
| Siconfi RREO Anexo 02 (dotação, acumulado) | sim | 27/27 | só ≥ 45 mil hab. (universo do anexo completo) | 2014–2026 (2026 até o 4º bim.) | 10.218 linhas de cobertura | PASS_WITH_CAVEATS |
| Siconfi DCA I-G (restos a pagar) | sim | 27/27 | só ≥ 100 mil hab. | 2014–2025 | 4.392 linhas de cobertura | PASS_WITH_CAVEATS |
| Despesas federais (Portal da Transparência) | sim | — | — | 2014–2026 (2026 parcial) | 127.985 linhas mensais + 2.030 de dotação | PASS_WITH_CAVEATS |
| Despesas estaduais detalhadas | — | PE | — | 2014–2026 | 13 exercícios de PE | PARTIAL (1 de 27 UFs) |
| Despesas municipais detalhadas | — | — | 497 do RS | 2016–2026 | 11 exercícios | PARTIAL (1 de 27 UFs; 2013–2015 ausentes) |
| Órgãos de Segurança | MJSP e subordinados | UGs de PE | unidades do RS | conforme fonte | 1.187 órgãos/unidades em `exec_fin_org`; 9 tipos de órgão no PNCP | PASS_WITH_CAVEATS |
| PNCP/contratos | sim (esfera F) | sim | sim | 2021–2024 publicado; 2025–2026 em coleta | ver §9 | PARTIAL |
| Transferências | MJSP concedente | sim | sim | 2008–2026 | 26.161 propostas | PARTIAL |

Números: 39 indicadores novos (7001–7074); 469.518 linhas de indicador; 81.786 linhas de cobertura; schema 7.090 → 7.461 MB (+371 MB); banco 22 GB; C: ≈ 59 GiB livres; D: ≈ 420 GiB livres. Testes: 463 executados, 433 aprovados, 0 falhas, 30 ignorados (os mesmos 30 de antes, pré-existentes); build isolado do Next aprovado.

## 2. Fontes e contratos reaproveitados

`exec_fin_fact` (vazia e reservada ao Siconfi desde o G5 da Saúde), dicionários em `exec_ref_code` (domínios 30–33), `exec_entity`/população, publicação transacional por fatia, manifestos RAW, change log, `replaceIndicatorsBulk`, `assertVolume`/`assertPgHeadroom`. Evidências P3/P4 reaproveitadas: CNPJ do ente no Siconfi = CNPJ de órgão/beneficiário (EXACT), DCA como verificador independente de pagamentos municipais, TCE-RS como único TCE testado com função + unidade + natureza. Não houve nova varredura de portais.

## 3. Classificação contábil (G1/G2)

- **Estágios nunca somados:** dotação (RREO), empenhada, liquidada, paga e restos a pagar inscritos são colunas distintas (`exec_ref_code` 31/32/33) e indicadores distintos. Restos a pagar pagos/cancelados (DCA I-G, 7021/7022) vivem à parte e não entram nas despesas pagas do exercício.
- **Acumulado × fluxo:** DCA é fluxo anual; RREO é acumulado até o bimestre do snapshot (uma linha por exercício, o último bimestre vencido; nunca se somam bimestres); a execução federal é fluxo mensal; a dotação federal é snapshot anual.
- **Perspectiva funcional × institucional separadas.** Funcional: despesa na função 06 (Siconfi, PE, RS, União). Institucional: órgãos do MJSP em qualquer função (União, `getSecurityFinanceUnion`) e contratos de órgãos de segurança por nome (PNCP). Os totais não se fundem.
- **Subfunção 122 (Administração Geral)** concentra folha e custeio em muitos entes (ES 2023: 1,69 de 2,24 bi da função): "Policiamento" isolado não é gasto policial. Isto consta nas notas dos indicadores e nas restrições do read model.
- Função 06 por ente vem da própria classificação do ente. Pessoal da função 06 **não** é publicado para estados/municípios em geral (a DCA não cruza função × natureza); existe para União, PE e RS.

## 4. Siconfi nacional (G3)

- DCA I-E coletada para os 5.598 entes, 2014–2025 (336 pacotes; 2026 não existe: o exercício não encerrou). Cada resposta oficial está preservada verbatim em `D:\Civica\raw\siconfi` (pacotes JSONL.gz por UF × exercício).
- Invariantes em **todos** os entes com função 06 (2014–2025): Σ funções = total e Σ subfunções (com "Demais") = função 06, em todos os estágios, tolerância R$ 1,00: **0 quebras** (`reconciliacao_financeira_seguranca.md` §1).
- Cobertura DCA (ex.: 2025): 5.597 respostas; 5.530 declararam; 3.038 com a linha da função 06; 2.492 declararam sem a linha (`DECLARED_WITHOUT_FUNCTION`: o ente não registrou despesa na função, mas nenhum zero foi gravado); 67 não declararam (`NOT_REPORTED`). A matriz UF × exercício está em `matriz_cobertura_dca_uf_exercicio.md`.
- RREO: só publicam o anexo completo estados, DF, União e municípios com ≥ 50 mil hab.; o universo coletado foi população ≥ 45 mil. Os demais não têm fonte por desenho e ficam fora da cobertura, não como zero.
- Pilotos pedidos (Vitória, ES, SP, MG, PE, RS, município pequeno, ente sem resposta) estão no conjunto: ES 2024 R$ 2.542.606.519,59 e Vitória R$ 76.842.715,85 (DCA = RREO ao centavo); Alto Rio Novo e entes sem resposta aparecem como `NOT_REPORTED`.
- **DCA × RREO** (mesmo ente, exercício, estágio, 6º bimestre): 6.048 pares; empenhada idêntica em 5.444 (90%), dentro de R$ 1 em 158, dentro de 1% em 101, acima de 1% em 345 — concentrados em 170 entes (5 estados e 165 municípios), majoritariamente RREO menor (versão da declaração/escopo). Goiás difere ~17% em todos os anos 2015–2018. Nada foi ajustado; linhas em §2 da reconciliação.

## 5. Execução federal (G4)

Portal da Transparência: 154 arquivos mensais + 13 orçamentos anuais, agregados por unidade orçamentária × função × subfunção × programa × ação × categoria × grupo × modalidade × UF do localizador. Identidade de órgãos: superior (nível 1), subordinado (2) e unidade orçamentária (3) com código oficial e nome por exercício (`exec_fin_org`); PF (30108), PRF (30802), FUNPEN (30907), FNSP (30911) etc. aparecem como subordinados do MJSP (30000).

Reconciliação com a DCA da União (função 06, modalidade ≠ 91, Σ dos meses; consulta corrigida, ver `ERRATA_RECONCILIACAO_FEDERAL.md`): **2016, 2017, 2020 e 2021 idênticos ao centavo**, 2014/2015/2018 dentro de R$ 300 mil; 2022: −R$ 11 mil; 2023: −R$ 950 mil (0,006%); 2024: −R$ 369 mil; 2025: −R$ 30 mi (0,18%); **2019: −R$ 229 mi (−2,2%) no empenhado**, divergência registrada sem ajuste. 2026 tem 10 meses e não tem DCA. O "orçamento realizado" do arquivo anual é exatamente o **valor pago** (inclui intra-orçamentárias), conferido com o Σ pago mensal.

## 6. Finanças estaduais (G5)

Todos os estados têm a função 06 por estágio e subfunção (Siconfi). Detalhe por unidade, programa, ação e natureza existe **só para Pernambuco** (TCE-PE `DespesasEstaduais`, filtro por função; 2014–2026): em 2024 a função 06 de PE tem R$ 3,9 bi pagos, 76% em pessoal, executados por PM, PC, CBM, Diretoria de Administração Geral da SDS, Fundo Estadual de Segurança e Defesa Civil. Cada linha é um empenho com valores acumulados até a extração, agrupado pelo mês do empenho: o **empenhado** é o comparável com a DCA (§6b da reconciliação); o "pago" inclui pagamentos posteriores (restos) e não é igual às despesas pagas da DCA. O filtro por unidade gestora não funciona nessa API, então a perspectiva institucional de PE fora da função 06 não foi coletada. As outras 26 UFs: sem fonte estadual de detalhe comprovada nesta onda (TCE-SP não tem função na API diária; demais não testados). Nenhum valor foi rateado por população, efetivo ou crime.

## 7. Finanças municipais e guardas (G6)

Todos os municípios: função 06 por estágio (Siconfi). Detalhe: prefeituras do **RS** (TCE-RS, função 06, 497 municípios, 2016–2026): unidade, subfunção, programa, projeto, natureza e estágios; exercício pela data da operação; só o órgão "PM DE <município>". **Descoberta que mudou o método:** o arquivo do ano seguinte reenvia operações já presentes no arquivo do ano (154 de 157 linhas de Roca Sales 2024); somar arquivos duplicava o empenhado (45% dos pares divergiam). Passamos a usar só a remessa do próprio ano; resultado em 3.252 pares município × ano com DCA: empenhado idêntico em 2.924 (90%), até 1% em 46, acima de 1% em 282; liquidado e pago equivalentes. 1.219 pares sem DCA no ano. Os zips de 2013–2015 baixam truncados (CRC inválido, detectado e rejeitado): lacuna registrada.

Guarda municipal: a MUNIC 2023 diz que o município tem guarda, mas isso não prova que a função 06 é da guarda; nenhum custo da guarda foi estimado (sem folha oficial) e nenhuma despesa estadual foi atribuída a município. O PNCP identifica secretarias/guardas municipais por nome (tipo 7).

## 8. Órgãos (G7)

`exec_fin_org`: 1.187 órgãos/unidades, chave natural (ente, nível, código), nome por exercício (nomes parecidos não são a mesma instituição), pai = último visto. União com códigos oficiais (30000, 30108, 30802…); PE por ID de unidade gestora; RS por código de unidade orçamentária do TCE-RS. Nenhuma entidade foi criada para corporações sem fonte. No PNCP os órgãos de segurança são identificados por **nome** (confiança alta, não exata) e classificados em 9 tipos; Forças Armadas e "segurança alimentar/do trabalho" são excluídas. `matriz_orgaos_seguranca.csv`.

## 9. PNCP, contratos e fornecedores (G8)

Coleta nacional mensal da API de consulta (2021 em diante), preservada em `D:\Civica\raw\pncp`. Duas classificações **separadas**: `org_kind` (órgão de segurança por nome) e `theme` (tema derivado do objeto por palavras-chave; palavras genéricas exigem contexto policial; vigilância patrimonial é descartada). O texto do objeto **não** é persistido; fornecedor pessoa física nunca é persistido; só CNPJ de PJ. 2024: 1.087.184 contratos lidos, 39.893 retidos (36.303 institucionais, 1.943 temáticos, 1.647 ambos). Total publicado 2021–2025: 112.871 contratos retidos (2025: 2.023.034 lidos, 69.733 retidos), valor global **contratado** de R$ 4,6 bi (2023), 17,2 bi (2024) e 25,8 bi (2025) nos indicadores, sem um contrato de 2025 com valor de R$ 1,03 tri (erro de digitação na origem, mantido no dado bruto e fora das somas) — valor contratado não é pago. PNCP 2026 em coleta. Vínculo financeiro: apenas a referência do número de empenho nos contratos do tipo Empenho (`exec_fin_contract.empenho`), sem prova de liquidação/pagamento — o elo PNCP → pagamento só foi demonstrado em RS (P3) e não foi generalizado. **PNCP 2025–2026 ainda está em coleta** (cada mês grande leva ~1 h por limite de taxa); quando terminar basta `contratos-pilot.ts pncp 2025 2026`.

## 10. Transferências (G9)

Plataforma +Brasil/Transferegov, concedente MJSP (inclui FUNPEN, FNSP, FUNAD): 26.161 propostas, 2008–2026; 15.013 com ente identificado por CNPJ exato (8.280 propostas de beneficiário estadual/municipal têm CNPJ de outra unidade — fundo, câmara — e ficam sem ente, nunca por nome). É origem de financiamento: **não** se soma ao pagamento do ente. A execução federal carrega modalidade (30/40/50/90/91) e UF do localizador do gasto, o que permite ver transferências fundo a fundo da função 06 por UF, mas sem beneficiário final; não há read model dedicado. `transferencias_seguranca.csv`.

## 11. Cobertura (G12)

Taxonomia em `exec_fin_cov.status`: PUBLISHED, PUBLISHED_WITH_CAVEATS, NOT_REPORTED, SOURCE_UNAVAILABLE, DECLARED_WITHOUT_FUNCTION (+ reservados NO_SOURCE_DATA, METHODOLOGY_PENDING, RECONCILIATION_FAILED). Universo: União + 27 UFs + 5.571 entidades municipais da fundação; entes fora do universo de um anexo (RREO < 45 mil, I-G < 100 mil) não têm linha. `cobertura_financeira_seguranca.csv` (uma linha por fonte × ente × exercício, com os estágios presentes da função 06).

## 12. Histórico e idempotência (G13/G15)

Publicação por fatia transacional, `NO_CHANGE` por hash, republicação com change log, rollback exato e falha injetada exercitados em testes de integração (DCA, contratos, TCE-RS) e em produção (republicações do RS e do RREO). Nada foi apagado; sem retenção do change log; sem scheduler. Proposta operacional: `proposta_atualizacao_operacional.md`.

## 13. Reconciliação (G11)

Ver `reconciliacao_financeira_seguranca.md`: invariantes (0 quebras), ida e volta RAW → banco em 336 pacotes e 66.367 entes (**0 divergências**), DCA × RREO, União × DCA, orçamento × pago, TCE-RS × DCA, TCE-PE × DCA, PNCP e transferências. Estado + municípios, estágios, contratos e transferências nunca são somados.

## 14. Indicadores (G10)

39 definições (7001–7074): despesa por estágio na função 06 (7001–7005), totais do ente (7006–7007), subfunções (7011–7020), participação, per capita (só com população do ano; 2022–2023 não têm estimativa na fundação), taxa de pagamento, dotação e execução do RREO (7041–7046), restos a pagar pagos/cancelados (7021–7022), contratos (7061–7066) e transferências (7071–7074). Variação **nominal** só no read model, rotulada `NOMINAL_SEM_DEFLACAO`; crescimento real não foi publicado. Natureza econômica da função 06 só existe para União, PE e RS. Nenhuma razão estima custo por policial. `catalogo_indicadores_financeiros.csv`.

## 15. Contratos de leitura (G14)

`getSecurityFinanceState(uf)`, `getSecurityFinanceMunicipality(ibge7)` (com contexto estadual rotulado como ESTADUAL), `getSecurityFinanceNational()`, `getSecurityFinanceUnion()`, `getSecurityFinanceOrgans(entityId)`. Toda medida monetária devolve moeda, valor exato em centavos (texto), estágio, período, fonte, ente executor, classificação, cobertura, revisão e limitações; sem campo genérico "gasto". No máximo 6 consultas por perfil, por entidade e exercício (índice da PK). `desempenho_consultas.json`.

## 16. Persistência e armazenamento (G18)

Migrations v5 (cobertura, órgãos, execução e dotação federais), v6 (contratos, fornecedores, transferências) e v7 (reinício da sequência de `exec_ref_code`). Ver `armazenamento_execucao.csv`: schema +371 MB; RAW novo ≈ 13 GB no D: (TCE-RS 11 GB, Portal 1,1 GB, PNCP, Siconfi 0,3 GB comprimidos). Nada foi baixado duas vezes (manifesto); sem cópias no C:; PGDATA intocado; sem VACUUM FULL.

## 17. Testes (G17)

Unitários: 9 (`financas-p95`), 4 (`pncp-p95`). Integração: 6 (`financas-p95`), 3 (`financas-p95-ondas`). Suíte completa: 463 testes, 433 aprovados, 0 falhas, 30 ignorados. Contagens de migrations em testes antigos foram atualizadas (38 tabelas; versões 1–7). Regressão: fingerprints de Saúde, P9.1–P9.3, entidades, contratos compartilhados e Legislativo idênticos (`g0_antes/depois.json`). Build isolado do Next: aprovado (`next_build_isolado.log`). O restore do backup em cluster isolado reproduziu todos os fingerprints (`g0_restore_teste.json`).

## 18. Privacidade (G16)

Nenhum CPF, nome de pessoa física, endereço, conta bancária, texto de objeto de contrato ou credor do TCE é persistido. Fornecedor PF ausente; fornecedor PJ só com CNPJ e razão social. Teste de esquema proíbe colunas dessa família. Sem rotas públicas de dados pessoais. Equipamentos, instalações e armazenagem não aparecem em texto: só o código do tema.

## 19. Problemas encontrados e corrigidos

(1) 429 do Siconfi e bloqueio 405 do Portal: limitador global adaptativo, pausa coletiva, espera longa, retomada. (2) Escritas concorrentes corrompendo linhas JSONL: serialização. (3) `ref_id` smallint esgotado por `INSERT … ON CONFLICT DO NOTHING`: código só insere o que falta + migration v7. (4) Specs de fatias disjuntas na mesma tabela exigem `tableId` próprio (rollback/hash). (5) Zips truncados do TCE-RS: verificação de CRC. (6) Arquivos do TCE-RS reenviam operações: exercício usa só a remessa do próprio ano. (7) Classificador do PNCP: Forças Armadas, "delegacia" genérica, viatura administrativa e perícia médica geravam falsos positivos; corrigidos e testados.

## 20. Ressalvas

- DCA 2026 não existe; RREO 2026 é do 4º bimestre (preliminar).
- 2.492–3.034 municípios por ano declaram sem a linha da função 06: sem zero gravado.
- Detalhe estadual só PE; detalhe municipal só RS (2016–2026). TCE-RS 2013–2015: arquivos da origem truncados.
- PNCP 2025–2026 em coleta; contratos nunca ligados a pagamento fora da referência de empenho; classificação por nome/palavras-chave não é função 06.
- Transferências: 8.280 propostas de ente sem CNPJ igual ao do ente; sem fundo a fundo por beneficiário.
- 2019 federal e Goiás/RN/PI em DCA × RREO: divergências reais registradas, sem explicação na fonte.
- Per capita ausente em 2022–2023. Variação real não publicada. Sem custo da guarda.
- Cluster de teste em `D:\Civica\pgtest_p95` deve ser apagado no fechamento; backup `pre-financas-p95-20261022.dump` (378 MB) mantido.

## 21. Gates

| Gate | Estado |
|---|---|
| G0_INFRASTRUCTURE_SAFETY | PASS |
| G1_FINANCIAL_SEMANTICS | PASS |
| G2_SECURITY_BUDGET_CLASSIFICATION | PASS_WITH_CAVEATS |
| G3_SICONFI_NATIONAL | PASS_WITH_CAVEATS |
| G4_FEDERAL_SECURITY_FINANCE | PASS_WITH_CAVEATS |
| G5_STATE_SECURITY_FINANCE | PARTIAL |
| G6_MUNICIPAL_SECURITY_FINANCE | PARTIAL |
| G7_INSTITUTIONAL_IDENTITY | PASS_WITH_CAVEATS |
| G8_PROCUREMENT_RELATIONSHIPS | PARTIAL |
| G9_SECURITY_TRANSFERS | PARTIAL |
| G10_FINANCIAL_INDICATORS | PASS |
| G11_FINANCIAL_RECONCILIATION | PASS_WITH_CAVEATS |
| G12_TERRITORIAL_COVERAGE | PASS |
| G13_HISTORICAL_BACKFILL | PARTIAL |
| G14_SERVING_CONTRACT | PASS |
| G15_IDEMPOTENCY_REPUBLICATION | PASS |
| G16_PRIVACY | PASS |
| G17_TESTS_AND_REGRESSION | PASS_WITH_CAVEATS |
| G18_STORAGE_PERFORMANCE | PASS |

Nenhum gate foi declarado PASS apenas porque a fonte, o arquivo ou a tabela existem: cada um se apoia nos números e testes acima. P9.6–P9.8, página de Segurança, scheduler, retenção do change log, commit e push permanecem não iniciados.
