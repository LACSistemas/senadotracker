# Retenção de artefatos

Auditoria e limpeza executadas em 2026-10-01.

O diretório passou de 289 arquivos / 17.103.082.722 bytes para 234 arquivos /
593.413.706 bytes. Foram removidos 55 arquivos e 16.509.669.016 bytes
(aproximadamente 15,37 GiB).

Após a limpeza restam 38 screenshots finais, 1 SQLite reduzido de benchmark e
os dois dumps PostgreSQL históricos. Não resta nenhuma cópia local do banco
SQLite completo.

## Mantidos

- relatórios finais e resultados de fases (`r1`–`r4`, paridade global, cutover,
  restore e auditorias de conteúdo);
- logs e JSONL que sustentam reconciliações ou reexecuções históricas;
- dumps PostgreSQL de restore/cutover;
- `artifacts/proposicoes-snapshot-reduzido.sqlite`, usado pelos benchmarks
  documentados;
- screenshots finais de `comissoes-v3`,
  `screenshots-proposicoes-explorar-final` e
  `proposicoes-id-audit-after`.

## Removidos

Foram removidas apenas cópias locais regeneráveis ou superseded:

- `artifacts/fts-only.sqlite` e sidecars;
- `artifacts/propositions-experiment.sqlite` e sidecars;
- `artifacts/postgres-parity/senadotracker-parity.sqlite` e sidecars;
- JSONs temporários `dump-case-*`, `tmp-*` e resultados vazios de benchmarks;
- screenshots antigos ou duplicados de explorações já substituídas pelos
  conjuntos finais.

Os dois dumps PostgreSQL de cutover e pré-delta foram mantidos porque ainda
servem à evidência de restore e aos watermarks históricos. O snapshot SQLite
reduzido de 61 MB também foi mantido porque é a entrada dos benchmarks
documentados; ele não é um caminho de runtime.

O SQLite autoritativo não é apagado: permanece no arquivo externo definido em
[`sqlite-baseline-archive.md`](sqlite-baseline-archive.md), com tamanho e SHA256
registrados. Comparators históricos continuam sendo baseline read-only e devem
receber `CIVICA_SQLITE_BASELINE_PATH` apontando para esse arquivo externo.

Alguns scripts históricos ainda contêm o literal do antigo caminho
`artifacts/postgres-parity/senadotracker-parity.sqlite`; eles são tooling de
reconciliação arquivado, não runtime. A cópia local foi removida para evitar
confundi-la com uma fonte canônica. Reexecuções devem ser adaptadas para usar o
baseline externo documentado.

Arquivos em `artifacts/` continuam ignorados pelo Git; a limpeza não removeu,
reverteu ou reclassificou código-fonte nem relatórios rastreados.
