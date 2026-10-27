# Relatório de execução — P10.8 Consolidação e Inteligência Educacional

Data: 27/10/2026. Banco: `projetoeleitor_db` (`projetoeleitor_user`). Sem frontend, P10.9/P10.10, lab/SQLite, commit ou push. RAW/staging permanecem em `D:\Civica`; nenhum RAW foi gravado no PostgreSQL. A letra D não estava montada no shell final, portanto o espaço livre de D não foi mensurável.

## Resultado executivo

A P10.8 consolidou P10.1–P10.7 em 51 indicadores, perfis integrados de escola, município, UF e Brasil, benchmarks dimensionais e relações analíticas descritivas. Fontes, edições, universos, grãos e estágios financeiros continuam separados; ausência, parcialidade e dado não publicável não viram zero. Resultado: **PASS_WITH_CAVEATS**.

## Indicadores e cobertura

| Família | Indicadores |
|---|---:|
| ESCOLAS_OFERTA | 4 |
| MATRICULAS_TURMAS | 6 |
| INFRAESTRUTURA | 9 |
| DOCENTES | 8 |
| APRENDIZAGEM | 4 |
| FLUXO_ESCOLAR | 7 |
| FINANCIAMENTO | 5 |
| PROGRAMAS_TRANSFERENCIAS | 4 |
| CONTRATACOES | 2 |
| OBRAS | 2 |
| **Total** | **51** |

Em 2025: 5.571 municípios no núcleo escolar; Ideb 5.568; Saeb 5.569; Siconfi 5.507; SIOPE 5.559; ambos os financiamentos 5.497; contratos em qualquer ano 3.846. O núcleo educacional completo cobre 5.568/5.571 municípios. Programas municipais ficam em 0 por ausência de chave canônica município-entidade e são expostos como `PARTIAL`.

Séries: cadastro/oferta/infra/indicadores 2007–2025; Ideb 2005–2025; Saeb 2017–2025; fluxo 2006–2025; transição 2007–2021; INSE 2019/2021/2023; SIOPE 2017–2025; programas somente 2025; contratos 2021–2026; ObrasGov em nove UFs.

## Contratos, comparabilidade e relações

Perfis de escola, município, UF e Brasil estão implementados. `OFFICIAL` e `CIVICA_DERIVED` são distintos. Comparações exigem mesmo indicador, ano/edição, unidade, rede, etapa, estágio, universo e cobertura; pares municipais são descritivos (mesma UF e matrículas de 0,5x–2x).

Relações implementadas: matrículas×internet, internet×Ideb, Siconfi pago/matrícula, transferências/matrícula e contratos/matrícula. Reconciliação real passou: Vitória oferta 77.662; internet 100%; contratos firmes/POSSIBLE Brasil 150.361/18.395, ES 1.545/234, SP 27.909/7.781. Apenas PDDE possui ligação escola–recurso por INEP (piloto de dez escolas); PNAE, PNATE, contratos e obras não são atribuídos automaticamente.

## Materialização e armazenamento

Migrações v17 (contratos/metadados), v18 (programas) e v19 (finanças de 2025). Rollups: contratos 2.442 linhas; programas 141.834; finanças 431.760. Não houve cópia de fatos nem soma de fontes/estágios.

Backup: `artifacts/projetoeleitor_p108_prepublication_20261027.dump`, custom schema-only `civica_exec`, `pg_restore --list` PASS, SHA-256 `e37b7ec24a98a942241b82a62e3d6df1ce0fcc7a9107c573b18b181114a37d94`.

PostgreSQL antes: 31.833.500.819 bytes. Depois: 32.244.108.435 bytes. Delta: 410.607.616 bytes (0,38 GiB), abaixo de +5 GiB. RAW/staging continuam fora do banco em `D:\Civica`.

## Performance

P95 (cinco repetições): escola 21,8 ms (PASS); município Vitória 49,3 ms (PASS); município São Paulo 1.003 ms (ressalva); UF ES 81,9 ms (PASS); UF SP 289,5 ms (ressalva marginal); Brasil 2.776,5 ms (ressalva); benchmarks Vitória 557,3 ms (ressalva). O diagnóstico do rollup de programas passou em 0,084 ms; misses decorrem de fan-out/agregações de grandes universos.

## Privacidade, testes e readiness

Perfis escolares e células derivadas permanecem `NEEDS_LEGAL_VALIDATION`; `NOT_PUBLICABLE` suprime exposição. Testes direcionados: 5 pass, 0 fail, 3 skipped por ausência de `EXEC_TEST_ADMIN_URL`. Reconciliação passou. Fingerprints pré/pós e backup estão em `evidencias/`; falhas históricas da suíte completa permanecem registradas e não foram mascaradas.

P10.9/P10.10: **READY_WITH_CAVEATS** — contratos, cobertura, benchmarks, paginação, séries e privacidade estão documentados; nenhuma publicação ou tela foi iniciada.

## Gates

| Gate | Estado |
|---|---|
| G0_SAFETY | PASS_WITH_CAVEATS (D indisponível no shell final) |
| G1_INDICATOR_CATALOG | PASS |
| G2_SCHOOL_PROFILE | PASS_WITH_CAVEATS |
| G3_MUNICIPAL_PROFILE | PASS_WITH_CAVEATS |
| G4_STATE_NATIONAL_PROFILE | PASS_WITH_CAVEATS |
| G5_BENCHMARKS | PASS_WITH_CAVEATS |
| G6_COVERAGE_CONTRACT | PASS |
| G7_ANALYTICAL_RELATIONS | PASS |
| G8_PERFORMANCE | PASS_WITH_CAVEATS |
| G9_DATABASE_5GB | PASS |
| G10_PRIVACY | PASS_WITH_CAVEATS |
| G11_REGRESSION | PASS_WITH_CAVEATS |
| G12_P109_P1010_READINESS | PASS_WITH_CAVEATS |

P10.8 encerra aqui; P10.9/P10.10 não foram iniciadas.
