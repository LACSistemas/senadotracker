# P9.1 — Reprodutibilidade

Tudo roda da raiz do repositório. `EXEC_DATABASE_URL` redireciona os scripts para um banco de teste; **sem ela, o alvo é o banco do Cívica (`.env`)**. Os coletores exigem `D:\Civica` montado com o GUID de `CIVICA_EXEC_VOLUME_ID`.

## Pré-checagem (somente leitura)

```
node --import tsx scripts/exec/seguranca-g0.ts --hash-sim > g0.json      # G0: banco, locks, espaço, volume, backup, fingerprints, hash do RAW do SIM
```

Backup antes de escrever:

```
pg_dump -h localhost -U <usuario> -d projetoeleitor_db -n civica_exec -Fc -f D:\Civica\backups\pre-seguranca-p91-AAAAMMDD.dump
pg_restore -l <dump>            # lista; para provar a restauração, restaure num cluster descartável e compare contagens
```

## Execução

```
node --import tsx scripts/exec/seguranca-pilot.ts migrate            # migration v2 (exec_seg_cov), idempotente
node --import tsx scripts/exec/seguranca-pilot.ts seed               # 62 definições de indicador
node --import tsx scripts/exec/seguranca-pilot.ts sim 2024 ES        # controle (ES 2024: 1.043 + 21 = 1.064)
node --import tsx scripts/exec/seguranca-pilot.ts sim-range 2013 2025
node --import tsx scripts/exec/seguranca-pilot.ts vde-fetch 2015 2026
node --import tsx scripts/exec/seguranca-pilot.ts vde 2025 ES
node --import tsx scripts/exec/seguranca-pilot.ts vde-range 2015 2026
```

Reexecutar qualquer comando é seguro: mesmo arquivo + mesma versão de parser → `NO_CHANGE`; arquivo reescrito pela fonte → nova versão no RAW e substituição da fatia com change log (`rollbackRun` exato).

## Relatórios e medições

```
node --import tsx scripts/exec/seguranca-report.ts <pasta> --g0-before reproducibilidade/g0_producao_antes.json   # cobertura, Atlas, VDE, crosswalk, armazenamento
node --import tsx scripts/exec/seguranca-perf.ts <saida.json>                                                    # consultas e planos
```

## Testes

```
# cluster descartável (porta 55433, NUNCA o banco do Cívica)
initdb -D <dir> -U postgres -A trust -E UTF8 --locale=C ; pg_ctl -D <dir> -o "-p 55433" start
set EXEC_TEST_ADMIN_URL=postgresql://postgres@localhost:55433/postgres
node --import tsx --test tests/unit/seguranca-p91.test.ts tests/unit/seguranca-p91-faults.test.ts tests/integration/seguranca-p91.test.ts tests/integration/exec-publication.test.ts
npm run typecheck
npm test
```

## Conteúdo desta pasta

| Arquivo | O que é |
|---|---|
| `g0_producao_antes.json`, `g0_producao_depois.json` | G0 e fingerprints antes/depois da carga |
| `summary_stdout.json` | saída do relatório de execução |
| `testes_exec_seguranca.tap` | TAP dos 64 testes do Executivo/Segurança |
| `logs/` | logs dos comandos reais (migrate, seed, sim, vde, republicação v2, backup) |
| `sim_seg_extract.py`, `vde_extract.py` | extratores agregadores |
| `seguranca-*.ts` | CLI, G0, relatório, desempenho |
| `analise_p91/` | scripts de investigação do layout do VDE usados nesta onda |
