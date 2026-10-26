# Reconciliação histórica 2007–2025 (G10)

Estado: **PASS**. Para cada uma das 19 edições: linhas do arquivo RAW → linhas válidas → snapshots publicados (contagem no PostgreSQL, ver `COBERTURA_ESCOLAS_2007_2025.csv`) → recorte "em atividade com matrícula" × Sinopse Estatística do **mesmo ano** (Brasil, UFs e todos os municípios × 11 células).

| Ano | Layout | Linhas RAW | Códigos únicos | Duplicados | Rejeitadas | Em atividade | Paralisadas | Extintas | Recorte | Sinopse | Dif. Brasil | UFs div. | Células div. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2007 | CSV único | 198.507 | 198.507 | 0 | 0 | 198.507 | 0 | 0 | 198.397 | 198.397 | 0 | 0 | 0 |
| 2008 | CSV único | 205.699 | 205.699 | 0 | 0 | 205.699 | 0 | 0 | 199.761 | 199.761 | 0 | 0 | 0 |
| 2009 | CSV único | 203.455 | 203.455 | 0 | 0 | 203.455 | 0 | 0 | 197.468 | 197.468 | 0 | 0 | 0 |
| 2010 | CSV único | 200.876 | 200.876 | 0 | 0 | 200.876 | 0 | 0 | 194.939 | 194.939 | 0 | 0 | 0 |
| 2011 | CSV único | 242.147 | 242.147 | 0 | 0 | 194.932 | 42.506 | 4.709 | 193.047 | 193.047 | 0 | 0 | 0 |
| 2012 | CSV único | 242.136 | 242.136 | 0 | 0 | 194.695 | 42.421 | 5.020 | 192.676 | 192.676 | 0 | 0 | 0 |
| 2013 | CSV único | 242.680 | 242.680 | 0 | 0 | 192.678 | 45.984 | 4.018 | 190.706 | 190.706 | 0 | 0 | 0 |
| 2014 | CSV único | 242.929 | 242.929 | 0 | 0 | 190.553 | 46.765 | 5.611 | 188.673 | 188.673 | 0 | 0 | 0 |
| 2015 | CSV único | 237.879 | 237.879 | 0 | 0 | 188.689 | 42.564 | 6.626 | 186.441 | 186.441 | 0 | 0 | 0 |
| 2016 | CSV único | 237.506 | 237.506 | 0 | 0 | 187.891 | 45.583 | 4.032 | 186.081 | 186.081 | 0 | 0 | 0 |
| 2017 | CSV único | 236.481 | 236.481 | 0 | 0 | 185.925 | 46.883 | 3.673 | 184.145 | 184.145 | 0 | 0 | 0 |
| 2018 | CSV único | 236.460 | 236.460 | 0 | 0 | 183.746 | 42.505 | 10.209 | 181.939 | 181.939 | 0 | 0 | 0 |
| 2019 | CSV único | 228.521 | 228.521 | 0 | 0 | 182.468 | 40.468 | 5.585 | 180.610 | 180.610 | 0 | 0 | 0 |
| 2020 | CSV único | 224.229 | 224.229 | 0 | 0 | 181.279 | 36.838 | 6.112 | 179.533 | 179.533 | 0 | 0 | 0 |
| 2021 | CSV único | 221.140 | 221.140 | 0 | 0 | 180.057 | 36.502 | 4.581 | 178.370 | 178.370 | 0 | 0 | 0 |
| 2022 | CSV único | 224.649 | 224.649 | 0 | 0 | 184.332 | 36.526 | 3.791 | 178.346 | 178.346 | 0 | 0 | 0 |
| 2023 | CSV único | 217.625 | 217.625 | 0 | 0 | 180.230 | 32.083 | 5.312 | 178.476 | 178.476 | 0 | 0 | 0 |
| 2024 | CSV único | 215.545 | 215.545 | 0 | 0 | 181.065 | 31.321 | 3.159 | 179.286 | 179.286 | 0 | 0 | 0 |
| 2025 | tabelas | 214.192 | 214.192 | 0 | 0 | 180.540 | 29.780 | 3.872 | 178.766 | 178.766 | 0 | 0 | 0 |

## Invariantes verificados

- **Uma identidade por código INEP** e **no máximo um snapshot por (escola, edição)**: 0 duplicados em todas as edições; a PK `(inep, year)` impõe o segundo; o código teste `verify` de cada publicação recusa repetição.
- **Nenhuma escola com município inexistente**: 0 rejeitadas por `MUNICIPIO_INEXISTENTE`, `UF_INCOMPATIVEL`, `INEP_INVALIDO`, `DEPENDENCIA_INVALIDA`, `LOCALIZACAO_INVALIDA` ou `SITUACAO_INVALIDA` em qualquer edição (a FK `entity_id → exec_entity` também impõe).
- **Contagens brutas = parsing = publicação**: linhas do RAW = `Σ exec_edu_cov.rows_in` = `Σ exec_edu_cov.valid` (rejeitadas 0) = linhas no banco (4.272.656 = soma das 19 edições).
- **Totais com matrícula só com universo oficial equivalente**: o recorte foi comparado com a Sinopse do mesmo ano (colunas da aba 3.2) e é exato nas 19 edições; fora desse recorte o produto não rotula "com matrícula".
- **Nenhuma mudança sobrescrita, nenhuma ausência interpretada como fechamento**: cada edição é uma fotografia; a leitura de histórico declara lacunas como `AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO`.

## Observações por família de layout

- **2007–2010**: o arquivo só contém escolas em atividade (`TP_SITUACAO_FUNCIONAMENTO = 1` em 100% das linhas) e, em 2007, 110 escolas ativas têm `QT_MAT_BAS` vazio (tratado como sem matrícula; o recorte continua igual à Sinopse). Ausência nesses anos **não** informa situação.
- **2011–2024**: CSV único com 370 colunas (2011–2021), 385 (2022), 408 (2023), 426 (2024): as oito colunas lidas mantêm nome e significado; paralisadas e extintas passam a constar. `QT_MAT_BAS` vem **0** (2011–2020) ou **vazio** (2021–2024) para escolas sem matrícula: ambos significam sem matrícula básica.
- **2025**: seis tabelas; lidas `Tabela_Escola` e `Tabela_Matricula` (escola sem linha em Matrícula = 0). `Gestor` e `Docente` não foram baixadas.
- Os arquivos históricos já estão harmonizados pelo INEP na nomenclatura atual (a mesma `CO_ENTIDADE`, `CO_MUNICIPIO`, `TP_DEPENDENCIA`, `TP_LOCALIZACAO`, `TP_SITUACAO_FUNCIONAMENTO`, `NO_ENTIDADE` em 2007–2024): a adaptação foi de **leitura** (nulos e zeros de matrícula, situação ausente de 2007–2010), não de renomeação de variáveis. A quebra de 2019 afeta infraestrutura (P10.3), não o cadastro.

## Limites

- A Sinopse não distingue "ativa sem matrícula" de "ausente"; por isso a reconciliação do cadastro completo (214 mil linhas) só é possível por decomposição por situação (ver `RECONCILIACAO_CENSO_2025.md`), não por total oficial.
- Edições 1995–2006 estão fora do escopo contratado.
