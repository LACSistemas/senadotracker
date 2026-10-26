# Relatório de execução da Educação — P10.5

## Resumo executivo

P10.5 publicou no `projetoeleitor_db` a despesa funcional da Educação (Siconfi, função 12) e a publicação separada dos fatos oficiais do SIOPE. O frontend não foi alterado. O domínio não mistura DCA, MDE, Fundeb ou SIOPE e não transforma ausência em zero.

## Respostas às questões da fase

1. A fonte funcional nacional é a DCA/Siconfi; o SIOPE é uma fonte educacional própria.
2. A função 12 é identificada por código source-native `12` e subfunções `12.xxx`.
3. EMP, LIQ, PAG e restos a pagar são colunas distintas e não somáveis.
4. Siconfi foi reprocessado de RAW existente, sem novo download.
5. SIOPE usa quatro recursos oficiais permitidos, período anual 6.
6. Remuneração e responsáveis foram deliberadamente excluídos por privacidade.
7. Cada resposta SIOPE tem RAW comprimido e SHA-256.
8. Falhas de entidade são contadas como rejeição, sem fuzzy matching.
9. SIOPE e Siconfi são publicados em tabelas/datasets distintos.
10. Subfunção ↔ função é reconciliada; divergência permanece caveat.
11. MDE/Fundeb são indicadores source-native do SIOPE, não despesas funcionais Siconfi.
12. Read models agregam por entidade, UF e ano sem N+1.
13. Cobertura expõe status e não mascara declaração ausente.
14. Reexecução idêntica da fatia ES/2024 retornou `NO_CHANGE`.
15. O banco oficial foi confirmado com `SELECT current_database()` antes da escrita.
16. P10.6 recebe contratos de leitura e semântica no `CONTRATOS_P106.md`.

## Modelo e fontes

Consulte `CONTRATOS_FINANCEIROS_EDUCACAO.md`, `REUSO_SICONFI_FUNCAO12.md` e `OPERACIONALIZACAO_SIOPE.md`. O schema v14 é aditivo e não modifica P10.1–P10.4.

## Siconfi

Foram publicadas 336 fatias Brasil/UF × 2014–2025, com `missing=0`. Os fatos são em centavos; indicadores 7101–7111 pertencem ao domínio Educação. Divergências observadas nas subfunções (notadamente 2017–2022) estão na cobertura e não foram corrigidas.

## SIOPE

A onda nacional 2017–2025 foi concluída pelo comando `publish-siope`: 243 fatias, 972 componentes e 3.395.269 fatos. O conjunto nacional foi publicado com `siope-v2`; o collector atual usa `siope-v3`, com hash semântico independente de reordenação/serialização do OData. O replay semântico ES/2024 retornou `NO_CHANGE` com 6.753 fatos. Cada resposta possui RAW gzip e SHA-256 em `D:\Civica\raw\siope`; o banco guarda somente fatos normalizados, hash e metadados. A cobertura oficial varia por ano/UF; DF e declarações ausentes permanecem explícitos.

## Indicadores e leitura

`getEducationFinanceSummary`, `getEducationFinanceByEntity`, `getSiopeEducationSummary` e `getEducationFinanceCoverage` são as consultas canônicas. O benchmark e o plano de reconciliação estão nos artefatos acompanhantes.

## Limitações

Não há soma entre Siconfi e SIOPE. O SIOPE não é consultado para remuneração. Divergências source-native não são imputadas. O dump pré-publicação foi criado em `artifacts/` porque o ACL de `D:\Civica\backups` recusou escrita.

## Gates e handoff

G0 (alvo, backup e headroom), G1 (reuso RAW), G2 (schema aditivo), G3 (semântica financeira), G4 (proveniência), G5 (reconciliação), G6 (read models), G7 (idempotência), G8 (SIOPE operacional) e G9 (regressão) estão documentados em `results.json`. A suíte completa do repositório executou 562 testes, com 454 pass, 64 skipped e 44 falhas de integrações preexistentes sem pool/fixtures (fora do escopo P10.5); os testes direcionados de finanças/typecheck passaram. P10.6 não foi iniciado automaticamente.
