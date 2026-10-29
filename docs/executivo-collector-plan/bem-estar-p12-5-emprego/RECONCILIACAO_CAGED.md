# Reconciliação Novo Caged — agosto/2026

## Cobertura

O workbook contém janeiro–agosto de 2026. Cada indicador possui 44.792 linhas: 5.571 municípios + 27 UFs + Brasil, em oito competências.

## Identidade do saldo

Foram comparadas as quatro séries na chave entidade×competência. Em todas as 44.792 linhas:

`valor(9501) - valor(9502) = valor(9503)`.

Resultado: `total=44.792`, `exact=44.792`, `mismatch=0`.

Os valores Brasil/UF e municipais foram mantidos em escopos separados. Não se usa o estoque (`9500`) como soma de saldos nem se infere taxa de desemprego.

## Paridade de fonte

As tabelas 7.1 e 8.1 foram lidas com o deslocamento de colunas real do workbook (grupo janeiro com quatro campos e grupos seguintes com cinco). O estoque e os fluxos foram conferidos por competência, e o último recurso comprovadamente publicado é agosto/2026.

`CAGED_ADMISSION_DISMISSAL_BALANCE_PARITY=PASS`.
