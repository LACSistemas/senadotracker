# Relatorio de execucao P14.4

**P14.4 = PASS_WITH_CAVEATS.** A vertical STJ foi publicada em `projetoeleitor_db.civica_jud`, usando apenas o CKAN oficial e RAW em `D:\\Civica\\judiciario\\stj`.

## Resultado real

- Precedentes: 2369 registros canonicos de 2410 linhas, com 41 duplicatas de fonte.
- Processos de precedentes: 5402 registros canonicos de 5562 linhas; todos ligados ao precedente por `sequencialPrecedente`.
- Espelhos de acordaos: 231 registros de duas secoes no recurso `20260930.json`; a cobertura e um recorte controlado, nao o universo de todos os orgaos.
- Metadados de decisoes: 2644 registros do recurso `metadados20261013.json` (publicacao ate 13/10/2026).
- Relacoes verificadas: 5419; orgaos estruturados: 2; nomes nominais de relatores/ministros: 72.

## Limites

O PostgreSQL guarda metadados compactos, ementas e referencias; inteiros teores permanecem no RAW oficial. Nomes de ministros sao identidade nominal source-native, sem inferencia de pessoa nacional. Espelhos e decisoes sao explicitamente marcados como cobertura parcial por periodo/orgao. P14.5 e P14.7 nao foram iniciadas.

## Operacao

A primeira execucao publicou a revisao `p144-stj-20261104`; o replay seguinte foi **NO_CHANGE** e cresceu 0 bytes. Crescimento persistente medido: 18.61 MB, restante do envelope: 81.39 MB.
