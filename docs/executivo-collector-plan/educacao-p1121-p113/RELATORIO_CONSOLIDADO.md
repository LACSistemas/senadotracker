# P11.2.1 + P11.3 — Relatório consolidado

**Data da execução:** 27/10/2026  
**Banco:** `projetoeleitor_db` · **schema:** `civica_exec`  
**RAW/staging:** `D:\Civica`  
**Frontend:** não alterado · **P11.4/ENEM:** não iniciado

## Resultado executivo

`P11_2_1_STATUS = PASS_WITH_CAVEATS` e `P11_3_STATUS = PASS_WITH_CAVEATS`.

O Censo Superior 2022–2024 está persistido com chave de oferta que inclui
`TP_DIMENSAO`, territorialização sem município inventado e contratos de leitura
parametrizados. Os indicadores oficiais IGC, CPC, Conceito Enade e IDD foram
coletados em 16 planilhas agregadas do INEP (2018, 2021, 2022 e 2023), com
crosswalk por códigos oficiais e estados `OFFICIAL_LINK`/`UNRESOLVED`.

As Sinopses Estatísticas 2022–2024 continuaram indisponíveis pelas rotas de
download testadas (502/erro de socket). Portanto, a paridade externa não é
declarada e a publicação pública permanece bloqueada até revisão metodológica e
jurídica das limitações. As páginas oficiais usadas para a descoberta e a
proveniência são o [catálogo de Indicadores de Qualidade do INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior), a página de [microdados do Enade](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade) e o [Censo da Educação Superior](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior).

## Respostas objetivas

1. **Sinopses 2022–2024:** não recuperadas. As tentativas oficiais estão documentadas em `educacao-p1121-execucao/SINOPSES_OFICIAIS_EVIDENCIAS.md`; o bloqueio é externo.

2. **Todos os totais reconciliaram?** Internamente, sim: source rows, linhas válidas, vínculos e agregações do banco fecham. Externamente, não foi possível confrontar as células das Sinopses; A2 permanece `PARTIAL`.

3. **`TP_DIMENSAO` evita dupla contagem?** Sim para a identidade persistida: a chave é `(year, co_ies, co_curso, co_municipio, tp_modalidade, tp_dimensao)`. Dimensões 1/2 são a partição territorial e 3/4 a partição nacional; o serving não soma município/UF/Brasil como categorias independentes. A semântica oficial das Sinopses ainda precisa ser confirmada.

4. **10.227.266 matrículas de 2024:** confirmadas como soma source-native do Censo e reproduzidas no banco; não confirmadas contra a célula externa da Sinopse porque o arquivo não foi recuperado.

5. **EAD sem município:** 11.769 registros de oferta de 2024 (`TP_DIMENSAO` 3/4); eles representam 2.539 matrículas. Não são atribuídos artificialmente a município.

6. **EAD sem UF:** os mesmos 11.769 registros de 2024 têm `uf IS NULL`; não há UF observada para essa partição nacional.

7. **Municípios com oferta territorial comprovada:** 3.551 em 2024, medidos em `exec_edu_higher_territory_year` (`scope=4`).

8. **Contratos P11.2 sob concorrência:** leituras sequenciais aquecidas ficaram abaixo das metas SQL. Carga concorrente de 5/10/25/50 clientes não foi executada contra o banco oficial; o gate é `PASS_SQL_WARM_PARTIAL_LOAD`, não um PASS de carga concorrente.

9. **IGC mais recente:** edição 2023.

10. **IES com IGC divulgado em 2023:** 2.101 linhas source-native; 2.077 com vínculo oficial a `CO_IES`; 24 permanecem `UNRESOLVED`.

11. **Cursos com CPC em 2023:** 9.812 linhas válidas; 9.803 vínculos oficiais; 1 não resolvido; 9.380 possuem faixa publicada.

12. **Cursos com Conceito Enade em 2023:** 9.812 linhas válidas; 9.803 vínculos oficiais; 1 não resolvido; linhas sem conceito permanecem com `band = NULL`.

13. **Cursos com IDD em 2023:** 9.812 linhas válidas; 9.803 vínculos oficiais; 1 não resolvido; valores contínuos e faixas são separados.

14. **Anos/ciclos disponíveis:** 2018, 2021, 2022 e 2023 para IGC, CPC, Enade e IDD. Isso não é uma série anual completa.

15. **Vínculos oficiais resolvidos:** no ciclo 2023, 2.077 IGC-IES e 9.803 vínculos para cada indicador de curso (CPC, Enade e IDD). Somando fatos de curso das três famílias, são 29.409 vínculos, com duplicação intencional entre indicadores diferentes; não é uma contagem de cursos únicos.

16. **Ambíguos:** zero em todas as 16 edições ingeridas. Não há fuzzy matching.

17. **Inconsistências de identidade:** há não correspondências (`UNRESOLVED`) de códigos source-native, mas nenhuma colisão ambígua. Elas são preservadas e contabilizadas; não são atribuídas por nome.

18. **Cobertura por UF:** 27 UFs em todas as edições de CPC, Enade e IDD. IGC é fato de IES e não recebe município/UF artificial no fato de qualidade.

19. **Cobertura municipal demonstrada:** no ciclo 2023, CPC/Enade/IDD cobrem 718 municípios cada. Nos ciclos anteriores, CPC cobre 802/813/779 municípios (2018/2021/2022), e Enade/IDD 761/813/781. Essa é a cobertura observada nos arquivos, não uma estimativa do universo nacional.

20. **Benchmarks válidos:** somente dentro do mesmo indicador, ciclo, área, grau, modalidade quando publicada, universo elegível, metodologia e escala. O read layer não cria uma nota universal nem mistura IGC/CPC/Enade/IDD.

21. **Exploração por curso sem ranking inventado:** sim. É possível consultar curso, ciclo, área, valor contínuo, faixa, ausência e histórico. Ordenações descritivas devem manter o universo compatível e não podem ser apresentadas como “melhores do Brasil”.

22. **Latência p95/p99 (100 repetições aquecidas):** P11.2 overview 0,192/0,267 ms; série 0,161/0,192 ms; busca IES 16,098/17,001 ms; busca curso 2,141/2,412 ms. P11.3 overview IES 0,223/0,284 ms; overview curso 0,434/0,541 ms; território 0,358/0,509 ms. Cold e concorrência não foram medidos.

23. **Crescimento real do banco:** aproximadamente 137 MB na medição pré/pós da fase; tamanho pós-execução observado de 33.768.983.699 bytes (≈33,70 GB). As novas tabelas de qualidade ocupam aproximadamente 154 MB (curso ≈144 MB; IES ≈10 MB). RAW permanece fora do PostgreSQL.

24. **Espaço livre:** C: 35.602.989.056 bytes (≈35,6 GB); D: 407.550.652.416 bytes (≈407,6 GB), na evidência de segurança. O diretório PGDATA/WAL não pôde ser revelado pelo usuário conectado por falta de privilégio; isso é uma limitação documentada, não uma criação de cluster.

25. **Pendências para exposição pública:** reconciliação externa com Sinopses; revisão jurídica/metodológica; revisão dos vínculos `UNRESOLVED`; decisão editorial sobre indicadores sem conceito e quebras de ciclo; eventual medição de carga concorrente fora do banco oficial. Por isso `READY_FOR_PUBLICATION = NO`.

26. **ProUni/FIES:** a infraestrutura está pronta para a próxima fase (`READY_FOR_P11_4_ACCESS_PROGRAMS = YES`), mas nenhum collector ou dado de acesso foi iniciado neste mandato.

27. **Frontend interno de ensino superior/qualidade:** sim, tecnicamente (`READY_FOR_QUALITY_FRONTEND = YES`), consumindo os contratos parametrizados e expondo cobertura/ausência. Nenhuma alteração de frontend foi feita aqui.

## Gates e evidências

### P11.2.1

| Gate | Resultado |
|---|---|
| A0 segurança | PASS |
| A1 Sinopses oficiais | BLOCKED_EXTERNAL |
| A2 reconciliação externa | PARTIAL |
| A3 `TP_DIMENSAO`/EAD | PASS_WITH_CAVEATS |
| A4 integridade territorial | PASS |
| A5 read contracts | PASS |
| A6 performance | PASS SQL / PARTIAL carga |
| A7 resiliência | PASS_WITH_CAVEATS |
| A8 testes | PASS |

### P11.3

| Gate | Resultado |
|---|---|
| B0–B2 segurança, inventário e coleta | PASS |
| B3 identidade/crosswalk | PASS_WITH_CAVEATS |
| B4 modelo | PASS |
| B5 comparabilidade | PASS_WITH_CAVEATS |
| B6 série histórica | PASS_WITH_CAVEATS |
| B7 paridade source-row | PASS com `UNRESOLVED` documentados |
| B8 provas territoriais | PASS |
| B9 read performance | PASS |
| B10–B12 resiliência, privacidade e testes | PASS |

Migrations v22 e v23 estão aplicadas no banco oficial. Typecheck de `@senadotracker/db` e `@senadotracker/collector` passou; testes unitários P11.2/P11.3 passaram. A evidência reproduzível está em `educacao-p1121-p113-evidence.json`, e os relatórios detalhados permanecem nas pastas `educacao-p112-execucao`, `educacao-p1121-execucao` e `educacao-p113-execucao`.

## Encaminhamento

P11.2.1 e P11.3 ficam encerradas com ressalvas explícitas. O próximo passo permitido é revisão das pendências externas/jurídicas e, depois, P11.4 (ProUni/FIES) ou frontend interno, conforme decisão do produto. Nenhuma dessas fases foi iniciada automaticamente.
