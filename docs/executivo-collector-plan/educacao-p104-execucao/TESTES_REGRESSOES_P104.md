# Testes e regressões (P10.4) · G11

Estado: **PASS**. `npm test` completo: **562 testes, 532 passam, 0 falham, 30 pulados** (`EXEC_TEST_ADMIN_URL` apontando para o cluster de teste, para os testes de integração rodarem). `npm run typecheck` sem erros (workspaces + `tsconfig.tests.json`).

Os 30 pulados são os testes do **Legislativo** que exigem o PostgreSQL local da aplicação (`DB_*`) ou o SQLite publicado; são os mesmos das ondas anteriores, o código deles não foi tocado e eles não entram na P10.4.

## 1. Testes novos (23, todos passam)

| Arquivo | Testes | Cobre |
|---|---|---|
| `tests/unit/educacao-learn-p104.test.ts` | 9 | Ideb: rede e nomes de território, escopo por UF, `-` é NULL, meta só no ciclo, rejeições classificadas, impressão da fatia; Saeb: ×100 sem perda, Brasil e UF em fatias separadas, estrato sem alunos, repetição idêntica da alfabetização que conta como célula, três linhas "Total - …" distintas |
| `tests/unit/educacao-flow-p104.test.ts` | 9 | Catálogo (54 + 17 = 71 colunas, 64 de transição), rendimento + distorção em uma linha por escola, soma 100 conferida e não corrigida, rejeições classificadas, transição só no modo `trn`, `***` ausente e contado, UF pelo prefixo do código da escola, INSE (média ×10000, rede 5 e 6 convertidas, repetição idêntica) |
| `tests/integration/educacao-p104.test.ts` | 5 | Migration v13 (13 tabelas, FK para o cadastro, sem coluna pessoal, idempotente); Ideb ponta a ponta (publicação por UF × edição, `NO_CHANGE` sem log, retificação com log, rollback exato, falha injetada sem rastro, escola sem cadastro rejeitada, leitura); Saeb, fluxo e transição, INSE e cobertura pelos read models |

## 2. Testes antigos ajustados (contagens e listas, nenhuma regra afrouxada)

| Teste | Mudança |
|---|---|
| `tests/integration/exec-publication.test.ts` | 52 → 65 tabelas em `civica_exec`; a descrição cita a v13 |
| `tests/integration/{efetivos-p93,financas-p95,prisional-p94}.test.ts` | lista de migrations `[1..12]` → `[1..13]` |
| `tests/integration/educacao-p101.test.ts` | a lista de tabelas da v9 passa a excluir também `ideb`, `saeb`, `flow`, `trn` e `inse`, como as ondas anteriores fizeram para `offer`, `infra`, `ind` e `doc` |

## 3. G16 com dados reais (idempotência, retificação, rollback, falha injetada)

`scripts/exec/educacao-p104-g16.ts` (somente em banco de teste, recusa rodar sem `EXEC_DATABASE_URL`), fatia ES × 2023 de cada família (transição: 2021, último par publicado). Resultado em `evidencias/g16_2023_ES.json`:

| Família | Replay | Log após replay | Retificação (5 linhas) | Rollback | Estado = referência | Falha injetada | Log após falha |
|---|---|---|---|---|---|---|---|
| Ideb | `NO_CHANGE` | 0 | `t93:U=5` | `ROLLED_BACK` | sim | lançou, estado igual | 0 |
| Saeb | `NO_CHANGE` | 0 | `t96:U=5` | `ROLLED_BACK` | sim | lançou, estado igual | 0 |
| Rendimento + distorção | `NO_CHANGE` | 0 | `t98:U=5`, `t100:U=1` | `ROLLED_BACK` | sim | lançou, estado igual | 0 |
| Transição | `NO_CHANGE` | 0 | `t101:U=5` | `ROLLED_BACK` | sim | lançou, estado igual | 0 |
| INSE | `NO_CHANGE` | 0 | `t103:U=5` | `ROLLED_BACK` | sim | lançou, estado igual | 0 |

`priorWavesUnchanged = true`: o hash das tabelas das ondas P10.1 a P10.3 (cadastro, oferta, infraestrutura, indicadores, docentes) ficou idêntico depois de todo o ensaio. Lição registrada: republicar **o mesmo conteúdo** reativa o run antigo; para testar a retificação duas vezes é preciso um SHA novo, senão o rollback é recusado por existir run mais novo na UF (a primeira execução do Saeb caiu nisso e foi refeita com SHAs únicos por execução).

## 4. Replay em produção

Depois da publicação, o script de produção rodou as 5 famílias de novo: **1.511 fatias, 1.511 `NO_CHANGE`**, 0 execuções novas, nenhuma linha nova no change log (16.161.837 antes e depois).

## 5. Fingerprints das ondas anteriores (produção, antes × depois da P10.4)

`scripts/exec/fingerprints-all.ts` (`evidencias/fingerprints_antes.json` e `fingerprints_depois.json`, 73 campos). **70 de 73 idênticos**: valores e definições de indicadores de Saúde e das ondas P9.1 a P9.8, tabelas por onda, estados de publicação abaixo do dataset 42, contratos compartilhados, esquema legislativo. As 3 diferenças são esperadas e explicadas:

- `migrations`: ganhou a versão 13.
- `publicationsCrime.n` e `.h`: a faixa de publicações é `dataset_id >= 42`, e a P10.4 criou os datasets 75 a 79 (+1.511 publicações, 2.684 → 4.195). Recalculado só para `42 ≤ dataset_id < 75`, o resultado é **idêntico ao de antes** (`bd743f35…`, 2.684 publicações).

## 6. O que não foi coberto por teste automático

- Os extratores Python não têm teste unitário próprio; são cobertos pela conferência independente (1.389 valores) e pelas contagens de cobertura (`RECONCILIACAO_APRENDIZAGEM.md`).
- Nenhuma interface foi alterada (a P10.4 não faz frontend).
