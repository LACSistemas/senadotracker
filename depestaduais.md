# CÍVICA — INSTRUÇÃO-MÃE DE CONTINUIDADE

## Expansão nacional de Deputados Estaduais

Este chat faz parte de um projeto contínuo chamado **Cívica**.

O objetivo NÃO é executar uma fase isolada.

O objetivo final é construir, validar, operacionalizar e colocar em produção uma camada nacional completa de dados sobre **deputados estaduais e Assembleias Legislativas/CLDF**, integrada ao restante do Cívica e, ao final, consolidada com Câmara e Senado em uma visão nacional única.

---

# 1. OBJETIVO FINAL

Executar sequencialmente todas as fases `PX` necessárias para cobrir as principais dimensões dos deputados estaduais e transformá-las em um produto operacional.

O trabalho só estará realmente completo quando tivermos, dentro dos limites efetivamente publicados por cada fonte oficial:

- identidade dos parlamentares;
- mandatos e períodos de exercício;
- partido/UF/Casa;
- subsídios;
- gastos parlamentares;
- fornecedores;
- estrutura de gabinete;
- assessores/servidores;
- folha/custo de gabinete quando público;
- proposições;
- autoria/coautoria;
- votações;
- presença;
- votos individuais;
- relatorias;
- tramitação das matérias;
- despachos;
- pareceres;
- emendas/substitutivos;
- sanção/veto;
- transformação em norma;
- emendas orçamentárias estaduais;
- demais dimensões estaduais relevantes descobertas ao longo do roadmap.

**Comissões não são mais uma dimensão standalone obrigatória.** A antiga P21 foi removida por decisão de produto. Comissões podem continuar aparecendo como **entidades/destinos de tramitação** quando necessárias para explicar a história procedimental de uma proposição em P22, mas não deve ser reconstruído um produto independente de catálogo, composição, reuniões e pautas sem nova decisão explícita.

Ao final:

1. integrar tudo ao produto estadual do Cívica;
2. operacionalizar collectors/providers em um motor uniforme;
3. executar production-readiness e cutover controlado;
4. consolidar Câmara + Senado + 27 Assembleias/CLDF em um agregador nacional final;
5. medir coverage por UF e dimensão;
6. validar consistência entre módulos;
7. preservar limitações, freshness, provenance e last-known-good explicitamente.

---

# 2. ROADMAP CANÔNICO

## P17 — Base parlamentar

Identidade, roster, mandato, períodos de exercício, partido, subsídio e estrutura-base necessária para vincular todas as outras dimensões.

## P18 — Financeiro parlamentar

CEAP / VIAP / verba indenizatória / equivalentes, fornecedores e despesas parlamentares.

## P19 — Gabinetes / pessoal parlamentar

Assessores, servidores, cargos, lotação, vínculos, remuneração e custo de gabinete quando público.

## P20 — Atividade legislativa

Proposições, autoria/coautoria, presença, votações, votos individuais, produção legislativa e relatorias.

## P21 — SKIPPED_BY_PRODUCT_DECISION

A fase standalone de comissões foi removida.

NÃO reabrir automaticamente.

Comissões podem existir somente como entidade procedimental em P22 quando necessárias para descrever tramitação.

## P22 — Tramitação profunda

Eventos de tramitação, despachos, referências a comissões como destinos procedimentais, pareceres, emendas, substitutivos, votações, sanção/veto, transformação em norma e relações entre proposições.

## P23 — Emendas orçamentárias estaduais

Autor/ator, valor, beneficiário, município, finalidade, órgão executor, programação orçamentária, instrumentos, processos, empenho, liquidação, pagamento e demais vínculos disponíveis.

## P24 — Integração nacional de produto

Transformar P17–P23 em uma experiência estadual realmente integrada ao Cívica.

P24 é principalmente:

- read models;
- queries canônicas;
- API;
- SSR;
- integração do perfil estadual;
- gastos e fornecedores;
- pessoal/gabinete onde houver;
- atividade parlamentar;
- proposições;
- tramitação;
- emendas orçamentárias;
- navegação entre Casas;
- estados de indisponibilidade/limitação;
- consistência de experiência com Câmara e Senado;
- performance da camada de produto.

**P24 NÃO é uma nova grande fase de coleta.**

Collectors já provados em P17–P23 não devem ser reescritos apenas para atender UI. Pequenos ajustes de contrato/read-model podem ocorrer se uma necessidade real de produto for descoberta, mas P24 não deve virar nova campanha nacional de source discovery.

## P25 — Motor operacional de collectors + Production Readiness + Cutover

P25 transforma o conjunto de providers provados em P17–P23 em **uma operação uniforme e segura de produção**.

É aqui que entram oficialmente:

- Provider Registry nacional;
- Collector Orchestrator;
- CLI uniforme;
- refresh incremental;
- full backfill explícito;
- checkpoints;
- retries;
- timeouts;
- rate limits;
- controle de concorrência;
- source health;
- run history;
- freshness;
- last-known-good;
- fail-closed;
- scheduler;
- observabilidade;
- alertas;
- migrations finais;
- índices e performance;
- segurança;
- backup/rollback;
- reconciliação lab → produção;
- initial load;
- smoke tests;
- scheduler activation;
- post-cutover validation.

P25 deve ser tratada internamente em duas etapas/gates:

### P25.R — Production Readiness

Tudo deve estar preparado e validado **sem ainda depender do cutover**.

### P25.C — Controlled Cutover

Somente após `READY_FOR_PRODUCTION_CUTOVER=YES` executar migrations/carga/ativação/smoke/rollback plan em produção.

Não misturar nova investigação de fontes com cutover.

## P26 — Agregador nacional final

Construir a camada que junta:

- Câmara dos Deputados;
- Senado Federal;
- 26 Assembleias Legislativas;
- CLDF.

P26 deve permitir visão nacional coerente de:

- parlamentares;
- mandatos;
- gastos;
- fornecedores;
- pessoal quando disponível;
- proposições;
- votações;
- presença;
- relatorias;
- tramitação;
- emendas orçamentárias;
- coverage por domínio;
- freshness;
- blockers;
- comparações entre Estados/Casas;
- rankings semanticamente válidos;
- distribuição geográfica;
- filtros nacionais;
- páginas e experiências de exploração nacional.

**P26 não deve virar outro conjunto de collectors externos.**

P26 é principalmente:

CÍVICA CANONICAL DATA
→ NATIONAL NORMALIZED READ LAYER
→ NATIONAL AGGREGATES
→ PRODUCT/API

---

# 3. ESTADO ATUAL DO ROADMAP

Estado de continuidade em 09/10/2026:

- P17: encerrada;
- P18: encerrada;
- P19: encerrada com coverage/limitações documentadas;
- P20: encerrada;
- P21: `SKIPPED_BY_PRODUCT_DECISION`;
- P22: `NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS`;
- P23.1–P23.5: executadas;
- P23.6: próxima fase, destinada a MS/PB/RR/TO e fechamento nacional do P23;
- P24: NÃO iniciada;
- P25: NÃO iniciada;
- P26: NÃO iniciada.

Estado P23 após P23.5:

- `OPERATIONAL = 12/27`;
- `PARTIAL = 5/27`;
- `BLOCKERS = 6/27`;
- `NOT_ATTEMPTED = 4/27`;
- UFs ainda não tentadas: `MS`, `PB`, `RR`, `TO`.

A P23.6 deve, se os gates permitirem, terminar com:

`P23_FINAL = NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS`

`STATE_BUDGET_NOT_ATTEMPTED = 0/27`

`READY_FOR_P24 = YES`

Sem iniciar P24 na mesma execução.

---

# 4. FONTES CANÔNICAS DE CONTINUIDADE

Antes de retomar qualquer fase em chat novo, procurar primeiro:

`C:\Projetos\civicadocs\SUMMARY`

Especialmente:

`C:\Projetos\civicadocs\SUMMARY\deputados_estaduais`

Os arquivos de SUMMARY são o ponto de entrada canônico para saber:

- onde o projeto parou;
- qual coverage existe;
- quais UFs estão operacionais;
- quais estão parciais;
- quais estão external/blocker;
- quais estão deferred;
- quais dados já existem;
- quais active revisions existem;
- qual freshness existe;
- qual é a próxima fase.

Depois consultar artifacts detalhados somente quando necessário.

Não reconstruir o projeto do zero em cada chat.

---

# 5. PRIOR SUCCESS É EVIDÊNCIA VINCULANTE

Se uma fonte, Casa ou dimensão já funcionou anteriormente, isso prova que existe ou existiu um fluxo técnico real.

Antes de fazer novo discovery, localizar:

- código anterior;
- providers;
- registry existente;
- scripts;
- artifacts;
- raw payloads;
- request logs;
- git history;
- revisions;
- fixtures;
- provenance;
- URLs e contratos anteriores;
- mappings de identidade existentes;
- checkpoints e execução anterior.

Não aceitar:

> “não consegui encontrar agora”

como equivalente a:

> “nunca funcionou”.

Uma probe isolada não anula prior success.

Se um provider anteriormente operacional não reproduzir imediatamente, tratar primeiro como:

- problema de transporte;
- mudança de contrato;
- execução local;
- autenticação/CAPTCHA;
- degradação temporária;
- regressão de implementação;

antes de reclassificar a fonte como inexistente.

---

# 6. LAST-KNOWN-GOOD E FAIL-CLOSED

Uma fonte parar de funcionar NÃO significa apagar dados daquela Casa.

Regra:

SOURCE FAILURE
→ NÃO publicar snapshot vazio
→ NÃO remover dados antigos
→ preservar última revisão válida
→ registrar freshness/source availability
→ tentar novamente em execução futura.

External blocker != no data.

Deferred != no data.

Degraded != no data.

Partial != no data.

Dados anteriormente coletados continuam servindo como:

`LAST_KNOWN_GOOD`

com metadata de atualização e disponibilidade da fonte.

---

# 7. STATUS E CLASSIFICAÇÕES

Usar status coerentes com o domínio/fase.

Conceitos válidos incluem:

- `OPERATIONALLY_PROVEN`;
- `OPERATIONALLY_PROVEN_DEGRADED_SOURCE_AVAILABILITY`;
- `OPERATIONAL_2026_STATE_BUDGET`;
- `PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY`;
- `PROVEN_EXTERNAL_BLOCKER`;
- `EXECUTION_ENVIRONMENT_BLOCKED`;
- `UPSTREAM_BLOCKER`;
- `DEFERRED_BY_PRODUCT_CONSTRAINT`;
- `NOT_APPLICABLE`;
- `NO_GO_EXECUTION_FAILURE`;
- `NOT_ATTEMPTED`, somente enquanto a Casa realmente ainda não foi trabalhada.

Não chamar decisão de produto de falha.

Não chamar trabalho local de blocker externo.

Não chamar source temporariamente degradada de provider inoperante se carry-forward for seguro.

Não manter `NOT_ATTEMPTED` depois que a Casa foi efetivamente investigada e terminalmente classificada.

---

# 8. NÃO EXISTE API UNIVERSAL ENTRE ASSEMBLEIAS

Cada Casa pode usar:

- JSON;
- CSV;
- XLSX;
- HTML;
- PDF;
- ODT;
- JSF;
- PrimeFaces;
- ScriptCase;
- WordPress;
- Drupal;
- Power BI;
- Qlik;
- API própria;
- download documental;
- backend privado com superfície pública;
- outro contrato oficial.

A universalidade deve existir **na camada canônica do Cívica**, não na fonte.

Arquitetura-base:

SOURCE-SPECIFIC PROVIDER
→ RAW
→ NORMALIZATION
→ CANONICAL MODEL
→ RECONCILIATION
→ REVISION
→ ACTIVE VIEW
→ PRODUCT/API

---

# 9. INVARIANTES TÉCNICOS

Preservar sempre:

- PostgreSQL lab first;
- `civica_postgres_lab` durante construção/investigação;
- fail closed;
- immutable revisions;
- raw provenance;
- deterministic source-native keys;
- no fuzzy identity;
- no silent shrink;
- explicit collection model;
- partition key != row natural key;
- unobserved partition != removal;
- last-known-good preservation;
- Run2 idempotency;
- duplicate insertions = 0;
- unchanged replay = no new revision;
- scheduler somente após publicação segura;
- prior success = binding evidence;
- blocker externo exige evidência externa;
- degraded source pode continuar operacional se carry-forward for seguro;
- product-deferred != external blocker;
- source failure != empty publication.

---

# 10. O USUÁRIO NÃO DEVE REDESCOBRIR O PROJETO

O usuário NÃO deve precisar:

- procurar links manualmente;
- lembrar onde estava um artifact;
- dizer novamente qual fluxo já funcionou;
- redescobrir endpoint já investigado;
- explicar ao agente onde procurar no próprio projeto;
- repetir provider/source contracts já provados.

O agente deve primeiro procurar:

SUMMARY
→ artifacts
→ code
→ provider registry/scripts
→ git history
→ raw/provenance
→ revisions/checkpoints

E somente depois concluir que uma informação não está disponível.

---

# 11. DOCUMENTAÇÃO POR FASE

Ao encerrar cada fase `PX`, gerar ou atualizar documentação em:

`C:\Projetos\civicadocs\SUMMARY\deputados_estaduais`

Registrar:

- objetivo da fase;
- o que foi implementado;
- coverage nacional;
- coverage por UF;
- providers;
- fontes;
- active rows;
- active revisions;
- freshness/dataThrough;
- blockers;
- partials/deferred;
- last-known-good;
- artifacts canônicos;
- regressões;
- próximos passos;
- readiness para a próxima PX.

O próximo chat deve conseguir começar dali.

---

# 12. P24 — REGRA DE PRODUTO

P24 consome os dados já construídos.

Objetivo:

Postgres canonical
→ read models
→ APIs/SSR
→ páginas/perfis
→ navegação integrada.

P24 deve validar que os dados realmente alimentam:

- perfil do deputado estadual;
- visão geral;
- carreira/mandato;
- gastos;
- fornecedores;
- gabinete/pessoal onde houver;
- atividade parlamentar;
- proposições;
- presença;
- votações;
- votos individuais;
- relatorias;
- tramitação/timeline;
- emendas orçamentárias.

Não basta “estar no banco”.

O dado precisa estar utilizável pela camada de produto.

P24 deve representar explicitamente diferenças de coverage por UF. Não inventar cards vazios ou zero quando o dado é `PARTIAL`, `BLOCKED`, `NOT_APPLICABLE` ou não publicado pela fonte.

P24 pode criar/ajustar read models e índices de produto, mas não deve operacionalizar scheduler nem fazer cutover.

---

# 13. P25 — ARQUITETURA OPERACIONAL DOS COLLECTORS

P17–P23 constroem e provam providers.

P25 deve transformar esses providers em **um único motor operacional nacional**.

A unidade conceitual do registry é:

`house × domain → provider contract`

Domínios mínimos:

- `identity` — P17;
- `finance` — P18;
- `personnel` — P19;
- `legislative` — P20;
- `timeline` — P22;
- `budget_amendments` — P23.

Exemplo conceitual:

```text
ES
  identity
  finance
  personnel
  legislative
  timeline
  budget_amendments

MG
  identity
  finance
  legislative
  timeline
  budget_amendments
```

Cada combinação deve apontar para o provider real e seu contrato de execução.

Exemplo conceitual de registry:

```ts
{
  house: "ES",
  domain: "budget_amendments",
  provider: "es_state_budget",
  enabled: true,
  collectionModel: "SNAPSHOT",
  sourceUpdateFrequency: "DAILY",
  supportsFullBackfill: true,
  supportsIncremental: true,
  supportsCheckpoint: true,
  refreshPolicy: {
    cadence: "DAILY",
    maxRetries: 3,
    timeoutSeconds: 120
  },
  publicationPolicy: {
    requireReconciliation: true,
    preserveLastKnownGood: true,
    allowEmptyRevision: false
  }
}
```

Os nomes concretos podem variar. A semântica não.

---

# 14. P25 — CLI UNIFORME

Evitar operação baseada em dezenas de comandos específicos como:

```text
collect-es-budget.ts
run-pi-emendas.ts
refresh-ro-finance.ts
```

P25 deve convergir para um CLI único/orchestrado.

Contrato conceitual desejado:

```powershell
pnpm civica:collect collect --scope state --house ES --domain budget_amendments --year 2026
```

Subcomandos esperados:

```text
collect
refresh
backfill
replay
validate
status
health
```

Exemplos conceituais:

```powershell
# Uma Casa / um domínio
pnpm civica:collect collect --scope state --house ES --domain budget_amendments --year 2026

# Refresh normal
pnpm civica:collect refresh --scope state --house ES --domain budget_amendments

# Full backfill explícito
pnpm civica:collect backfill --scope state --house ES --domain budget_amendments --year 2026

# Todos os domínios elegíveis de uma Casa
pnpm civica:collect refresh --scope state --house ES --all-domains

# Um domínio em todas as Casas elegíveis
pnpm civica:collect refresh --scope state --domain legislative --all-houses

# Tudo que está vencido segundo o registry
pnpm civica:collect refresh --scope state --due

# Status nacional
pnpm civica:collect status --scope state

# Status de uma Casa
pnpm civica:collect status --scope state --house ES

# Validar sem publicar
pnpm civica:collect validate --scope state --house ES --domain budget_amendments

# Reprocessar raw já capturado
pnpm civica:collect replay --scope state --house ES --domain budget_amendments --revision <id>

# Dry-run
pnpm civica:collect collect --scope state --house ES --domain budget_amendments --year 2026 --dry-run
```

Esses comandos são **contrato-alvo de P25**, não afirmação de que já existem hoje.

---

# 15. P25 — CLI E SCHEDULER DEVEM USAR O MESMO ORCHESTRATOR

É proibido construir uma implementação manual e outra separada para cron.

Arquitetura desejada:

```text
CLI
  ↓
Collector Orchestrator
  ↓
Provider Registry
  ↓
Provider
  ↓
Raw capture
  ↓
Parser/Normalization
  ↓
Candidate revision
  ↓
Reconciliation
  ↓
Gates
  ↓
Publish / preserve last-known-good
```

O scheduler deve entrar no MESMO fluxo:

```text
Scheduler
  ↓
Collector Orchestrator
  ↓
mesmo Provider Registry
  ↓
mesma pipeline
```

Regra:

**manual e scheduler não podem executar implementações diferentes do mesmo provider.**

---

# 16. P25 — ESTADOS DE EXECUÇÃO

Cada collector run deve possuir estados formais equivalentes a:

```text
FETCHING
RAW_CAPTURED
PARSING
RECONCILING
VALIDATING
PUBLISHING
SUCCESS
NO_CHANGE
SOURCE_BLOCKED
FAILED_SAFE
```

`FAILED_SAFE` significa:

- refresh falhou;
- nenhuma empty revision foi publicada;
- active revision anterior continua válida;
- erro/source-health ficou registrado;
- tentativa futura pode ser feita com segurança.

---

# 17. P25 — SCHEDULER POR DUE, NÃO “RODAR TUDO”

O comando operacional preferencial deve ser equivalente a:

```powershell
pnpm civica:collect refresh --scope state --due
```

O Provider Registry decide o que está vencido segundo:

- source cadence;
- last successful collection;
- dataThrough;
- sourceUpdateFrequency;
- checkpoint;
- provider health;
- retry policy;
- rate limit;
- concurrency policy.

Evitar um cron ingênuo que rode literalmente todos os providers todos os dias.

---

# 18. P25 — CADÊNCIA É POR PROVIDER/DOMÍNIO

Não existe uma frequência nacional única.

Exemplos conceituais:

```text
P17 identity/roster
→ daily ou alguns dias por semana

P18 finance/CEAP
→ daily ou monthly, conforme a Casa

P19 personnel
→ monthly/source-driven

P20 legislative
→ daily

P22 timeline
→ daily/incremental em propostas alteradas

P23 budget amendments
→ daily/weekly/monthly/source-driven
```

A frequência pertence ao registry/provider contract.

Não hardcodar cadência diretamente no scheduler.

---

# 19. P25 — NENHUM PROVIDER COM CRON CUSTOMIZADO ISOLADO

Regra arquitetural forte:

**nenhum provider deve precisar de um cron/script customizado específico para funcionar em produção.**

Todos entram pelo mesmo registry/orchestrator.

O que varia por Casa/domínio:

- provider;
- source contract;
- collection model;
- cadence;
- pagination;
- checkpoint;
- retries;
- parsing;
- reconciliation;
- publication policy.

A operação externa deve ser uniforme.

---

# 20. P25 — PROVIDER HEALTH E OBSERVABILIDADE

Para cada `house × domain`, expor pelo menos:

- provider;
- enabled;
- status atual;
- source availability;
- active revision;
- row count;
- dataThrough;
- sourceUpdatedAt;
- lastAttemptAt;
- lastSuccessAt;
- nextDueAt;
- freshness;
- checkpoint;
- consecutiveFailures;
- last error classification;
- last-known-good;
- scheduler eligibility;
- incrementalRefreshReady;
- fullBackfillReady;
- provenance coverage.

O objetivo é que comandos como:

```powershell
pnpm civica:collect status --scope state
```

e:

```powershell
pnpm civica:collect health --scope state --house ES
```

sejam suficientes para entender a operação sem abrir código do provider.

---

# 21. P25 — PRODUCTION READINESS TRANSVERSAL

Antes do cutover, validar conjuntamente:

- identidade;
- financeiro;
- gabinete/pessoal;
- atividade legislativa;
- proposições;
- votações;
- tramitação;
- emendas orçamentárias;
- integrações entre domínios;
- Provider Registry;
- CLI;
- scheduler;
- idempotência;
- fail-closed;
- freshness;
- observabilidade;
- performance;
- raw provenance;
- rollback;
- migrations;
- API/product queries;
- last-known-good;
- source degradation;
- monitoring.

Somente depois:

`READY_FOR_PRODUCTION_CUTOVER = YES`

---

# 22. P25 — CUTOVER CONTROLADO

Nunca misturar investigação/coleta nova com produção.

Cutover deve ter:

- preflight;
- backup/rollback;
- migrations;
- schema parity;
- index parity;
- initial production load;
- lab→production row parity;
- revision parity;
- query parity;
- API/SSR smoke tests;
- scheduler activation gradual;
- provider health validation;
- post-cutover validation;
- rollback test/procedure documentada.

Primeiro provar em lab.

Depois migrar.

Nunca usar produção como ambiente de discovery.

---

# 23. P26 — AGREGADOR NACIONAL

P26 não deve coletar novamente as fontes estaduais.

P26 consome dados canônicos do próprio Cívica.

Conceito:

```text
Câmara
Senado
27 Casas estaduais/distrital
        ↓
Canonical data
        ↓
National normalized read layer
        ↓
National aggregates
        ↓
API / SSR / exploration product
```

Os comandos internos podem convergir para algo equivalente a:

```powershell
pnpm civica:aggregate refresh --domain legislators
pnpm civica:aggregate refresh --domain legislative
pnpm civica:aggregate refresh --domain budget_amendments
pnpm civica:aggregate refresh --all
pnpm civica:aggregate refresh --due
```

Novamente: nomes concretos podem variar; a responsabilidade arquitetural é a parte obrigatória.

Collector:

```text
fonte pública → Cívica canonical
```

Aggregator P26:

```text
Cívica canonical → Cívica national
```

Não misturar essas responsabilidades.

---

# 24. P26 — MATRIZ NACIONAL DE CAPABILITIES

O agregador deve responder, para cada UF/Casa e cada dimensão:

- `AVAILABLE`;
- `OPERATIONAL`;
- `DEGRADED`;
- `PARTIAL`;
- `EXTERNAL_BLOCKER`;
- `EXECUTION_ENVIRONMENT_BLOCKED`;
- `UPSTREAM_BLOCKER`;
- `DEFERRED`;
- `NOT_APPLICABLE`;
- `UNPROVEN`, somente quando genuinamente não resolvido.

E conter pelo menos:

- provider;
- source;
- row count;
- dataThrough;
- last successful collection;
- scheduler status;
- freshness;
- last-known-good;
- blocker/deferred reason;
- provenance coverage;
- semantic compatibility.

A matriz deve permitir enxergar toda a expansão em uma única estrutura.

---

# 25. P26 — NÃO FAZER AGREGAÇÃO FINANCEIRA INGÊNUA

Estados/Casas podem expor métricas diferentes:

- indicado;
- aprovado;
- dotação/current;
- empenhado;
- liquidado;
- pago;
- utilizado;
- realizado;
- transferido.

Além disso, os scopes temporais podem ser:

- anual;
- snapshot;
- updated-to-date;
- transacional;
- desconhecido.

P26 deve agregar/comparar somente métricas semanticamente compatíveis.

Não somar números só porque todos são “valores de emendas”.

---

# 26. ENTIDADES CANÔNICAS CONECTADAS

O objetivo não é criar tabelas isoladas.

Todos os dados devem convergir para entidades conectadas, como:

- parlamentar;
- mandato/exercício;
- Casa;
- partido;
- UF;
- fornecedor;
- proposição;
- votação;
- evento de tramitação;
- emenda orçamentária;
- beneficiário;
- instrumento;
- processo;
- município;
- comissão quando necessária como entidade procedimental.

Exemplo de conexão:

```text
deputado
→ mandato/exercício
→ gabinete
→ despesas
→ fornecedores
→ proposições
→ votos
→ presença
→ relatorias
→ tramitação
→ emendas orçamentárias
```

Essa conexão é parte do produto final.

---

# 27. HISTÓRICO NÃO BLOQUEIA O ANO CORRENTE

Não bloquear avanço do produto esperando todos os anos históricos.

Prioridade:

1. ano corrente / corpus operacional;
2. produto;
3. production readiness/cutover;
4. agregador nacional;
5. historical backfill como workload próprio quando apropriado.

Backfill histórico não deve ser misturado automaticamente com cutover.

---

# 28. REGRA DE ENCERRAMENTO DE FASE

Não transformar uma fase em projeto infinito.

Quando uma fase atingir:

- cobertura operacional suficiente;
- blockers externos comprovados;
- boundaries de fonte documentadas;
- deferred decisions documentadas;
- last-known-good protegido;
- artifacts canônicos;
- queries/read models validados quando aplicável;
- zero trabalho local crítico restante;

ENCERRAR A FASE e avançar.

Não ficar fazendo refinamentos infinitos enquanto dimensões seguintes ainda não começaram.

Blocker/partial terminal não impede próxima fase quando:

`INTERNAL_WORK_REMAINING = NO`.

---

# 29. REGRA PARA NOVO CHAT

Ao receber esta instrução em um chat novo:

1. localizar o SUMMARY canônico;
2. identificar a última PX realmente encerrada;
3. identificar a próxima PX;
4. verificar artifacts somente quando necessário;
5. NÃO reabrir fases anteriores sem evidência concreta de regressão;
6. reutilizar prior success e contratos já provados;
7. continuar o roadmap uma fase por vez;
8. atualizar SUMMARY ao final;
9. manter produção intocada até P25.C;
10. manter em mente que o objetivo não é “terminar a próxima tarefa”, mas concluir a expansão estadual, operacionalizá-la e integrá-la ao Cívica nacional.

---

# 30. RESUMO EXECUTIVO DA ARQUITETURA FINAL

```text
P17–P23
PROVAR E CONSTRUIR PROVIDERS + MODELOS CANÔNICOS
        ↓
P24
CONSUMIR NO PRODUTO
read models + API + SSR + frontend
        ↓
P25
OPERACIONALIZAR PROVIDERS E COLOCAR EM PRODUÇÃO
registry + CLI + orchestrator + scheduler + health + cutover
        ↓
P26
AGREGAR NACIONALMENTE
Câmara + Senado + 27 Casas
```

Princípio final:

**SOURCE-SPECIFIC COLLECTION, CANONICAL NORMALIZATION, SAFE PUBLICATION, UNIFORM OPERATION, NATIONAL PRODUCT.**

Construir todas as dimensões estaduais necessárias Casa por Casa, normalizá-las em um modelo nacional do Cívica, preservar dados quando fontes falharem, integrar os dados ao produto, operacionalizar collectors por um único registry/orchestrator, executar cutover seguro e observável e, por fim, consolidar Câmara + Senado + 27 Assembleias/CLDF em uma visão nacional coerente.
