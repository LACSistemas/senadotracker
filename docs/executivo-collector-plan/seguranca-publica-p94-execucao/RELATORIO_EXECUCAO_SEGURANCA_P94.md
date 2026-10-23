# CÍVICA — P9.4: Sistema Prisional Nacional (SISDEPEN/SENAPPEN) — relatório de execução

Execução em 21/10/2026. **Sem commit e sem push.** Sem scheduler, sem retenção do change log, sem página de Segurança, sem P9.5–P9.8, sem perfil demográfico persistido.

## 1. Resumo executivo

O Cívica passou a ter uma base prisional histórica e territorial no PostgreSQL de produção: **19 ciclos semestrais (2016/2 a 2025/2)**, **2.357 estabelecimentos** com identidade interna rastreável, capacidade e população por unidade, agregados por município, UF e Brasil, ocupação e excedente com fórmula explícita, separação estadual × federal × domiciliar e cobertura/continuidade por ciclo. **Uma migration (v4, 6 tabelas)**, 37 indicadores, 71 medidas, **458.577 valores de indicador + 1.129.488 fatos por unidade**, 532 publicações transacionais, todas reconciliadas na própria transação.

**Reconciliação externa:** nos 6 relatórios oficiais da SENAPPEN (ciclos 14 a 19), **população, capacidade, número de estabelecimentos e déficit do sistema estadual, e os quantitativos do sistema federal, coincidem exatamente**, inclusive em **324 de 324** células UF × ciclo de população e capacidade. Contra o Anuário (Tabela 75), 7 de 10 anos fecham exatamente; os demais têm diferença explicada e **não forçada**.

Reexecutar tudo = 532 fatias `NO_CHANGE`; fingerprints de Saúde, P9.1–P9.3, entidades, contratos e Legislativo **idênticos**. Banco +206,5 MB, WAL +635 MB, C: livre 60,7 → 60,5 GiB.

| Família | Brasil | UFs | Municípios | Ciclos | Indicadores | Estado |
|---|---|---:|---:|---|---:|---|
| Estabelecimentos prisionais | 1.360 celas físicas (1.355 estaduais + 5 federais) + 172 domiciliares no 19º ciclo; 2.357 unidades únicas na série | 27 | 1.164 com ao menos uma unidade | 19 | 8 (6 E/F + 2 domiciliar) | PASS_WITH_CAVEATS |
| Capacidade e vagas | 506.307 (505.267 estadual + 1.040 federal) em 2025/2 | 27 | por município | 19 | 11 (4 totais/sexo + 7 por regime) | PASS |
| População em celas físicas | 727.895 (727.301 + 594) em 2025/2 | 27 | por município | 19 | 4 (+ 2 domiciliar) | PASS |
| Regimes e situação processual | 6 margens (provisórios, fechado, semiaberto, aberto, med. seg. internação e ambulatorial) | 27 | por município | 19 | 6 de população (as 7 de capacidade estão acima) | PASS |
| Ocupação prisional | 143,9 % (estadual, 2025/2) | 27 | por município | 19 | 2 | PASS |
| Excedente de capacidade | líquido 221.730; bruto publicado à parte | 27 | por município | 19 | 4 | PASS |
| Estabelecimentos federais | 5 (RO, RN, PR, MS, DF); pop. 594; vagas 1.040 | 5 | 5 | 19 | 8 | PASS |
| Perfil agregado | só regime e sexo; demais blocos **não persistidos** | — | — | — | — | PARTIAL |

Complementos: domiciliar 233.081 pessoas em 2025/2 (65 estabelecimentos com monitoramento + 107 sem), **fora** da ocupação.

## 2. Fontes e ciclos

Portal oficial SENAPPEN/SISDEPEN: `gov.br/senappen/pt-br/servicos/sisdepen/bases-de-dados`. **19 CSV** (um por ciclo) preservados no RAW (`D:\Civica\raw\seguranca\prisional\sisdepen`, ~141 MB, hash e manifesto no banco). Nenhum ciclo posterior ao 19º foi encontrado (verificado na página). Os 16º e 18º ciclos são as versões **retificadas** publicadas. Arquivos 2014, 2015 e "2016_basefinal" são o formato anterior (INFOPEN) e ficaram **fora** do contrato. Controles externos preservados no RAW: 6 relatórios semestrais (14º a 19º ciclos) e o Anuário FBSP 2026 (SHA-256 em `reproducibilidade/analise/`).

## 3. Contrato de capacidade (G2) e população (G3)

Ver `contratos_prisionais.md`. Verificado nos 19 arquivos, **com zero violações**: capacidade total por sexo = Σ regimes; total do regime = M + F; total do grupo de população = Σ das seis margens de jurisdição × sexo; população total = Σ dos seis grupos. Logo **nunca** se soma total + componentes. Capacidade da unidade = M + F (soma do declarado); célula vazia só é "não aplicável" em unidade de um sexo (41 unidades masculinas com feminino vazio no 19º ciclo). Medida principal: população **em celas físicas**; domiciliar tem indicadores próprios. "Justiça Federal" em 4.1 é a jurisdição do processo, não o âmbito do estabelecimento.

## 4. Ocupação e excedente (G4)

`ocupação = Σ população ÷ Σ capacidade` das celas físicas **elegíveis** (capacidade completa > 0), por soma e nunca por média de taxas; excedente líquido e bruto são indicadores distintos; capacidade zero/ausente nunca divide (6007/6107, `noDenominator`). Série nacional estadual: 159,0 % (2016/2) → 134,6 % (2022/2) → 143,9 % (2025/2). Todas as fórmulas ficam no `methodology_note` de cada definição.

## 5. Identidade histórica (G1)

O SISDEPEN **não** publica identificador estável. `unit_id` é chave **interna** (`key_kind = 1`); nome e linha originais de cada ciclo ficam em `exec_pri_obs` e `exec_pri_xwalk`. Regras determinísticas (sem fuzzy): nome+município+tipo exatos (25.950 linhas, confiança 100); mesmo CEP e município com nome diferente (516, confiança 70, **revisão**); mesmo CEP e nome com município diferente (2, 60, **revisão**); candidatos ambíguos ficam **separados** (159, **revisão**); unidades novas 2.198. **677 correspondências pendentes de revisão** (2,3 % das linhas): séries por unidade devem usá-las com essa ressalva. Unidade ausente de um ciclo **não** é tratada como encerrada. Cobertura de continuidade em `cobertura_sisdepen.csv`. Cadastro em `estabelecimentos_prisionais.csv` (2.357 linhas) e crosswalk em `crosswalk_estabelecimentos.csv` (28.825 linhas). CEP é usado só na comparação e **não** é persistido; endereço, bairro e telefone também não.

## 6. Cobertura e não resposta (G5)

O arquivo traz **só respostas validadas** (`Validado`/`Ativo` em 100 % das linhas), então o **universo esperado não consta da fonte** e não há percentual de cobertura honesto. Publicamos o que é demonstrável: registros por ciclo, novos, reconhecidos, **ausentes versus ciclo anterior** (ex.: 2018/2 → 2019/1: 122 ausentes e queda de 1.514 para 1.412 registros, provável queda de cobertura e não fechamento), capacidade incompleta (de 38 em 2021/2 a 0–1 nos ciclos recentes) e unidades sem município. Estados: `reported`/zero declarado = linha com valor; vazio = sem linha; sem unidade × sem resposta **não se distinguem** e a leitura expõe isso.

## 7. Cadastro territorial (G6, G8)

Município pelo **código IBGE nativo** (7 dígitos) contra `exec_entity`; sem fuzzy. 56 observações da série (3 no 19º ciclo) sem código IBGE ficam com `entity_id` nulo: entram na UF e no "resto não conciliado" (invariante verificada na transação: Σ municípios + não conciliados = UF; Σ UFs = Brasil). 1.164 municípios têm ao menos uma unidade. Brasília permanece uma entidade. Estadual, federal e domiciliar são escopos separados em todos os níveis; os 5 federais aparecem na UF onde estão, **fora** do sistema estadual dela.

## 8. Sistema federal × estadual (G8)

Matriz por ciclo em `reconciliacao_prisional.md` §3 (estaduais, federais, domiciliar, população, vagas, ocupação, excedente). 19º ciclo: 1.355 estaduais + 5 federais; população 727.301 + 594; vagas 505.267 + 1.040. Controle do relatório do 18º ciclo: 1.375 estaduais e 5 federais — idêntico.

## 9. Perfil agregado (G7) — PARTIAL

Persistidos: população por regime/situação (6 margens) e por sexo, capacidade por regime e sexo. **Não persistidos**: faixa etária, cor/raça, escolaridade, estado civil, deficiência, nacionalidade, tipo penal, trabalho, educação, saúde, mortalidade e servidores. A matriz campo → definição → universo → risco está em `contratos_prisionais.md` §7. Motivo: margens independentes por unidade podem identificar pessoas em unidades pequenas, o layout de nacionalidade muda no 14º ciclo, e nenhum agregado ≥ UF foi contratado ainda. Nada de cruzamento de margens, perfis ou facções.

## 10. Banco, migration e engine (G9)

Migration **v4** (reversível por `DROP` das seis tabelas): `exec_pri_unit`, `exec_pri_obs`, `exec_pri_measure`, `exec_pri_fact` (só células preenchidas), `exec_pri_xwalk`, `exec_pri_cov`; sem tabela por UF ou ciclo, sem colunas de endereço/CEP/telefone (teste). Agregados reutilizam `exec_ind_def/value/latest`. Datasets 28 (UF × ciclo) e 29 (nacional). **Duas mudanças aditivas no motor compartilhado:** `publishSlice` grava `quality.specIds` e `rollbackRun` confere o hash sobre **todas** as tabelas publicadas (antes só as presentes no change log; um rollback de retificação que alterasse uma única tabela era recusado), e `BulkScope.nationalOnly`. Runs antigos continuam com o comportamento anterior.

## 11. Reconciliação (G11)

`reconciliacao_prisional.md`. (a) **Relatórios SENAPPEN**, 6 ciclos: população, capacidade, estabelecimentos, déficit e federal idênticos; 324/324 células UF. (b) **Anuário FBSP 2026, T75** (celas + domiciliar, todos os ciclos de dezembro): exatos em 2016, 2017, 2018, 2019, 2022, 2024 e 2025; **2020/2 +7,05 %** (+53.179), **2021/2 +1,39 %**, **2023/2 −0,19 %** — hipótese: o Anuário usa a base consolidada com retificações e, em 2020/2, a primeira edição com domiciliar "sem monitoramento", possivelmente tratada de outro modo; **não ajustado**. (c) Invariantes internas: Σ UFs = Brasil e Σ municípios + resto = UF em todas as 532 publicações. Primeira versão do Cívica tinha capacidade menor que os relatórios em 4 ciclos; a causa foi tratar unidade mista incompleta como zero. Corrigida para a soma do declarado (como no relatório) e republicada; o resultado final é 0 divergências.

## 12. Testes (G15)

Novos: 8 unitários, 4 de falha (SSD ausente, HTML no lugar do CSV, CSV corrompido/layout, ciclos) e 3 de integração em PostgreSQL descartável (migração, publicação/NO_CHANGE/retificação/rollback exato/falha injetada/reconciliação que barra/Brasil = Σ UFs, read models) — **15/15**. Suíte completa: **441 testes, 411 aprovados, 0 falhas, 30 ignorados** (os mesmos 30 legislativos; ignorados não contam). Typecheck limpo. `next build` passou **em cópia isolada** (`C:\Projetos\build_p94`, removida); o `.next` e o servidor do usuário não foram tocados.

## 13. Performance (G12, G16)

`desempenho_consultas.json`: UF = 4 consultas, ~5–7 ms, ~100–135 KB; município = 4–5 consultas, 1–17 ms (a consulta de fatos usa a chave primária por `unit_id`; a primeira versão com subconsulta levava ~100 ms em São Paulo); Brasil = 4 consultas, ~6 ms. Planos: `Index Scan` na PK de `exec_ind_value`. O contrato de município devolve só o seu recorte e rotula a UF como contexto.

## 14. Armazenamento (G16)

| | Antes | Depois |
|---|---:|---:|
| PostgreSQL | 23.096.724.627 B | 23.303.261.331 B (**+206,5 MB**; `exec_pri_fact` 94,6 MB) |
| WAL gerado | — | +634,8 MB (1 checkpoint requisitado a mais) |
| `exec_change_log` | 16.134.052 | 16.134.052 (sem alteração) |
| Livre no C: | 60,7 GiB | 60,5 GiB |
| Livre no D: | 439,8 GiB | 438,9 GiB (RAW +151 MB; backup +372 MB) |

Backup `pre-prisional-p94-20261021.dump` (372 MB) restaurado em cluster isolado com contagens idênticas às de produção; cluster, cópias exploratórias e cópia de build removidos. Backups anteriores mantidos. Detalhe em `armazenamento_execucao.csv`.

## 15. Privacidade (G13)

Só dados institucionais e agregados por estabelecimento; nenhum custodiado individual. O extrator lê apenas identificação institucional, capacidade e população; não lê endereço, telefone, servidores, perfil ou campos livres. Não há mapas internos, plantas, rotinas, escalas, facções ou associação entre população prisional e criminalidade do município (restrição no payload de leitura).

## 16. Ressalvas

1. **Identidade**: 677 correspondências (renomeação, mudança de município, ambíguas) aguardam revisão; chave é interna.
2. **Cobertura**: sem universo esperado na fonte; queda de registros pode ser queda de resposta; "sem unidade" × "sem resposta" não se distinguem.
3. **Perfil demográfico**, trabalho, educação, saúde e servidores não persistidos (G7 PARTIAL).
4. Anuário diverge em 2020/2 (+7,05 %), 2021/2 e 2023/2; relatórios oficiais fecham exatamente.
5. 56 observações sem código IBGE (3 no último ciclo): só em UF/Brasil.
6. Pessoas em carceragens de delegacias e outras prisões (citadas nos relatórios) **não** estão nos CSV e não foram publicadas.
7. Ciclos 16 e 18 são versões retificadas; uma nova retificação gera hash novo e republicação com log.
8. Ondas A–E do backfill foram executadas **primeiro em cluster isolado** (restaurado do backup) e depois em produção, para as 27 UFs de uma vez, em vez de um piloto reduzido (ES, SP, MG, DF, UF de baixa cobertura): o desenho por UF × ciclo e a reconciliação na transação tornaram o piloto parcial dispensável.
9. 30 testes legislativos continuam ignorados.

## 17. Gates

| Gate | Estado | Evidência |
|---|---|---|
| G0_INFRASTRUCTURE_SAFETY | **PASS** | banco/volume/locks/fingerprints; backup restaurado com contagens idênticas; C: 60,7 GiB |
| G1_PRISON_UNIT_IDENTITY | **PASS_WITH_CAVEATS** | chave interna determinística; 677 revisões pendentes |
| G2_CAPACITY_CONTRACT | **PASS** | total = Σ componentes provado nos 19 ciclos; regras de agregação |
| G3_CUSTODY_POPULATION | **PASS** | celas físicas × domiciliar separados; margens não somadas |
| G4_OCCUPANCY_METHODOLOGY | **PASS** | Σ÷Σ, líquido × bruto, capacidade zero; confere com relatórios |
| G5_PRISON_COVERAGE | **PASS_WITH_CAVEATS** | continuidade e ausências; sem universo esperado |
| G6_TERRITORIAL_IDENTITY | **PASS_WITH_CAVEATS** | IBGE nativo; 56 sem município |
| G7_PRISON_PROFILE | **PARTIAL** | regime/sexo publicados; matriz dos demais campos, não persistidos |
| G8_FEDERAL_STATE_SEPARATION | **PASS** | escopos E/F/D; 5 federais idênticos ao relatório |
| G9_PERSISTENCE | **PASS** | v4 + testes; rollback exato; sem alteração destrutiva |
| G10_NATIONAL_BACKFILL | **PASS_WITH_CAVEATS** | ondas A–E; F (dimensões adicionais) não executada |
| G11_OFFICIAL_RECONCILIATION | **PASS_WITH_CAVEATS** | relatórios exatos; Anuário com 3 diferenças documentadas |
| G12_SERVING_CONTRACT | **PASS** | 3 contratos; ≤ 5 consultas; ~5–17 ms |
| G13_PRIVACY | **PASS** | só institucional/agregado; sem endereço/CEP persistidos |
| G14_IDEMPOTENCY | **PASS** | 532 NO_CHANGE; retificação, falha injetada e rollback testados |
| G15_TESTS_AND_REGRESSION | **PASS_WITH_CAVEATS** | 411/441, 0 falhas, 30 ignorados; fingerprints idênticos; build em cópia |
| G16_STORAGE_PERFORMANCE | **PASS** | +206,5 MB; WAL +635 MB; C: 60,5 GiB |

Pendências para ondas futuras (não autorizadas): página de Segurança, revisão das 677 correspondências, agregados demográficos ≥ UF, P9.5–P9.8, scheduler (a proposta é verificar a página de bases a cada semestre) e retenção do change log.

## Entregáveis

`RELATORIO_EXECUCAO_SEGURANCA_P94.md`, `cobertura_sisdepen.csv` (1.125 linhas), `estabelecimentos_prisionais.csv` (2.357), `crosswalk_estabelecimentos.csv` (28.825), `reconciliacao_prisional.md`, `contratos_prisionais.md`, `armazenamento_execucao.csv`, `desempenho_consultas.json`, `results.json`, `summary_relatorio.json`, `reproducibilidade/`.
