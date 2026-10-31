# Reconciliação DEC/FEC

- indicadores coletivos: 5.137.778 linhas, 23 siglas, 3.980 conjuntos, 105 agentes, 80 períodos (`2020-1` a `2026-8`), sem duplicatas da chave `(ano, período, indicador, conjunto, CNPJ)`;
- limites: 263.401 linhas, somente DEC/FEC, 16.311 conjuntos, anos 1990–2032, sem duplicatas;
- atributos: 776.216 linhas, 22 siglas de atributos, 7.433 conjuntos, períodos 2008-1 a 2014-4, sem duplicatas;
- geração mais recente dos três recursos: 2026-10-05.

Não há paridade municipal a calcular: a fonte de continuidade não contém município. O crosswalk INDQUAL foi auditado separadamente e não fornece pesos. `DEC_FEC_ROWS_PUBLISHED = 0` é uma decisão semântica, não falha de ingestão.
