# Reprodutibilidade P10.6

Banco-alvo: `projetoeleitor_db`, carregado pelo mesmo `.env`/contrato dos collectors. RAW: `D:\Civica`.

Comandos principais:

```text
node --import tsx scripts/exec/p106-programas.ts
node --import tsx scripts/exec/p106-validate.ts
node --import tsx scripts/exec/p106-siope-compat.ts
node --import tsx scripts/exec/p106-benchmark.ts
node --import tsx --test tests/unit/educacao-programas-p106.test.ts
npm.cmd test
```

Os ZIP/XLSX são baixados para `D:\Civica\raw` e identificados por SHA-256 no manifesto. O replay não baixa nem armazena o conteúdo bruto dentro do banco. O restore isolado do dump pré-P10.5 foi tentado; a role não possui `CREATEDB`, portanto a verificação foi limitada a `pg_restore --list` sem alterar o banco oficial.
