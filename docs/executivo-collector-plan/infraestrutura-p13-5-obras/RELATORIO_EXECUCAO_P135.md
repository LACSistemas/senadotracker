# P13.5 — Obras públicas e investimentos

## Resultado

`P13_5_STATUS=PARTIAL` em 30/10/2026. A API pública nova do Obrasgov foi comprovada e um piloto real de 200 projetos foi publicado transacionalmente no `projetoeleitor_db`. A coleta nacional (155.037 projetos e tabelas relacionadas) foi tentada em D:, mas não terminou dentro da janela operacional; portanto não há publicação nacional completa.

O piloto preservou proveniência em D: e não alterou frontend nem reiniciou PNCP/Siconfi. O replay do mesmo hash reutilizou o `run_id=38141`, inseriu zero duplicatas e não aumentou o banco.

## Gates

- `OBRASGOV_NEW_API=PASS`: OpenAPI e endpoints GET retornaram HTTP 200.
- `OBRASGOV_SCHEMA_VALIDATED=PASS`: contrato OpenAPI, envelope de paginação e seis payloads reais validados.
- `OBRASGOV_REAL_ACQUISITION=PASS_WITH_CAVEATS`: seis amostras de 200 linhas adquiridas; nacional incompleta.
- `P135_PILOT_PUBLICATION=PASS` · `IDEMPOTENT_REPLAY=PASS`.
- `P13_5_1_READY=NO`: falta backfill nacional.
- `P13_5_5_FOUNDATION_READY=YES`: modelo genérico e proveniência estão implantados.

Sem PASS global enquanto a aquisição integral e as ligações relacionadas não forem concluídas.
