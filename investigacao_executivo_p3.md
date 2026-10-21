# CÍVICA — P3: Investigação profunda do Poder Executivo

Data: 2026-10-11. Escopo: somente investigação. Nada foi implementado, e nenhum código, banco, collector, schema, frontend ou arquivo das fases anteriores foi alterado. Os testes ficaram no scratchpad da sessão. Chaves de API públicas não foram gravadas no repositório.

Companheiro estruturado: `investigacao_executivo_p3_fontes.json` (IDs estáveis `SRC-*`, `DS-*`, `TST-*`, `IND-*`, `REL-*`, `OPP-*`, `COL-*`, `GATE-*`). Fontes já existentes em P0/P1/P2 são referenciadas pelo ID de origem (`p0:`, `p1:`, `p2:`).

Classes de evidência: `VERIFIED_API`, `VERIFIED_DATASET`, `DOCUMENTED_ONLY`, `INFERRED`, `BLOCKED`, `NOT_EVALUATED`, `UNAVAILABLE`. Viabilidade: `READY_FOR_CONTRACT`, `NEEDS_VALIDATION`, `DISCOVERY_ONLY`, `BLOCKED`, `NOT_FEASIBLE`. Classes de vínculo: `EXACT`, `HIGH_CONFIDENCE`, `PROBABLE`, `TERRITORIAL_ONLY`, `TEMPORAL_ONLY`, `UNLINKED`, `CONFLICT`.

Nada foi marcado `UNAVAILABLE`. Uma tentativa sem resposta é registrada como `NOT_EVALUATED`.

---

## 1. Resumo executivo

A P3 provou, com dados reais, **cinco cadeias de ponta a ponta** que as fases anteriores só tinham como hipótese:

| # | Cadeia | Resultado |
|---|---|---|
| 1 | Contrato PNCP → fornecedor (CNPJ) → empenho/liquidação/pagamento em prefeituras | **Comprovada em 2 UFs**: RS (Agudo) por CNPJ + ano + nº do contrato, com valor pago ou empenhado igual ao valor global em 24 casos; ES (Alto Rio Novo) por CNPJ + unidade gestora + valor (o nº do empenho **não** casa). |
| 2 | Escola (Inep) → unidade executora (CNPJ) → programa → repasse datado → saldo → prestação de contas | **Comprovada** no PDDE Info (ES 2024: 2.414 escolas, 4.891 linhas escola×programa, Inep e CNPJ da UEx em 100%). |
| 3 | Hospital (CNES) → CNPJ do estabelecimento → procedimentos com valor aprovado e tipo de financiamento | **Comprovada** (SIH). **Pagamento efetivo por hospital não foi localizado.** |
| 4 | Estabelecimento (lat/long do CNES) → setor censitário 2022 → população, domicílios e renda | **Comprovada** (hospital CNES 0011738 → setor 320530905090052, Santa Cecília, Vitória). |
| 5 | Órgão/município → manifestação anonimizada → prazo → resposta → situação | **Comprovada** no Fala.BR (federal) e em 156 de São Paulo, Recife e Belo Horizonte. |

**Respostas diretas (A–J):**

**A. Pagamentos reais a fornecedores de prefeituras?** Sim, em quatro Tribunais de Contas que publicam **todos os municípios da jurisdição num único formato**: TCE-SP (644 municípios, API JSON), TCE-ES (CKAN, CSV em ZIP), TCE-PE (184 prefeituras, API) e TCE-RS (CSV anual de 1,35 GB). Jurisdição somada: ≈1.400 de 5.570 municípios (≈25%), **com a contagem do RS ainda não verificada no arquivo** (lidos 3 municípios). Os demais TCEs não foram provados (seção 6).

**B. Repasses a escolas individuais?** Sim, via **PDDE** (inclui Básico, Qualidade, Equidade, Educação Conectada e outros). Para PNAE, PNATE, FUNDEB e PNLD **não foi encontrada granularidade por escola** nesta rodada; isso não prova ausência.

**C. Hospitais com financiamento específico?** **Parcialmente.** SIH traz valor **aprovado** por CNES/CNPJ/procedimento/competência e o tipo de financiamento (MAC). Repasse ou pagamento por estabelecimento: não localizado.

**D. Filas e tempos de espera do SUS?** **Não há fonte nacional de tempo de espera.** O DEMAS publica cirurgias eletivas **realizadas e previstas por UF e mês** (desde 2025-07). Consulta de posição na fila existe em alguns entes (DF), mas é consulta individual.

**E. Reclamações, prazos e atendimento?** Sim: Fala.BR (manifestação a manifestação, anonimizada) e portais 156 municipais com CSV (SP desde 2012; Recife desde 2012; BH).

**F. Fiscalização/prestação de contas ligada a contratos, fornecedores e transferências?** **Parcial.** O CEIS/CNEP liga a fornecedores por CNPJ (EXACT na chave), mas o vínculo com o gasto é só **temporal** e a abrangência da sanção muda o significado. TCE-PE publica obras fiscalizadas, determinações e sanções por unidade jurisdicionada. Prestação de contas do PDDE é observável por escola.

**G. Menor granularidade territorial comprovada?** **Setor censitário** (468.099 setores no Brasil; ES 8.706; Vitória 680; Alto Rio Novo 17), ligado a pontos por coordenada.

**H. Fontes estaduais que cobrem centenas/milhares de municípios com uma integração?** TCE-SP (644), TCE-RS (497, a confirmar no arquivo), TCE-PE (184), TCE-ES (~78).

**I. Dados novos sem explosão de collectors?** Seis famílias bastam para tudo o que foi provado (seção 21), e três delas já existem em parte no Cívica.

**J. Descobertas inesperadas de maior potencial?** (1) **Estoque diário de medicamentos por farmácia/CNES com CATMAT, lote e validade** (DEMAS); (2) **PDDE por escola com repasses datados, saldo em conta e prestação de contas**; (3) **SIH com município de residência do paciente** (fluxo entre municípios); (4) **TCE-PE: obras e transporte escolar fiscalizados, determinações, sanções**; (5) **Fala.BR com serviço, satisfação e atraso por órgão**.

**Limites que não podem ser esquecidos:** CPF aparece em claro em algumas fontes (TCE-RS, TCE-PE, PNCP); vínculo com sanção é só temporal; "valor previsto" (PDDE), "valor aprovado" (SIH) e "empenhado" não são pagamento; nenhuma fonte policial ou de saúde provada chega a "resultado" do serviço.

---

## 2. O que a P3 acrescenta à P0/P1/P2

| Tema | Até a P2 | P3 |
|---|---|---|
| Pagamento por credor municipal | P0: "nenhuma fonte nacional traz pagamento por credor para estados e municípios"; TCEs `NOT_EVALUATED` | **TCEs são o agregador**: 4 TCEs testados com chamadas reais; campos, cobertura de CNPJ, chaves e limitações medidos (seção 6). |
| FNDE/PDDE/SIOPE | P0: `BLOCKED` (catálogo exige token; dados não localizados) | **SIOPE** acessível via serviço **Olinda OData** do FNDE; **PDDE** acessível pelo **PDDE Info** (consulta GET e Excel). O portal CKAN do FNDE é SPA em JavaScript e a API não foi localizada. |
| SIOPS | P0: `BLOCKED` | API pública identificada (`siops-consulta-publica-api.saude.gov.br`), mas rotas **não enumeradas** (`/v3/api-docs` 404). `DOCUMENTED_ONLY`. |
| Saúde × financiamento | CNES/SIA/SIH com chave exata | SIH com `nu_cnpj`, `ds_financiamento`, valor aprovado, município do paciente. |
| Ouvidoria | Não coberto | Fala.BR (CSV anual 2014–2026) e 156 municipais. |
| Servidores | Não coberto | Portal da Transparência (ZIP mensal SIAPE existe) e TCE-PE (`ListaServidores`, com PII). |
| Sanções | Não coberto | CEIS (23.713 linhas) e CNEP (1.828) abertos. |
| Submunicipal | P1: catálogo | **Abertos e cruzados**: agregados por setor, renda do responsável, malha GPKG e ponto-em-polígono. |
| Medicamentos | Não coberto | Estoque diário BNAFAR/Hórus por CNES (DEMAS). |

**P0 revisitado:** `FNDE`, `SIOPE` e `SIOPS` deixam de ser `BLOCKED` para SIOPE e PDDE; SIOPS segue `DOCUMENTED_ONLY`; Querido Diário segue sem resposta (`NOT_EVALUATED`).

---

## 3. Dez descobertas de maior potencial

1. **TCE-SP API de despesas por evento** (`/api/json/despesas/{município}/{ano}/{mês}`): Empenhado, Valor Liquidado, Valor Pago, Anulação, Reforço, com `nr_empenho` e CNPJ. 644 municípios. `VERIFIED_API`.
2. **TCE-RS empenhos com licitação e contrato** (CSV anual, 48 colunas): `cnpj_cpf`, `ano_licitacao`, `nr_licitacao`, `mod_licitacao`, `ano_contrato`, `nr_contrato`, `historico`. Fecha o elo contrato→pagamento. `VERIFIED_DATASET`.
3. **PDDE Info**: por escola, repasses datados (valor devido, ajuste, valor pago, data da ordem de pagamento), saldo mensal em conta por programa, situação de prestação de contas e suspensão. `VERIFIED_DATASET`.
4. **Estoque de medicamentos** (BNAFAR/Hórus): posição diária por CNES, `codigo_catmat`, lote, validade, quantidade, latitude/longitude. `VERIFIED_API`.
5. **SIH por hospital com origem do paciente** (`co_ibge_pac`) e tipo de financiamento. `VERIFIED_API`.
6. **TCE-PE como API de controle externo**: despesas, empenho-liquidação-pagamento, fornecedores, sanções (12.575), contratos, obras fiscalizadas (2.577), transporte escolar (209), determinações (4.784), débitos e multas. `VERIFIED_API`.
7. **Fala.BR**: ~1,2 milhão de linhas/ano (estimativa pelo tamanho do arquivo); campos de prazo, resposta, atraso, serviço, "demanda atendida" e satisfação. `VERIFIED_DATASET`.
8. **Setor censitário como unidade de ligação**: coordenadas do CNES caem em setor com renda. `VERIFIED_DATASET`.
9. **Espinha de identidade por CNPJ**: Siconfi (ente) = PNCP (órgão) = PDDE (EEx) = Transferegov (beneficiário) = TCE-PE (UG). `EXACT` em 184/184 prefeituras de PE.
10. **SIOPE via Olinda OData**: execução da educação (empenhada, liquidada, paga) por município e período, com remuneração, indicadores e receitas. `VERIFIED_API`.

---

## 4. Rastreabilidade financeira federal

| Fonte | Estado em P3 | Granularidade | Observação |
|---|---|---|---|
| PNCP Consulta v1 (contratos, itens) | `VERIFIED_API` (reconfirmado) | contrato, item, fornecedor (`niFornecedor`), `codigoIbge`, `numeroContratoEmpenho` | **Já no Cívica** (`pncp-enrichment.ts`), hoje restrito às Casas. |
| Transferegov Transferências Especiais | `VERIFIED_API` (reconfirmado) | plano de ação, empenho, beneficiário (CNPJ), parlamentar | **Já no Cívica** (`postgres-pix-transferegov.ts`, schema `civica_budget`). |
| Portal da Transparência (ZIP mensal) | `VERIFIED_DATASET` | `202607_Servidores_SIAPE.zip` existe (83 MB); CEIS/CNEP diários | O Cívica já lê o ZIP de Emendas (`postgres-pix-portal.ts`). A API REST exige chave (P0 `BLOCKED`). |
| Siconfi `/entes` | `VERIFIED_API` | 5.598 entes com CNPJ e IBGE | Ponte de identidade. |
| Execução financeira federal por credor (SIAFI) | `NOT_EVALUATED` em P3 | P0: ZIPs agregados por UG × ação × elemento, sem credor | Lacuna conhecida; não revisitada. |

**Elo comprovado**: CNPJ de órgão/beneficiário = CNPJ do ente no Siconfi (EXACT). Exemplo: Alto Rio Novo `31796659000120` aparece como órgão no PNCP, beneficiário no Transferegov e entidade executora no PDDE; no Siconfi é o ente IBGE 3200359.

---

## 5. Rastreabilidade financeira estadual e municipal

Estados: **não houve varredura dos portais de execução orçamentária dos Executivos estaduais** nesta rodada (P0 já os classificou como `NOT_EVALUATED`). O TCE-PE documenta `DespesasEstaduais` (`DOCUMENTED_ONLY`), mas **não foi exercitado**. Resultado: `P3_STATE_PAYMENT_COVERAGE = PARTIAL`.

Municípios: a cobertura vem dos TCEs (seção 6) e de portais municipais que publicam 156 (seção 9).

Para **Alto Rio Novo/ES** e **Vitória/ES** o pagamento por credor está em TCE-ES (CKAN) e, para contratos, em PNCP. Vitória não aparece como uma unidade "Prefeitura Municipal de Vitória", e sim como dezenas de secretarias e fundos ("... de Vitória"): o município precisa ser reconstruído pela **lista de unidades gestoras**, não por um nome único.

---

## 6. Tribunais de Contas como agregadores de pagamentos

### 6.1 Resultado por TCE

| TCE | Fonte | Acesso | Municípios | Etapas | CNPJ credor | Contrato | Status |
|---|---|---|---|---|---|---|---|
| **SP** | `transparencia.tce.sp.gov.br/api/json/despesas/{mun}/{ano}/{mes}` | JSON sem chave; ~4 s e 5,3 MB para Campinas/mês | **644** (lista em `/api/json/municipios`; a capital é do TCM-SP) | Empenhado, Valor Liquidado, Valor Pago, Anulação, Reforço | PJ: CNPJ completo. PF: 6 dígitos (parcial) | Não | `VERIFIED_API` |
| **ES** | CKAN `dados.es.gov.br` (`despesas-municipios`, `tcees-empenho`) | ZIP/CSV; despesas 2013–2026, empenhos 2020–2026 | ~78 (69 "Prefeitura Municipal" no recorte de 4 meses; Vitória por secretarias) | Empenhada, Liquidada, Paga + restos a pagar (RP) por linha | CNPJ em 58,5%; CPF 17,6% (nome, sem código); "identificação especial" 17,0% | Não | `VERIFIED_DATASET` |
| **PE** | `sistemas.tce.pe.gov.br/DadosAbertos/{método}!json` | JSON sem chave; limite 100.000 por chamada; filtros por parâmetro | 184 prefeituras (184/184 com CNPJ no Siconfi) | `DespesasMunicipais`, `EmpenhoLiquidacao`, `EmpenhoPagamento`, `EmpenhoResumo` | 62,7% com 14 dígitos; 15,2% zeros ou vazio | `Contratos` à parte | `VERIFIED_API` |
| **RS** | CKAN `dados.tce.rs.gov.br`; `dados/municipal/empenhos/{ano}.csv.zip` | CSV 1,35 GB (2025); leitura parcial por `Range` | 497 na jurisdição (arquivo lido: 3 PMs) | Linhas separadas `E`/`L`/`P` | 44,8% com 14 dígitos na amostra; PF com CPF em claro | **Sim** (`ano_contrato`, `nr_contrato`) | `VERIFIED_DATASET` |
| MG | `dadosabertos.tce.mg.gov.br` | `/api/3/...` devolveu 404 | 853 (SICOM) | — | — | — | `DOCUMENTED_ONLY` (SICOM); acesso `NOT_EVALUATED` |
| RJ | `dados.tce.rj.gov.br` | sem resposta (1 tentativa) | — | — | — | — | `NOT_EVALUATED` |
| PR | `dados.tce.pr.gov.br`; SIM-AM | sem resposta; 720 mil licitações abertas (imprensa) | 399 | — | — | — | `DOCUMENTED_ONLY` |
| SC | Farol/e-Sfinge (Qlik) | Painel visual; a fase anterior (P23.5, em `scripts/`) registrou "sem CSV/JSON/enumerador" para emendas | 295 | — | — | — | `BLOCKED` (visual-only, para emendas) |
| CE | `api.tce.ce.gov.br` (SIM) | página de documentação 200; não exercitada | 184 | — | — | — | `DOCUMENTED_ONLY` |
| BA | TCM-BA, página de dados abertos | página 200 cita empenho/pagamento/json; não exercitada | 417 | — | — | — | `DOCUMENTED_ONLY` |
| GO | `dadosabertos.tce.go.gov.br` (CKAN, 63 datasets) | 200; só indicadores (educação, saúde) | — | — | — | — | pagamentos: não localizados |
| PB | SAGRES | URL testada 404 | — | — | — | — | `NOT_EVALUATED` |
| MS | `tce.ms.gov.br/dados-abertos` | página 200; conteúdo não avaliado | — | — | — | — | `NOT_EVALUATED` |
| MT, PA, AC, AL, AM, AP, MA, PI, RN, RO, RR, SE, TO | — | — | — | — | — | — | `NOT_EVALUATED` |

### 6.2 Medidas pedidas (onde foi possível)

| Medida | SP | ES | PE | RS |
|---|---|---|---|---|
| Municípios | 644 | ~78 | 184 | 3 lidos |
| Exercícios | não enumerados | 2013–2026 (despesas); 2020–2026 (empenhos) | por parâmetro (2024 usado) | 2025 lido; outros anos listados no CKAN |
| Volume lido | 4.561 linhas (Adamantina, 2024-01); 17.789 (Campinas, 2024-06) | 913.596 linhas, 4 meses (5–8/2025) | 100.000 linhas (corte) | 197.713 linhas (3 PMs) |
| CNPJ do credor | PJ: 100%; PF: id parcial | 58,5% CNPJ; 77,0% com código de 14 dígitos | 62,7% | 44,8% (amostra) |
| Descrição | não | não | `HISTORICO`, ação, programa | `historico` 100% |
| Nº do empenho | sim | sim | sim (`NUMEROEMPENHO`, `ID_EMPENHO`) | sim |
| Contrato | não | não | via `Contratos` | sim |
| Liquidação/pagamento | eventos separados | colunas na mesma linha | colunas + métodos | linhas separadas |
| Retificações | desconhecidas | "declaratório"; linhas de estorno (valores negativos: 139.904 células) | desconhecidas | "não analisadas pelo TCE" (declaração do dataset) |

**Cuidado com o ES:** cada empenho tem várias linhas mensais (299.270 de 341.097 chaves têm mais de uma linha), com valores que **movimentam** o saldo, inclusive negativos. Somar linhas dá fluxo, não total do ano, e somar a coluna `Paga` de arquivos sobrepostos pode duplicar. Isso exige uma regra de reconciliação antes de qualquer total publicado.

**Cuidado com a identidade:** SP e ES **não trazem IBGE**; RS usa código de órgão do TCE (`PM DE AGUDO`); PE usa código próprio (`P083`). O IBGE vem do **CNPJ da prefeitura** (PE: EXACT) ou do nome normalizado (SP, ES, RS: PROBABLE até ser provado).

### 6.3 Questão fundamental

**Existe TCE que publique pagamentos da maioria dos municípios da jurisdição num único formato?** Sim: **SP, ES, PE e RS**. Não foi provado para os demais.

---

## 7. Recursos financeiros por escola

### 7.1 PDDE Info (principal descoberta)

URL base: `https://www.fnde.gov.br/pddeinfo/`. Sem autenticação.

| Tela | Rota | Entrega |
|---|---|---|
| Situação de Prestação de Contas | `/situacaoprestacaoconta/situacaoprestacaoconta/situacaoprestacaoconta?ano=&siglaUf[]=&consultar=Consultar` | 10 cartões por página (ES 2024: 490 páginas). `/pddeinfo/situacaoprestacaoconta/situacaoprestacaoconta/excel?an_exercicio=2024&sg_uf=ES&tpRelatorio=1` baixa **a UF inteira** em XLSX. |
| Consulta por escola | `/pddeinfo/pddeinfo/escola/consultar?ano=&co_escola=` | Dados da escola (matrículas por nível), UEx (CNPJ, situação na Receita, mandato), situação de prestação de contas, **repasses por destinação** com data. |
| Exportação em lote | `/pddeinfo/pddeinfo/escola/excelall?ano=&SG_UF=&CO_MUNICIPIO_FNDE=` | 25 colunas por escola × destinação. |
| Consulta de Saldo | `/consultasaldoentidade/…/consultasaldoentidade?mes=MM-AAAA&siglaUf[]=` | Saldo em conta por UEx × programa × mês. |

**Prova (ES 2024):** 4.891 linhas escola×programa; **2.414 escolas**; 78 municípios; Inep com 8 dígitos em 100%; CNPJ da UEx e da EEx em 100%; programas PDDE (2.360), PDDE Qualidade (2.182), PDDE Equidade (295), PDDE Educação Especial (54); valor total **previsto** R$ 37,7 milhões.

**Exemplo ponta a ponta (Alto Rio Novo, escola CMEI Gilda Aggum Capettini, Inep 32087608):** UEx "Conselho da C.E.I. Gilda Aggum Capettini", CNPJ `13.738.531/0001-28`; EEx = Prefeitura (`31.796.659/0001-20`, o mesmo CNPJ do ente no Siconfi); repasses PDDE Básico Primeira Infância P1 (R$ 1.065,00 em 06/05/2024) e P2 (R$ 1.065,00 em 24/05/2024); subtotal **R$ 2.130,00**, igual ao "Valor Total Previsto" do relatório de prestação de contas.

**Previsto ≠ devido ≠ pago.** Para o município inteiro (2024): previsto R$ 110.576 (9 escolas no relatório de prestação de contas); devido R$ 115.187 e **pago R$ 97.576** (10 escolas, 32 destinações) na exportação em lote. As diferenças (parcelas sem data, escola a mais) mostram que cada tela usa recorte próprio.

**Em lote?** Sim por UF (XLSX) e por município (`excelall`). Por escola é GET direto. Volume nacional estimado em 27 + 5.570 chamadas por exercício para a visão em lote (`INFERRED`).

**Prestação de contas:** campo "Situação Prestação de Contas" (UEx e EEx) e "Suspensão de Pagamento". No recorte ES 2024 todas as 4.891 linhas apareceram "Adimplente/NÃO" (o filtro padrão não parece listar inadimplentes; a tela tem filtro "Situação").

### 7.2 SIOPE (Olinda OData)

`https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/` com funções parametrizadas, por exemplo `Dados_Gerais_Siope(Ano_Consulta=2024,Num_Peri=6,Sig_UF='ES')`. Conjuntos: Dados Gerais, Despesas, Despesas por Função Educação, Receita, Indicadores, Remuneração, Informações Complementares.

Resposta de ES 2024: 79 entes (78 municípios + Estado). Vitória (COD_MUNI 320530): despesa total paga em educação **R$ 808.103.944,68**; empenhada R$ 873.106.318,01. **Não há escola**: a granularidade é município (IBGE de 6 dígitos). **Não atribuir gasto municipal a uma escola.**

Observação: a função `Despesas_Siope` com filtro por município devolveu lista vazia na tentativa (parâmetros de pasta não explorados); `Dados_Gerais_Siope` funcionou.

### 7.3 Outros programas

PNAE, PNATE, FUNDEB, PNLD, Caminho da Escola: **não localizados por escola** nesta rodada. O portal CKAN do FNDE é SPA em JavaScript e a API não foi localizada (`NOT_EVALUATED`, não `UNAVAILABLE`).

### 7.4 Perfil de escola que já é possível (cada vínculo provado)

| Bloco | Fonte | Chave | Prova |
|---|---|---|---|
| Identificação, infraestrutura, matrículas | Censo Escolar (P0) | Inep | P0 |
| Resultados | Ideb por escola (P0) | Inep | P0 |
| Programas, repasses (data/valor), saldo, prestação de contas | PDDE Info | Inep (8 dígitos) | **P3** |
| Município/ente | EEx CNPJ → Siconfi | CNPJ | **P3** (EXACT) |
| Local | Censo 2022 (setor) | coordenadas | **P3** para CNES; escolas via Inep-geocodificado, não testado |
| Obras/equipamentos | Obrasgov (P0), PDDE destinação (Sala de Recursos Multifuncionais) | — | parcial |

O vínculo PDDE↔Censo Escolar por Inep **não foi executado em P3** (o Censo Escolar não foi rebaixado); a chave é a mesma de 8 dígitos (HIGH_CONFIDENCE até o join).

---

## 8. Saúde, financiamento e filas

### 8.1 Financiamento por estabelecimento

`GET https://apidadosabertos.saude.gov.br/assistencia-a-saude/sih-procedimentos-hospitalares?co_cnes=0011738&nu_ano=2025` devolve, por registro: competência, `co_cnes`, **`nu_cnpj`**, nome fantasia, natureza jurídica, **`co_ibge_pac`** (município de residência do paciente), **`ds_financiamento`** ("06 - Média e Alta Complexidade (MAC)"), procedimento, quantidade e **`nu_valor_procedimento`**.

Exemplo: Hospital Santa Rita de Cássia (Vitória). O CNPJ do SIH (`28137925000106`) **é o mesmo** do cadastro CNES (`/cnes/estabelecimentos/0011738`). Procedimento "Gastrectomia parcial em oncologia" R$ 5.099,40 (competência 202503, paciente de município `320520`).

**Distinção obrigatória:** esse é **valor aprovado de produção**, não repasse. O DEMAS não expôs FNS fundo a fundo por estabelecimento. A API do SIOPS (despesa por subfunção/fonte, municipal) tem swagger em `…/swagger-ui/`, mas `/v3/api-docs` devolveu 404 e as rotas não foram enumeradas: `DOCUMENTED_ONLY`.

### 8.2 Filas e tempo de espera

- DEMAS: "Agora tem Especialistas – componente cirurgias" traz **cirurgias previstas e realizadas** (CSV/JSON/XML) com granularidade `UF` e `BR`, competências desde 2025-07, atualizado em 2026-02-28 (783 linhas por arquivo).
- Não existe série nacional de **tempo de espera** nem de **posição na fila**. Imprensa e legislação indicam obrigação futura de divulgação; SISREG público não localizado.
- DF disponibiliza consulta de posição por cidadão (individual): **não coletar**.

`P3_HEALTH_WAITING_LISTS = PARTIAL`: produção cirúrgica por UF, sem espera.

### 8.3 Medicamentos e abastecimento (descoberta)

`GET /daf/estoque-medicamentos-bnafar-horus` devolve a posição de estoque **de um dia** (`data_posicao_estoque = 2026-10-09`) por CNES: `codigo_catmat`, lote, validade, `quantidade_estoque`, programa de saúde, nome do estabelecimento, endereço, **latitude/longitude**. Parâmetros: UF, município, CNES, ano-mês da posição, CATMAT.

- CATMAT liga a **compras públicas** (PNCP/Compras.gov) de itens catalogados.
- O estoque **zero** aparece como linha (quantidade 0): não é "falta" comprovada sem regra de negócio.
- Estoque não é distribuição nem demanda.
- Compras.gov: `modulo-material/4_consultarItemMaterial` responde (exige `tamanhoPagina ≥ 10`); `modulo-pesquisa-preco/1_consultarMaterial` devolveu 404 na forma testada.

### 8.4 Vínculo com território

CNES traz latitude/longitude (comprovado na seção 13) e `codigo_municipio` de 6 dígitos.

---

## 9. Ouvidorias e atendimento ao cidadão

### 9.1 Fala.BR

`https://dadosabertos-download.cgu.gov.br/e-Ouv/manifestacoes-ouvidoria.zip` (191,8 MB, `Last-Modified` 2026-09-01), com 13 CSV anuais de **2014 a 2026** (o de 2026: 293 MB descompactado). Sem cadastro. Li apenas o começo do arquivo de 2026 por `Range` (76.591 linhas, ~janeiro a fevereiro).

Campos (26): data de registro, data do prazo de resposta, data da resposta, faixa etária, raça/cor, gênero, município e UF do manifestante, **município e UF da manifestação**, tipo de manifestação, **código SIORG do órgão**, código e nome do órgão, município e UF do órgão, assunto, **dias para resolução, dias de atraso**, formulário, situação, **esfera**, serviço, outro serviço, **demanda atendida**, **satisfação**.

Na amostra de 2026: esfera Federal 65.696, Municipal 6.211, Estadual 3.014 (8%/4%); **175 órgãos municipais** e ouvidorias; 3.162 valores distintos para município da manifestação; "Não informado" em 27.591 (36%); satisfação e demanda atendida preenchidas só em ~4% das linhas.

**Exemplos de prefeituras na amostra:** Itajaí/SC (214), Niterói/RJ (206), Uberlândia/MG (203), São Mateus/ES (106), Colatina/ES (38), Domingos Martins/ES (30). Alto Rio Novo e Vitória não estão entre as dez maiores origens do ES no trecho lido; **não verifiquei se aparecem**.

**Limites:** o município é **nome**, não IBGE; o órgão municipal é identificado por "nome do órgão + município do órgão + UF". "Concluída" é situação administrativa, **não problema resolvido** (`demanda atendida` existe, mas escassa). Dados são anonimizados (sem nome nem CPF).

### 9.2 Portais 156 municipais com CSV

| Município | Dataset | Conteúdo | Atualização |
|---|---|---|---|
| São Paulo | `dados.prefeitura.sp.gov.br` "SP156 – Solicitações" | data de abertura, bairro, distrito, órgão, canal, assunto, especificação, status, data do parecer | 2026-10-09; desde 2012 |
| Recife | `dados.recife.pe.gov.br` "Central 156 Emlurb" | grupo e serviço, logradouro, número, bairro, RPA, data da demanda, situação, data da última situação | 2026-06-19; desde 2012 |
| Belo Horizonte | `ckan.pbh.gov.br` "Solicitações dos cidadãos por canais de atendimento" | CSV | 2026-06-10 |
| Vitória, Curitiba, Belém | testados | sem resposta CKAN (`NOT_EVALUATED`) | — |

Plataforma compartilhada por várias prefeituras: **não localizada** além do Fala.BR (esfera municipal) e de fornecedores privados não testados.

---

## 10. Servidores e capacidade administrativa

| Fonte | Evidência | Granularidade | Observação |
|---|---|---|---|
| Portal da Transparência — SIAPE | `…/servidores/202607_Servidores_SIAPE.zip` (83 MB, `HEAD` 200) | servidor federal | Contém dados pessoais; não lido em P3. |
| TCE-PE `ListaServidores` | `VERIFIED_API` | servidor municipal e estadual de PE | **Contém `CPFServidor`, `NomeServidor`, `Matricula`**, e também `HashCPFPessoa` (para contar pessoas distintas), cargo, vínculo, admissão, afastamento. Limite de 100.000 linhas por chamada. |
| CNES profissionais, Censo Escolar docentes | P0 | por estabelecimento/escola | Agregar. |
| MUNIC/ESTADIC | P0 | município/UF | Não revisitado. |

**Regras:** trabalhar com **agregados** (servidores por órgão, vínculo, cargo; despesa de pessoal por Siconfi). Contar pessoas pelo hash, nunca por vínculo. Não armazenar nome ou CPF.

`P3_PUBLIC_WORKFORCE = PARTIAL`.

---

## 11. Transferências e prestação de contas

**Já no Cívica:** Emendas Pix (`civica_budget`) com `special_action_plans`, empenhos, documentos hábeis e ordens bancárias.

**Teste (Alto Rio Novo):** `GET …/transferenciasespeciais/plano_acao_especial?cnpj_beneficiario_plano_acao=eq.31796659000120` devolve **4 planos** (2022: R$ 170.297 investimento, situação "CIENTE"; 2025: R$ 396.000 custeio, um "IMPEDIDO" e outro "CIENTE"; 2026: R$ 497.500 investimento). Plano 16483: **empenho `2022NE005445`** (UG 170860, enviado).

O **`relatorio_gestao_especial`** (prestação) devolveu **0 linhas** para o plano 16483. "Sem relatório no sistema" **não** é irregularidade: pode ser estágio, outro canal ou ausência de obrigação.

Instrumentos de convênio e contrato de repasse seguem sem API localizada (P0 `BLOCKED`).

---

## 12. Fiscalização e controle

| Fonte | Estado | Dado |
|---|---|---|
| CEIS (Portal) | `VERIFIED_DATASET` — 23.713 linhas em 2026-10-09 | CNPJ/CPF, categoria, datas de início/fim, órgão sancionador, **abrangência** |
| CNEP | `VERIFIED_DATASET` — 1.828 linhas | + valor da multa |
| TCE-PE | `VERIFIED_API` | `Sancoes` 12.575; `Obras` 2.577; `TransporteEscolar` 209; `Determinacoes` 4.784; `DebitosMultas`; `Processos` |
| TCU | `dados-abertos.apps.tcu.gov.br` respondeu 200 (página); rotas não avaliadas | `NOT_EVALUATED` |
| CGU auditorias | página de dados abertos 200 | `NOT_EVALUATED` |

**Teste F:** 14.263 CNPJs distintos de credores em empenhos municipais do ES (meses 5–8/2025); **478 (3,35%)** aparecem no CEIS ou CNEP em algum momento; **131** tiveram empenho emitido **dentro** da janela de vigência de uma sanção. Como a "abrangência" (no órgão sancionador, no Poder, em todas as esferas) delimita onde a sanção vale, **isso é `TEMPORAL_ONLY`**: não diz que houve irregularidade. Sem rótulos acusatórios.

Classificação de eventos (formal): `ACHADO`, `SUSPEITA`, `RECOMENDAÇÃO`, `DETERMINAÇÃO`, `SANÇÃO`, `CONDENAÇÃO` são **tipos distintos**; TCE-PE publica `Determinacoes` e `DebitosMultas` (decisão), CEIS/CNEP publicam sanção administrativa.

---

## 13. Granularidade submunicipal

Arquivos reais abertos:

| Arquivo | Tamanho | Conteúdo comprovado |
|---|---|---|
| `Agregados_por_setores_basico_BR_20260520.zip` | 15 MB | **468.099 setores**; 38 colunas (código do setor, situação, distrito, subdistrito, **bairro**, nome do município, áreas) + variáveis `v0001…` |
| `Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip` | 9 MB | 458.772 setores; `V06001…V06006`; **53.424 células com "X"** (supressão) |
| `ES_setores_CD2022.gpkg` | 25 MB | 8.788 feições (8.706 códigos de setor únicos); CRS EPSG:4674 |
| `…/Agregados_por_Setor_csv/` (alfabetização 136 MB, domicílio 1–3, cor/raça, demografia, parentesco etc.) | listados | não abertos |
| Entorno urbano, registro de nascimento, favelas | listados | não abertos |

Setores: ES 8.706 (renda: 8.568); Vitória 680; Alto Rio Novo 17. A grade estatística **não** foi localizada na árvore testada (`NOT_EVALUATED`).

**Chave:** `CD_SETOR` (15 dígitos; os 7 primeiros = IBGE do município).

**Teste G (ponto em polígono):** o Hospital Santa Rita (CNES `0011738`, lat −20,2975166 / lon −40,3173521, do próprio cadastro) cai no setor **320530905090052** (Santa Cecília, Vitória; urbano; 0,28 km²). A clínica CNES `9631402` cai no setor 320530905100003 (Praia do Canto). Cada setor tem seus agregados e renda. A geometria local usou `pyogrio` + `shapely` (**sem PostGIS**). 

**PostGIS:** 468.099 polígonos nacionais são viáveis; o GPKG por UF é a unidade de carga; a edição censitária vira revisão (`source_key` por edição). Não estimar deslocamento sem rede viária. **Proximidade ≠ disponibilidade.**

Os cruzamentos setor→escolas, hospitais e assistência dependem da coordenada do equipamento. CNES traz coordenadas; escolas por Inep e CRAS **não foram geocodificados em P3**.

---

## 14. Funcionamento real de serviços públicos

| Domínio | Fonte | Evidência | Granularidade |
|---|---|---|---|
| Energia — DEC/FEC | ANEEL CKAN: `indicadores-coletivos-de-continuidade-dec-e-fec` (ZIP/Parquet 2000–2029); `interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao` (ZIP/Parquet por ano a partir de 2017) | `VERIFIED_DATASET` (catálogo e recursos listados; arquivos **não baixados**) | conjunto elétrico × distribuidora; o vínculo conjunto→município **não foi testado** |
| Serviços urbanos / 156 | seção 9 | `VERIFIED_DATASET` | solicitação |
| Saúde — produção | SIH/SIA | `VERIFIED_API` | estabelecimento × competência |
| Saúde — abastecimento | estoque de medicamentos | `VERIFIED_API` | CNES × CATMAT × lote |
| Educação | PDDE, SIOPE | `VERIFIED` | escola/município |
| Água e esgoto | SNIS/SINISA (P0) | `DOCUMENTED_ONLY` | município |
| Transporte público (GTFS/GTFS-RT, bilhetagem) | — | `NOT_EVALUATED` | — |
| Concessões (ANTT, ANEEL, ANA) | — | `NOT_EVALUATED` (exceto ANEEL catálogo) | — |

`P3_OPERATIONAL_SERVICE_DATA = PARTIAL`.

---

## 15. Preços unitários, patrimônio e concessões

**Preços unitários (PNCP):** `GET https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens` devolve `numeroItem`, `descricao`, `materialOuServico`, **`valorUnitarioEstimado`**, `valorTotal`, `quantidade`, `unidadeMedida`, categoria, critério de julgamento, situação (ex.: Homologado), datas, `temResultado`, `patrimonio`, `codigoRegistroImobiliario`. Exemplo (Alto Rio Novo, 2024/63): item 1, serviço, valor 239.000,00. Comparar preços entre órgãos exige **código de catálogo** (CATMAT/CATSER): o item acima, por ser serviço sob descrição livre, **não é comparável**.

**Patrimônio:** os campos `patrimonio` e `codigoRegistroImobiliario` existem no item do PNCP (para obras/bens), mas **sem cadastro de imóveis públicos aberto provado**. SPU: a API de `dados.gov.br` devolveu **401** (requer token): `BLOCKED` para este teste.

**Concessões:** `NOT_EVALUATED` fora do catálogo ANEEL.

**Preço de referência de medicamentos (CMED/ANVISA):** a URL tentada devolveu 404 (`NOT_EVALUATED`).

---

## 16. Descobertas criativas adicionais

Rodada independente. Só entram itens com evidência (`VERIFIED_*`). Complexidade: B=baixa, M=média, A=alta.

| ID | Descoberta | Pergunta que responde | Identificadores | Granularidade | Cobertura/histórico | Coleta | Relações | Limite |
|---|---|---|---|---|---|---|---|---|
| OPP-01 | **Estoque de medicamentos** (BNAFAR/Hórus) | Quais farmácias públicas têm qual medicamento, lote e validade hoje? | CNES, CATMAT, lote | estabelecimento × item | posição de 2026-10-09; histórico: parâmetro `anomes_posicao_estoque` | B (API paginada) | CATMAT↔PNCP/Compras; CNES↔setor | estoque zero ≠ falta; só quem informa ao BNAFAR |
| OPP-02 | **PDDE saldo mensal por UEx × programa** | Quanto dinheiro de escola está parado em conta? | CNPJ da UEx, Inep | UEx × programa × mês | mês corrente e anteriores | M (HTML/Excel por UF) | Inep↔Censo; CNPJ↔Siconfi | contas bancárias aparecem na tela; **não armazenar** banco/agência/conta |
| OPP-03 | **PDDE prestação de contas, suspensão e situação RFB da UEx** | Quais escolas têm prestação pendente ou repasse suspenso? | Inep, CNPJ | escola | 1997–2026 por ano | M | idem | situação ≠ irregularidade |
| OPP-04 | **SIH com `co_ibge_pac`** | De onde vêm os pacientes de cada hospital? | CNES, IBGE do paciente | estabelecimento × procedimento × mês | 2025 verificado | M | CNES↔CNPJ↔setor | valor aprovado ≠ pago; endereço do paciente só em IBGE |
| OPP-05 | **TCE-PE obras fiscalizadas** | Quais obras de prefeituras foram auditadas e com que achados? | UG, código | obra | 2.577 | B | UG↔CNPJ↔Siconfi↔IBGE | só PE |
| OPP-06 | **TCE-PE transporte escolar fiscalizado** | Como estão os serviços de transporte escolar auditados? | UG | contrato/serviço | 209 | B | idem | só PE |
| OPP-07 | **TCE-PE determinações/recomendações** | Quais determinações pesam sobre cada prefeitura? | UJ, processo | determinação | 4.784 | B | idem | determinação ≠ descumprimento |
| OPP-08 | **TCE-PE sanções** | Quem foi sancionado e por qual órgão? | CPF/CNPJ, órgão | sanção | 12.575 | B | CEIS↔CNPJ | cobertura distinta do CEIS |
| OPP-09 | **TCE-RS empenho + licitação + contrato + histórico** | Qual contrato justificou cada pagamento? | CNPJ, ano/nº do contrato | linha | 2025 (ano a ano) | A (1,35 GB/ano) | PNCP | CPF em claro |
| OPP-10 | **Fala.BR: serviço, atraso, satisfação** | Qual serviço gera reclamação e demora mais? | SIORG, nome do órgão | manifestação | 2014–2026 | M | SIORG↔órgãos; município por nome | município sem IBGE |
| OPP-11 | **156 municipais** (SP, Recife, BH) | Quanto tempo a prefeitura leva para atender cada tipo de pedido por bairro? | bairro/distrito, serviço | solicitação | desde 2012 | B | setor/bairro | esquemas diferentes por cidade |
| OPP-12 | **Setor censitário como chave espacial** | Quem mora no entorno de cada equipamento público? | `CD_SETOR` | setor | Censo 2022 | M | CNES/escola/obra por coordenada | proximidade ≠ acesso |
| OPP-13 | **Espinha de identidade por CNPJ** | A mesma prefeitura em PNCP, PDDE, Transferegov, TCE e Siconfi | CNPJ do ente | ente | 184/184 em PE | B | EXACT | fundos e autarquias têm CNPJ próprio |
| OPP-14 | **SIOPE: remuneração e despesa por função** | Quanto cada município gasta com educação e com pessoal da educação? | COD_MUNI (6 dígitos) | município × semestre | 2024 verificado | B | Siconfi | não chega à escola |
| OPP-15 | **Cirurgias eletivas por UF e mês** | A produção cirúrgica está crescendo? | UF, competência | UF × mês | desde 2025-07 | B | — | sem tempo de espera |
| OPP-16 | **Cruzamento CEIS/CNEP × credores** | Que fornecedores de prefeituras já foram sancionados? | CNPJ | credor | 14.263 credores ES | B | TCE↔CEIS | só temporal; abrangência |
| OPP-17 | **TCE-SP despesa por evento** | Quando cada despesa foi empenhada, liquidada e paga? | município, nº empenho | evento | 644 municípios | M | PNCP (por CNPJ+valor) | sem contrato nem função |
| OPP-18 | **Interrupções de energia (ANEEL)** | Quais conjuntos e distribuidoras têm mais interrupções? | conjunto, distribuidora | evento/conjunto | 2017+ (Parquet) | M | vínculo conjunto→município por provar | — |

Dezoito oportunidades, todas com ao menos uma consulta real que prova a existência do dado. Nenhuma foi incluída apenas para atingir meta.

---

## 17. Testes reais de relacionamento entre fontes

### Teste A — Contrato → fornecedor → empenho → pagamento

**A1. Agudo/RS (TCE-RS + PNCP, 2025).** Fonte A: PNCP, CNPJ do órgão `87531976000179` (Siconfi: Agudo, IBGE 4300109); 150 contratos. Fonte B: TCE-RS `empenhos/2025.csv.zip` (primeiros ~4 MB de PM de Agudo). Regra: `niFornecedor = cnpj_cpf` **e** `anoContrato = ano_contrato` **e** `numeroContratoEmpenho = nr_contrato` (sem zeros à esquerda). **46 de 150** casaram pela chave; **24** com valor pago ou empenhado igual ao valor global (±R$ 1). Exemplos: contrato 62/2025 (R$ 51.283,00: empenhado 0, liquidado 51.283, pago 51.283); contrato 65 (R$ 7.000, pago 7.000); contrato 77 (R$ 12.946,70; pago 12.947). Resultado: **`EXACT` na chave composta** para os 24 consistentes; os outros 22 casam pela chave, mas o valor pago é parcial ou de outro contrato e ficam `HIGH_CONFIDENCE`. **Risco de falso positivo:** `numeroContratoEmpenho` do PNCP varia de significado entre municípios (em Agudo é o número do contrato; em Alto Rio Novo é de empenho). **A janela de 4 MB cobre parte do município; o total de casamentos é limite inferior.**

**A2. Alto Rio Novo/ES (TCE-ES + PNCP).** PNCP: 20 contratos (dez/2024 a jul/2025). TCE-ES: arquivo `2-2025` (meses 5–8). **Número de empenho: 0 de 20 casam** (`numeroContratoEmpenho` do PNCP é outra numeração). **CNPJ do fornecedor como credor da mesma unidade gestora: 14 de 20.** Os seis restantes têm explicações prováveis (contratos de 2024 fora da janela de meses; pessoas físicas, cujo CPF o TCE-ES omite), **não verificadas contrato a contrato**. Exemplo `EXACT` em valor: contrato 7/2025 (R$ 15.000, CNPJ `19132485000103`) ↔ empenho 2025/00000821: empenhada = liquidada = paga = R$ 15.000. Exemplos parciais: contrato 3 (R$ 60.000) ↔ pago R$ 20.000; contrato 1 (R$ 24.705) ↔ pago R$ 8.235 (um terço). Classe: **`HIGH_CONFIDENCE`** (CNPJ + unidade + ano + valor), não `EXACT`, porque falta chave de contrato ou de empenho compartilhada.

**A3. SP e PE.** TCE-SP e TCE-PE trazem CNPJ e nº de empenho, mas **não** nº de contrato no endpoint testado; para PE o método `Contratos` existe, **não exercitado**. `NOT_EVALUATED`.

**Elo que falta no caminho nacional:** uma chave de contrato presente tanto no PNCP quanto no TCE em todos os estados. Só RS a traz.

### Teste B — Escola → programa → repasse → situação

Inep `32087608` (CMEI Gilda Aggum Capettini, Alto Rio Novo/ES, 2024): Fonte A: relatório de prestação de contas (PDDE, previsto R$ 2.130,00, UEx CNPJ `13738531000128`, "Adimplente"). Fonte B: tela da escola (repasse P1 R$ 1.065,00 em 06/05/2024 e P2 R$ 1.065,00 em 24/05/2024). Regra: Inep. Resultado: **`EXACT`**. Risco: o mesmo Inep aparece em múltiplas linhas (uma por destinação); somar sem chave de destinação duplica.

Amostras pedidas: **Vitória** (237 linhas, 119 escolas, R$ 1.837.329 previstos, programas PDDE 117, Qualidade 115, Equidade 3, Educação Especial 2) e **município pequeno** (Alto Rio Novo: 18 linhas, 9 escolas, R$ 110.576). **São Paulo/SP não foi executado** (apenas ES testado em bloco; a mesma rota aceita `siglaUf[]=SP`): `NOT_EVALUATED`.

### Teste C — Hospital → financiamento

Fonte A: CNES `0011738`, CNPJ `28137925000106`, `codigo_municipio` 320530. Fonte B: SIH (2025): mesmo CNPJ, procedimentos, `ds_financiamento` = MAC. Regra: `co_cnes` + CNPJ. Resultado: **`EXACT`** para identificar a unidade; o **vínculo financeiro é produção aprovada**, não repasse (`TEMPORAL/INFERRED` para pagamento). Risco: valor aprovado inclui só AIH aprovada, não glosas posteriores.

### Teste D — Município → manifestação

São Mateus/ES: Fala.BR com órgão "Prefeitura Municipal", município do órgão "SÃO MATEUS", UF "ES"; 106 linhas na amostra de 2026. Regra: nome do município + UF → IBGE (via Siconfi `/entes`). **`HIGH_CONFIDENCE`** (nome+UF sem homônimo na UF), **não `EXACT`** (sem código). Prazo, resposta, dias de atraso e situação presentes.

### Teste E — Transferência → prestação

Alto Rio Novo: plano 16483 (R$ 170.297, 2022), beneficiário CNPJ `31796659000120` (**`EXACT`** com o ente do Siconfi), empenho `2022NE005445`. `relatorio_gestao_especial`: 0 linhas. Elo de **prestação** não demonstrado para esse plano (ausência registrada, sem juízo).

### Teste F — Fiscalização/sanção → entidade

Seção 12: CEIS/CNEP ↔ credor por CNPJ (**`EXACT`** na chave). Vínculo com o **gasto**: `TEMPORAL_ONLY`.

### Teste G — Território → serviço

Seção 13: coordenada do CNES → setor `320530905090052`. Classe: **`EXACT`** para a geometria (ponto dentro do polígono); pressupõe coordenada correta no cadastro. Risco: coordenada defeituosa no CNES.

### Teste H (identidade)

Prefeituras de PE: **184/184** CNPJs de `UnidadesJurisdicionadas` (natureza "Prefeitura Municipal") existem no Siconfi `/entes` e na UF correta: **`EXACT`**.

---

## 18. Matriz de cobertura territorial

| Domínio | União | Estados | Municípios | Unidade individual | Evento/transação | Evidência |
|---|---|---|---|---|---|---|
| Pagamento por credor | P0: agregado; transferências com CNPJ | não varrido (TCE-PE documenta) | SP 644, ES ~78, PE 184, RS ~497 | credor | empenho/liquidação/pagamento | VERIFIED |
| Contrato | PNCP | PNCP | PNCP (`codigoIbge`) | contrato/item | assinatura | VERIFIED |
| Repasse a escola | FNDE (PDDE) | — | por EEx | **escola (Inep)** | repasse datado | VERIFIED |
| Gasto em educação | — | SIOPE (Estado) | SIOPE (município) | — | período | VERIFIED |
| Saúde produção | DEMAS | idem | idem | **estabelecimento (CNES)** | competência | VERIFIED |
| Estoque de medicamentos | DEMAS | — | — | **farmácia (CNES)** | posição diária | VERIFIED |
| Fila/espera | UF e BR (cirurgias) | UF | — | — | mensal | VERIFIED (sem espera) |
| Ouvidoria | Fala.BR federal | Fala.BR estadual | 175 órgãos municipais na amostra | manifestação | registro/resposta | VERIFIED |
| 156 municipal | — | — | SP, Recife, BH | solicitação | abertura/parecer | VERIFIED |
| Servidores | SIAPE (existe) | TCE-PE | TCE-PE | vínculo | mês | PARTIAL |
| Sanções | CEIS/CNEP | TCE-PE | idem | CNPJ/CPF | início/fim | VERIFIED |
| Submunicipal | — | — | — | **setor censitário** | Censo 2022 | VERIFIED |
| Energia | ANEEL | — | por conjunto | conjunto | mensal/evento | catálogo |

**Amostras técnicas pedidas:** União; ES; Vitória; Alto Rio Novo (testados extensivamente); São Paulo (TCE-SP não cobre a capital; SP156 sim; PDDE/SP não executado); Belo Horizonte (156 sim; TCE-MG não); Curitiba (portal sem resposta); Recife (156 sim; TCE-PE sim); Belém (portal sem resposta). Sem extrapolação nacional.

---

## 19. Matriz de granularidade

| Dado | Menor unidade comprovada | Datas | Valor financeiro individualizado |
|---|---|---|---|
| Empenho/pagamento (TCE-SP) | evento por empenho e fornecedor | emissão | sim |
| Empenho (TCE-ES) | movimento mensal por empenho | referência e emissão | sim (com estornos) |
| Empenho (TCE-RS) | operação E/L/P | operação | sim |
| PDDE | escola × destinação × ordem de pagamento | data do pagamento | sim |
| SIOPE | município × período | semestre/bimestre | agregado |
| SIH | estabelecimento × procedimento × competência | competência | sim (aprovado) |
| Estoque | CNES × CATMAT × lote | dia | quantidade |
| Fala.BR | manifestação | registro, prazo, resposta | — |
| Censo | setor | 2022 | — (renda agregada) |

---

## 20. Matriz de identidade e relacionamentos

| Chave | Onde existe | Relação | Classe |
|---|---|---|---|
| CNPJ do ente | Siconfi, PNCP, PDDE (EEx), Transferegov, TCE-PE (UG) | ente ↔ município | **EXACT** (PE 184/184) |
| IBGE 7 / IBGE 6 | PNCP `codigoIbge` (7), CNES/SIOPE/PDDE `co_municipio` (6) | converter | **EXACT** (regra de dígito) |
| Inep (8 dígitos) | PDDE, Censo, Ideb | escola | **EXACT** (PDDE); Censo **HIGH** até o join |
| CNES | CNES, SIH, estoque, SIA | estabelecimento | **EXACT** |
| CNPJ do estabelecimento | CNES, SIH | hospital ↔ pessoa jurídica | **EXACT** |
| CNPJ credor | TCEs, PNCP, CEIS | fornecedor | **EXACT** na chave; PF mascarada ou aberta, conforme a fonte |
| Nº do contrato | PNCP, TCE-RS | contrato ↔ pagamento | **EXACT** (RS) |
| Nº do empenho | TCEs, Transferegov | empenho | PNCP↔TCE: **UNLINKED** (numerações diferentes) |
| Nome do município | SP, ES, Fala.BR | → IBGE | **PROBABLE/HIGH** (nome+UF) |
| `CD_SETOR` | Censo | setor | **EXACT** |
| Coordenadas | CNES, estoque | → setor | **EXACT** geométrico |
| Código SIORG | Fala.BR | órgão federal | **EXACT** (federal); municipal sem SIORG |
| Código do órgão TCE-RS (`cd_orgao`) | TCE-RS | → município | **PROBABLE** (nome "PM DE …") |
| Código de município do TCE-PE (`P083`) | TCE-PE | → IBGE | via UG→CNPJ→Siconfi: **EXACT** |

---

## 21. Arquitetura consolidada de collectors

### 21.1 O que o Cívica já tem (DRY)

| Componente existente | Arquivo/doc | Reuso nesta P3 |
|---|---|---|
| Transporte institucional com host oficial, timeout, limite de bytes e `Retry-After` | `apps/collector/src/institutional-http.ts` | Todas as fontes HTTP desta fase. Acrescentar hosts: `transparencia.tce.sp.gov.br`, `dados.es.gov.br`, `sistemas.tce.pe.gov.br`, `dados.tce.rs.gov.br`, `www.fnde.gov.br`, `apidadosabertos.saude.gov.br`, `dadosabertos-download.cgu.gov.br`, `geoftp.ibge.gov.br`, `ftp.ibge.gov.br`. |
| Execução institucional com raw → normalizado → publicação, checkpoints, `--resume`, `--dry-run` | `institutional-run.ts`, `institutional-storage.ts`, `docs/collectors/institutional-ingestion.md` | Modelo de execução de todas as famílias. |
| PNCP Consulta v1 | `pncp-enrichment.ts`, `chamber-procurement.ts`, `senate-procurement.ts` | **Generalizar** do filtro por Casa para órgão arbitrário e para itens. |
| Transferegov PostgREST e ZIP do Portal | `postgres-pix-transferegov.ts`, `postgres-pix-portal.ts`, `postgres-pix-identity.ts`, `postgres-pix-run.ts`, `civica_budget` | Fornecem o teste E já pronto; ampliar para `relatorio_gestao`. |
| Identidade de fornecedor (CPF/CNPJ, conflitos, links reversíveis) | `packages/domain/src/supplier-identity.ts`, `packages/db/src/suppliers.ts`, `supplier-aggregates.ts`, `docs/contracts/supplier-identity-and-institutional-data.md` | **Todas** as fontes de credor (TCEs, PNCP, CEIS). Resolver regras de CPF parcial. |
| Regras de ligação por nome sem fuzzy (EXACT_ID > ... > UNIQUE_NAME) | `packages/db/src/state-finance-identity.ts` | Modelo para nome→IBGE dos TCEs e Fala.BR. |
| Registro de fontes/capacidades | `core/registry/national-finance-registry.ts`, `civica_national.domain_capabilities` | Hoje descrevem **Casas legislativas**; precisam de "território/ente" (adaptação grande, P0 já apontou). |
| Controle de plano, agendador, revisão, observabilidade, travas, retry, ciclo de publicação, recuperação histórica | `core/control-plane`, `scheduler`, `revision`, `observability`, `lock`, `retry`, `publication-lifecycle.ts`, `historical-*` | Operação das novas famílias. |
| Índice de preços (IPCA via SIDRA) | `price-index.ts` | Deflação de séries de pagamentos. |
| Mapa do Brasil | `apps/web/components/brazil-map-markup.ts` | Visualização por UF. |
| Providers estaduais | `apps/collector/src/state/providers/*` | **São de Assembleias Legislativas**, não do Executivo: o arcabouço (registro, validação, persistência, publicação) é reutilizável, os providers não. |

**Não existe no repositório (apenas investigado):** Siconfi, CNES/DEMAS, Obrasgov, Censo Escolar/INEP (apenas scripts de tipos de escola em P22), DataJud (apenas docs), SIOPE, SIOPS, Fala.BR, CEIS, TCE.

### 21.2 Famílias de collectors propostas

| ID | Família | Transporte | Fontes | Reuso |
|---|---|---|---|---|
| COL-F0 | Referência e identidade | JSON REST | Siconfi `/entes`, IBGE | P0 F0 |
| COL-F1 | PNCP (contratos, itens) | REST paginado | PNCP | **`pncp-enrichment.ts`** |
| COL-F2 | Transferências | PostgREST + ZIP | Transferegov, Portal | **`postgres-pix-*`** |
| COL-F3 | **Pagamentos via Tribunais de Contas** (adaptador por TCE) | JSON (SP, PE), CSV/ZIP (ES, RS) | TCE-SP, ES, PE, RS | `institutional-http`, `suppliers` |
| COL-F4 | **FNDE** | HTML/XLSX (PDDE Info), OData (SIOPE) | PDDE, SIOPE | `institutional-*` |
| COL-F5 | **Saúde (DEMAS)** | REST JSON | CNES, SIH, estoque, cirurgias (CSV S3) | P0 DEMAS |
| COL-F6 | **Atendimento ao cidadão** | ZIP CSV (Fala.BR), CKAN CSV (156) | Fala.BR, SP/Recife/BH | `institutional-*` |
| COL-F7 | **Controle externo** | ZIP CSV, API JSON | CEIS/CNEP, TCE-PE (sanções/obras/determinações) | `suppliers` |
| COL-F8 | **Território** | ZIP CSV + GPKG | Censo 2022 (setores), malha | PostGIS (novo) |

Um **adaptador por TCE** (F3) é a unidade de custo real: formatos diferentes, mesma saída canônica (evento de despesa).

### 21.3 Cenários

| | **A — Mínimo operacional** | **B — Nacional + agregadores estaduais** | **C — Granularidade máxima** |
|---|---|---|---|
| Sistemas | 6 (Siconfi, PNCP, Transferegov, PDDE Info, DEMAS, Fala.BR) | 10–11 (A + TCE-SP, ES, PE, RS + CEIS) | 20+ (B + todos os TCEs viáveis + 156 municipais + ANEEL + Censo) |
| Famílias | F0, F1, F2, F4, F5, F6 | + F3, F7 | + F8 |
| Municípios com pagamento por credor | 0 | ≈1.400 (25%) | ≈1.400 + os provados no futuro; teórico nacional |
| Granularidade | contrato, escola, hospital, manifestação | + pagamento por credor municipal | + setor censitário, estoque por farmácia |
| Dados que faltam | pagamento por credor municipal | 23 UFs de TCE | águas, transporte, patrimônio |
| Frequência | semanal–mensal | + mensal | + diária (estoque) |
| Volume (`INFERRED`) | GB baixos | + dezenas de GB/ano (RS ~1,3 GB por ano zipado) | + PostGIS ~1 GB, estoque diário |
| Backfill | PDDE 1997→, Fala.BR 2014→ | + empenhos desde 2020 (ES) | + 2012→ (156) |
| Manutenção | baixa | **média**: um adaptador por TCE | alta |
| Dependências | gov.br, FNDE (HTML) | + 4 TCEs | + dezenas de portais |

**Recomendação:** B. O cenário A não resolve a pergunta central (pagamento municipal); o C, sem prova prévia dos demais TCEs, promete cobertura que não há evidência para sustentar.

---

## 22. Estimativa de volume e atualização

| Fonte | Volume observado | Atualização | Estratégia |
|---|---|---|---|
| TCE-SP | 4,6 mil linhas/mês (Adamantina) a 17,8 mil (Campinas); 644 municípios (total/mês `INFERRED`: milhões) | mensal | uma chamada por município/mês; limitador |
| TCE-ES | 133 MB zipados de empenhos em 2025 (5 arquivos); despesas ~19 MB/ano | mensal; `metadata_modified` no CKAN | baixar por arquivo e reconciliar movimentos |
| TCE-PE | 100.000 linhas por chamada; 56 MB para um corte | contínua | filtrar por UG/mês |
| TCE-RS | 1,35 GB zipado (2025) | mensal (arquivo anual refeito) | `Range`/streaming; retificações possíveis |
| PDDE | ES: 372 KB/UF/ano; por município ~40 KB | mensal | 27 UFs + 5.570 municípios por exercício |
| SIOPE | 100 KB por UF/semestre | semestral/bimestral | OData por UF |
| SIH | por CNES/ano | mensal | paginar |
| Estoque | por CNES/dia | diária | amostrar; histórico por parâmetro |
| Fala.BR | 192 MB zip; 2026: 293 MB | mensal | reprocessar o ano corrente |
| Censo | 468 mil setores; renda 9 MB; GPKG ES 25 MB | por edição | revisão por edição |
| CEIS/CNEP | 3,5 MB + 0,2 MB | diária | substituir snapshot |

---

## 23. Indicadores e perguntas de produto

Cada indicador (matriz de maturidade completa no JSON).

| ID | Indicador | Fonte | Granularidade | Prova | Viabilidade |
|---|---|---|---|---|---|
| IND-PAY-001 | Pago a fornecedor por município e ano | TCE-SP/ES/PE/RS | município × credor × mês | VERIFIED | NEEDS_VALIDATION (reconciliação de movimentos) |
| IND-PAY-002 | Contrato→pago | PNCP × TCE-RS | contrato | VERIFIED (RS) | NEEDS_VALIDATION |
| IND-EDU-001 | PDDE pago por escola e ano | PDDE Info | escola × destinação | VERIFIED | READY_FOR_CONTRACT |
| IND-EDU-002 | Saldo de escola em conta | PDDE Info | UEx × programa × mês | VERIFIED | NEEDS_VALIDATION (dados bancários) |
| IND-EDU-003 | Situação de prestação de contas | PDDE Info | escola | VERIFIED | READY_FOR_CONTRACT |
| IND-EDU-004 | Despesa em educação por município | SIOPE | município × semestre | VERIFIED | READY_FOR_CONTRACT |
| IND-HLT-001 | Produção aprovada por hospital e tipo de financiamento | SIH | CNES × mês | VERIFIED | READY_FOR_CONTRACT |
| IND-HLT-002 | Estoque de medicamentos por farmácia | DEMAS | CNES × CATMAT × lote | VERIFIED | NEEDS_VALIDATION |
| IND-HLT-003 | Cirurgias eletivas realizadas/previstas por UF | DEMAS | UF × mês | VERIFIED | READY_FOR_CONTRACT |
| IND-HLT-004 | Tempo de espera | — | — | — | NOT_FEASIBLE |
| IND-OUV-001 | Manifestações por órgão, assunto, esfera | Fala.BR | manifestação | VERIFIED | READY_FOR_CONTRACT |
| IND-OUV-002 | Dias para resolução e atraso | Fala.BR | manifestação | VERIFIED | READY_FOR_CONTRACT |
| IND-OUV-003 | Tempo de atendimento 156 por bairro | SP156, Recife, BH | solicitação | VERIFIED | NEEDS_VALIDATION |
| IND-CTL-001 | Credor com sanção vigente no empenho (temporal) | TCE × CEIS/CNEP | credor | VERIFIED | NEEDS_VALIDATION (abrangência) |
| IND-GEO-001 | População, domicílios e renda no setor do equipamento | Censo × CNES | setor | VERIFIED | NEEDS_VALIDATION |

**Perguntas de produto que passam a ter resposta provada:** quem recebeu da prefeitura X em 2025; qual contrato sustentou o pagamento; quanto cada escola recebeu do PDDE e em que data; quais escolas têm prestação pendente; quanto do saldo de escolas está parado; o que cada hospital faturou e de onde vêm os pacientes; que medicamentos a farmácia municipal tem hoje; quais serviços geram mais manifestações e demoram mais.

---

## 24. Lacunas e bloqueios

| ID | Bloqueio | Tipo |
|---|---|---|
| BLK-01 | TCEs de MG, RJ, PR, SC (Qlik), CE, BA, PB, MT, GO, MS e demais: não exercitados ou sem formato de pagamentos | NOT_EVALUATED/DOCUMENTED |
| BLK-02 | Pagamento de Executivos **estaduais** por credor: não varrido | NOT_EVALUATED |
| BLK-03 | Chave de contrato comum PNCP↔TCE fora do RS | falta de elo |
| BLK-04 | CPF em claro em TCE-RS, TCE-PE e PNCP (PF); mascarado em TCE-ES e TCE-SP | privacidade |
| BLK-05 | Rota da API do SIOPS não enumerada; `/v3/api-docs` 404 | DOCUMENTED_ONLY |
| BLK-06 | FNDE: CKAN em SPA; PNAE/PNATE/FUNDEB/PNLD por escola não localizados | NOT_EVALUATED |
| BLK-07 | Tempo de espera do SUS: inexistente em fonte nacional | NOT_FEASIBLE (por ora) |
| BLK-08 | Pagamento efetivo por hospital (FNS/contratos de gestão) | não localizado |
| BLK-09 | SPU (patrimônio): `dados.gov.br` 401 | BLOCKED |
| BLK-10 | Município sem IBGE em SP, ES, RS e Fala.BR | PROBABLE |
| BLK-11 | Vínculo conjunto elétrico→município (ANEEL) | não testado |
| BLK-12 | Grade estatística, escolas geocodificadas, CRAS | não testados |
| BLK-13 | PDDE de São Paulo (e demais UFs) não executado; só ES | NOT_EVALUATED |
| BLK-14 | Prestação de contas do PDDE: filtro de inadimplência não explorado | NEEDS_VALIDATION |

---

## 25. Experimentos prioritários seguintes

1. **Reconciliação de movimentos do TCE-ES**: reproduzir total anual de um município conhecido e comparar com Siconfi (RREO/DCA).
2. **TCE-RS completo**: baixar o ano inteiro, contar municípios, medir cobertura de CNPJ e de contrato, repetir o Teste A em 5 municípios.
3. **TCE-PE `Contratos` + `EmpenhoPagamento`** para um município: fechar contrato→empenho→pagamento em PE.
4. **PDDE nacional por UF**: executar `excel` para as 27 UFs (uma chamada cada) e `excelall` para 20 municípios; cruzar com Censo Escolar por Inep.
5. **SIOPS**: enumerar a API (Swagger UI) e testar município/ano.
6. **Segunda rodada de TCEs**: MG (SICOM), PR (SIM-AM), SC (e-Sfinge), CE, BA, GO, MT, MS, PB, RJ.
7. **Estoque de medicamentos**: medir volume nacional por dia, histórico por `anomes_posicao_estoque` e cruzamento com CATMAT do PNCP.
8. **ANEEL**: baixar o recurso de conjuntos e testar o vínculo com município.
9. **Fala.BR 2025 completo**: contar órgãos municipais e medir cobertura por IBGE.
10. **Geocodificar escolas** por Inep e medir o setor de cada uma.

---

## 26. Gates finais

| Gate | Estado | Justificativa (evidência) |
|---|---|---|
| `P3_SOURCE_DISCOVERY` | **PASS_WITH_CAVEATS** | 20+ fontes provadas com chamadas reais; vários bloqueios reclassificados (FNDE, SIOPE). Itens `NOT_EVALUATED` listados. |
| `P3_FINANCIAL_TRACEABILITY` | **PARTIAL** | Cadeia contrato→pago comprovada em 2 municípios (RS EXACT; ES HIGH). Sem chave nacional e sem pagamento federal por credor revisitado. |
| `P3_STATE_PAYMENT_COVERAGE` | **PARTIAL** | Executivos estaduais não varridos; TCE-PE documenta `DespesasEstaduais`. |
| `P3_MUNICIPAL_PAYMENT_COVERAGE` | **PARTIAL** | 4 TCEs provados (≈25% dos municípios por jurisdição, com RS a confirmar); 23 UFs não avaliadas. |
| `P3_SCHOOL_FUNDING_LINKAGE` | **PASS_WITH_CAVEATS** | PDDE por escola com repasses datados e prestação (ES completo 2024). Outros programas por escola não provados; join com Censo não executado. |
| `P3_HEALTH_FINANCING_LINKAGE` | **PARTIAL** | CNES↔CNPJ↔SIH com valor aprovado e tipo de financiamento; pagamento efetivo não localizado; SIOPS não enumerado. |
| `P3_HEALTH_WAITING_LISTS` | **PARTIAL** | Cirurgias por UF e mês; sem tempo de espera nacional. |
| `P3_CITIZEN_SERVICE_DATA` | **PASS_WITH_CAVEATS** | Fala.BR (2014–2026) e 156 de 3 cidades. Município sem IBGE; satisfação rara. |
| `P3_PUBLIC_WORKFORCE` | **PARTIAL** | SIAPE ZIP existe; TCE-PE traz servidores municipais (PII). Agregação não executada. |
| `P3_TRANSFER_ACCOUNTABILITY` | **PARTIAL** | Instrumento→empenho comprovado; prestação ausente no exemplo; convênios sem API. |
| `P3_AUDIT_LINKAGE` | **PARTIAL** | CEIS/CNEP por CNPJ (EXACT) e TCE-PE (determinações, sanções, obras); vínculo com gasto só temporal; TCU/CGU não avaliados. |
| `P3_SUBMUNICIPAL_COVERAGE` | **PASS_WITH_CAVEATS** | Setor censitário aberto, renda com supressão, ponto-em-polígono provado. Grade e escolas geocodificadas não testadas. |
| `P3_OPERATIONAL_SERVICE_DATA` | **PARTIAL** | Estoque, 156, SIH provados; energia só em catálogo; transporte e água não avaliados. |
| `P3_CREATIVE_DISCOVERY` | **PASS_WITH_CAVEATS** | 18 oportunidades com evidência real (mínimo pedido: 15). |
| `P3_IDENTITY_LINKAGE` | **PASS_WITH_CAVEATS** | Espinha CNPJ EXACT (PE 184/184); IBGE por nome PROBABLE em SP/ES/RS/Fala.BR. |
| `P3_COLLECTOR_CONSOLIDATION` | **PASS_WITH_CAVEATS** | 9 famílias, com F1, F2 e a base institucional já existentes; custo real = 1 adaptador por TCE. |
| `P3_PRODUCT_READINESS` | **PARTIAL** | Prontos para contrato: PDDE por escola, SIH por hospital, Fala.BR, SIOPE. O resto precisa de validação. |

---

## 27. Inventário de evidências, endpoints e testes

| ID | Consulta | Resultado |
|---|---|---|
| TST-TCESP-1 | `GET transparencia.tce.sp.gov.br/api/json/municipios` | 200; 644 municípios |
| TST-TCESP-2 | `GET …/despesas/adamantina/2024/1` | 200; 4.561 linhas; Empenhado 1.995, Liquidado 1.585, Pago 959, Anulação 22; PJ 3.134, PF 1.427 |
| TST-TCESP-3 | `GET …/despesas/campinas/2024/6` | 200; 17.789 linhas; 5,3 MB; 4,4 s; `mes=13` devolve `[]` |
| TST-TCEES-1 | CKAN `package_show?id=despesas-municipios` e `tcees-empenho` | 15 e 31 recursos; empenhos 2020–2026 |
| TST-TCEES-2 | Dicionário `Dicionário de dados` (CSV) | 58 colunas descritas |
| TST-TCEES-3 | ZIP `municipios-despesas-empenhos-2-2025` (26,8 MB → 773 MB) | 913.596 linhas; 536 UGs; 69 "Prefeitura Municipal"; CNPJ 58,5% |
| TST-TCEPE-1 | `…/DadosAbertos/Exemplo!listar` | catálogo de métodos |
| TST-TCEPE-2 | `DespesasMunicipais!json?ANOREFERENCIA=2024` | 56 MB; 100.000 linhas; 184 municípios; 627 UGs; CNPJ 14 dígitos 62,7% |
| TST-TCEPE-3 | `UnidadesJurisdicionadas!json` | 1.817 UGs; 184 prefeituras com CNPJ ∈ Siconfi |
| TST-TCEPE-4 | `Sancoes`, `Obras`, `TransporteEscolar`, `Determinacoes`, `ListaServidores` | 12.575; 2.577; 209; 4.784; 100.000 (corte) |
| TST-TCERS-1 | CKAN `dados.tce.rs.gov.br`: `package_list` | 73.440 pacotes (48.530 balancetes, 11.405 empenhos PM, …) |
| TST-TCERS-2 | `empenhos/2025.csv.zip` (`HEAD`, `Range`) | 1.349.555.700 B; 48 colunas; 197.713 linhas lidas (3 PMs) |
| TST-A1 | PNCP Agudo × TCE-RS | 46/150 chave; 24 valor-consistentes |
| TST-A2 | PNCP Alto Rio Novo × TCE-ES | nº empenho 0/20; CNPJ 14/20 |
| TST-SIC-1 | Siconfi `/entes` | 5.598 entes; CNPJ de Alto Rio Novo, Serra, Vitória, Agudo |
| TST-PDDE-1 | `situacaoprestacaoconta…?ano=2024&siglaUf[]=ES` (HTML) | 10 cartões/página; 490 páginas |
| TST-PDDE-2 | `…/excel?an_exercicio=2024&sg_uf=ES` | XLSX 372 KB; 4.891 linhas; 2.414 escolas |
| TST-PDDE-3 | `escola/consultar?ano=2024&co_escola=32087608` | repasses datados; subtotal 2.130,00 |
| TST-PDDE-4 | `escola/excelall?ano=2024&SG_UF=ES&CO_MUNICIPIO_FNDE=320035` | XLSX 39 KB; 10 escolas; devido 115.187; pago 97.576 |
| TST-PDDE-5 | `consultasaldoentidade…?mes=08-2026&siglaUf[]=ES` | saldos por UEx × programa |
| TST-SIOPE-1 | `…/odata/$metadata` | 8 funções |
| TST-SIOPE-2 | `Dados_Gerais_Siope(Ano_Consulta=2024,Num_Peri=6,Sig_UF='ES')` | 79 entes; Vitória pago educação R$ 808,1 mi |
| TST-DEMAS-1 | `/cnes/estabelecimentos/0011738` | CNPJ, lat/lon, município |
| TST-DEMAS-2 | `/assistencia-a-saude/sih-procedimentos-hospitalares?co_cnes=0011738&nu_ano=2025` | `nu_cnpj`, financiamento, valor aprovado, `co_ibge_pac` |
| TST-DEMAS-3 | `/daf/estoque-medicamentos-bnafar-horus` | posição 2026-10-09; CATMAT, lote, lat/lon |
| TST-DEMAS-4 | CSV S3 `pnrfcirrea`, `pnrfcirpre`, `mgdi_ms_3f6` | 783 linhas; UF/BR; desde 2025-07 |
| TST-FALA-1 | `…/e-Ouv/manifestacoes-ouvidoria.zip` (`HEAD`, `Range`) | 191.810.664 B; 13 CSV (2014–2026) |
| TST-FALA-2 | CSV 2026 (primeiros 18 MB) | 76.591 linhas; 26 colunas; 175 órgãos municipais |
| TST-156-1 | SP156, Recife, BH (CKAN) | CSV com datas, bairro, serviço, status |
| TST-TRF-1 | Transferegov `plano_acao_especial?cnpj_beneficiario_plano_acao=eq.31796659000120` | 4 planos; empenho `2022NE005445`; `relatorio_gestao_especial` 0 |
| TST-CEIS-1 | `download-de-dados/ceis/20261009` e `cnep` | 23.713 e 1.828 linhas |
| TST-F-1 | Credores TCE-ES × CEIS/CNEP | 478/14.263; 131 com janela temporal |
| TST-CEN-1 | Censo: básico, renda, GPKG ES | 468.099 setores; renda 458.772; 53.424 "X"; 8.706 setores ES |
| TST-G-1 | Ponto-em-polígono CNES 0011738 | setor 320530905090052 |
| TST-ANEEL-1 | CKAN ANEEL | DEC/FEC e interrupções (ZIP/Parquet) |
| TST-PNCP-ITEM | `…/orgaos/31796659000120/compras/2024/63/itens` | campos de item |
| TST-NEG | `dados.tce.rj.gov.br`, `dados.tce.pr.gov.br`, `dados.tcesc.tc.br`, `api.tcm.ce.gov.br`, `api.queridodiario.ok.org.br`, `dadosabertos.compras.gov.br/modulo-pesquisa-preco/…`, `dados.anvisa.gov.br/…CMED`, SPU (`dados.gov.br` 401), `mapaosc.ipea.gov.br` | sem resposta, 404 ou 401: `NOT_EVALUATED`/`BLOCKED` |

Limites respeitados: consultas pequenas, parciais por `Range` quando o arquivo é grande, sem autenticação, sem contornar controles, sem dados individuais armazenados no repositório. CPF e dados bancários vistos nos testes **não** foram reproduzidos neste relatório.
