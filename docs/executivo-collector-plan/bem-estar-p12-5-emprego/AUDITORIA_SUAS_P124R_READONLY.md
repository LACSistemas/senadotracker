# Auditoria somente-leitura da P12.4-R

## IDCRAS

O universo publicado tinha 5.333 municípios com CRAS/respondentes e 5.570 médias IDCRAS não nulas. A inspeção do staging oficial (`D:\Civica\staging\bem-estar\censo-suas\2024\p124r_rows.json`) encontrou exatamente 237 códigos com média não nula e sem linha correspondente no agregado municipal de CRAS. As notas são valores efetivamente publicados, não valores calculados pelo motor, e a faixa observada é `0,0–5,0`.

Não foi encontrada evidência suficiente para converter esses casos em zero administrativo, imputar respondente ou reprocessar a fonte. A divergência é documentada como limitação de universo da média IDCRAS; nenhum dado SUAS foi alterado nesta fase.

## Geografia CRAS

A conferência encontrou 5.333 códigos IBGE6 distintos e 5.333 códigos IBGE7 distintos, sem município com múltiplos IBGE7 e sem unidade territorial extra. A referência anterior a “5.334 IBGE7” correspondia à soma de uma linha Brasil com as 5.333 linhas municipais em contagens de indicadores, não a um 5.334º município.

## Resultado

`SUAS_READONLY_AUDIT=PASS_WITH_DOCUMENTED_LIMITATION`. A ressalva não bloqueia RAIS/Caged e não houve escrita nas tabelas dos indicadores 9101–9301.
