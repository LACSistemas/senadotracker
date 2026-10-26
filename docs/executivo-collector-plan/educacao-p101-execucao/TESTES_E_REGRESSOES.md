# Testes e regressões · P10.1 (G11, G13, G14)

## 1. Testes automatizados (todos no `npm test`)

| Arquivo | Escopo | Resultado |
|---|---|---|
| `tests/unit/educacao-p101.test.ts` | regras de flags, rejeições, impressão da fatia, transições, lacunas, links do INEP (8 testes) | 8/8 |
| `tests/integration/educacao-p101.test.ts` | migration v9 (3 tabelas, sem coluna pessoal, `exec_entity` intacta, idempotência), publicação por UF × edição, `NO_CHANGE` sem novo log, FK adiada, retificação com log só do diferente, rollback exato, falha injetada, lacunas, read models, filtros, busca com curingas escapados, paginação limitada, entradas inválidas (6 testes, banco descartável) | 6/6 |
| `npm test` completo (`evidencias/npm_test_saida.txt`) | todas as suítes do repositório, com cluster isolado em `EXEC_TEST_ADMIN_URL` | **512 testes: 482 passaram, 0 falharam, 30 ignorados** (Legislativo/SQLite que exigem `DB_*` ou arquivo local; preexistentes, não relacionados) |
| `tsc --noEmit` (db, collector, testes) | tipos | sem erros |

Testes pré-existentes atualizados apenas por refletir a nova migration (autorizado): contagem de tabelas do schema (39 → 42) e lista de versões `[1…8]` → `[1…9]` em `exec-publication`, `efetivos-p93`, `prisional-p94`, `financas-p95`.

## 2. G2 · migration em cluster isolado com dados reais
Cluster `D:\Civica\pgtest_edu` (porta 55440), restauração do dump pré-P10.1 do `civica_exec`: **contagens idênticas** às de produção em 11 de 12 tabelas conferidas; a 12ª (`exec_raw_manifest`) difere em 20 linhas, que são exatamente as 20 entradas de RAW do Censo registradas **depois** do dump (18 ZIPs 2007–2024 + 2 tabelas de 2025). `applyExecMigrations` aplicou só a v9; segunda execução `[]` (idempotente); `DROP` das três tabelas + remoção da linha em `schema_migrations` + reaplicação restaurou o estado (reversível).

## 3. G11 · idempotência, retificação e rollback com dados reais (`evidencias/g11_retificacao_rollback_2025_ES.json`)
Banco de teste restaurado, edição 2025 do ES (3.847 escolas):
- Republicação do mesmo arquivo → `NO_CHANGE`, 0 linhas de log, estado idêntico.
- Retificação controlada com arquivo de hash diferente (3 nomes, 2 municípios, 2 dependências, 1 escola removida, 1 incluída): log de **exatamente 10 linhas** (`t81:U=7`, `t81:D=1`, `t81:I=1`, `t80:I=1`), e só o que mudou foi tocado; a cobertura da UF não mudou (não gerou evento).
- `rollbackRun` → `ROLLED_BACK`; hashes das três tabelas **iguais** ao estado de referência; publicação ativa volta ao run original.
- Falha injetada após aplicar → exceção, estado idêntico, 0 linhas de log.
- Republicar o original → `NO_CHANGE`.
Em produção, o replay das 19 edições (513 fatias) resultou em **0 publicações novas**: `exec_ingestion_run` permaneceu com 513 runs do dataset 70 e nenhuma linha de log foi criada (`changeLogRows` 16.161.837 antes e depois).

## 4. G13 · testes territoriais em produção (`BENCHMARK_READ_MODELS.json`)
Contagens 2025 de cada município e UF conferidas contra a Sinopse: **17/17 iguais** (Vitória 178, Serra 230, Alto Rio Novo 10, São Paulo 7.187, Rio de Janeiro 3.875, Belo Horizonte 1.373, Recife 1.061, Porto Alegre 955, Chapada de Areia/TO 2 [menor município], São Paulo [município com maior número de escolas que passaram de em atividade a paralisada]; UFs ES, SP, RJ, MG, PE, RR e DF). Cobrem rede (por dependência), situação, histórico (série de 19 edições), filtros, paginação, busca, resposta vazia e entradas inválidas.

## 5. G12 · desempenho dos read models (mediana de 5 execuções, produção, 4,27 mi de linhas)
| Consulta | Tempo |
|---|---:|
| Escola por código / histórico da escola | 0,5–0,7 ms |
| Município (resumo + série + 50 escolas): pequeno … São Paulo (7.905 escolas) | 2,4 … 88 ms |
| UF, só resumo (ES … MG) | 2 … 63 ms |
| UF, lista filtrada (dependência + busca por nome), 50 por página | 9 … 351 ms (MG, pior caso, busca `ILIKE` em 24 mil linhas) |
| Página 600 da lista de SP | 214 ms |
| Resultado vazio | 5 ms |
Sem N+1 (cada função usa um número fixo de consultas), paginação limitada a 200 por página, payload nunca traz todas as escolas. Limite conhecido: busca por nome em lista estadual é varredura da fatia ano × UF; aceitável, e um índice trigram só se justificará se a página pública oferecer busca por UF.

## 6. G14 · regressão (`evidencias/fingerprints_antes.json` × `fingerprints_depois.json`)
Mesmo script das ondas anteriores (`scripts/exec/fingerprints-all.ts`), antes da migration e depois da publicação das 19 edições. **Diferenças encontradas: apenas as autorizadas de Educação**: (a) `migrations` ganhou a versão 9; (b) `publicationsCrime` (publicações com `dataset_id ≥ 42`) passou de 81 para 594 = +513 do dataset 70. **Idênticos:** valores e definições de indicadores de Saúde e P9.1–P9.6 (hash e contagem), `exec_ind_value`, `exec_ind_def`, `exec_fin_fact`/`exec_fin_exec`/`exec_fin_dot`/…, `exec_pri_*`, `exec_tra_*`, `exec_entity` (hash e contagem), `exec_seg_cov` < 8000, publicações < 42, contrato das colunas compartilhadas (`sharedContracts`) e o schema do Legislativo (tabelas e linhas vivas). O `exec_change_log` não teve nenhuma linha acrescentada. Nenhum código compartilhado do Next foi alterado, então não houve `next build`.
