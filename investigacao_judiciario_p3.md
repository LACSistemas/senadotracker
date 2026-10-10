# Investigação Judiciário P3 — pagamentos, reconciliação JN × DataJud e continuidade do TJSP

**Escopo:** investigação somente, fechamento da P3 enxuta prevista na Parte 19 de `investigacao_judiciario_p2.md` (P1 e P2 não alteradas). Nenhum código, banco, collector, migration ou configuração foi alterado. As consultas foram pequenas e não destrutivas: leitura de páginas, metadados CKAN, **faixas de bytes** de CSVs grandes (nenhum arquivo de 1 GB foi baixado inteiro) e 54 contagens `_count` no DataJud, em sequência, abaixo de 120 requisições/min. Artefatos ficaram fora do repositório. **Este arquivo é a única entrega.**
**Data:** 08–09/10/2026. **Anonimização:** nomes de pessoas físicas, CPFs e favorecidos pessoa física não são reproduzidos.
**Estados:** EXISTE · PUBLICADO · ACESSÍVEL · ESTRUTURADO · COLETÁVEL · RELACIONÁVEL · GENERALIZÁVEL · HISTÓRICO (— = não demonstrado).

---

# 1. Resumo executivo

| Pergunta da P2 (Parte 19) | Resultado P3 |
|---|---|
| 1. Existe `credor + valor pago + data + empenho` por tribunal? | **Sim para o TJES** (e para a Justiça estadual do ES): o dado aberto SIGEFES do Governo do ES traz favorecido, CPF/CNPJ, valor empenhado/liquidado/pago, documento e histórico, **inclusive para o Tribunal de Justiça (UG 30101) e o Fundo Especial do Poder Judiciário (UG 30901)**, 2004–2026, licença CC-BY. **Não** para o Judiciário federal: o Portal da Transparência (CGU) **exclui** o Judiciário até nos arquivos diários de empenho e pagamento com favorecido. TJSP: só diárias nominais em XLS; execução não localizada como arquivo |
| 2. A reconciliação JN × DataJud gera uma regra de uso? | **Sim, a regra é "não reconciliar": usar o JN para contagens oficiais.** Em 54 comparações (5 tribunais × 3 anos × graus), a razão DataJud/JN tem mediana 0,88 e vai de 0,02 a 1,69; só a Turma Recursal é estável (mediana 1,00). Há buracos de remessa no DataJud (TRT3 2023: 13%) e superavaliação (TJMG 1º grau: 1,6×) |
| 3. A série de produtividade do TJSP está viva? | **Não, pelo que a página publica**: a lista termina em **10/2022** (77 PDFs: 2017–2022). Arquivos de 2023–2026 por padrão de URL retornam 404. A série **tem dados reais** (09/2022 e 10/2022 com linhas não nulas); a suspeita de zeros levantada na P2 **não se confirma** |
| 4. Contato institucional | Lista de pedidos concretos na Parte 6 (nada foi enviado) |

**Efeito na matriz da P2:** "Pagamentos dos tribunais" passa de **SEM AVANÇO** para **AVANÇO PARCIAL** (comprovado no TJES; negativo no federal; SP/MG sem arquivo). "Produtividade individual" permanece **AVANÇO PARCIAL**, agora com a informação de que a série do TJSP está **encerrada em 10/2022**.

---

# 2. Pagamentos: quanto cada tribunal pagou, a quem, quando, por qual objeto

## 2.1 Judiciário federal — Portal da Transparência (CGU): **negativo**

| Teste | Resultado |
|---|---|
| `despesas-execucao/202609` (P2) | 35 órgãos superiores; nenhum do Judiciário |
| `download-de-dados/despesas/20260930` (pacote diário, 10,3 MB): `Despesas_Empenho` (12.443 linhas, 63 colunas), `Despesas_Pagamento` (30.977 linhas, 34 colunas, com `Código Favorecido`/`Favorecido`), `Despesas_Pagamento_FavorecidosFinais`, `ItemEmpenho`, `Liquidacao` etc. | **Mesmos 35 órgãos superiores** (Presidência, ministérios, AGU, CGU, Banco Central…); **nenhum tribunal**. Aparece "Ministério da Justiça e Segurança Pública" (3.206 pagamentos), que **não** é o Judiciário |
| `despesas-favorecidos/202609` | existe (24 MB); **não inspecionado**, mas o teste diário já mostra o mesmo recorte de órgãos |

**Leitura:** o Portal da Transparência federal cobre o Executivo. O Judiciário federal teria de vir do SIAFI/Siga Brasil/Tesouro Gerencial (Qlik, não testados) ou dos portais dos próprios tribunais. Pistas localizadas (sem dado de favorecido comprovado): CSJT/TST (consulta de contratos exportável CSV/Excel/XML; execução orçamentária de TIC em CSV), TRF2 (gestão orçamentária mensal em PDF, CSV e ODS conforme anexo I da Res. CNJ 102/2009 — agregado, não por favorecido).

## 2.2 Espírito Santo / TJES — **comprovado**

**Fonte:** `https://dados.es.gov.br/dataset/portal-da-transparencia-despesas-execucao-orcamentaria-e-financeira` (CKAN; "extraída do SIGEFES"; **licença CC-BY**; modificado em 08/10/2026). O portal `transparencia.es.gov.br/Despesa` lista como unidades "**TRIBUNAL DE JUSTIÇA DO ESTADO DO ESPÍRITO SANTO (30101)**" e "**FUNDO ESPECIAL DO PODER JUDICIÁRIO** (30901)".

| Item | Observado |
|---|---|
| Recursos | `Despesas-AAAA.csv` anual de **2004 a 2026** (2009: 575 MB; 2021: 1,1 GB; 2025: 1,5 GB; 2026: 1,16 GB; 2024 também em semestres); `RestosAPagar-AAAA.csv` (2008–2024); `OrcamentosDespesa-AAAA.csv` (2014–2026); `OrcamentosExecucoes-AAAA.csv` (2009–2026); dicionário PDF |
| Estrutura (2026) | CSV `;`, 71 colunas. Valores: `ValorEmpenho`, `ValorLiquidado`, `ValorPago`, `ValorRap`. Favorecido: `CpfCnpjNis`, `TipoFavorecido`, `Favorecido`, `IdFavorecido`. Documento: `Documento`, `DocumentoEmpenho`, `HistoricoDocumento`, `CodigoProcesso`, `Processo`. Classificação: `CodigoUnidadeGestora`/`UnidadeGestora`, `CodigoOrgao`, função/subfunção/programa/ação, grupo e elemento de despesa, fonte, `TipoLicitacao`, `NumeroLicitacao`, `AnoLicitacao`, `Contrato`, `Emenda`, `DescricaoEsfera` |
| Leitura feita | **duas faixas de bytes** do arquivo de 2026 (12 MB iniciais e 8 MB a partir do byte 600.000.000): 11.369 e 7.390 linhas |
| Linhas do Judiciário (UG 30101 e 30901) | **410** na primeira faixa e **283** na segunda; datas de 01/03/2026 a 31/08/2026 nas faixas (o arquivo **não** está ordenado por data) |
| Fases | empenhado, liquidado e pago em colunas separadas na mesma linha |
| Favorecido | `CpfCnpjNis` completo com 14 dígitos para pessoa jurídica (**49%** das linhas: 201/410 e 126/283); pessoa física **mascarada** (`###.xxx.xxx-##`); alguns favorecidos são códigos de unidade (`030101`) |
| `TipoFavorecido` | valores 1, 2 e 3; o código 2 coincide com as linhas de CNPJ (201 = 201) — **inferido** como PJ; 1 e 3 não decodificados (dicionário não lido) |
| Objeto | `HistoricoDocumento` preenchido em 78–90% das linhas (ex.: "locação do imóvel onde funciona o arquivo do fórum…", "folha … mês de agosto") + elemento de despesa; `Processo` vazio nas linhas lidas; `Contrato` e `NumeroLicitacao` preenchidos em todas as linhas, mas o **conteúdo** não foi conferido (podem ser "0") |

**Os valores somados nas faixas não são totais do tribunal**: foram fatias de arquivo; nenhum total foi publicado aqui.

**Estados:** EXISTE, PUBLICADO, ACESSÍVEL, ESTRUTURADO, COLETÁVEL (arquivos anuais; atenção a 1,5 GB por ano), RELACIONÁVEL (CNPJ de 14 dígitos; `Contrato`/`NumeroLicitacao` a verificar), HISTÓRICO (2004→2026). **GENERALIZÁVEL: não** — padrão específico do Governo do ES; outros estados precisam de teste próprio.

**Respondendo à pergunta central para o TJES:** *quanto* (valores por fase), *a quem* (CNPJ/razão social; PF mascarada), *quando* (data) e *por qual objeto* (histórico + elemento) são recuperáveis. Falta apenas verificar o dicionário e a consistência do campo de contrato.

## 2.3 São Paulo / TJSP

| Teste | Resultado |
|---|---|
| `dadosabertos.sp.gov.br/dataset/execucao-de-despesas-publicas` | licença CC-BY-4.0, mas o único recurso é um **link** para a consulta dinâmica `transparencia.sp.gov.br/Home/DespContratosPg`; sem arquivo CSV |
| `transparencia.sp.gov.br/Home/DespContratosPg` | página dinâmica (21 KB); sem link de arquivo; menção ao SIGEO/Fazenda |
| Portal do TJSP — Execução Orçamentária e Financeira | página institucional; **dados do SIAFEM/SP** (texto da P2); sem arquivo estruturado localizado |
| Portal do TJSP — **Diárias** | **XLS/XLSX mensal por padrão `MMMAA_SOF-divulgacao-no-portal.xls[x]`** (2023–2026 observados); `ABR26` (17 KB) lido: aba "Passagens Aéreas", linhas nominais (nome, cargo, evento, valor, trecho, datas) — **nomes não reproduzidos** |

**Conclusão SP:** pagamento por favorecido do TJSP **não** foi encontrado como arquivo. Diárias e passagens **são** publicadas mensalmente, em XLS, com nome do beneficiário. Estado: EXISTE e PUBLICADO (diárias); COLETÁVEL (XLS); execução por credor — **NÃO COMPROVADO** (pode estar atrás da consulta dinâmica).

## 2.4 Outros

- **MG, SC, STJ (execução):** não testados nesta rodada (MG e SC têm relatórios dinâmicos/Excel, P2).
- **STJ:** sanções com CPF/CNPJ (532 linhas), diárias e passagens — sem execução por credor.

## 2.5 Classificação

**Pagamentos dos tribunais: AVANÇO PARCIAL.** Comprovado no TJES (e, por extensão do mesmo sistema, em qualquer órgão do Governo do ES). Judiciário federal: **não encontrado** nas fontes abertas da CGU; precisa de teste SIAFI/Siga Brasil ou de dados dos próprios tribunais. SP: diárias apenas.

---

# 3. Reconciliação JN × DataJud (5 tribunais, 3 anos)

**Método:** `_count` no DataJud por `grau` e ano de `dataAjuizamento` (2023, 2024, 2025) para TJES, TJMG, TJRJ, TRT3, TRF1 (54 contagens, tentativas de repetição apenas por falha de rede) × variáveis `Cn1`, `Cn2`, `CnJE`, `CnTR` da base JN (P03 da P2). Os totais do DataJud são *documentos ajuizados no ano*, sem filtro de sigilo ou duplicidade. A definição de "casos novos" do CNJ **não foi conferida** (pode incluir execução e remetidos). Razão = DataJud/JN.

| Tribunal | Ano | 1º grau (G1/Cn1) | 2º grau (G2/Cn2) | JE (JE/CnJE) | Turma Recursal (TR/CnTR) |
|---|---|---:|---:|---:|---:|
| TJES | 2023 | 0,77 | 0,91 | 0,97 | 1,00 |
| TJES | 2024 | 0,67 | 0,91 | 0,86 | 1,00 |
| TJES | 2025 | 0,60 | 0,90 | 0,84 | 1,01 |
| TJMG | 2023 | **1,59** | 0,89 | 1,05 | 1,02 |
| TJMG | 2024 | **1,60** | 0,84 | 1,01 | 1,01 |
| TJMG | 2025 | **1,69** | 0,84 | 1,14 | 1,09 |
| TJRJ | 2023 | 0,79 | **0,17** | 0,97 | **0,02** |
| TJRJ | 2024 | 0,66 | 0,78 | **0,46** | 0,67 |
| TJRJ | 2025 | 0,79 | 0,89 | 0,87 | 1,00 |
| TRT3 | 2023 | **0,13** | **0,06** | — | — |
| TRT3 | 2024 | 0,25 | 0,18 | — | — |
| TRT3 | 2025 | 0,59 | 0,85 | — | — |
| TRF1 | 2023 | 0,95 | 0,75 | **0,50** | 0,98 |
| TRF1 | 2024 | 0,99 | 0,97 | 0,73 | 0,93 |
| TRF1 | 2025 | 0,96 | 1,04 | 0,74 | 0,84 |

**Agregado (n = 54):** mediana 0,88. Por grau: **TR** n=12, mín. 0,02, mediana **1,00**, máx. 1,09; **G2** n=15, mín. 0,06, mediana 0,85, máx. 1,04; **JE** n=12, mín. 0,46, mediana 0,86, máx. 1,14; **G1** n=15, mín. 0,13, mediana 0,79, máx. 1,69.

**Leitura:**
1. **Não existe fator de conversão estável.** Os desvios têm três origens distintas: (a) **lacuna de remessa** no DataJud (TRT3 2023–2024; TJRJ 2023 em G2/TR; TJRJ 2024 em JE), com melhora em 2025 (TRT3 1º grau 0,13→0,25→0,59); (b) **definições diferentes** (TJMG 1º grau 1,6×: o DataJud contém mais ajuizamentos do que os "casos novos" oficiais; no TJES e TRF1 o sentido é inverso); (c) **JE na Justiça Federal** (TRF1 0,50–0,74) provavelmente por competência/alocação de grau.
2. A **Turma Recursal** é o único grau estável (≈1,0 em 10 de 12 comparações; as exceções são TJRJ 2023–2024).
3. A diferença **entre anos** de um mesmo tribunal indica que o DataJud melhora com o tempo (consistente com a Portaria CNJ 374/2026, envio diário).

**Regra de uso proposta (ainda sem parecer jurídico):**
- **Contagens e KPIs oficiais:** JN (base CSV). Sem substituir por DataJud.
- **DataJud:** estrutura (unidades, classes, assuntos), linha do tempo, **qualidade** (razão DataJud/JN **por tribunal e por ano** como indicador de cobertura da remessa), nunca como "casos novos" oficiais.
- Qualquer razão deve vir com ano e tribunal; não generalizar.

**Limites:** 5 tribunais; 3 anos; **não** foram separados execução/conhecimento; `dataAjuizamento` inválida (sentinelas) não foi tratada; a regra de ajuizamento do DataJud ≠ "caso novo" do CNJ.

---

# 4. TJSP — continuidade da série de produtividade

| Verificação | Resultado |
|---|---|
| Lista oficial `produtividadeweb` | 77 PDFs `PrudSegundaInstancia/AAAA/ProdSegundaInst<Mês><Ano>.pdf`: 2017 (12), 2018 (12), 2019 (12), 2020 (11), 2021 (12), 2022 (10: **de janeiro a outubro**) |
| Padrões 2023–2026 (`Janeiro`, `Marco`, `Dezembro` × 4 anos) | **404** |
| Conteúdo 2022 | `Marco2022` (74 páginas) e `Outubro2022` (200 páginas) com **1.201 e 1.122 linhas** magistrado×órgão com algum valor > 0; `Setembro2022` (75 páginas): 102 linhas > 0 nas páginas lidas por padrão de linha. **A suspeita de zeros da P2 vinha de uma primeira página isolada** (a página mostrava valores 0 para desembargadores sem produção naquela seção) |
| Estado | **EXISTE, PUBLICADO, ACESSÍVEL, HISTÓRICO (2017-01 → 2022-10); ENCERRADO na página** (não foi verificada nota oficial de descontinuidade) |

**Classe:** produtividade individual do TJSP = **HISTÓRICA, sem continuidade comprovada**. O parser por regex usado aqui para contar linhas **não** é uma extração validada; os PDFs têm layouts distintos entre meses (66, 74, 75, 108 e 200 páginas).

---

# 5. Respostas objetivas

1. **Pagamentos:** o TJES é o primeiro caso comprovado de `credor + valores por fase + data + histórico` aberto e histórico (2004→2026). Aplicável a qualquer tribunal que use o SIGEFES; depende de dado estadual.
2. **Regra JN × DataJud:** JN para KPI; DataJud para estrutura e qualidade; razão por tribunal/ano como métrica de cobertura da remessa.
3. **TJSP:** série de produtividade encerrada em 10/2022 na página oficial.

---

# 6. Pedidos institucionais (rascunho de conteúdo; nada enviado)

**CNJ (DPJ / MPM):**
1. Extrato público do MPM de magistrados **sem CPF** (nome, cargo, situação, lotação por código de unidade, datas de início e fim).
2. Cadastro de **serventias com código** (a lista, não só as tabelas auxiliares).
3. Esclarecer 3.8 e 3.9 do Termo DataJud para estatísticas agregadas e para a **forma de ciência** ao CNJ.
4. Aumento de cota (120 req/min) ou acordo de cooperação técnica.
5. Painel "Grandes Litigantes" e "Dados de Pessoal" em CSV.

**STF:** extrato do Portal de Sessões de Julgamento e CSV do Painel de Decisões (Corte Aberta).

**TJSP:** informar se a série de produtividade foi descontinuada e onde está a execução por credor (SIAFEM/SP).

**Governo do ES / TJES:** confirmação do dicionário (`TipoFavorecido`, `Contrato`, `NumeroLicitacao`) e da cobertura do TJES (UG 30101/30901).

---

# 7. Evidências reproduzíveis

| ID | Evidência |
|---|---|
| **R01** | `GET https://portaldatransparencia.gov.br/download-de-dados/despesas/20260930` → 302 → `dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/20260930_Despesas.zip` (10.264.985 B; 11 CSVs). `…/despesas/20260929` (9.590.653 B). Análise: `Despesas_Pagamento.csv` 30.977 linhas, `Despesas_Empenho.csv` 12.443 linhas; 35 e 32 órgãos superiores, nenhum do Judiciário |
| **R02** | `GET https://portaldatransparencia.gov.br/download-de-dados/despesas` (descrição dos arquivos); `…/despesas-favorecidos/202609` (HEAD 200, 24.174.784 B) |
| **R03** | `GET https://transparencia.es.gov.br/Despesa` (5.366 `<option>`; UG 30101 e 30901 do Judiciário); `…/DadosAbertos/BaseDeDados` (200) |
| **R04** | `GET https://dados.es.gov.br/api/3/action/package_show?id=portal-da-transparencia-despesas-execucao-orcamentaria-e-financeira` (licença `cc-by`; recursos 2004–2026) |
| **R05** | `GET …/despesas-2026.csv` com `Range: bytes=0-12000000` e `600000000-608000000` e redirecionamento `-L` para o armazenamento S3 assinado (302 → `one.s3.es.gov.br/pr-ckan-store/…`): 71 colunas, 11.369 + 7.390 linhas lidas |
| **R06** | `GET https://dadosabertos.sp.gov.br/api/3/action/package_show?id=execucao-de-despesas-publicas` (CC-BY-4.0; 1 recurso, tipo LINK); `GET https://www.transparencia.sp.gov.br/Home/DespContratosPg` |
| **R07** | `GET https://www.tjsp.jus.br/CanaisComunicacao/Transparencia/ContasPublicas_ExecucaoOrcamentariaFinanceira_Default` (200, página sem arquivo de execução) e `…/Download/Portal/CanaisComunicacao/Transparencia/Diarias/ABR26_SOF-divulgacao-no-portal.xlsx` (17.382 B) |
| **R08** | DataJud `POST …/api_publica_{tjes,tjmg,tjrj,trt3,trf1}/_count` com filtro `grau.keyword` + `range dataAjuizamento` (2023/2024/2025); 54 contagens, execução sequencial com pausa de 1 s; resultado: Parte 3 |
| **R09** | CNJ `17-set-2026.zip` (P03 da P2): variáveis `cn1`, `cn2`, `cnje`, `cntr` |
| **R10** | `GET http://www.tjsp.jus.br/produtividadeweb/` (77 links) e PDFs `…/PrudSegundaInstancia/{2017/ProdSegundaInstAbril2017, 2022/ProdSegundaInstJaneiro2022, …Marco2022, …Setembro2022, …Outubro2022}.pdf`; HEAD de `…/2023–2026/ProdSegundaInst{Janeiro,Marco,Dezembro}AAAA.pdf` → 404 |
| **R11** | Busca web: CSJT/TST (`csjt.jus.br/web/csjt/dados-abertos`), TRF2 (gestão orçamentária CSV/ODS) — **apenas leitura de resultado de busca** |

---

# 8. Lacunas remanescentes (após a P3)

| Lacuna | Natureza |
|---|---|
| Execução por favorecido do Judiciário **federal** (STJ, TRFs, TRTs, TST, TSE, STF) | **não encontrado** em fonte aberta da CGU; SIAFI/Siga/SIOP não testados |
| Execução por credor de TJSP, TJMG, TJRJ, TJBA | não encontrada (SP: link dinâmico) |
| Dicionário do SIGEFES (`TipoFavorecido`, `Contrato`, `NumeroLicitacao`) | não lido |
| Totais anuais do TJES a partir do CSV | não calculados (arquivos de 1,1–1,5 GB; só faixas) |
| Regra JN × DataJud por execução vs conhecimento | não separada |
| Série TJSP pós-10/2022 | encerrada na página; sem nota oficial |
| Pedidos ao CNJ/STF/TJSP | dependem de ação humana |

# 9. Conclusão

A P3 fecha as três perguntas técnicas pendentes. O que ela muda: **pagamentos por favorecido existem e são abertos para o TJES** (e, provavelmente, para qualquer órgão do Governo do ES), o que reabre a página de gastos do Cívica Judiciário **para esse tribunal**; **o DataJud não pode substituir o JN em contagens**; e **a série individual do TJSP é histórica, não corrente**. Nada além disso é necessário antes do desenho de arquitetura; os próximos passos são decisões e pedidos institucionais (Parte 6), não mais sondagens.
