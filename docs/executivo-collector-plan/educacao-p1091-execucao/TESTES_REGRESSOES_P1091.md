# Testes e regressões P10.9.1

## Executados

- migration 21 e refresh validados em cluster isolado restaurado;
- contratos compactos validados com dados reais;
- benchmark aquecido: 100 repetições por cenário;
- carga isolada: 1, 5, 10, 25 e 50 concorrentes;
- replay do materializador idempotente;
- build Next.js passou;
- typecheck global continua bloqueado pelo erro sintático preexistente em `scripts/p5_rebuild_global_rollup.ts`;
- suíte completa anterior: 470 pass, 44 fail, 70 skipped; não declarada verde.

## Estado

Não houve skip ambiental nos testes específicos P10.9.1. As falhas da suíte histórica não foram convertidas em skips nem mascaradas. O gate de regressão integral permanece `PASS_WITH_CAVEATS`.
