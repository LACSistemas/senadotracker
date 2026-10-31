# P13.4 — Execução de mobilidade e transporte

**Status:** `PASS_WITH_DOCUMENTED_SOURCE_LIMITATION`  
**Banco:** `projetoeleitor_db` · **data:** 2026-10-30

P13.4 publicou MUNIC 2024 e PEMOB 2026, reutilizou a frota e infrações Senatran e preservou o envelope de armazenamento. ESTADIC 2024 foi confirmado na documentação oficial do IBGE, mas a página retornou HTTP 403 nesta execução; não foram inferidas URLs nem indicadores estaduais. O arquivo metropolitano PEMOB foi validado, mas não publicado por falta de entidade canônica metropolitana.

- MUNIC: 12 indicadores, 5.570 municípios, 27 UFs.
- PEMOB municipal: 7 indicadores, 96 respondentes, 24 UFs.
- Senatran reutilizada: 919.256 linhas de frota (até 2026-09), 425.724 de infrações.
- Crescimento desde a linha de base P13.3: **18.317.312 bytes**.
- Replay PEMOB: crescimento 0 e nenhum novo `run_id`.

Detalhes e gates estão em `P134_RESULTS.json`.
