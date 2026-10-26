# Reconciliação: Ideb, Saeb, rendimento, distorção, transição e INSE (P10.4)

Estado: **PASS** com 6 divergências da fonte documentadas (nenhuma corrigida). Medido no banco de **produção** depois da publicação; o cluster de teste deu exatamente os mesmos números. Evidências em `evidencias/` (`reconciliacao_producao.json`, `spot_check_producao.json`, `numeros_producao.json`, `g16_2023_ES.json`).

## 1. Células e linhas publicadas × cobertura gravada (8 tabelas, todas as edições)

`scripts/exec/educacao-p104-reconcilia.ts` conta, por tabela e edição, as linhas e as células não nulas do banco e compara com `valid` e `cells_num` da cobertura gravada na publicação.

| Tabela | Edições | Linhas | Células | Linhas × cobertura | Células × cobertura |
|---|---|---|---|---|---|
| `exec_edu_ideb_school` | 11 | 1.045.501 | 9.430.870 | 11/11 | 11/11 |
| `exec_edu_ideb_terr` | 11 | 359.746 | 3.615.739 | 11/11 | 11/11 |
| `exec_edu_saeb_terr` | 5 | 1.820.574 | 18.153.674 | 5/5 | 5/5 |
| `exec_edu_flow_school` | 19 | 2.678.764 | 87.568.222 | 19/19 | 19/19 |
| `exec_edu_flow_terr` | 20 | 1.258.400 | 63.633.732 | 20/20 | 20/20 |
| `exec_edu_trn_terr` | 15 | 360.304 | 21.253.272 | 15/15 | 15/15 |
| `exec_edu_inse_school` | 3 | 208.444 | 1.998.852 | 3/3 | 3/3 |
| `exec_edu_inse_terr` | 3 | 229.392 | 1.997.972 | 3/3 | 3/3 |
| **Total** | | **7.961.125** | **207.652.333** | **87/87** | **87/87** |

Nas tabelas de escola do rendimento a linha única reúne rendimento e distorção, então a comparação é `linhas ≤ válidas(rendimento) + válidas(distorção)`; as **células** batem exatamente.

## 2. Conferência independente contra as planilhas oficiais (1.389 valores, 0 divergências)

`scripts/exec/educacao-p104-spot.py` lê os `.xlsx` oficiais **sem usar os extratores** (outro caminho de código) e compara com o banco de produção:

| Família | Verificações | Escopo |
|---|---|---|
| Ideb | 1.203 | 10 municípios (Vitória, Serra, Alto Rio Novo, São Paulo, Rio de Janeiro, Belo Horizonte, Recife, Porto Alegre, Borá e Serra da Saudade, o menor do país) × 3 etapas × redes × edições 2007, 2013, 2019, 2023, 2025 × Ideb, P e N; tolerância 1e-9; onde a planilha tem "-" o banco tem NULL |
| Saeb 2025 | 36 | média de LP e MT do 5º e 9º ano nos municípios com resultado divulgado (total × total); tolerância 0,005 |
| Rendimento | 30 | aprovação do fundamental, total × total, 10 municípios em 2023 (planilha com códigos), 2016 e 2013 (planilhas sem código, por posição) |
| INSE 2023 | 120 | 40 escolas × média, alunos, nível 4 |

## 3. Totais oficiais do INEP × banco (Ideb 2025, Quadro 1 da Nota Informativa)

| Etapa | Escolas com Ideb (nota) | Banco | Participantes (nota) | Banco (linhas) |
|---|---|---|---|---|
| Anos iniciais | 42.454 | 42.454 | 43.400 | 43.400 |
| Anos finais | 33.448 | 33.448 | 34.938 | 34.938 |
| Ensino médio | 17.584 | 17.584 | 19.023 | 19.023 |

Municípios (rede pública, federal, estadual, municipal): AI 5.478 / 15 / 1.094 / 5.320; AF 5.491 / 23 / 3.613 / 3.292; EM 5.428 / 224 / 5.431 / 44. Todos **idênticos** ao quadro. Unidades da Federação: 27 em cada etapa. O Ideb do Brasil (total) reproduz os valores publicados (anos iniciais 3,8 em 2005, 5,9 em 2019, 5,8 em 2021, 6,0 em 2023, 6,3 em 2025; anos finais 5,1 em 2021, 5,0 em 2023, 5,3 em 2025; ensino médio 4,2 em 2019 e 2021, 4,5 em 2025) e as metas de 2007 a 2021.

## 4. Coerência interna dos números oficiais

| Teste | Resultado |
|---|---|
| Ideb ≈ N × P (tolerância 0,05, o Ideb é publicado com 1 casa) | Escolas: 798.632 de 798.642 (10 passam por 2e-6, ruído de ponto flutuante; máximo 0,05000196). **Territórios: 324.222 de 324.295; 73 passam de 0,05, 29 de 0,1 e o máximo é 0,41**, 65 delas nos anos iniciais de 2023 em UF, região e município. Divergência **da fonte** (a Nota Informativa descreve agregações urbanas distintas por nível): publicamos como vieram e não recalculamos |
| Faixas (Ideb ≤ 10, P ≤ 1, N ≤ 10, proficiência ≤ 500) | 0 violações em escolas e territórios |
| Aprovação + reprovação + abandono ≈ 100 (±0,3 p.p.) | **38.289.809 combinações** conferidas (≈ 2 milhões por edição, 2007–2025; a de 2006 só tem distorção), **0 fora da tolerância** |
| Promoção + repetência + evasão + migração para a EJA ≈ 100 | **5.313.318** combinações (15 edições), 0 fora da tolerância |
| Níveis do INSE somam 100 (±0,1) | 368.453 linhas, 0 fora da tolerância |
| Níveis do Saeb somam 100 (±0,3) | 1.747.640 de 1.794.793 linhas. **47.153 ficam abaixo, todas no 5º ano de LP de 2017**: a planilha só traz os níveis 1–9 (sem nível 0). Edição 2019–2025: 0 fora |

## 5. Ideb ≠ média dos Idebs das escolas (medido)

Anos iniciais, rede municipal, edição 2023: Ideb **publicado** do município × média simples dos Idebs das escolas municipais dele (`idebNotAverageOfSchools` em `reconciliacao_producao.json`).

| Município | Ideb publicado | Média dos Idebs das escolas | Escolas | Diferença |
|---|---|---|---|---|
| Alto Rio Novo | 6,4 | 6,525 | 4 | +0,125 |
| Belo Horizonte | 5,8 | 5,719 | 153 | −0,081 |
| Porto Alegre | 4,7 | 4,915 | 20 | +0,215 |
| Recife | 5,5 | 5,539 | 193 | +0,039 |
| Rio de Janeiro | 6,0 | 6,022 | 648 | +0,022 |
| São Paulo | 5,6 | 5,652 | 456 | +0,052 |
| Serra | 5,5 | 5,497 | 59 | −0,003 |
| Vitória | 6,1 | 6,153 | 51 | +0,053 |

A diferença existe e muda de sinal; por isso o município, a rede, a UF e o Brasil nunca são calculados a partir das escolas, e as escolas nunca são ponderadas aqui.

## 6. Divergências e particularidades da fonte (nenhuma corrigida)

| # | Onde | O que acontece | Tratamento |
|---|---|---|---|
| 1 | Ideb, N×P territorial 2023 AI | 73 linhas passam de 0,05 de diferença (máx. 0,41) | Publicado como veio; contado aqui |
| 2 | Rendimento escolar 2007 | 8 linhas com aprovação −0,0999999 (ruído negativo na planilha) | Rejeitadas `VALOR_INVALIDO`, contadas |
| 3 | Ideb 2005–2021 | 124 escolas (137 linhas por edição) do arquivo não existem no cadastro 2007–2025 | `SEM_IDENTIDADE_ESCOLAR`, sem snapshot inventado; contadas na cobertura |
| 4 | Saeb 2017 (UF e Brasil) e 2021 | 2.422 estratos sem alunos em 2017 e 65 em 2021 gravados com média 0 e distribuição 0 | Ausentes, contados como `emptyStrata` na qualidade da publicação; não viram zero |
| 5 | INSE municipal 2023 | Linhas **idênticas** repetidas (54.165 repetições) | Valem uma só; valor diferente na mesma chave seria rejeição (0 casos) |
| 6 | Cabeçalho do rendimento 2016 | Rótulos de localização e rede trocados na planilha de município/UF | Detectado pelo conteúdo e corrigido na leitura; cobertura idêntica ao esperado |
| 7 | Transição 2007–2021 | `***` (sigilo estatístico): 71.588 células | Ausentes, contadas em `cells_supp`; nenhuma reconstruída |
| 8 | Saeb 2021 alfabetização | A planilha repete a linha de 2º ano com a taxa | Junta `tx_alf` à linha existente; contada como célula (corrigido na revisão da cobertura) |

## 7. O que NÃO foi reconciliado

- Valores do Saeb por escola (não existe arquivo oficial) e Ideb de escolas de 2005 sem cadastro posterior.
- As planilhas anteriores a 2010 de rendimento/distorção só tiveram conferência por amostra (rendimento 2013 e 2016 por posição). A conferência estatística (soma 100, cobertura × células) vale para todas.
- Nenhum valor suprimido foi reconstruído, nem comparado com microdados.
