# Testes e benchmarks— P14.2

- Database guard: PASS (`current_database() = projetoeleitor_db`).
- Correção institucional: PASS; TJMA/TJMG/TJMS/TJMT estaduais e TJMMG/TJMRS/TJMSP militares.
- Typecheck `@senadotracker/db`: PASS.
- Testes unitários direcionados P14.1/P14.2: 6/6 PASS.
- Fonte real: PASS; 1595 linhas, 1.314 colunas, dicionário e seção federal parseados.
- Paridade: 130 checks, 0 falhas.
- Replay final: NO_CHANGE, 0 bytes adicionais.

## Benchmarks reais

| Contrato | p50 | p95 | p99 |
|---|---:|---:|---:|
| Overview Brasil/ano | 3,08 ms | 61,99 ms | 61,99 ms |
| Overview ramo/ano | 16,47 ms | 23,91 ms | 23,91 ms |
| Série histórica | 0,33 ms | 0,95 ms | 0,95 ms |
| Comparação de tribunais | 0,51 ms | 1,10 ms | 1,10 ms |

A meta inicial de p95 â‰¤ 500 ms foi atendida no banco local.

O typecheck global ainda falha em erros preexistentes de `tests/unit/educacao-p113.test.ts` e `tests/unit/educacao-p114.test.ts`; nenhum erro foi introduzido nos pacotes ou testes P14.1/P14.2. Smoke read-only dos domínios existentes permaneceu íntegro.
