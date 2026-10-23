# Errata da reconciliação federal da P9.5 (referência)

O texto completo, com a causa, a prova numérica e as correções, está em
[`../seguranca-publica-p95-execucao/ERRATA_RECONCILIACAO_FEDERAL.md`](../seguranca-publica-p95-execucao/ERRATA_RECONCILIACAO_FEDERAL.md).

Resumo: a divergência de R$ 2–4 bi entre Portal da Transparência e DCA da União era erro da consulta do relatório (faltava filtrar a entidade Brasil em `exec_fin_exec`, que também guarda PE e as prefeituras do RS), não dos dados nem do parser. Com o filtro, 2020 e 2021 coincidem ao centavo e 2019 fica −2,2%. Há teste de regressão em `tests/integration/financas-p95.test.ts`.
