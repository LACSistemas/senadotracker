# Comparação dos modelos PostgreSQL (A, B, C e D) — revisão 2

Data: 2026-10-19 · Decisão pedida: como organizar dados de 27 UFs e 5.571 municípios no mesmo PostgreSQL. Esta análise usa números **medidos** (banco atual, P8, experimento de histórico no ES) e deixa explícito o que é estimativa.

## 1. Evidências usadas

| Evidência | Valor | Fonte |
|---|---|---|
| Tabelas / partições hoje | 216 / **0** | auditoria 19/10 |
| Maior tabela do banco | 2,37 mi linhas (`proposal_authors`), 2,5 GiB com `raw_objects` | auditoria 19/10 |
| Latência de consultas existentes (frio) | 49–108 ms em leituras indexadas por Casa | `EXPLAIN ANALYZE` |
| Concentração por UF (CNES, 2026-09) | SP 23,2%; MG 12,9%; RS 8,6%; RJ 7,9%; mediana 9.467 estabelecimentos/UF; razão máx/mediana ≈ 12 | arquivos `ST*2609` |
| Concentração em `civica_state` | SP = 93% das proposições; SC = 67% das despesas | auditoria |
| Maiores tabelas da Saúde Fase 1 | `exec_sau_hosp_mes_subgrupo` 5,2 mi linhas (~0,7 GiB); `exec_sau_cnes_equip_v` 3,5 mi; `exec_ind_value` 4,3 mi | cálculo |
| Cenário C (opcional) | `hospital × procedimento × mês` ≈ 36 mi linhas (~3,9 GiB); `hospital × residência × mês` ≈ 12 mi | P8 |
| Histórico CNES por mudança, ES 2013-01…2026-09 (165 competências) | leitos: 169.703 linhas de snapshots → **4.271** versões (2,5%); estabelecimentos: 1.220.612 → **38.916** (3,2%); equipamentos: 3.273.769 → **70.733** (2,2%) | experimento desta execução |

## 2. Os quatro modelos

### Modelo A — tabelas físicas por UF (`saude_es`, `saude_rj`…)

| Critério | Avaliação |
|---|---|
| Nº de tabelas | 12 tabelas de fato × 27 UFs = **324** tabelas (+ ~2,3 índices cada ≈ 745); hoje o banco inteiro tem 216 tabelas. Por município seria 5.571 × 12 = **66.852** tabelas: inviável (catálogo `pg_class`, autovacuum, `ANALYZE`, planejamento). |
| Consulta nacional (itens 11 e 12 da lista de consultas) | `UNION ALL` de 27 tabelas gerado dinamicamente ou *view* sobre 27 tabelas; o planejador não faz *pruning* em views de `UNION ALL` sem `CHECK` em cada tabela; custo de plano cresce linearmente. |
| Migração | Toda mudança de esquema × 27 e risco de deriva entre UFs (o repositório já tem `schema_drifts` e `schema_migrations` para evitar isso). |
| Atualização por UF | **Excelente** (`TRUNCATE`/`INSERT` ou *swap* de tabela por UF, sem tocar nas outras). |
| Deduplicação e identidade | Pior caso: o mesmo estabelecimento/município pode existir em UFs vizinhas (residência × atendimento) e não há chave única global. |
| Novos domínios | Cada domínio × 27 outra vez (Educação +27×N). |
| Armazenamento | Igual ao B + fragmentação (27 conjuntos de páginas parciais, índices de 27 raízes). |
| Veredito | **Rejeitado.** O único benefício (isolamento da escrita por UF) é obtido em B/D por ponteiros de publicação e *upsert* por fatia. |

### Modelo B — tabelas nacionais compartilhadas (sem partições)

* Tabelas únicas com `entity_id`/`uf` e `competence` na chave: 12 tabelas de fato + dimensões. Índices compostos por território e período: `(cnes, competence)` para hospital, `(entity_id, indicator_id, period)` para município, `(indicator_id, period, entity_id)` para comparações nacionais.
* Tamanho máximo na Fase 1: 5,2 mi linhas (~0,7 GiB). O banco atual já responde em ~50–110 ms (frio) consultas indexadas sobre tabelas de 1–2,4 mi linhas com ~1 GiB.
* **Unicidade global**, `ON CONFLICT` e chaves estrangeiras funcionam sem restrições.
* Atualização por UF: *upsert* idempotente apenas das linhas que mudaram + remoção das que sumiram (`NOT EXISTS` contra a fatia em staging), tudo em uma transação com *advisory lock* por `(dataset, uf)`. Bloqueia apenas escritores da mesma fatia; leitores nunca esperam (MVCC). Custo: bloat controlado por `autovacuum` — mitigado porque só linhas alteradas geram versões.
* Consultas por UF em tabelas cuja chave começa por estabelecimento/município exigem coluna `uf` e índice `(competence, uf)` para operar fatias (custo medido no cálculo: ~22 B por linha em `exec_sau_hosp_mes_subgrupo`).
* Veredito: **suficiente para a Fase 1**.

### Modelo C — particionamento nativo

Alternativas avaliadas para o maior fato (`exec_sau_hosp_mes_subgrupo`, 5,2 mi linhas):

| Estratégia | Partições | Linhas/partição | Pruning útil? | Problemas |
|---|---:|---:|---|---|
| `LIST (uf)` | 27 | 5,2 mi ÷ 27 ≈ 192 mil (SP ≈ 23% ≈ 1,2 mi; RR ≈ 0,3%) | Só quando a consulta traz `uf`. Página de **hospital** traz `cnes`, não `uf`: varre as 27 partições (27 sondagens de índice). | PK precisa conter `uf`; hospital consultado por `(cnes, competence)` deixa de ser PK única; partições desiguais |
| `RANGE (competence)` por ano | 14 (2013–2026) + atual | ≈ 370 mil | Sim para séries e janelas de tempo; **série completa de um hospital desde 2013 toca 14 partições** | Consulta nacional "último mês" poda bem; "evolução desde 2013" não poda |
| `RANGE` por ano × `LIST (uf)` | 14 × 27 = **378** | ≈ 13,7 mil | Raramente | Mais partições que linhas úteis por partição; planejamento e catálogo piores; **rejeitado** |
| Sem partição, índice `(cnes, competence)` | 0 | 5,2 mi | Índice B-tree profundidade 3 | Nenhuma |

Impactos genéricos (PostgreSQL 17): a chave primária e qualquer `UNIQUE` **precisam incluir a chave de partição**; `INSERT … ON CONFLICT` exige que o alvo cubra a chave de partição; chaves estrangeiras *para* tabelas particionadas são permitidas, mas índices são locais por partição (consultas sem a chave consultam N índices); *pruning* só ocorre com predicado na chave; retenção e reversão por partição (`DROP`/`DETACH`) são o grande ganho; a manutenção aumenta (criar partições futuras, índices por partição, `ANALYZE` por partição). **Particionar não é automaticamente mais rápido**: em tabelas que cabem em RAM (shared_buffers 1 GiB + cache do SO) a leitura indexada já é de poucos milissegundos, e o ganho de partição é de operação, não de latência.

Quando partições se pagam (critérios adotados): (1) tabela > ~50 mi linhas ou > ~8 GiB; (2) a unidade de retenção/reprocessamento coincide com a partição (ano/competência); (3) a maior parte das consultas traz a chave de partição; (4) *rollback* por `DETACH`/`DROP` substitui reprocessamento caro. Na Fase 1 (B) **nenhuma tabela atinge o critério (1)**. No cenário C, `exec_sau_hosp_proc_mes` (~36 mi) e `exec_sau_sia_estab_grupo_mes` (~29 mi) chegam perto e seriam candidatas a `RANGE (competence)` anual, **após benchmark**.

### Modelo D — híbrido (recomendado)

* **Dimensões canônicas** (território, códigos, população): tabelas únicas pequenas.
* **Tabelas de fato por domínio**, nacionais, com chaves inteiras curtas, sem `revision_id` nas linhas: o ponteiro de publicação fica em uma tabela pequena por `(dataset, uf, competence)`.
* **Histórico por intervalos** (`valid_from`/`valid_to`) para dados de cadastro (estabelecimento, leitos, equipamentos); agregados mensais para atividade hospitalar.
* **Tabela longa de indicadores** (`exec_ind_value`) apenas para valores territoriais (município/UF/Brasil), mais `exec_ind_latest` como serving.
* **Particionamento seletivo e adiado**: 0 partições na Fase 1; esquema de chaves já inclui `competence` para permitir `RANGE` depois sem reescrever contratos.
* **RAW fora do PostgreSQL** (HD externo), com manifesto e `sha256` no banco.

## 3. Matriz de decisão (1 = pior, 5 = melhor)

| Critério | A | B | C (por UF) | C (por ano) | D |
|---|:-:|:-:|:-:|:-:|:-:|
| Simplicidade operacional (nº de objetos) | 1 | 5 | 2 | 3 | 5 |
| Consulta de município / hospital | 4 | 5 | 3 | 4 | 5 |
| Consulta de UF | 5 | 4 | 5 | 4 | 4 |
| Consulta nacional | 1 | 5 | 4 | 4 | 5 |
| Série histórica longa | 3 | 5 | 3 | 3 | 5 |
| Atualização/rollback de uma UF | 5 | 4 | 5 | 3 | 4 |
| Unicidade global e `ON CONFLICT` | 1 | 5 | 3 | 3 | 5 |
| Novos domínios reutilizam estruturas | 1 | 4 | 3 | 4 | 5 |
| Armazenamento | 3 | 5 | 4 | 4 | 5 |
| Facilidade de migração de esquema | 1 | 5 | 3 | 3 | 5 |
| **Soma (máx. 50)** | **25** | **47** | **35** | **35** | **48** |

D e B diferem apenas pela existência de **gatilhos documentados** para particionar e pelas tabelas de intervalo, indicadores e serving; D = B + governança.

## 4. Custos

| Item | A | B/D (Fase 1) | C (hipotético, por ano) |
|---|---:|---:|---:|
| Tabelas físicas novas | ~324 + dimensões | **21** | 21 + 14 partições da maior |
| Índices (aprox.) | ~745 | 35 | 63 |
| Linhas totais | 23,3 mi | 23,3 mi | 23,3 mi |
| PostgreSQL adicional | ≈ 3,6 GiB (≈15% de fragmentação) | **3,12 GiB** | ≈ 3,27 GiB |

Alternativa de histórico rejeitada: **snapshots mensais completos** de CNES teriam, por escala do ES, 228 mi linhas (estabelecimentos 60 mi, leitos 8 mi, equipamentos 160 mi), contra 5,6 mi linhas por intervalos — redução de **41×** com a mesma capacidade de reconstruir qualquer competência. (Escala do ES para o Brasil por razão de estabelecimentos CNES, 48,9×; é uma premissa, não uma medição nacional.)

## 5. Recomendação

**Modelo D**, com a regra: *nenhuma tabela por UF, nenhuma tabela por município; tabelas nacionais por domínio com chaves curtas; partições só depois de benchmark em banco isolado e só nas tabelas que cruzarem os critérios da seção 2-C.* A política é revisável: o desenho de chaves não impede a conversão posterior de `exec_sau_hosp_mes_subgrupo` em `PARTITION BY RANGE (competence)`.

## 6. Efeito da revisão 2 sobre a comparação

**O modelo D continua recomendado**, e a pontuação não muda. O que a auditoria alterou dentro do modelo: (i) o ponteiro de publicação deixou de ser o mecanismo de visibilidade e o desfazer passou a exigir `exec_change_log` (custo de escrita: uma linha de log por linha alterada, só em publicações incrementais, retenção de 12 meses, ≈ 0,26 GiB); (ii) as FKs apontam para uma identidade de **todo** CNES já visto; (iii) intervalos semiabertos eliminam a subtração de competência. Nenhuma dessas mudanças favorece A ou C: tabelas por UF multiplicariam também o change log e a identidade; partições por UF/ano dificultariam as FKs para `exec_sau_cnes_estab` e os índices únicos parciais dos intervalos abertos (o índice único parcial só é global em tabela não particionada ou com a chave de partição na chave). Total de tabelas novas: **21** (antes 20).

## 7. O que seria preciso para mudar essa recomendação

Seria preciso demonstrar em banco de testes **isolado e autorizado** que (a) consultas de município ou hospital em tabelas B > 20 mi linhas ultrapassam p95 de 100 ms com cache quente e índices corretos; ou (b) a troca de uma UF em tabela única gera bloat/latência de escrita superior a 2× o custo por partição; ou (c) a retenção por competência passa a ser requisito regulatório. O plano de benchmark está em `plano_implementacao_saude_fase1.md` (seção 9).


---

## Revisão 2 — correções que afetam este arquivo

| ID | Diagnóstico anterior | Evidência nova | Correção | Impacto na arquitetura | Impacto no armazenamento | Impacto no plano |
|---|---|---|---|---|---|---|
| **C04** O ponteiro não determina a visibilidade; rollback não é O(1) | A seção 7 atualizava as linhas de fato **no lugar** e apontava `exec_publication` para o novo `run_id`; a seção 6 do plano falava em rollback por `previous_run_id`. | Com mutação no lugar, os valores visíveis são os do último `COMMIT`; o ponteiro apenas registra. Os dados antigos deixam de existir na tabela: voltar exige reaplicar o inverso ou reprocessar o RAW. Não é O(1). | Ponteiro redefinido como **registro e portão** (cobertura, idempotência, base para rollback). Rollback exato por **`exec_change_log`** (O(linhas alteradas), só para a publicação mais recente da fatia); fora disso, **replay do RAW**. Sequências transacionais exatas de publicação, rollback e reprocessamento com critérios de aceite. | Nova tabela `exec_change_log`; `slice_hash` em `exec_ingestion_run`; indicadores derivados são gravados e registrados na mesma transação dos fatos. | +0,26 GiB (`exec_change_log`, retenção rolante de 12 meses) | Fase 0 inclui `exec_change_log`; teste de rollback é critério de aceite da Fase 0. |
| **C11** Armazenamento | 2,72 GiB no PostgreSQL; 20 tabelas. | Itens C03–C06 e C04 alteram linhas e colunas; índices parciais de intervalo aberto adicionados. | **3,12 GiB** (+0,40 GiB): `exec_change_log` 0,26; identidade de CNES +0,05; índices únicos parciais e colunas de status; 21 tabelas. | — | 2,72 → 3,12 GiB; crescimento anual 0,22 GiB | Totais de ondas recalculados. |

