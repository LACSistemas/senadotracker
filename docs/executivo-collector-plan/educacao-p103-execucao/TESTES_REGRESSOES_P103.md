# Testes e regressões · P10.3 (G16, G17, G18)

## 1. Testes automatizados (todos no `npm test`)
| Arquivo | Escopo | Resultado |
|---|---|---|
| `tests/unit/educacao-infra-p103.test.ts` | catálogo (códigos e colunas oficiais únicos; famílias redefinidas em 2019 em colunas separadas); valor fora da vigência vira NULL; branco ≠ "não"; códigos oficiais 9 e 88888; universo = escola em atividade; rejeições classificadas; agregados sim/não; impressão da fatia | 8/8 |
| `tests/integration/educacao-p103.test.ts` | migrations v11 e v12 (7 tabelas, FK composta, sem coluna pessoal, idempotente); publicação por UF × edição, `NO_CHANGE` sem log, FK e CHECK; retificação só do diferente, rollback exato e falha injetada; read models de infraestrutura (percentual, sem resposta à parte, vigência, escola); indicadores oficiais (escola e território, "--" = NULL, escala real, rejeição fora da faixa e chave repetida); docentes oficiais (total ≠ soma das redes) | 6/6 (banco descartável) |
| `npm test` completo (`evidencias/npm_test_saida.txt`) | todas as suítes do repositório, cluster isolado em `EXEC_TEST_ADMIN_URL` | **539 testes: 509 passaram, 0 falharam, 30 ignorados** (Legislativo/SQLite, preexistentes) |

Testes preexistentes ajustados só por refletir as novas migrations (autorizado): lista de versões `[1…10]` → `[1…12]` (`efetivos-p93`, `prisional-p94`, `financas-p95`), contagem de tabelas do schema 45 → 52 (`exec-publication`) e o filtro de tabelas da migração da P10.1 (`educacao-p101`), que agora exclui `exec_edu_infra*`, `exec_edu_ind*` e `exec_edu_doc*`.

## 2. G0 · ambiente
Backup `pre-educacao-p103-20261025.dump` (577 MB, SHA-256 `2ea5dc24…62f9`) restaurado no cluster isolado `D:\Civica\pgtest_edu3`: os fingerprints do banco restaurado são **idênticos** aos de produção (só o schema do Legislativo difere, porque o dump é só do schema `civica_exec`). As migrations v11 e v12 foram aplicadas na cópia, repetidas (`[]`) e usadas no piloto e no backfill completo; em produção foram aplicadas uma vez (`{"applied":[11,12]}`).
Houve **três correções no piloto, antes de qualquer escrita em produção** (cada uma documentada no relatório): (a) o ZIP histórico preenche colunas futuras com zero (tratamento por vigência); (b) códigos oficiais `9` e `88888`, que o piloto rejeitava e agora são NULL contados à parte; (c) layouts antigos de planilha (rótulos de identificação trocados em 2016–2018, planilhas `.xls`, duas planilhas repetidas na AFD 2017, região × UF, "Centro Oeste" × "Centro-Oeste").

## 3. G16 · idempotência, retificação e rollback
**Produção:** a publicação das três frentes foi repetida (`infra-publish all`, `ind-publish all`, `doc-publish all`): **1.577 `NO_CHANGE`** (513 + 532 + 532), 0 novos runs, **0 linhas de change log** (`exec_change_log` 16.161.837 antes e depois).
**Dados reais, banco isolado** (`evidencias/g16_retificacao_rollback_2025_ES.json`, ES 2025: 3.046 escolas de infraestrutura, 2.987 escolas e 1.042 linhas territoriais de indicadores, 79 linhas de docentes):
- infraestrutura: repetir o arquivo → `NO_CHANGE`, 0 log; retificação controlada (5 escolas passam de "tem internet" para "não tem"; 2 mudam a quantidade de salas) → log de **exatamente 10 linhas** (`t86:U=7`, `t87:U=3`); `rollbackRun` → `ROLLED_BACK` e estado idêntico ao de referência; falha injetada → exceção, estado idêntico, 0 log; republicar o original → `NO_CHANGE`;
- indicadores oficiais: retificação de 5 valores de ATU → log de 5 linhas (`t89:U=5`); rollback e falha injetada com estado idêntico;
- docentes: retificação em 3 municípios → log de 3 linhas (`t92:U=3`); rollback idêntico;
- estado final = estado de referência; **P10.1 e P10.2 inalteradas** (hashes de cadastro, oferta e identidade iguais); 3 publicações ativas (dataset 72, 73 e 74) para a UF.

## 4. G17 · regressão (`evidencias/fingerprints_antes.json` × `fingerprints_depois.json`)
Mesmo script das ondas anteriores (`scripts/exec/fingerprints-all.ts`), antes da migration e depois da publicação. **Diferenças encontradas: apenas as autorizadas da Educação:** `migrations` ganhou as versões 11 e 12 e `publicationsCrime` (publicações com `dataset_id ≥ 42`) passou de 1.107 para 2.684 (**+1.577**, igual a 513 + 532 + 532). **Idênticos:** indicadores e definições de Saúde e P9.1–P9.6, `exec_ind_value`/`exec_ind_def`, `exec_fin_*`, `exec_pri_*`, `exec_tra_*`, `exec_entity`, `exec_seg_cov`, publicações < 42, contrato das colunas compartilhadas e o schema do Legislativo. As tabelas da P10.1 (`exec_edu_school*`, `exec_edu_cov`) e da P10.2 (`exec_edu_offer*`) não foram alteradas (G16: hashes iguais). O `exec_change_log` não recebeu nenhuma linha. Nenhum código compartilhado do Next foi alterado, então não houve `next build`.

## 5. G18 · testes territoriais com dados reais (produção, 2025, `evidencias/bench_producao.json`)
Brasil; 7 UFs (ES, SP, RJ, MG, PE, RR, DF); 12 municípios: Vitória, Serra, Alto Rio Novo (ES), São Paulo, Rio de Janeiro, Belo Horizonte, Recife, Porto Alegre, Petrolina (escolas que mudaram de dependência), Chapada de Areia/TO (menor município com escolas: 5), Brasília e Boa Vista/RR. Em todos, os recortes por dependência e localização somam o universo, o denominador é declarado e a escola sem resposta aparece à parte.
Casos especiais medidos: escolas sem internet em 2025 = **9.778**; campo não informado em 2022 = **4.259** (NULL); `biblioteca` gravada antes de 2009 = **0**; escolas do cadastro 2025 sem linha de infraestrutura = 33.652, **todas** paralisadas, extintas ou fora de atividade (nenhuma ativa ficou sem linha); escolas que mudaram de dependência entre 2024 e 2025 = 148 (a infraestrutura segue a dependência **da edição**); ensino médio no recorte por etapa de Vitória (32 escolas, 100% com internet).
Exemplos de UF (2025): ES 3.046 escolas, 97,6% com internet, 55,8% com biblioteca ou sala de leitura; SP 30.817, 98,8%, 51,9%; RR 915, 68,4%, 27,5%; DF 1.332, 100%, 82,8%.

## 6. G13 · desempenho dos read models (produção, 20 repetições por caso; p50 / p95 em ms)
| Consulta | p50 | p95 |
|---|---:|---:|
| Infraestrutura Brasil (resumo + série de 19 edições) | 15,3 | 20,3 |
| Infraestrutura UF (ES, SP, RJ, MG, PE, RR, DF) | 8–10 | 10–11 |
| Indicadores Brasil / UF / município | 2–3 | 3–4 |
| Infraestrutura município pequeno ou médio, sem série (Vitória, Serra, Alto Rio Novo, Petrolina, Chapada de Areia) | 7–13 | 8–18 |
| Infraestrutura município pequeno ou médio, **com** série | 17–117 | 19–224 |
| Infraestrutura município **grande**, sem série (São Paulo, Rio, Belo Horizonte) | 313–344 | 441–528 |
| Infraestrutura município **grande**, **com** série de 19 edições | 817–938 | 939–1.119 |
| Infraestrutura de uma escola (19 edições) / indicadores da escola | 1,2 / 0,4 | 2,2 / 0,7 |
Sem N+1 (número fixo de consultas por função). Limite conhecido: a infraestrutura municipal soma as escolas do município nas edições pedidas (≈ 130 mil linhas para São Paulo com série). Mitigação adotada: a série é opcional (`series: false`), e a primeira pintura sai em ≈ 0,3 s para os maiores municípios. Se uma página precisar da série dos maiores municípios em menos de 100 ms, o passo seguinte é uma tabela de agregados por município × edição (≈ 100 mil linhas, da ordem de 15 MB), não construída por não ter sido exigida.
