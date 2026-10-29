# Auditoria documental da RAIS P12.5

## Fonte e método

Arquivo oficial: `D:\Civica\raw\bem-estar\trabalho\rais\2025\rais-2025-tabelas.xlsx`.

SHA-256: `b53279b80448e4b5545eee3192130215727d066c62dcce7e77337921ea14efff`.

Leitura somente leitura com `openpyxl`, células e agregações da própria planilha, seguida de consulta aos fatos canônicos em `civica_exec.exec_ind_value`.

## Células verificadas

Na planilha `TABELA 2`, linha 13, coluna B (`Estoque Total`), os totais nacionais são:

| Ano | Célula | Valor |
|---|---:|---:|
| 2023 | D13 | 55.316.614 |
| 2024 | E13 | 57.132.156 |
| 2025 | F13 | 59.970.945 |

Na planilha `TABELA 4`, a linha 5587 é `UF=NI`, `Código=999999`, `Município=Não Identificado`. As colunas `AD`, `AE`, `AF` são, respectivamente, os totais 2023, 2024 e 2025 (cabeçalho na linha 14):

| Ano | Célula | Linha 999999 |
|---|---:|---:|
| 2023 | AD5587 | 709 |
| 2024 | AE5587 | 10.899 |
| 2025 | AF5587 | 3.065 |

## Recomposição

- 2024: `57.132.156 - 57.121.257 = 10.899`.
- 2023: `55.316.614 - 55.315.905 = 709`.
- 2025: o total nacional da Tabela 2 é `59.970.945`; a soma das linhas municipais da Tabela 4 é `59.871.633`; excluindo `999999`, `59.868.568`. Logo, o residual em relação ao total nacional é `102.377`, mas a linha `999999` contém apenas `3.065`. A diferença adicional de `99.312` decorre de divergências entre totais de UFs nas duas tabelas (RJ −44.345; SP −33.968; MG +21.351; DF −42.350; saldo −99.312).

## Fatos persistidos

Os fatos canônicos conferem com a Tabela 2 para o Brasil: RAIS 9401 = 55.316.614 (2023), 57.132.156 (2024), 59.970.945 (2025). O recorte municipal confere com a soma sem `999999`: 55.315.905, 57.121.257 e 59.868.568.

## Conclusão

`RAIS_PARITY_GATE=PASS_DOCUMENTARY_CORRECTION`. O erro foi documental: o valor de 2024 foi registrado como 899 em um documento, e o documento de 2025 confundiu o residual de reconciliação (102.377) com a linha `999999` (3.065). Nenhum fato RAIS foi alterado.
