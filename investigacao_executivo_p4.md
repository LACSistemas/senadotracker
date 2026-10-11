# CÍVICA — P4: Validação nacional e fechamento de contratos

Data: 2026-10-11. Escopo: somente investigação. Nenhum código, banco, collector, migration, schema ou frontend foi alterado, e nenhum arquivo das fases anteriores foi tocado. Os dados baixados ficaram no scratchpad da sessão, fora do repositório. Nada de dado pessoal foi reproduzido aqui.

Companheiro estruturado: `investigacao_executivo_p4_fontes.json` (IDs estáveis `SRC-*`, `TST-*`, `REC-*`, `RULE-*`, `GATE-*`; referências às fases anteriores como `p0:`, `p2:`, `p3:`).

Classes de evidência: `VERIFIED_API`, `VERIFIED_DATASET`, `DOCUMENTED_ONLY`, `INFERRED`, `BLOCKED`, `NOT_EVALUATED`, `UNAVAILABLE`. Classes de vínculo: `EXACT`, `HIGH_CONFIDENCE`, `PROBABLE`, `TERRITORIAL_ONLY`, `TEMPORAL_ONLY`, `UNLINKED`, `CONFLICT`.

---

## 1. Resumo executivo

A P4 fechou as perguntas que a P3 deixou abertas. O saldo é bom, mas **corrige três afirmações da P3**.

| Objetivo | Resultado |
|---|---|
| **Pagamentos: cobertura real dos TCEs** | Confirmada com contagem real: **SP 644 + ES 78 + PE 184 + RS 497 = 1.403 municípios (25,2% dos 5.570)**. A incerteza do RS acabou: o arquivo de 2025 (26,9 milhões de linhas) traz 497 prefeituras, 497 câmaras e 125 outras entidades. |
| **Pagamentos: reconciliação** | **Fecha com o Siconfi/DCA** em ES (78/78 municípios comparados; 71 dentro de R$ 1), SP (liquidado e pago idênticos) e PE (dentro de R$ 10 mil). No RS só fecha somando todos os órgãos do município. Regras de soma por TCE definidas (seção 3.3). |
| **Executivos estaduais** | Pagamento por favorecido verificado em **ES, MG (só empenho), RS e PE** (via TCE-PE). BA é painel agregado; PB, SC, GO, RO e SP só parcial. |
| **Escolas** | PDDE nas 27 UFs: **2023 completo** (126.402 escolas, 247.863 linhas), mas o export em lote **falha em 2024 e 2025** na maioria das UFs. Vínculo com o Censo Escolar: **99,99%**. |
| **Saúde: estoque** | No ES: 68 de 78 municípios, 393 estabelecimentos; 88% atualizados em até 7 dias, mas as 29 unidades de Vitória estão paradas desde 05/05/2026 e Serra não aparece. Histórico: a API só guarda o mês corrente. |
| **Saúde: fluxo de pacientes** | Medido com os arquivos RD do DATASUS: no ES, só **44,5%** das internações ocorrem no município de residência; o Hospital Santa Rita atende pacientes de **82 municípios** e só 11,9% são de Vitória. |
| **Território** | **391/391** coordenadas de estabelecimentos caem em setor censitário, e no município certo. A soma dos setores de Vitória fecha com o Censo (322.869). |
| **Atendimento** | Fala.BR 2025: **1,56 milhão de manifestações; 2.230 órgãos municipais em 1.650 municípios (29,6%)**. 156: SP atualizado até o 3º tri/2026; Recife completo; **BH parou em 2023**. |

**Correções à P3 (importantes):**

1. **SIH do DEMAS não é a produção do hospital.** A API devolve ~1 linha por hospital-mês e ignora `limit`. Para o Hospital Santa Rita: 12 linhas e R$ 166 mil em 2025 na API, contra **2.095 AIH e R$ 4,70 milhões só em jan–mar/2025** nos arquivos RD do DATASUS. A fonte correta para produção hospitalar são os arquivos RD (FTP DATASUS).
2. **O export em lote do PDDE falha com `ORA-01722` em 2024/2025** (e para capitais grandes por município), e o filtro "Inadimplente" **sempre falha**. Logo, os "100% Adimplente" que a P3 observou são **viés de sobrevivência do filtro**, não um fato sobre as escolas.
3. **TCE-CE tem catálogo e municípios com IBGE, mas as tabelas voltam vazias** (0 linhas em 195 consultas de órgãos e 6 de empenhos). A P3 só havia registrado "documentado".

**Achados novos que simplificam a arquitetura:**

- No TCE-ES, o dataset agregado de despesas traz o **nome do município na coluna `EsferaAdministrativa`**, o que resolve a identidade das 78 prefeituras (casou 78/78 com o Siconfi).
- O **DCA do Siconfi é um verificador independente**: qualquer carga de pagamento municipal pode ser conferida contra ele.

---

## 2. Pagamentos

### 2.1 Cobertura real dos TCEs

| TCE | Municípios | Evidência | Volume lido | Ano de referência |
|---|---|---|---|---|
| SP | **644** (capital: TCM-SP) | `/api/json/municipios` | por município/mês (4.561 a 17.789 linhas) | 2024 |
| ES | **78** | 78 nomes no agregado 2024, todos com 12 meses; 78/78 casam com o Siconfi | 942.247 linhas agregadas; 5 partições de empenhos | 2024 |
| PE | **184** prefeituras | 184/184 CNPJ no Siconfi | 100.000 linhas por chamada | 2024 |
| RS | **497** prefeituras | `PM DE …` = 497; câmaras (`CM DE …`) = 497; outros = 125; todas as 497 prefeituras têm pagamentos | **26.932.626 linhas**; E 6,62 mi, L 8,59 mi, P 11,72 mi | 2025 |
| **Soma** | **1.403 (25,2%)** | | | |

RS (2025, 1,35 GB zipado): identificação do credor — 14 dígitos em 54,5% das linhas (62,8% entre pagamentos a PJ); CPF de 11 dígitos em claro em 9,0%; número de contrato em 16,9%; licitação em 37,4%; histórico em 100%. Todo o arquivo chega com `mes_recebimento = 12` (remessa anual).

### 2.2 Reconciliação com o Siconfi (DCA, Anexo I-D, "Total Geral da Despesa")

| Caso | TCE | DCA | Resultado |
|---|---|---|---|
| **ES 2024, 78 municípios** (agregado, empenhada/liquidada/paga) | — | 78 consultas | **71 dentro de R$ 1**; 7 divergem: Vila Pavão 2,83% (R$ 1,80 mi), São Domingos do Norte 0,40%, Irupi 0,24%, Barra de São Francisco 0,11%, Domingos Martins 0,05%, Presidente Kennedy 0,011%, Vargem Alta 0,001%. Provável retificação posterior à remessa (não verificado). |
| ES 2024, Vitória (nível do movimento, 37 UGs) | emp 3.433.411.455,69; liq 3.108.383.039,25; pago 3.054.578.156,47 | emp 3.433,41; liq 3.108,38; pago 3.054,58 (R$ mi) | liquidada e paga idênticas; empenhada difere **R$ 6.228,40**. |
| ES 2024, Alto Rio Novo (4 UGs) | 49.496.680,91 / 49.004.390,55 / 48.622.589,05 | 49,50 / 49,00 / 48,62 | **idêntico ao centavo** somando as 5 partições. |
| SP 2024, Adamantina | liquidado 280,10; pago 276,96; empenhado 303,46 − anulação 12,51 = 290,95 | 290,96; 280,10; 276,96 | liquidado e pago idênticos; empenhado fecha em R$ 10 mil. |
| PE 2024, Abreu e Lima | 308,16 / 306,10 / 303,21 | 308,15 / 306,10 / 303,20 | dentro de R$ 10 mil. |
| RS 2025, **só a prefeitura**, empenhos de 2025 | Agudo pago 114,80; Alegrete 401,22; Canoas 1.884,99; Caxias do Sul 2.296,30; Porto Alegre 7.185,22 | 116,70; 414,62; 2.394,12; 3.364,46; 11.349,54 | **98,4%, 96,8%, 78,7%, 68,3%, 63,3%**. A diferença é de outros órgãos do município (câmara, autarquias, fundações). |

Conclusão: **o pagamento por credor é consistente com a contabilidade oficial** quando se somam todos os órgãos do município com a regra certa de cada TCE.

### 2.3 Regras de reconciliação (por TCE)

| TCE | Regra | Armadilha |
|---|---|---|
| ES | Somar **todas** as linhas das 5 partições de empenhos do ano, por unidades gestoras do município. As linhas são **deltas mensais** (há valores negativos). | Não deduplicar por número de empenho: 299.270 de 341.097 chaves têm mais de uma linha. |
| SP | Empenhado + Reforço − Anulação = empenhado líquido; Liquidado e Pago são eventos independentes. | A capital não está no TCE-SP. |
| PE | Colunas `VALOREMPENHADO/LIQUIDADO/PAGO` por empenho somadas por município. | Limite de 100.000 linhas por chamada: filtrar por UG/mês. |
| RS | Filtrar `ano_empenho = ano`; somar `vl_pagamento` de **todos os órgãos do município** (PM, CM e autarquias/fundações). | Pagamentos de empenhos de anos anteriores entram no arquivo: Agudo total 152,85 mi vs 114,80 mi do exercício. Autarquias e fundações só se ligam ao município pelo **nome** do órgão. |
| Todos | Verificar contra o DCA (Anexo I-D) do mesmo ente e exercício, com tolerância declarada. | O DCA sai com atraso e é declaratório. |

### 2.4 Executivos estaduais

| UF | Fonte | Credor | Empenho/liq/pago | Contrato | Observação | Evidência |
|---|---|---|---|---|---|---|
| **ES** | CKAN `dados.es.gov.br`: "Despesas – execução orçamentária e financeira" (76 recursos, 2004–2026; 1,2–1,5 GB/ano) | nome + CPF/CNPJ (CPF **mascarado** `###.785.245-##`) | `ValorEmpenho/Liquidado/Pago/Rap`, `DocumentoEmpenho` (NE), `Documento` (OB), `CodigoProcesso` | `TipoLicitacao`, histórico em 78,7% | CNPJ de 14 dígitos em 48,1% do prefixo lido | `VERIFIED_DATASET` |
| **MG** | CKAN `dados.mg.gov.br`: "Despesa por Empenho" (2022–2026; 63.293 linhas em 2025) | razão social; CNPJ/CPF formatado (14 dígitos em 97,8%) | só **empenhada** (sem pagamento neste dataset) | `contratoconvenio_saida`, processo, modalidade | atualizado em 2026-10-07 | `VERIFIED_DATASET` |
| **RS** | CKAN `dados.rs.gov.br`: "Despesa do Estado" (ZIP mensal; março/2026: 384.314 linhas) | `Cod_Credor`, `Favorecido`, `CNPJ` | `Empenho`, `Liquidacao`, `Pagamento` (números), `FaseGasto` | `Processo` | coluna CNPJ traz CPF formatado em 85% das linhas; folha com `000.000.000-00` | `VERIFIED_DATASET` |
| **PE** | TCE-PE `DespesasEstaduais!json` | `NOME_FORNECEDOR`, `CPF_CNPJ` | empenhado/liquidado/pago | `NUMERO_CONTRATO`, `ANO_CONTRATO` | limite de 100.000 linhas | `VERIFIED_API` |
| BA | CKAN `dados.ba.gov.br`: "Despesas" (ZIP 225 MB, `VW_PAINEL_DESPESA.csv`, 63 colunas, 2013+) | **sem credor** (painel agregado) | `VAL_LIQUIDADO_TOTAL`, `VAL_PAGO` | — | "Ordem cronológica de pagamentos" (319 MB) não aberta | `VERIFIED_DATASET` (agregado) |
| PB | CKAN `dados.pb.gov.br`: JSON "Notas de Empenho", "Liquidações" | — | — | — | recursos catalogados sem URL | `NOT_EVALUATED` |
| SC | CKAN `dados.sc.gov.br`: Despesas, Liquidações (`nunotaempenhooriginal`) | — | sim | — | datas de 2019–2022: defasado | `VERIFIED_DATASET` (desatualizado) |
| GO | CKAN `dadosabertos.go.gov.br`: despesas **por entidade** (Goiásgás, Metrobus, GoiásTelecom, CEASA) com fornecedor e CNPJ | sim | pagamento por entidade | processo/licitação | não é o Estado inteiro | `VERIFIED_DATASET` (parcial) |
| RO | CKAN: "Despesas" (JSON, 2023) | — | — | — | defasado | `DOCUMENTED_ONLY` |
| SP | CKAN `dadosabertos.sp.gov.br`: "Execução de Despesas Públicas" é **link**, não CSV | — | — | — | | `NOT_EVALUATED` |
| AC, AL, AM, AP, CE, DF, MA, MS, MT, PA, PI, PR, RJ, RN, RR, SE, TO | portal CKAN sem resposta, 404 ou sem dataset de despesa | — | — | — | nenhum portal de despesas localizado por esta varredura (não prova ausência) | `NOT_EVALUATED` |

### 2.5 TCEs ainda não testados

| UF | Resultado |
|---|---|
| CE | API nova `api-dados-abertos.tce.ce.gov.br/sim`: **105 recursos** (notas de empenho, liquidações, notas fiscais e itens, notas de pagamento, contratos, contratados, obras, OSCs, bens, folha). Municípios: 185, **184 com código IBGE**. **As tabelas retornaram 0 linhas** (195 consultas de `orgaos` em 5 exercícios e 39 municípios; `notas_empenhos` para Abaiara e Fortaleza em 2023–2026). `data_referencia_doc` (AAAAMM) é obrigatório. A API antiga está marcada como obsoleta. `VERIFIED_API` (serviço), dados `NOT_CONFIRMED`. |
| MG | `dadosabertos.tce.mg.gov.br` é SPA (Angular); a API não foi localizada (`/api/3` devolve 404). Imprensa e agregadores citam 853 municípios e 40,5 milhões de despesas no SICOM. `DOCUMENTED_ONLY`. |
| BA | A página "Dados abertos" do TCM-BA trata **da própria despesa do TCM**, não dos municípios. |
| PR, RJ, SC, MT, PI, RR, AL, TO, AP | sem resposta, 403 ou sem dataset de pagamentos. SC é painel Qlik (visual-only para emendas, segundo a fase anterior). |
| GO | CKAN do TCE-GO só tem indicadores (63 datasets). |
| AC, AM, MA, MS, PA, PB, RN, RO, SE | página institucional respondeu; nenhum dataset de pagamentos localizado. |

---

## 3. Escolas

### 3.1 PDDE nas 27 UFs

| Exercício | UFs com export Excel válido | Linhas | Escolas |
|---|---|---|---|
| **2023** | **27 de 27** | 247.863 | **126.402** |
| 2024 | 2 (ES, MS) | 7.726 | 3.821 |
| 2025 | 4 (AC, MS, SE, TO) | 12.348 | 5.371 |

2023: valor previsto total R$ 2.278,5 milhões; Inep com 8 dígitos em 100% e CNPJ da unidade executora em ≥ 99,9%; maiores UFs por escolas: SP 17.967, BA 12.386, MG 10.998, MA 9.250.

**Falha de servidor, dependente de UF e ano:** `ORA-01722 invalid number` (HTTP 500, 159 bytes). Não é limite de requisições: AC 2025 funciona e AC 2024 não. No AC 2024, o export **por município** funcionou em 12 de 22 municípios. A consulta **por escola** (GET) funciona mesmo onde o Excel falha (testada em duas escolas de Acrelândia, 2024). O filtro "Inadimplente" (`stEntidade[]=4`) **devolve 500 em todos os testes** (ES, SP, BA, MG), também na tela HTML.

**Consequência:** o relatório de prestação de contas exportado só lista o que o servidor consegue serializar. Os 100% "Adimplente" são **viés do filtro**. Para um indicador de inadimplência, é preciso a consulta por escola.

### 3.2 Vínculo com o Censo Escolar (Inep)

PDDE 2023 × microdados do Censo Escolar 2023 (217.625 escolas): **99,99% das 126.402 escolas casam** (16 sem correspondência), e a UF é **100% consistente**. Por dependência: municipal 96.213, estadual 28.260, privada 1.913.

Inversa: das 137.914 escolas públicas ativas do Censo, **89,4% têm linha no PDDE** (municipais 88,6%; estaduais 94,3%; federais 0%).

Observação: o Censo Escolar de 2025 devolveu 404 na URL usada pela P0; 2023 e 2024 estão no mesmo caminho. Os microdados **não trazem latitude/longitude**.

### 3.3 Previsto, devido, pago e saldo

Exportação em lote por município × relatório de prestação de contas, 2023:

| Município | Previsto (prestação) | Devido final | Pago | Pago / devido |
|---|---|---|---|---|
| Vitória/ES | 2.187.575 | 2.189.605 | 2.095.771 | 95,7% |
| Alto Rio Novo/ES | 122.930 | 125.570 | 122.930 | 97,9% |
| Curitiba/PR | 11.291.632 | 11.451.692 | 10.392.158 | 90,7% |
| Agudo/RS | 247.542 | 247.542 | 224.609 | 90,7% |
| São Paulo, Belo Horizonte, Recife, Belém, Rio Branco, Salvador | — | — | — | **export por município falha (HTTP 500)** |

**Definições operacionais:**

- **Previsto** (relatório de prestação de contas) ≈ **devido final**: diferença de até 2,2% (ARN) por escolas a mais na exportação em lote e ajustes.
- **Devido** = previsto + ajustes (`Vl Ajuste`); **pago** = soma das ordens de pagamento com data (`Data da Ordem de Pagamento`); em todos os casos testados, **todo valor pago tem data**.
- **Pago/devido** ficou entre 90,7% e 97,9%. A diferença são parcelas ainda sem ordem de pagamento.
- **Saldo** (tela "Consulta de Saldo") é **estoque**, em conta, por UEx × programa × mês. Não se reconcilia com repasses de um único ano porque as contas acumulam exercícios anteriores. **Nunca somar saldo e pago.**

---

## 4. Saúde

### 4.1 Estoque de medicamentos (BNAFAR/Hórus)

`GET /daf/estoque-medicamentos-bnafar-horus` — varredura completa do ES (78 municípios, 87 s, 53.999 linhas):

| Medida | Resultado |
|---|---|
| Municípios com estoque | **68 de 78** (87%). Sem estoque: Serra, Linhares, Baixo Guandu, Barra de São Francisco, Governador Lindenberg, Itapemirim, João Neiva, Marilândia, Pancas, Vila Valério. |
| Estabelecimentos (CNES) com estoque | **393** (mediana 3 por município) |
| Atualidade da última posição | ≤ 7 dias: **347 (88,3%)**; 8–30 dias: 5; 31–90: 1; 91–365: 34; > 365: 6. Posição mais comum: 2026-10-09 (343 CNES); **29 unidades de Vitória** em 2026-05-05 (159 dias). |
| Linhas com quantidade zero | 21,7% (Vitória 5,9%; Alto Rio Novo 0%) |
| Alto Rio Novo | 2 CNES com estoque de 19 cadastrados no CNES |

**Leitura:** a cobertura **depende de cada município enviar** ao BNAFAR; o dado é bom onde existe, e o buraco é estrutural (Serra, a segunda maior cidade, não aparece; Vitória está parada). **Não usar "estoque zero" ou "sem linha" como falta de medicamento.**

**Histórico:** a API retorna só o mês corrente: com `anomes_posicao_estoque` de 2026-09 para trás, **0 linhas** (testado de 2025-06 a 2026-09). O conjunto "BNAFAR – Posição de Estoque" no OpenDataSUS é descrito como CSV histórico, mas a página é JavaScript e **os recursos não foram enumerados** (`DOCUMENTED_ONLY`).

**CATMAT × PNCP:** os itens do PNCP têm campos `catalogo` e `catalogoCodigoItem`, mas em **50 pregões do ES (272 itens) nenhum item tinha código de catálogo** (0%; a amostra era majoritariamente de serviços e veículos). O elo PNCP↔estoque por CATMAT **não foi provado** (`UNLINKED` na amostra; precisa de amostra de medicamentos).

### 4.2 Fluxo de pacientes entre municípios

**O SIH do DEMAS não serve** (seção 1, correção 1). Usei os **arquivos RD do DATASUS**: `ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Dados/RDES2501.dbc` (ES, janeiro/2025: 2,0 MB; SP: 18,8 MB), decodificados com `pyreaddbc` (113 campos, incluindo `MUNIC_RES`, `MUNIC_MOV`, `CNES`, `VAL_TOT`, `PROC_REA`, `DT_INTER`, `DT_SAIDA`).

ES, jan–mar/2025: **77.995 AIH; R$ 135,2 milhões; 71 hospitais**.

| Medida | Resultado |
|---|---|
| Residência = município do hospital | **44,5%** |
| Residentes de outras UFs | 1,14% |
| Hospitais de Vitória: AIH de residentes de Vitória | **20,4%** (16.793 AIH) |
| Hospital Santa Rita (CNES 0011738), 3 meses | 2.095 AIH; R$ 4.698.475; pacientes de **82 municípios**; **11,9%** de Vitória |
| Maiores fluxos | Cariacica→Vitória 2.968; Vila Velha→Vitória 2.575; Serra→Vitória 1.993; Cariacica→Serra 1.585 |
| API do DEMAS para o mesmo hospital | 12 linhas/ano; R$ 166.274 (≈ 0,9% a 3,5% do real) |

Valor total da AIH (`VAL_TOT`) é **valor aprovado**, não repasse. O campo `CNPJ_MANT` veio **vazio** para o Santa Rita; o CNPJ do estabelecimento vem do CNES. `N_AIH`, nascimento e sexo são dados individuais: **usar só agregados**.

---

## 5. Território e atendimento

### 5.1 Setor censitário

| Teste | Resultado |
|---|---|
| Coordenadas de estabelecimentos do ES (estoque, 391 com lat/lon) → polígono do setor | **391/391** caem em um setor, nenhum em dois |
| Município do setor = município do cadastro CNES | **391/391 (100%)** |
| Soma `v0001` dos 680 setores de Vitória | **322.869** (população do Censo 2022) |
| Alto Rio Novo | 17 setores; população 7.434 |
| Serra | 1.013 setores; população 520.653 |
| Renda do responsável: setores sem renda ou suprimidos (`X`) | Vitória: 642 de 680 setores com renda, 0,6% suprimidos; Serra: 999 de 1.013, 1,3%; ARN: 17/17, 0% |

A malha por UF (GPKG, 25 MB no ES) + agregados (15 MB) + renda (9 MB) é suficiente para **PostGIS** e para a ligação de qualquer equipamento com coordenada válida. Escolas não têm coordenada no Censo Escolar.

### 5.2 Fala.BR (2025 completo)

1.563.634 manifestações. Esferas: Federal 1.286.183 (82,3%); **Municipal 137.023 (8,8%)**; Estadual 89.182; Judiciário Federal 38.655; conselhos 12.591.

| Medida (esfera municipal) | Resultado |
|---|---|
| Órgãos municipais | **2.230** (prefeituras 1.323; câmaras 664; secretarias 109; ouvidorias/controladorias 11; outros 123) |
| Municípios do Brasil com algum órgão municipal | **1.650 de 5.570 (29,6%)**; concentrados em RS (283), SC (263), SP (122), MG (122) |
| ES | **38 de 78**; Vitória, Serra, Vila Velha, Cariacica e Alto Rio Novo **não aparecem**; maiores: São Mateus 1.979, Colatina 1.098 |
| Com data de resposta | 116.659 (85,1%) |
| Com atraso | 20.363 (14,9%) |
| Satisfação preenchida | 3.622 (2,6%) |
| Município da manifestação informado | 93.066 (67,9%) |
| Tipos | Reclamação 43.850; Solicitação 38.603; Comunicação 38.099; Denúncia 11.791; Elogio 2.433; Sugestão 2.247 |

Distribuição mensal estável (111 mil a 170 mil por mês).

### 5.3 156 municipal

| Cidade | Cobertura | Resultado |
|---|---|---|
| São Paulo | trimestral, 2012 → 3º tri/2026 (atualizado em 2026-10-09); CSV de 85 a 225 MB por trimestre | colunas: data de abertura, bairro, distrito, órgão, canal, assunto, status, data do parecer |
| Recife | 2012 → 2026; 2025: **86.966 linhas** | datas válidas 100%; mediana até a última situação **2 dias** (p90 106); **95,6%** dos registros têm bairro que casa com o nome de bairro do Censo; traz latitude |
| Belo Horizonte | CSV por ano/mês, 2020 → **jul/2023** | **dataset defasado** (último recurso de 2023) |

---

## 6. Regras de identidade territorial (consistentes e medidas)

| ID | Regra | Medição | Classe |
|---|---|---|---|
| RULE-01 | CNPJ do ente → Siconfi `/entes` → IBGE 7 | PE 184/184 prefeituras | `EXACT` |
| RULE-02 | IBGE de 6 dígitos (CNES, SIOPE, PDDE, SIH) ↔ 7 dígitos (PNCP, Siconfi) por regra de dígito | usado em ES, SP, PR | `EXACT` |
| RULE-03 | Nome normalizado (maiúsculas, sem acento, espaços colapsados) **+ UF** → ente municipal do Siconfi | Fala.BR: 2.222 de 2.230 órgãos (99,6%), nenhuma ambiguidade dentro da UF; TCE-ES: 78/78 | `HIGH_CONFIDENCE` |
| RULE-04 | Casos que falham na RULE-03 exigem **tabela de apelidos** | 8 órgãos sem casamento (ex.: variações de "Santana do Livramento", "Trajano de Morais", "Januário Cicco", "Eldorado dos Carajás", "Seridó") | `PROBABLE` até resolvido |
| RULE-05 | Unidade gestora → município | ES: coluna `EsferaAdministrativa` do agregado; RS: nome `PM DE …` (prefeitura) e nomes de autarquias com município embutido; SP: slug do município | `HIGH_CONFIDENCE` (ES, SP); `PROBABLE` (autarquias do RS) |
| RULE-06 | Nome de bairro normalizado → bairro do Censo (`NM_BAIRRO`) dentro do município | Recife 95,6% das linhas | `HIGH_CONFIDENCE`, nunca `EXACT` |
| RULE-07 | Coordenada → setor (ponto em polígono) e conferência do município do setor | 391/391 | `EXACT` (geométrico) |
| RULE-08 | Inep de 8 dígitos | PDDE × Censo 99,99% | `EXACT` |

**Regra geral:** sempre incluir a UF na chave de nome; nunca ligar por nome sem conferir que o município é único na UF; registrar a regra usada em cada vínculo.

---

## 7. Contratos de dados (o que está pronto para virar contrato)

| Dado | Estado | Condição |
|---|---|---|
| Pagamento municipal, TCE-ES | `READY_FOR_CONTRACT` | regra de soma de movimentos; conferência com DCA |
| Pagamento municipal, TCE-SP | `READY_FOR_CONTRACT` | regra de empenhado líquido; capital à parte |
| Pagamento municipal, TCE-PE | `READY_FOR_CONTRACT` | paginar por UG/mês (limite de 100 mil) |
| Pagamento municipal, TCE-RS | `NEEDS_VALIDATION` | somar todos os órgãos do município; tabela de nomes de autarquias; CPF em claro |
| Despesa estadual ES, MG (empenho), RS, PE | `NEEDS_VALIDATION` | volume (1,4 GB/ano no ES); CPF |
| PDDE por escola (consulta individual) | `READY_FOR_CONTRACT` | estratégia por escola, pois o lote falha em 2024/2025 |
| PDDE em lote 2023 | `READY_FOR_CONTRACT` | histórico completo; não usar para inadimplência |
| PDDE × Censo Escolar | `READY_FOR_CONTRACT` | 99,99% |
| Estoque de medicamentos | `NEEDS_VALIDATION` | cobertura depende do município; sem histórico |
| SIH por RD (DATASUS) | `NEEDS_VALIDATION` | decodificação `.dbc`; agregados apenas |
| SIH via DEMAS | `NOT_FEASIBLE` | cobre ≈ 1% da produção |
| Setores + CNES (ponto em polígono) | `READY_FOR_CONTRACT` | PostGIS |
| Fala.BR | `READY_FOR_CONTRACT` | cobertura de 29,6% dos municípios; município por regra RULE-03 |
| 156 SP e Recife | `NEEDS_VALIDATION` | esquemas diferentes por cidade |
| 156 Belo Horizonte | `BLOCKED` | defasado em 2023 |
| TCE-CE | `DISCOVERY_ONLY` | tabelas vazias |

---

## 8. Lacunas e riscos

1. **Cobertura de pagamento municipal em 25,2%**; 23 UFs sem TCE com dados provados. MG (853 municípios) é a maior oportunidade e está atrás de uma SPA.
2. **PDDE 2024 e 2025** não saem em lote; a coleta atual teria de ser por escola (~126 mil consultas por exercício, `INFERRED`).
3. **Inadimplência do PDDE** só pode ser observada escola a escola.
4. **Estoque**: sem histórico na API; cobertura irregular (Vitória parada, Serra ausente).
5. **CPF em claro** no TCE-RS, TCE-PE e PNCP (pessoa física); mascarado no TCE-ES e no estado do ES; parcial no TCE-SP.
6. **Município sem IBGE** em SP, ES (nome), RS e Fala.BR: depende de RULE-03.
7. **PNCP × estoque por CATMAT** não provado.
8. **DCA do Siconfi** é declaratório e tem atraso: divergências de até 2,83% (Vila Pavão) não foram explicadas.
9. **Execuções estaduais**: 17 UFs sem portal de despesa localizado por esta varredura.
10. **SIH por RD** foi testado só no ES (3 meses).

---

## 9. Gates

| Gate | Estado | Evidência |
|---|---|---|
| `P4_PAYMENT_COVERAGE` | **PASS_WITH_CAVEATS** | 1.403 municípios (25,2%) com contagem real; CE sem dados |
| `P4_PAYMENT_RECONCILIATION` | **PASS_WITH_CAVEATS** | ES 71/78 ≤ R$ 1; SP e PE exatos; RS só com soma de órgãos |
| `P4_STATE_EXECUTIVE_DISCOVERY` | **PARTIAL** | ES, MG, RS e PE verificados; BA agregado; 17 UFs sem portal |
| `P4_OTHER_TCE_DISCOVERY` | **PARTIAL** | CE com catálogo e sem dados; MG em SPA; demais sem dataset |
| `P4_SCHOOL_PDDE_NATIONAL` | **PARTIAL** | 27 UFs só em 2023; falha em 2024/2025; inadimplência bloqueada |
| `P4_SCHOOL_CENSUS_LINK` | **PASS** | 99,99%; UF 100% |
| `P4_SCHOOL_AMOUNT_SEMANTICS` | **PASS_WITH_CAVEATS** | previsto ≈ devido; pago 90,7–97,9%; saldo é estoque |
| `P4_HEALTH_STOCK_COVERAGE` | **PARTIAL** | ES: 87% dos municípios, 88% atualizados |
| `P4_HEALTH_STOCK_HISTORY` | **PARTIAL** | API só mês corrente; dataset histórico não enumerado |
| `P4_PATIENT_FLOW` | **PASS_WITH_CAVEATS** | RD decodificado (ES, 3 meses); API do DEMAS inadequada |
| `P4_SUBMUNICIPAL_VALIDATION` | **PASS** | 391/391; população de Vitória fecha |
| `P4_COMPLAINTS_COVERAGE` | **PASS_WITH_CAVEATS** | Fala.BR 29,6% dos municípios; SP e Recife atualizados; BH defasado |
| `P4_TERRITORIAL_IDENTITY_RULES` | **PASS_WITH_CAVEATS** | 8 regras medidas; apelidos pendentes |
| `P4_PRODUCT_READINESS` | **PARTIAL** | seção 7 |

---

## 10. Próximos experimentos

1. **TCE-MG**: localizar a API por trás da SPA (rede do navegador) e testar um município.
2. **TCE-CE**: confirmar parâmetros (`data_referencia_doc`) e se há exercício com dados.
3. **PDDE por escola**: medir custo de varrer 126 mil escolas (ou só as que falham) e a taxa de inadimplentes.
4. **SIH por RD**: rodar para 3 UFs grandes e para 12 meses; validar `VAL_TOT` contra um total oficial.
5. **BNAFAR**: enumerar os recursos históricos do OpenDataSUS.
6. **Tabela de apelidos** de municípios (8 casos) e de autarquias do RS.
7. **PNCP × CATMAT**: amostra de pregões de medicamentos e medição de `catalogoCodigoItem`.
8. **Segunda reconciliação** (2023) para medir estabilidade das divergências do ES.
9. **Escolas geocodificadas**: obter coordenadas por Inep e medir o setor de cada uma.
10. **Varredura de portais estaduais** nas 17 UFs sem portal (por navegador, não só por CKAN).

---

## 11. Inventário de testes

| ID | Teste | Resultado |
|---|---|---|
| TST-RS-FULL | stream de `empenhos/2025.csv.zip` (1,35 GB) | 26.932.626 linhas; 497 PM; 497 CM; 125 outros |
| TST-RS-TGT | 5 PMs por `ano_empenho` | 98,4% a 63,3% do DCA |
| TST-ES-DCA | 78 municípios × DCA 2024 | 71 dentro de R$ 1; 7 divergentes |
| TST-ES-MOV | 5 partições × UGs de Alto Rio Novo e Vitória | ARN idêntico ao centavo; Vitória L/P idênticas |
| TST-SP-DCA | Adamantina 2024 (12 meses) | L e P idênticos; E líquido ≈ |
| TST-PE-DCA | Abreu e Lima 2024 | dentro de R$ 10 mil |
| TST-ESTADO-ES/MG/RS/BA | cabeçalhos e amostras | seção 2.4 |
| TST-CE-API | 105 recursos; 195 consultas de órgãos; empenhos | 0 linhas |
| TST-PDDE-27 | Excel por UF em 2023, 2024, 2025 | 27, 2 e 4 UFs |
| TST-PDDE-FALLBACK | município (AC 2024) e escola | 12/22 e 2/2 |
| TST-PDDE-INAD | `stEntidade[]=4` em 4 UFs e HTML | HTTP 500 / sem cartões |
| TST-PDDE-CENSO | PDDE 2023 × Censo 2023 | 99,99% |
| TST-PDDE-TRI | 4 municípios, 2023 | previsto/devido/pago |
| TST-EST-ES | 78 municípios, 53.999 linhas | 68/78; 393 CNES; 88,3% ≤ 7 dias |
| TST-EST-HIST | `anomes_posicao_estoque` 2025-06…2026-09 | 0 linhas |
| TST-SIH-API | filtros diversos | ~1 linha por hospital-mês |
| TST-SIH-RD | RDES2501–2503 | 77.995 AIH; fluxos |
| TST-GEO | 391 CNES × setores | 391/391 |
| TST-CENSO-POP | setores de Vitória | 322.869 |
| TST-FALA-25 | CSV 2025 completo (366 MB descompactado) | 2.230 órgãos; 1.650 municípios |
| TST-156-REC | Recife 2025 | 86.966 linhas; bairro 95,6% |
| TST-156-SP-BH | listas de recursos | SP até 3º tri/2026; BH até 2023-07 |
| TST-PNCP-CAT | 50 pregões ES, 272 itens | 0% com catálogo |

Limites respeitados: leituras parciais por `Range` quando o arquivo é grande, sem autenticação, sem contornar controles, sem armazenar dado pessoal no repositório. CPF e conta bancária vistos nos testes **não** foram reproduzidos.
