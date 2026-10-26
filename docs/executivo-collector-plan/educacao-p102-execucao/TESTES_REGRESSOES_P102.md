# Testes e regressões · P10.2 (G11, G13, G14)

## 1. Testes automatizados (todos no `npm test`)
| Arquivo | Escopo | Resultado |
|---|---|---|
| `tests/unit/educacao-oferta-p102.test.ts` | catálogo (toda coluna tem medida; partições × transversais), universo, resto derivado, rejeições classificadas, disponibilidade por edição (NULL antes de 2014 e 2023), EJA de turmas 2025, agregados, impressão da fatia (7 testes) | 7/7 |
| `tests/integration/educacao-oferta-p102.test.ts` | migration v10 (3 tabelas, FK composta, sem coluna pessoal, idempotente), publicação por UF × edição, `NO_CHANGE` sem log, CHECKs de partição, FK, **bloqueio da fatia quando o bit0 da P10.1 diverge**, retificação com log só do diferente, rollback exato, falha injetada, dependência da P10.1 (o cadastro não apaga escola com oferta), read models (município, UF, Brasil, escola) e entradas inválidas (6 testes, banco descartável) | 6/6 |
| `npm test` completo (`evidencias/npm_test_saida.txt`) | todas as suítes do repositório, cluster isolado em `EXEC_TEST_ADMIN_URL` | **525 testes: 495 passaram, 0 falharam, 30 ignorados** (Legislativo/SQLite, preexistentes) |
| `tsc --noEmit` (db, collector, testes) | tipos | sem erros |

Testes preexistentes ajustados só por refletir a nova migration (autorizado): contagem de tabelas do schema (42 → 45), lista de versões `[1…9]` → `[1…10]` em `exec-publication`, `efetivos-p93`, `prisional-p94`, `financas-p95`, e o filtro de tabelas do teste de migração da P10.1 (`educacao-p101`), que agora exclui as tabelas `exec_edu_offer*`.

## 2. G0/G4 · migration e ambiente
Backup `pre-educacao-p102-20261025.dump` (515 MB, SHA-256 `7e4d7d21…ae73`) restaurado no cluster isolado `D:\Civica\pgtest_edu2`: 4.272.656 linhas de cadastro e 513 publicações, como em produção. A v10 foi aplicada na cópia, repetida (`[]`) e usada para o piloto e o backfill completo; em produção foi aplicada uma vez (`{"applied":[10]}`). A primeira versão do DDL foi **corrigida no piloto** (coluna `tur_eja`, ver `RECONCILIACAO_TURMAS_2007_2025.md`) antes de qualquer escrita em produção.
Os 20 arquivos do RAW do Censo existentes (ZIPs 2007–2024 e tabelas 2025) tiveram o SHA-256 reconferido contra o manifesto: 0 divergentes. Foram baixados só `Tabela_Turma_2025` (99,9 MB, CRC conferido) e os documentos jurídicos (2,4 MB).

## 3. G11 · idempotência, retificação e rollback
**Produção:** a publicação das 19 edições (513 fatias) foi repetida (`oferta-publish all`): **513 `NO_CHANGE`, 0 novos runs, 0 linhas de change log** (`exec_change_log` 16.161.837 antes e depois).
**Dados reais, banco isolado** (`evidencias/g11_oferta_retificacao_rollback_2025_ES.json`, 2.986 escolas do ES em 2025):
- repetir o mesmo arquivo → `NO_CHANGE`, 0 log, estado idêntico;
- retificação controlada (5 escolas deslocam 5 matrículas entre anos iniciais e finais; 2 mudam o tempo integral) → log de **exatamente 10 linhas** (`t83:U=7` escolas, `t84:U=3` agregados), nenhuma inserção ou remoção;
- `rollbackRun` → `ROLLED_BACK`; hashes de oferta, agregados e cobertura **iguais** ao estado de referência; publicação ativa volta ao run original;
- falha injetada após aplicar → exceção, estado idêntico, 0 log;
- republicar o original → `NO_CHANGE`; **cadastro da P10.1 inalterado** (hashes de `exec_edu_school_year`, `exec_edu_school` e `exec_edu_cov` iguais).
- Dependência da P10.1: um teste de integração prova que o cadastro não pode apagar escola com oferta (FK) e que republicar o cadastro igual é `NO_CHANGE`.
- Consistência com o bit0: a verificação `bit0 ⇔ oferta com mat_bas > 0` roda **dentro de cada publicação**; uma fatia que a viole não é publicada (teste de integração + 513/513 fatias conferem).

## 4. G13 · testes territoriais em produção (`BENCHMARK_READ_MODELS_P102.json`)
Totais de 2025 (matrículas e turmas) conferidos contra a Sinopse 1.2 e 4.2: **19/19 iguais** (Brasil; 7 UFs: ES, SP, RJ, MG, PE, RR, DF; 11 municípios: Vitória 77.662/3.344, Serra 122.802/5.115, Alto Rio Novo 1.741/83, São Paulo 2.512.355/118.763, Rio de Janeiro 1.208.798/53.249, Belo Horizonte 480.019/23.085, Recife 318.487/15.300, Porto Alegre 291.051/13.705, Chapada de Areia/TO [menor município com oferta] 282/14, Belo Horizonte [mais etapas e modalidades no critério usado] e Petrolina/PE [escolas que mudaram de dependência entre 2024 e 2025] 107.732/4.635). Em todos, as etapas somam o total de matrículas. Cobrem rede (dependência), localização, série de 19 edições, zero × ausência (colunas de turno e tempo integral de turmas), resposta para escola sem oferta e entradas inválidas.

## 5. G9 · desempenho dos read models (mediana de 5 execuções, produção, 3,5 mi de linhas de oferta)
| Consulta | Tempo |
|---|---:|
| Brasil (resumo + série de 19 edições) | 9 ms |
| UF (resumo + série) | 2,4 – 3,3 ms |
| Município pequeno a médio (Vitória, Alto Rio Novo, Chapada de Areia, Serra, Petrolina) | 2,6 – 64 ms |
| Município grande **com** série de 19 edições (Belo Horizonte, Recife, Porto Alegre) | 168 – 213 ms |
| São Paulo / Rio de Janeiro **com** série | 473 / 517 ms |
| Mesmos municípios **sem** série (`series: false`, primeira pintura) | 1,8 – 157 ms (São Paulo 110 ms) |
| Escola (série de 19 edições) | 0,8 ms |
Sem N+1 (número fixo de consultas por função). Limite conhecido: a série municipal soma as escolas do município em 19 edições (≈ 150 mil linhas para São Paulo); a opção `series: false` e o carregamento separado da série mantêm a primeira pintura em ≤ 160 ms. Uma tabela de agregados por município (≈ 100 mil linhas, ~15 MB) só se justificará se a página pública exigir a série dos maiores municípios em < 100 ms.

## 6. G14 · regressão (`evidencias/fingerprints_antes.json` × `fingerprints_depois.json`)
Mesmo script das ondas anteriores (`scripts/exec/fingerprints-all.ts`), antes da migration e depois da publicação das 19 edições. **Diferenças encontradas: apenas as autorizadas da Educação:** `migrations` ganhou a versão 10 e `publicationsCrime` (publicações com `dataset_id ≥ 42`) passou de 594 para 1.107 (= +513 do dataset 71). **Idênticos:** indicadores e definições de Saúde e P9.1–P9.6, `exec_ind_value`/`exec_ind_def`, `exec_fin_*`, `exec_pri_*`, `exec_tra_*`, `exec_entity`, `exec_seg_cov`, publicações < 42, contrato das colunas compartilhadas e o schema do Legislativo. **P10.1:** hashes de `exec_edu_school_year` (6298453f…), `exec_edu_school` (23e8ed87…), `exec_edu_cov` (a20d6da5…) e das 513 publicações do dataset 70 idênticos antes e depois (`evidencias/p101_antes.txt`, `p101_depois.txt`). O `exec_change_log` não recebeu nenhuma linha. Nenhum código compartilhado do Next foi alterado, então não houve `next build`.
