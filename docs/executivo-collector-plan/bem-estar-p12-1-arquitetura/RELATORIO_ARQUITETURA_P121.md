# P12.1 — Arquitetura definitiva de Bem-Estar

**Status:** `PASS_WITH_CAVEATS`  
**Banco auditado:** `projetoeleitor_db` / `civica_exec` (somente leitura)  
**Escopo:** arquitetura, contratos e provas controladas. Nenhuma migration, coleta, backfill, API, frontend ou escrita foi executada.

## Resumo executivo

A P12.1 fecha o desenho para que Bem-Estar seja publicado como observações estatísticas versionadas, e não como uma tabela achatada de “indicadores sociais”. A decisão é **C: staging especializado no RAW/staging em `D:\Civica`, fatos canônicos publicados no modelo genérico `exec_ind_*`, e tabelas especializadas somente quando a granularidade da fonte não cabe no indicador escalar**.

O modelo existente já fornece as primitivas corretas: `exec_entity`/`exec_entity_external_id` para território, `exec_ind_def`/`exec_ind_value`/`exec_ind_latest` para fatos, `exec_ingestion_run`/`exec_raw_manifest`/`exec_publication` para proveniência e last-known-good, e contratos de source-run para Prouni/Fies/Capes. O banco observado tem 32 GB; `exec_ind_value` ocupa aproximadamente 2,73 GB, portanto não é aceitável carregar microdados sociais detalhados quando um agregado oficial atende à pergunta.

Bem-Estar não cria um índice Cívica nem um ranking nacional. A camada editorial consumirá indicadores atômicos com comparabilidade declarada. Medianas, percentuais e taxas nunca serão somados; fluxos, estoques, pessoas, famílias e pagamentos continuam entidades semânticas distintas.

## Estado auditado

- P12 tem 40 linhas no catálogo, 32 com município marcado `sim`, 5 `parcial` e 2 `não universal`; o texto executivo que diz 39 é uma inconsistência documental registrada, não uma nova contagem.
- P12 tem 18 entradas no CSV de fontes e 15 famílias na matriz territorial. Elas não são o mesmo universo: organização, sistema, dataset, recurso, edição e família de coleta foram separados em `CONTRATOS_FONTES.md`.
- `exec_entity` contém 5.631 registros: 1 Brasil, 5 regiões (kind 2), 27 UFs, 5.571 recortes municipais e 27 agregados de UF (kind 5). Os cinco registros que faltavam na soma do relatório são as regiões Norte, Nordeste, Sudeste, Sul e Centro-Oeste.
- Alto Rio Novo existe como IBGE `3200359`; a ausência relatada em P12 veio da consulta ao código incorreto `3200506`. Boa Esperança do Norte (`5101837`) e Brasília (`5300108`) também estão presentes.
- `exec_entity_version` tem apenas um registro; a identidade corrente é boa para serving, mas a história de malha precisa ser carregada por uma fase posterior antes de publicar séries territorialmente incompatíveis.
- Não há fatos Prouni/Fies publicados (`exec_prouni_fact=0`, `exec_fies_fact=0`); isso permanece fora do escopo de Bem-Estar e não foi reaberto.

## Alternativas avaliadas

1. **Somente `exec_ind_*`:** rejeitada para staging, porque RAIS, Caged, CadÚnico e Censo SUAS têm chaves/dimensões próprias e retificações que não devem desaparecer antes da agregação.
2. **Seis famílias de fatos publicadas:** rejeitada como regra; criaria duplicação e contratos de leitura diferentes para medidas escalares.
3. **Staging especializado + fatos publicados normalizados (decisão C):** aprovada. O staging preserva chaves e layout source-native no D:, enquanto os fatos editoriais usam `exec_ind_*`; fatos especializados só entram quando a pergunta exige entidade não escalar (por exemplo, equipamento SUAS ou classe de faixa).

## Arquitetura proposta

```text
fonte oficial -> D:\Civica\raw\bem-estar\<família>\<edição>
             -> D:\Civica\staging\bem-estar\<run> (imutável, hash)
             -> validação de schema/território/semântica
             -> exec_ingestion_run + exec_raw_manifest
             -> agregação atômica -> exec_ind_value
             -> publication(dataset, UF, competência) -> exec_ind_latest
             -> read model compacto (futuro) -> API/frontend (P12.8)
```

Cada família pode publicar independentemente. Uma falha de RAIS não bloqueia Censo ou proteção social. O `exec_publication` é o limite transacional; a revisão anterior permanece ativa até a nova fatia passar todos os gates.

## Decisões não negociáveis

- RAW/staging pesado somente em `D:\Civica`; PostgreSQL recebe fatos agregados, metadados e hashes.
- Identidade territorial por código IBGE7 oficial; nenhum fuzzy matching.
- `NULL`, ausência, supressão, não aplicável, bloqueio e revisão são estados distintos de zero.
- Censo 2022 (amostra/preliminar quando assim publicado) nunca será rotulado como universo censitário sem o metadado correspondente.
- Gini, medianas, percentuais e taxas só são comparáveis quando universo, período, unidade e denominador são compatíveis.
- Não manter CPF, NIS ou microdados identificáveis.

## Riscos e limitações

1. RAIS/Caged exigem estratégia de arquivos grandes, retificações e município do estabelecimento; continuam `SOURCE_DOCUMENTED` até prova de recurso e layout.
2. MDS/Censo SUAS/SINISA têm documentação pública, mas os recursos concretos ainda precisam de amostra legítima e dicionário antes de `READY_FOR_COLLECTOR`.
3. A malha histórica do IBGE não está representada de forma suficiente em `exec_entity_version`; P12.2 deve tratar crosswalk e validade temporal antes de séries 2022/2026 misturadas.
4. O orçamento de armazenamento é estimativa de arquitetura, não medição de uma coleta P12.1.

## Gates P12.1

| Gate | Estado | Evidência/decisão |
|---|---|---|
| G0 repositório/banco auditados | PASS | código, DDL e SELECTs somente leitura; banco correto |
| G1 inconsistências P12 | PASS | auditoria reproduzível em `AUDITORIA_P12_CORRECOES.md` |
| G2 território | PASS_WITH_CAVEATS | tipos reais e casos IBGE provados; malha histórica pendente |
| G3 contrato estatístico | PASS | campos, universos, medidas e ausências especificados |
| G4 modelo compatível | PASS | reuso de `exec_ind_*`, publication e source-run |
| G5 fontes/proveniência | PASS_WITH_CAVEATS | contratos separados; novas fontes ainda não prontas para coleta |
| G6 MVP atômico | PASS | 20 métricas atômicas em CSV, dez grupos preservados |
| G7 comparabilidade/ausência | PASS | regras explícitas e razões estruturadas |
| G8 publicação/revisão | PASS | last-known-good e rollback aderentes ao código existente |
| G9 armazenamento/performance | PASS_WITH_CAVEATS | orçamento e metas propostas; sem benchmark de coleta |
| G10 read models | PASS | interfaces TypeScript propostas sem alterar rotas |
| G11 roadmap | PASS | dependências e critérios de aceite definidos |
| G12 segurança operacional | PASS | zero escrita, zero coleta, zero mudança de frontend |

## Saída

`ARCHITECTURE_READY=YES` · `TERRITORIAL_CONTRACT_READY=YES` · `STATISTICAL_CONTRACT_READY=YES`  
`P12_2_READY=YES` **somente como autorização condicional**: iniciar pelo IBGE renda/moradia após validação do recurso; P12.2 não foi iniciada.

