# P9.3 — Reprodutibilidade

Da raiz do repositório. `EXEC_DATABASE_URL` redireciona os scripts para um banco de teste; **sem ela o alvo é o banco do Cívica**. Requer `D:\Civica` montado com o GUID de `CIVICA_EXEC_VOLUME_ID`, Python com `pymupdf` (PyMuPDF), `openpyxl`, `numpy`; Node 22 com `tsx`.

```
node --import tsx scripts/exec/efetivos-g0.ts > g0.json                                   # G0 (fingerprints de Saúde, P9.1, P9.2, entidades, contratos, Legislativo)
pg_dump -n civica_exec -Fc -f D:\Civica\backups\pre-efetivos-AAAAMMDD.dump                 # backup antes de escrever (restaurar em cluster isolado e comparar contagens)
node --import tsx scripts/exec/efetivos-pilot.ts migrate     # nenhuma migração nova: confere a versão do schema
node --import tsx scripts/exec/efetivos-pilot.ts seed        # 62 definições (5001–5304), idempotente
node --import tsx scripts/exec/efetivos-pilot.ts fetch       # 5 fontes → RAW (SSD) com hash e manifesto
node --import tsx scripts/exec/efetivos-pilot.ts all         # FBSP + ESTADIC 2019/2023 + MUNIC 2019/2023 (27 UFs cada)
node --import tsx scripts/exec/efetivos-pilot.ts siape 202001,202101,202201,202301,202401,202501,202601,202607,202608
node --import tsx scripts/exec/efetivos-report.ts <pasta>    # CSVs de cobertura + reconciliacao_institucional.md
node --import tsx scripts/exec/efetivos-perf.ts <saida.json> # desempenho dos read models
```

Reexecutar é seguro (59 fatias `NO_CHANGE` na verificação). O SIAPE reutiliza o agregado já no RAW (sem baixar); `refresh` força novo download, agregação e comparação por hash.

**Testes** (cluster descartável; `lc_messages = 'C'` para os testes antigos que casam mensagens em inglês):

```
initdb -D D:\Civica\pgtest_xxx -U postgres -A trust -E UTF8 ; pg_ctl -D … -o "-p 55435" start
set EXEC_TEST_ADMIN_URL=postgresql://postgres@localhost:55435/postgres
node --import tsx --test tests/unit/efetivos-p93.test.ts tests/unit/efetivos-p93-faults.test.ts tests/integration/efetivos-p93.test.ts
npm test        # suíte completa: 426 testes, 396 aprovados, 0 falhas, 30 ignorados
```

Conteúdo: `g0_antes.json` / `g0_depois.json` (fingerprints idênticos), `restore_check.txt`, `logs/` (cargas e replay em **produção**; o ensaio geral foi feito no cluster isolado), `extratores/` (cópias dos scripts Python), `analise/` (dicionários oficiais, tabelas do PDF extraídas e imagens das páginas 14 e 22 usadas na conferência visual de SP e RS), `testes_suite_completa.tap`, `next_build_isolado.log` (+ três logs de tentativas anteriores que falharam por caminho/ambiente).

Sem dados pessoais em nenhum arquivo desta pasta.
