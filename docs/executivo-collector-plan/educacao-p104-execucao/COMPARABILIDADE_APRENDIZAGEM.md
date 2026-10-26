# Comparabilidade histórica: Ideb, Saeb, rendimento, distorção, transição e INSE (P10.4)

Fontes lidas antes de validar qualquer comparação: Nota Informativa do Ideb 2025 (`ideb/2025/nota_informativa_ideb_2025.pdf`), Nota Informativa dos Resultados do Saeb 2021 (versão retificada), Nota Técnica da base amostral do 2º ano do Saeb 2023, dicionário de dados da planilha do Saeb 2025 e os cabeçalhos/rodapés das planilhas de Indicadores Educacionais e do INSE. O que o INEP não declara aqui está marcado como **não verificado**.

## 1. Ideb

| Período | O que mudou | Efeito na comparação |
|---|---|---|
| 2005 | Linha de base da trajetória; só agregados e escolas | Escola de 2005 só entra se também existe no cadastro 2007–2025 (P10.1); as demais ficam contadas e fora, sem snapshot inventado. Território de 2005 entra completo |
| 2007–2021 | Ciclo de metas (Decreto 6.094/2007) | `meta` só neste período; meta é do ciclo, não "meta atual" |
| 2021 | Pandemia: Saeb com mais não resposta; para município o mínimo de participação foi flexibilizado (50%) e a escola manteve 80% | Edição comparável pelo INEP, mas com cobertura menor: o conjunto de escolas e municípios com Ideb muda entre 2019 e 2021. Compare só quem tem valor nas duas edições |
| 2023, 2025 | Sem metas; a Nota Informativa 2025 afirma que seguem a mesma metodologia de 2007, "utilizada de forma inalterada", e são comparáveis com as anteriores | Comparáveis; **2025 é a última divulgação na formulação original** (Portaria 26/2024 trata da atualização do índice) |
| 2025 | Escolas com participação < 80% e outros critérios (A–I do item 2 da nota) ficam sem Ideb; municípios < 50% ou com uma única escola avaliada < 80% ficam sem Ideb | Ausência ≠ resultado baixo. Quadro 1 da nota fecha com o banco (ver `RECONCILIACAO_APRENDIZAGEM.md`) |

Regras fixas: etapas diferentes (AI, AF, EM) não se comparam nem se somam; escola, rede, município, UF e Brasil são agregações **diferentes** (não são média uma da outra; a nota dá o exemplo de um município com escolas de 5.000 e 100 alunos); a Nota Informativa 2025 lista unidades de agregação distintas por nível (por exemplo, UF "total" = escolas urbanas públicas e privadas; município = rede pública urbana, federal, estadual, municipal), então o `ap_tot` publicado ao lado e o Ideb podem não reproduzir `N × P` em agregados (nas linhas territoriais, 73 de 324.295 conferidas passam de 0,05 de diferença entre N×P e o Ideb publicado, 65 delas nos anos iniciais de 2023 em UF, região e município; 29 passam de 0,1 e o máximo é 0,41; nas escolas, 10 de 798.642 passam de 0,05 e o máximo é 0,05000196, que é só arredondamento). O Cívica publica os valores como vieram e não recalcula nada.

## 2. Saeb

| Ponto | Fato (nota ou dicionário) | Regra do Cívica |
|---|---|---|
| Matrizes | 2019 inicia a transição para a BNCC (entram 2º ano EF e CH/CN do 9º ano); 2023 traz testes de LP e MT do 5º e 9º anos alinhados à BNCC e CH/CN do 5º ano; 2025 fecha com o ensino médio alinhado à BNCC | O INEP mantém a escala histórica de 5º/9º/EM; **não verificado** se a equalização preserva a comparabilidade entre 2021, 2023 e 2025. Cada série × disciplina tem escala própria e o Cívica não compara valores entre escalas |
| 2º ano e alfabetização | Escala de alfabetização (750, 50) criada em 2019; em 2023 os estados aplicaram avaliação censitária e o INEP fez uma base amostral cuja margem de erro vai de 2,8 p.p. (Brasil) a 21,5 p.p. (BA) | `tx_alf` (2021, TX_ALFABETIZADO) e `PC_ALFABETIZADO` (2023) são conceitos e escalas diferentes e **não se comparam**; a base amostral de 2023 não serve para ranquear UFs |
| 2021 | Versão retificada: erro de ponderação corrigido e dados recalculados; participação menor (70,2% de resposta); critério de divulgação flexível para municípios (50%) | Usamos a planilha vigente na página do INEP em 24–25/10/2026 (SHA-256 no manifesto). A diferença para a versão original não foi medida |
| Níveis | Pontos de corte iguais em todas as edições da mesma série: EM 225–450 de 25 em 25; a distribuição de 2017 do 5º ano em LP traz os níveis 1–9 (sem nível 0), então a soma fica abaixo de 100 | 49.575 linhas de 2017 somam menos de 99,7%: é o formato da fonte, não perda do Cívica |
| Estrato sem alunos | UF e Brasil de 2017 gravam média 0 e níveis 0 | Ausente (marcador), contado em `emptyStrata` |
| Ensino médio | Código 12 = tradicional, 13 = integrado, 14 = tradicional ou integrado (dicionário 2025). Nas edições anteriores confira o dicionário da edição | Rótulos do catálogo seguem o dicionário de 2025 |
| Cobertura | Escola/município só com 80%/50% de participação; escolas com resultado divulgado em 2021: 71% (5º ano), 60% (9º ano), 37% (EM) | A cobertura é parte do resultado; nunca interpretar a falta |

## 3. Rendimento, distorção e transição (Indicadores Educacionais)

- **Fundamental de 9 anos.** Os segmentos gravados são os do fundamental de 9 anos (f1 = 1º ano). As planilhas de 2007–2009 trazem colunas "1ª série/2º ano" etc.; o Cívica grava o ano equivalente (f2…f9) e a coluna sem equivalente de 8 anos não existe. Se o 1º ano tem cobertura menor em 2007–2009 não foi verificado: confira a cobertura (`COBERTURA_EDUCACAO_P104.csv`) antes de comparar séries iniciais.
- **Rendimento do ano Y** vem do Censo de Y. **Transição Y/Y+1** usa o rendimento de Y e a matrícula de Y+1; gravada com `year = Y`. As duas medidas **não** se somam nem se substituem.
- **Fonte das lacunas.** Em 2012–2014 as planilhas de rendimento de Brasil e UFs não trazem as regiões (28 territórios: Brasil + 27 UFs); a cobertura aparece no CSV.
- **Sigilo.** `***` aparece nas planilhas de transição (a partir de 2007) e é mantido como ausente com contagem em `cells_supp`.
- **Soma de 100.** A conferência `aprovação + reprovação + abandono` e `promoção + repetência + evasão + migração para a EJA` usa tolerância de 0,3 p.p. (cada parcela é arredondada a 1 casa). Resultado em `RECONCILIACAO_APRENDIZAGEM.md`.
- **Taxa negativa na fonte.** Em 2007, 8 linhas de escola trazem aprovação −0,1 (ruído de ponto flutuante na planilha): rejeitadas como `VALOR_INVALIDO` e documentadas, sem correção.

## 4. INSE

| Edição | Observação |
|---|---|
| 2019 | Escala do Saeb 2019; "não há escala interpretativa" por município e UF; classificação em 8 níveis (o cabeçalho diz 6 grupos, a lista traz 8) |
| 2021, 2023 | Escala nova, com a mesma classificação em 8 níveis; municípios 2023 repetem linhas idênticas (defeito da planilha) |
| 2011–2015 | Indicador de Nível Socioeconômico das escolas (outra metodologia): baixado, **não carregado**. Sem comparação com 2019–2023 |

**Regra:** 2019 não se compara com 2021/2023. INSE descreve o contexto agregado das escolas; não mede qualidade e não sustenta causalidade com Ideb, Saeb ou rendimento.

## 5. O que o Cívica nunca faz com estas séries

Ranking único de escolas ou redes; "efeito" de infraestrutura, docentes ou INSE sobre o resultado; média entre etapas, redes, escolas ou escalas; preencher edição ausente; reconstruir valor suprimido; comparar valor de município de poucos alunos como se fosse tendência.
