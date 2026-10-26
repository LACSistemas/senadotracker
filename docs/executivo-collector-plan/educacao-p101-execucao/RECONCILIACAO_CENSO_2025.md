# Reconciliação do Censo Escolar 2025 · cadastro × Sinopse (G3)

Estado: **PASS**. Reproduzo o recorte oficial a partir dos campos do próprio Censo e comparo com a Sinopse Estatística 2025 (aba 3.2) em **Brasil, 27 UFs e 5.571 municípios × localização × dependência** (11 células por município: 61.281 comparações, **0 divergentes**).

## 1. A cadeia quantitativa

`Cadastro completo (214.192 linhas) → situação de funcionamento → matrícula na educação básica → estabelecimentos da Sinopse (178.766)`

| Etapa | Registros | Regra (campo do arquivo) |
|---|---:|---|
| Cadastro completo da edição 2025 | 214.192 | todas as linhas de `Tabela_Escola_2025_V2.csv` |
| A. em atividade com matrícula (recorte da Sinopse) | 178.766 | `TP_SITUACAO_FUNCIONAMENTO = 1` e `QT_MAT_BAS > 0` (`Tabela_Matricula`) |
| B. em atividade SEM matrícula na educação básica | 1.774 | `TP_SITUACAO_FUNCIONAMENTO = 1` e sem linha em `Tabela_Matricula` (matrícula 0) |
| C. paralisada | 29.780 | `TP_SITUACAO_FUNCIONAMENTO = 2` |
| D. extinta (no ano) | 3.872 | `TP_SITUACAO_FUNCIONAMENTO = 3` |

**Recorte reproduzido: 178.766 · Sinopse 2025 (Brasil): 178.766 · diferença: 0.** A diferença de 35.426 registros entre 214.192 e 178.766 decompõe-se **integralmente** em: em atividade SEM matrícula na educação básica 1.774, paralisada 29.780, extinta (no ano) 3.872 (soma: 35.426). Nenhum resíduo.

### Notas metodológicas da própria Sinopse (aba 3.2)

- Fonte: INEP – Censo Escolar da Educação Básica 2025
- Notas:     1 - Inclui somente os estabelecimentos em atividade na data de referência do Censo Escolar (última quarta-feira do mês de maio) e com pelo menos uma matrícula registrada em qualquer etapa de ensino.
- 2 - Não inclui estabelecimentos com turmas exclusivas de Atividade Complementar ou Atendimento Educacional Especializado (AEE).

"Matrícula registrada em qualquer etapa de ensino" equivale a `QT_MAT_BAS > 0` (matrícula da educação básica); estabelecimentos só com turmas de atividade complementar ou AEE não têm matrícula básica e ficam de fora, como diz a nota 2.

## 2. Por dependência administrativa (recorte)

| Dependência | Cadastro | Em atividade com matrícula | Sinopse (urbana + rural) | Dif. |
|---|---:|---:|---:|---:|
| Federal | 728 | 716 | 716 | 0 |
| Estadual | 33.561 | 29.732 | 29.732 | 0 |
| Municipal | 128.145 | 106.572 | 106.572 | 0 |
| Privada | 51.758 | 41.746 | 41.746 | 0 |

## 3. Por UF

| UF | Cadastro | A (recorte) | B ativa sem matrícula | C paralisada | D extinta | Sinopse | Dif. |
|---|---:|---:|---:|---:|---:|---:|---:|
| RO | 1.393 | 1.186 | 34 | 131 | 42 | 1.186 | 0 |
| AC | 1.678 | 1.521 | 3 | 110 | 44 | 1.521 | 0 |
| AM | 6.104 | 5.536 | 26 | 503 | 39 | 5.536 | 0 |
| RR | 969 | 908 | 7 | 54 | 0 | 908 | 0 |
| PA | 11.817 | 10.471 | 59 | 1.031 | 256 | 10.471 | 0 |
| AP | 944 | 864 | 11 | 63 | 6 | 864 | 0 |
| TO | 2.217 | 1.575 | 6 | 574 | 62 | 1.575 | 0 |
| MA | 13.226 | 11.123 | 96 | 1.847 | 160 | 11.123 | 0 |
| PI | 5.325 | 3.976 | 41 | 1.211 | 97 | 3.976 | 0 |
| CE | 10.122 | 7.628 | 88 | 2.157 | 249 | 7.628 | 0 |
| RN | 4.708 | 3.368 | 48 | 1.222 | 70 | 3.368 | 0 |
| PB | 5.641 | 4.624 | 12 | 865 | 140 | 4.624 | 0 |
| PE | 9.957 | 7.968 | 24 | 1.467 | 498 | 7.968 | 0 |
| AL | 3.322 | 2.851 | 31 | 397 | 43 | 2.851 | 0 |
| SE | 2.430 | 1.999 | 5 | 352 | 74 | 1.999 | 0 |
| BA | 19.604 | 15.854 | 252 | 2.944 | 554 | 15.854 | 0 |
| MG | 24.069 | 15.849 | 61 | 7.693 | 466 | 15.849 | 0 |
| ES | 3.847 | 2.986 | 60 | 758 | 43 | 2.986 | 0 |
| RJ | 13.035 | 11.557 | 90 | 1.179 | 209 | 11.557 | 0 |
| SP | 33.616 | 30.439 | 378 | 2.536 | 263 | 30.439 | 0 |
| PR | 9.975 | 9.528 | 48 | 319 | 80 | 9.528 | 0 |
| SC | 7.463 | 6.538 | 212 | 636 | 77 | 6.538 | 0 |
| RS | 11.046 | 9.874 | 72 | 922 | 178 | 9.874 | 0 |
| MS | 1.965 | 1.829 | 30 | 102 | 4 | 1.829 | 0 |
| MT | 3.241 | 2.701 | 9 | 383 | 148 | 2.701 | 0 |
| GO | 5.007 | 4.722 | 30 | 199 | 56 | 4.722 | 0 |
| DF | 1.471 | 1.291 | 41 | 125 | 14 | 1.291 | 0 |

## 4. Municípios

Comparação de **todos** os municípios da Sinopse: 5571 municípios × 11 células (total; urbana e rural × total/federal/estadual/municipal/privada) = 61.281 células, **0 divergentes**. Municípios só no cadastro: 0; municípios só na Sinopse com escola: 0. Resultado completo: `evidencias/reconciliacao_sinopse.json`.

## 5. O que NÃO foi apagado

As 35.426 linhas fora do recorte (ativas sem matrícula, paralisadas e extintas) **permanecem no cadastro** (`exec_edu_school_year`, `sit` e `flags` as distinguem): são necessárias para reconstruir transições. O recorte é um filtro de leitura (`flags` bit1), não uma exclusão.

## 6. Limites

- A equivalência vale para o universo "estabelecimentos da educação básica" da aba 3.2; não foi comparada a aba de estabelecimentos conveniados (3.3) nem etapas (exigem a tabela de matrículas/turmas, P10.2).
- Em 2007–2010 o arquivo só lista escolas em atividade; ver `RECONCILIACAO_HISTORICA.md`.
