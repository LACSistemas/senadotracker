# P9.4 — Reprodutibilidade

Da raiz do repositório. `EXEC_DATABASE_URL` redireciona para banco de teste; sem ela o alvo é o banco do Cívica. Requer `D:\Civica` com o GUID de `CIVICA_EXEC_VOLUME_ID`, Python com `pymupdf`, `openpyxl`.

```
node --import tsx scripts/exec/prisional-g0.ts > g0.json                 # G0 + fingerprints (Saúde, P9.1–P9.3, entidades, contratos, Legislativo)
pg_dump -n civica_exec -Fc -f D:\Civica\backups\pre-prisional-AAAAMMDD.dump
node --import tsx scripts/exec/prisional-pilot.ts migrate                # migration v4 (6 tabelas)
node --import tsx scripts/exec/prisional-pilot.ts seed                   # 37 indicadores (6001–6143) + 71 medidas
node --import tsx scripts/exec/prisional-pilot.ts fetch                  # 19 CSV oficiais → RAW (SSD), layout conferido
node --import tsx scripts/exec/prisional-pilot.ts identity               # identidade histórica (estatísticas)
node --import tsx scripts/exec/prisional-pilot.ts publish all all        # 27 UFs × 19 ciclos + 19 fatias nacionais (ou: publish 19 ES)
python -I scripts/exec/sisdepen_report_extract.py <relatorio.pdf> <saida.json>   # controles externos
node --import tsx scripts/exec/prisional-report.ts <pasta> <json-relatorios> <anuario_t75.json>
node --import tsx scripts/exec/prisional-perf.ts <saida.json>
```
Reexecutar é seguro (532 fatias `NO_CHANGE`). Novo ciclo: acrescentar a linha em `PRI_CYCLES` (apps/collector/src/exec/prisional.ts) após conferir o layout; `publish <ciclo>` publica só ele (a identidade é resolvida sobre todos os ciclos do RAW).

Testes (cluster descartável, `lc_messages=C`): `node --import tsx --test tests/unit/prisional-p94*.test.ts tests/integration/prisional-p94.test.ts`; suíte completa `npm test` (441 testes: 411 aprovados, 0 falhas, 30 ignorados).

Conteúdo: `g0_antes/depois.json`, `logs/` (produção e replay), `extratores/`, `analise/` (cabeçalho do ciclo 19, relatórios oficiais extraídos, série do Anuário, SHA-256 dos PDFs guardados no RAW), `testes_suite_completa.tap`, `next_build_isolado.log`. Sem dados pessoais.
