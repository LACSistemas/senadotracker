# P10.9.1 — Excelência operacional da Educação

**Status: PASS_WITH_CAVEATS**  
**Banco:** `projetoeleitor_db`  
**Schema:** `civica_exec`  
**Data:** 27/10/2026

## Resultado executivo

Foi criada e publicada a migration 21 com serving compacto, sem alterar fatos anteriores. O overview Brasil caiu de aproximadamente 26 MB no perfil legado para 11.613 bytes; UF SP para 12.912 bytes; município São Paulo para 759 bytes. Os contratos compactos passaram os limites definidos em 100 execuções aquecidas.

O resultado não é PASS integral porque: (a) não foi localizada tabela oficial SIAFI→IBGE, apenas vínculo derivado exato; (b) a suíte completa histórica permanece vermelha; (c) o typecheck global ainda contém erro sintático preexistente; (d) o espaço livre em C: está abaixo de 20 GiB; (e) o fallback last-known-good ainda precisa ser ligado ao control plane.

## G0 — baseline e recuperação

O backup full-data P10.9 existente foi validado previamente por SHA-256 e `pg_restore --list`; foi usado para o cluster isolado `.p109_pg_cluster` na porta 55439. A migration 21 e o refresh foram ensaiados no isolado antes da aplicação oficial. O cluster isolado foi parado após os testes.

Banco oficial final: migration 21, tamanho 32.308.554.899 bytes. RAW/staging continuam em `D:\Civica`; nenhuma fonte original foi alterada.

## G1 — profiling

O profiling registrou duração total, duração acumulada das queries, composição, serialização, payload e contagem de consultas. O perfil legado São Paulo executou 48 queries e serializou 499.975 B; o legado Brasil executou fan-out de famílias e chegou a dezenas de MB. Os contratos compactos usam 1 query por overview/seção/série/lista e 3 na comparação.

O tempo acumulado de queries do perfil legado pode exceder o wall-clock porque as famílias são executadas em paralelo; isso está registrado no JSON, não escondido como composição negativa.

## G2/G3 — serving compacto e performance

| Contrato | p50 | p95 | p99 | payload | queries | Gate |
|---|---:|---:|---:|---:|---:|---|
| Overview Brasil | 0,48 ms | 0,65 ms | 1,06 ms | 11.613 B | 1 | PASS |
| Overview UF SP | 0,43 ms | 0,68 ms | 0,89 ms | 12.912 B | 1 | PASS |
| Overview município grande | 0,22 ms | 0,37 ms | 0,42 ms | 759 B | 1 | PASS |
| Overview município pequeno | 0,22 ms | 0,36 ms | 0,54 ms | 745 B | 1 | PASS |
| Comparação Vitória | 0,95 ms | 1,38 ms | 1,54 ms | 24.312 B | 3 | PASS |
| Seção financeira SP | 0,45 ms | 0,63 ms | 0,75 ms | 9.870 B | 1 | PASS |
| Série Brasil | 0,27 ms | 0,41 ms | 0,46 ms | 3.003 B | 1 | PASS |
| Lista escolar | 0,83 ms | 1,06 ms | 1,37 ms | 2.307 B | 1 | PASS |

Os números são 100 repetições aquecidas no banco oficial. Medição fria separou aquisição de pool (22–142 ms), primeira query (2,6–4,7 ms) e query aquecida (0,8–1,0 ms).

## G4 — carga

No cluster isolado, 1/5/10/25/50 concorrentes produziram respectivamente 0, 0, 0, 0 e 0 erros. A 10 concorrentes, p95 foi 5,64 ms; a 50, 13,23 ms e p99 146,69 ms. Capacidade sustentável medida: 50 concorrentes neste host isolado; não equivale a capacidade pública de internet.

## G5 — materializações

`exec_edu_overview_rollup` contém 5.599 linhas e `exec_edu_series_rollup` 106.331 pontos. O refresh é transacional, aditivo e protegido por advisory lock. O overview contém apenas agregados por estágio/categoria; detalhes devem ser buscados em seções/listas específicas.

## G6 — território e finanças

Não foi encontrada tabela oficial SIAFI→IBGE no projeto, fontes locais ou `D:\Civica`. Portanto, 0 vínculos são classificados como `OFFICIAL_CODE`; 5.537 são `EXACT_NAME_UF_DERIVED` e 30 permanecem `UNRESOLVED`.

A reconciliação Portal fecha exatamente:

- total: 563.222 linhas / 6.581.406.260.075 centavos;
- ligados: 471.356 / 5.416.059.247.155;
- sem código: 89.547 / 1.142.224.700.080;
- código não resolvido: 2.319 / 23.122.312.840.

As categorias somam todos os centavos. A divergência de quatro linhas no rollup é explicada por quatro linhas `pdde_info` (Brasil/ES × DUE/PAID), excluídas no relatório filtrado para `portal_transferencias`.

## G7 — testes

Migration, refresh, replay, contratos, benchmark, carga e build passaram. O typecheck global segue bloqueado por erro sintático preexistente. A suíte completa histórica permanece 470 pass / 44 fail / 70 skipped; portanto não há declaração de regressão integral verde.

## G8/G9 — privacidade e resiliência

Os contratos compactos não carregam CPF, aluno, professor ou identificador individual protegido. `NULL`, supressão e ausência continuam distintos de zero. `NEEDS_LEGAL_VALIDATION` permanece bloqueado para exposição pública. O refresh transacional mantém o estado anterior em caso de falha; o fallback last-known-good no control plane ainda é trabalho pendente.

## G10 — armazenamento

Delta oficial desde o baseline P10.9: 64.446.464 bytes, dentro do teto de 5 GB. C: possui 3.257.856.000 bytes livres, abaixo do mínimo operacional de 20 GiB; D: 422.447.976.448 bytes livres. Nenhuma exclusão foi feita.

## Handoff P10.10

P10.10 pode consumir os contratos compactos documentados, com estados de coverage, frescor e privacidade. Deve evitar o perfil legado na primeira pintura, não acessar fontes externas e manter bloqueios jurídicos. P10.10 não foi iniciado.

## Gates

| Gate | Resultado |
|---|---|
| G0_SAFETY | PASS |
| G1_PROFILING | PASS |
| G2_COMPACT_SERVING | PASS |
| G3_PERFORMANCE | PASS |
| G4_LOAD | PASS_WITH_CAVEATS |
| G5_MATERIALIZATIONS | PASS_WITH_CAVEATS |
| G6_TERRITORIAL_RECONCILIATION | PASS_WITH_CAVEATS |
| G7_TESTING | PASS_WITH_CAVEATS |
| G8_PRIVACY | PASS_WITH_CAVEATS |
| G9_RESILIENCE | PASS_WITH_CAVEATS |
| G10_STORAGE | PASS_WITH_CAVEATS |
| G11_PRODUCTION | PASS_WITH_CAVEATS |

**P10.9.1 encerrado. Não iniciar P10.10 automaticamente.**
