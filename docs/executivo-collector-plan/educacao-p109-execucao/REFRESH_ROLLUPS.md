# Refresh e idempotência

`applyExecMigrations` aplica migrations por versão sob advisory lock. A migration 20 é aditiva e cria a identidade municipal. O materializador `refreshEducationProgramRollup` reconstrói o rollup a partir dos fatos e do mapa, sem alterar os fatos source-native.

Execuções oficiais consecutivas em 27/10/2026:

- mapa: 5.567 linhas em ambas;
- `LINKED`: 5.537 em ambas;
- `UNRESOLVED`: 30 em ambas;
- fatos ligados: 471.356 em ambas;
- total source: 6.581.406.260.075 centavos em ambas;
- rollup: 141.010 linhas reportadas pelo materializador (141.006 linhas observadas na consulta final, devido a escopo/filtros de leitura);
- nenhuma revisão nova foi criada por replay inalterado.

Refresh não foi ativado por scheduler nesta fase. O contrato de produção deve registrar `snapshotStartedAt`, `snapshotFinishedAt`, `dataThrough`, hash de fonte e estado last-known-good antes de publicação.
