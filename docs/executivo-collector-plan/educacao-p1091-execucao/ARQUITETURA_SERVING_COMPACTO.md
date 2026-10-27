# Arquitetura de serving compacto

P10.9.1 introduz duas materializações aditivas:

- `exec_edu_overview_rollup`: uma linha por território e ano, com KPIs essenciais, cobertura, frescor e agregados resumidos;
- `exec_edu_series_rollup`: uma linha por território, indicador e ano para séries sob demanda.

Os fatos escolares, SIOPE, Siconfi, programas e contratos não são copiados. O overview não contém linhas detalhadas de cada fonte: finance/programs/contracts são agregados por estágio/categoria. A primeira pintura deixa de selecionar e serializar o perfil integrado completo.

Novos contratos em `educacao-serving-read.ts`:

- `getEducationOverview`;
- `getEducationSection`;
- `getEducationSeries`;
- `getEducationComparison`;
- `getEducationList`.

Todos usam SQL parametrizado e índices de chave. O contrato legado continua disponível para uso interno e auditoria, mas não deve ser usado como payload inicial.
