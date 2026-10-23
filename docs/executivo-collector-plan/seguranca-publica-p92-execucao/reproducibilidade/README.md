# P9.2 — Reprodutibilidade

Da raiz do repositório. `EXEC_DATABASE_URL` redireciona para um banco de teste; **sem ela o alvo é o banco do Cívica**. Requer `D:\Civica` montado com o GUID de `CIVICA_EXEC_VOLUME_ID`, Python com `pyreaddbc`, `dbfread`, `openpyxl`, `xlrd==2.0.2`, `numpy`.

```
node --import tsx scripts/exec/seguranca-g0.ts --hash-sim > g0.json            # G0 (fingerprints de Saúde, P9.1)
pg_dump -n civica_exec -Fc -f D:\Civica\backups\pre-transito-AAAAMMDD.dump  # backup antes de escrever
node --import tsx scripts/exec/transito-pilot.ts migrate | seed
node --import tsx scripts/exec/transito-pilot.ts sim-range 2013 2025
node --import tsx scripts/exec/transito-pilot.ts prf all
node --import tsx scripts/exec/transito-pilot.ts infr all
node --import tsx scripts/exec/transito-pilot.ts frota all
node --import tsx scripts/exec/transito-pilot.ts renaest                      # baixa 529 MB, agrega, descarta o original
node --import tsx scripts/exec/transito-report.ts <pasta> --g0-before g0_producao_antes.json
node --import tsx scripts/exec/transito-perf.ts <saida.json>
```
Reexecutar é seguro (NO_CHANGE). Atualização: `frota <AAAAMM,…>`, `prf <ano,…>`, `infr <AAAAMM,…>`; o RENAEST republica apenas fatias cujo conteúdo mudou.

Testes: cluster descartável (`initdb`, porta 55434), `EXEC_TEST_ADMIN_URL=postgresql://postgres@localhost:55434/postgres`, `node --import tsx --test tests/unit/transito-p92*.test.ts tests/integration/transito-p92.test.ts`.

Conteúdo: `g0_producao_antes/depois.json`, `restore_check.txt`, `testes_*.tap`, `logs/` (cargas reais), `extratores/` (scripts usados), `analise/` (investigação de layout).
