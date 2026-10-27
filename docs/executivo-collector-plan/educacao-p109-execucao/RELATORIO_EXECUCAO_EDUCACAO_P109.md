# P10.9 — Hardening de produção e prontidão para exibição

**Status: PASS_WITH_CAVEATS**  
**Banco:** `projetoeleitor_db`  
**Data:** 27/10/2026

## Resumo executivo

O domínio educacional foi endurecido para serving real, com backup completo, restauração isolada, migration 20, identidade municipal determinística, rollup de programas por município, contratos de leitura e auditoria de armazenamento. O banco oficial passou de 32.244.108.435 para 32.270.511.251 bytes (delta de 26.402.816 bytes), dentro do limite de +5 GB.

O vínculo municipal não é uma tabela oficial SIAFI→IBGE: é uma correspondência exata auditada por nome normalizado + UF. Foram ligados 5.537 de 5.567 códigos; 30 permanecem sem resolução e nenhum caso ambíguo foi forçado. Por isso G2 e a prontidão final são `PASS_WITH_CAVEATS`.

## G0 — segurança, backup e restore

Foi criado backup full-data em formato custom, com SHA-256 e listagem `pg_restore` válida. O dump foi restaurado em cluster isolado na porta 55439 e validado com `SELECT current_database()`, contagens factuais e migration máxima 19 antes das alterações oficiais. O cluster foi parado após a validação e o diretório de reprodução foi mantido.

RAW/staging permanecem contratualmente em `D:\Civica`; o diretório foi confirmado nesta execução e não foi movido para o PostgreSQL.

## G1 — performance

O benchmark possui 30 repetições aquecidas por cenário. Escola, Vitória, ES e SP (UF) ficaram dentro dos alvos. São Paulo município, Brasil e benchmarks Vitória continuam acima dos alvos estritos. O diagnóstico aponta agregações nacionais SIOPE/SICONFI e fan-out de comparadores como gargalos; planos `EXPLAIN (ANALYZE, BUFFERS)` e payloads estão nos JSONs de evidência.

Não foi declarado PASS estrito de latência. O materializador de programas municipais removeu o scan repetido dos fatos para essa família, mas não resolve sozinho as agregações nacionais.

## G2 — identidade SIAFI/IBGE

A tabela `civica_exec.exec_edu_program_municipality_map` preserva código, nome source, método, status e evidência. O join de serving usa `entity_id` e `ibge7` apenas para `LINKED`; valores sem identidade ficam fora do município canônico, sem virar zero. Detalhes em `MAPEAMENTO_SIAFI_IBGE.md` e `RECONCILIACAO_PROGRAMAS_MUNICIPIOS.md`.

## G3 — serving contracts

Os contratos de escola, município, UF, Brasil, programas, cobertura e benchmarks estão implementados na camada de leitura. Cobertura, publicação, data-through e privacy são retornados como metadados. Payload Brasil medido em aproximadamente 26 MB exige paginação/on-demand no frontend futuro.

## G4 — comparabilidade

As dimensões de ano, unidade, rede, etapa, estágio financeiro e universo continuam obrigatórias. SICONFI e SIOPE não são somados; indicado, empenhado, liquidado e pago permanecem sem equivalência implícita. Benchmarks são descritivos e não ranking.

## G5 — freshness e idempotência

Migrations usam advisory lock e tabela de versões. O refresh do rollup é reconstruível e o replay inalterado preservou exatamente as contagens e o total source. Scheduler não foi ativado nesta fase; o contrato de produção exige snapshot/hash/data-through e last-known-good.

## G6 — privacidade

Read models não expõem CPF, aluno, professor, e-mail ou telefone. A matriz marca `NEEDS_LEGAL_VALIDATION` quando a granularidade ou licença exigem revisão. Não foi emitido parecer conclusivo sobre a ANPD NT 12/2023; a análise jurídica deve ocorrer antes da publicação de células potencialmente reidentificáveis.

## G7 — testes e regressão

Os testes direcionados passaram (8), falharam (0) e foram pulados (3) somente por ausência de `EXEC_TEST_ADMIN_URL`. O typecheck geral continua bloqueado por erro sintático preexistente em `scripts/p5_rebuild_global_rollup.ts`; não foi mascarado. Não houve alteração de frontend.

## G8 — armazenamento

O crescimento pós-P10.9 foi 26,3 MB. Nenhuma tabela ou dado foi apagado. O backup full-data e o restore isolado formam a recuperação mínima comprovada.

## Handoff

P10.10 pode implementar UI usando somente os contratos documentados e estados de cobertura. Deve tratar `PARTIAL`, `NOT_COLLECTED`, `SOURCE_UNAVAILABLE`, `SUPPRESSED` e `NEEDS_LEGAL_VALIDATION` distintamente, sem zeros falsos e sem chamadas diretas às fontes. P10.10 **não foi iniciado**.

## Gates

| Gate | Resultado |
|---|---|
| segurança/backup/restore | PASS |
| performance | PASS_WITH_CAVEATS |
| vínculo municipal | PASS_WITH_CAVEATS |
| serving/comparabilidade | PASS_WITH_CAVEATS |
| freshness/idempotência | PASS_WITH_CAVEATS |
| privacidade | PASS_WITH_CAVEATS |
| testes/regressões | PASS_WITH_CAVEATS |
| armazenamento | PASS |
| prontidão P10.10 | PASS_WITH_CAVEATS |

**P10.9 encerrado. Não iniciar P10.10 automaticamente.**
