# Reconciliação de docentes e indicadores oficiais · P10.3 (G11)

Estado: **PASS_WITH_CAVEATS**. Ressalva única e declarada: o Cívica **reproduz** os valores do INEP, e a reconciliação prova que o publicado é o lido e que as distribuições fecham; não há uma segunda fonte oficial independente para os indicadores por escola (os arquivos de indicadores *são* a referência).

## 1. Docentes distintos (Sinopse Estatística, tabelas 2.1 e 2.2)
Referência oficial: a própria Sinopse. Verificações:
- **Total do Brasil**: o banco (`exec_edu_doc_terr`, entidade Brasil) = o valor da planilha oficial nas **19 edições** (de 1.878.284 em 2007 a 2.407.049 em 2025).
- **0 linhas rejeitadas** em 19 edições × 28 fatias; 5.593 a 5.599 territórios por edição (Brasil, 27 UFs, ≈ 5.570 municípios).
- **Não aditividade, medida:** a soma dos docentes das UFs é maior que o total do Brasil e a soma dos municípios é maior ainda, porque o docente que atua em mais de uma UF ou município conta em cada um.

| Ano | Brasil | Σ UFs | Σ municípios | Σ municípios ÷ Brasil |
|---:|---:|---:|---:|---:|
| 2007 | 1.878.284 | 1.882.961 | 1.968.911 | 1.048 |
| 2008 | 1.983.130 | 1.988.161 | 2.088.422 | 1.053 |
| 2009 | 1.972.333 | 1.977.978 | 2.093.236 | 1.061 |
| 2010 | 1.999.518 | 2.005.734 | 2.127.044 | 1.064 |
| 2011 | 2.039.261 | 2.045.350 | 2.168.708 | 1.063 |
| 2012 | 2.095.013 | 2.101.408 | 2.228.021 | 1.063 |
| 2013 | 2.141.676 | 2.148.023 | 2.280.643 | 1.065 |
| 2014 | 2.184.267 | 2.190.743 | 2.327.511 | 1.066 |
| 2015 | 2.187.154 | 2.193.453 | 2.333.335 | 1.067 |
| 2016 | 2.196.397 | 2.203.176 | 2.345.948 | 1.068 |
| 2017 | 2.192.224 | 2.199.002 | 2.343.224 | 1.069 |
| 2018 | 2.226.423 | 2.233.179 | 2.380.478 | 1.069 |
| 2019 | 2.212.018 | 2.218.921 | 2.364.064 | 1.069 |
| 2020 | 2.189.005 | 2.195.884 | 2.334.996 | 1.067 |
| 2021 | 2.190.943 | 2.199.107 | 2.368.036 | 1.081 |
| 2022 | 2.315.616 | 2.323.277 | 2.473.623 | 1.068 |
| 2023 | 2.354.194 | 2.361.574 | 2.505.387 | 1.064 |
| 2024 | 2.367.777 | 2.375.270 | 2.518.098 | 1.063 |
| 2025 | 2.407.049 | 2.414.827 | 2.564.091 | 1.065 |

- **Rede pública + rede privada ≥ total**, também por dupla vinculação (2025: 1.908.735 + 573.953 = 2.482.688 contra 2.407.049 docentes distintos, 75.639 a mais; série 2007–2025 abaixo).

| Ano | Total | Pública | Privada | Docentes nas duas redes (Σ − total) |
|---:|---:|---:|---:|---:|
| 2007 | 1.878.284 | 1.569.532 | 375.529 | 66.777 |
| 2008 | 1.983.130 | 1.633.807 | 427.940 | 78.617 |
| 2009 | 1.972.333 | 1.623.263 | 435.728 | 86.658 |
| 2010 | 1.999.518 | 1.637.231 | 450.462 | 88.175 |
| 2011 | 2.039.261 | 1.654.623 | 473.214 | 88.576 |
| 2012 | 2.095.013 | 1.689.371 | 495.732 | 90.090 |
| 2013 | 2.141.676 | 1.721.910 | 510.371 | 90.605 |
| 2014 | 2.184.267 | 1.745.047 | 529.256 | 90.036 |
| 2015 | 2.187.154 | 1.740.070 | 532.557 | 85.473 |
| 2016 | 2.196.397 | 1.744.638 | 534.908 | 83.149 |
| 2017 | 2.192.224 | 1.737.492 | 533.715 | 78.983 |
| 2018 | 2.226.423 | 1.751.211 | 552.126 | 76.914 |
| 2019 | 2.212.018 | 1.730.050 | 556.218 | 74.250 |
| 2020 | 2.189.005 | 1.711.932 | 547.863 | 70.790 |
| 2021 | 2.190.943 | 1.726.099 | 534.004 | 69.160 |
| 2022 | 2.315.616 | 1.833.276 | 557.322 | 74.982 |
| 2023 | 2.354.194 | 1.861.118 | 566.858 | 73.782 |
| 2024 | 2.367.777 | 1.864.296 | 578.088 | 74.607 |
| 2025 | 2.407.049 | 1.908.735 | 573.953 | 75.639 |

- **Soma das escolas superconta.** A investigação P10 mediu Σ `QT_DOC_BAS` das escolas = 2.939.002 em 2024 contra 2.367.777 docentes distintos da Sinopse 2024 (+24,1%). **Nenhum coeficiente de correção foi aplicado** e o Cívica não publica soma de docentes por escola.

## 2. Integridade dos Indicadores Educacionais oficiais (RAW → publicado)
Para cada edição × família × nível (escola, território) foram contadas as **células numéricas** que o extrator lê das planilhas oficiais e as células não nulas gravadas no banco: **201 comparações, 201 iguais, 0 divergentes** (`reconciliacao_p103_producao.json`, bloco A). Total de células conferidas: 153.257.071.

| Família | Comparações | Células conferidas |
|---|---:|---:|
| ATU | 38 | 16.949.496 |
| HAD | 32 | 14.097.245 |
| DSU | 30 | 15.445.794 |
| AFD | 26 | 52.509.500 |
| IED | 26 | 43.452.834 |
| IRD | 26 | 4.347.692 |
| ICG | 23 | 6.454.510 |

## 3. Invariantes dos próprios indicadores (distribuições que devem somar 100)
AFD (cinco grupos, sete etapas), IED (seis níveis, quatro etapas), ICG (seis níveis) e IRD (quatro faixas) são distribuições percentuais. Tolerância de 0,3 ponto (arredondamento em 1 casa de cada parcela). **24 verificações, 18.966.393 linhas, 0 fora da tolerância.** O valor nunca foi recalculado ou normalizado.

## 4. Coerência com a oferta da P10.2 (escola)
Indicador de uma etapa só existe se a escola tem matrícula na etapa: ATU de creche, pré-escola, anos iniciais, anos finais ou ensino médio sem matrícula correspondente na P10.2 = **0 escolas em 2025** e em todas as edições com oferta (bloco C). Há linhas de indicador para escolas sem linha de oferta (120 em 2025): são escolas que têm indicador publicado pelo INEP mas não têm linha de oferta (matrícula ou turma básica > 0) na P10.2; a causa não foi investigada escola a escola e a ligação entre as tabelas é a identidade da P10.1, não a oferta.

## 5. ATU oficial × razão derivada da P10.2 (Brasil, total)
| Ano | ATU oficial infantil | derivada | ATU oficial fundamental | derivada | ATU oficial médio | derivada |
|---:|---:|---:|---:|---:|---:|---:|
| 2007 | 18.1 | 18.2 | 25.5 | 25.0 | 34.4 | 34.3 |
| 2008 | 17.7 | 17.8 | 25.1 | 24.7 | 33.7 | 33.7 |
| 2009 | 17.5 | 17.7 | 24.7 | 24.3 | 33.2 | 33.1 |
| 2010 | 17.0 | 17.3 | 24.2 | 23.9 | 32.4 | 32.4 |
| 2011 | 16.9 | 17.1 | 23.9 | 23.6 | 31.9 | 31.8 |
| 2012 | 16.8 | 17.0 | 23.6 | 23.2 | 31.4 | 31.4 |
| 2013 | 16.7 | 16.9 | 23.3 | 23.0 | 31.0 | 31.0 |
| 2014 | 16.7 | 16.8 | 23.2 | 22.9 | 30.7 | 30.7 |
| 2015 | 16.5 | 16.7 | 23.1 | 22.8 | 30.2 | 30.2 |
| 2016 | 16.4 | 16.6 | 23.1 | 22.8 | 30.5 | 30.5 |
| 2017 | 16.3 | 16.5 | 23.0 | 22.7 | 30.4 | 30.4 |
| 2018 | 16.3 | 16.4 | 23.1 | 22.8 | 30.2 | 30.2 |
| 2019 | 16.2 | 16.3 | 23.0 | 22.8 | 29.6 | 29.6 |
| 2020 | 15.8 | 15.9 | 23.0 | 22.7 | 30.3 | 30.3 |
| 2021 | 15.4 | 15.5 | 22.9 | 22.7 | 30.1 | 30.1 |
| 2022 | 15.6 | 15.7 | 22.7 | 22.4 | 29.5 | 29.5 |
| 2023 | 15.7 | 15.8 | 22.5 | 22.3 | 28.7 | 28.7 |
| 2024 | 15.4 | 15.5 | 22.4 | 22.2 | 28.9 | 28.9 |
| 2025 | 15.1 | 15.1 | 22.2 | 22.0 | 28.4 | 26.5 |

As diferenças (pequenas no infantil e no fundamental, maiores no ensino médio, que chega a 28,4 contra 26,5 em 2025) são esperadas: o ATU do INEP usa apenas turmas de ensino regular de cada etapa com regras de exclusão próprias, e a razão derivada divide **todas** as matrículas pela **soma** de turmas, inclusive turmas multietapa e de educação profissional. Os dois números são mantidos separados e rotulados: `MEDIA_OFICIAL_INEP` e `RAZAO_DERIVADA_CIVICA`. Não se declarou erro em nenhum dos dois.

## 6. Supressões e pequenos números
Células `--` (suprimidas ou fora de aplicação) viram NULL; zeros publicados permanecem zero. Contagens por família estão em `COBERTURA_EDUCACAO_P103.csv` (`celulas_suprimidas`). Nenhum valor suprimido foi inferido por subtração.
