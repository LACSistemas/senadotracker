# Grafo de proposições da Câmara: pai → filhos (emendas e substitutivos)

Relatório técnico da integração de `principal_id` como fonte canônica das relações da Câmara, da resolução de pais
históricos e da apresentação na UI. Data das medições: 2026-10-05, banco `projetoeleitor_db`, schema `civica_poc`.

## Semântica

`principal_id` vem direto de `uriPropPrincipal` (lista anual oficial da Câmara; coletor em `apps/collector/src/activity.ts`).
As 5.169 emendas/substitutivos do lote `2026-L57` têm `principal_id` idêntico ao `uriPropPrincipal` bruto (0 divergências).

Significa: "esta proposição está oficialmente ligada a esta principal da tramitação". Não significa sempre "esta emenda altera
o texto desta matéria":

- ESB, SBR e SBE-A atuam sobre um substitutivo/emenda intermediário (pai imediato ≠ matéria raiz);
- em apensações a principal é a matéria condutora (ex.: EMC-A "ao PL 3075/2011" com principal PL 5831/2009);
- a UI diz "ligadas a esta matéria", nunca "emendas ao texto desta matéria".

Contrato por filho (`AmendmentItem`, `packages/db/src/postgres-proposition-graph.ts`): `immediateParentId`, `rootProposalId`,
`relationDepth` (1 direto, 2 sob substitutivo/emenda), `type`, `relation { origin: 'official_uri', kind: 'principal', evidence }`.
`evidence` só marca apensação como `confirmada` quando a matéria citada na ementa existe na base e aponta para esse pai;
caso contrário é `nao_comprovada` e o texto da UI é hedged ("A ementa cita o PL X; a principal oficial é Y").

## Integração com /proposicoes e /proposicoes/[id]

### Estado anterior (investigação da Fase 0)

Runtime: `apps/web/lib/data.ts` → `data-postgres.ts` (PostgreSQL somente; `web-legacy-contract.ts` só fornece tipos).
Detalhe: `postgresPropositionRepository.detail()` (`packages/db/src/postgres-propositions.ts`).

Blocos de `/legislativo/proposicoes/[source]/[id]` (`page.tsx` + `components/proposition-story.tsx`):

| Bloco | Fonte | Observação |
|---|---|---|
| Cabeçalho (eyebrow, ementa, situação observada) | `item.proposal`, `propositionObservedState` | `humanType` só nomeava EMC/SBT |
| "Contexto relacionado" (`Context`) | `item.principal = {id,label,themes:[],movements:[]}` | único cartão da matéria-pai; `themes` **sempre vazio**; link "Abrir matéria principal" mesmo sem página (inexistente para 3.697 emendas, por leitura do código); só EMC/SBT* tinham verbo próprio |
| "Efeito procedural" / "Fluxo documental" (`Historical`) | `item.principal.label` como nó "Alvo"/"Matéria relacionada" | visualização de fluxo (instrumento → alvo → decisão), sobrepõe o rótulo do pai |
| "O que esta emenda propõe mudar" | `item.proposal.summary` | próprio da emenda, sem sobreposição |
| "Atividade em torno desta matéria" (`ActivityAround`) | `item.amendments`, `item.documents`, `item.resultingNorms` | `item.amendments` vinha só de `proposal_detail_atoms(kind='amendment')`: **1 linha no banco, vazia**; links para URL oficial externa |
| Autoria, "O que este objeto produziu", decisão | `item.authors`, `documents`, `deliberations` | autores repetidos em `proposal_authors` apareciam repetidos |

Nenhum bloco chamado "Matéria principal", "Proposição relacionada" ou "Proposição pai" existia: só o "Contexto relacionado".
`item.relationships` só entra em um cálculo de densidade. Não havia seção de filhos.

`/legislativo/proposicoes` (`page.tsx`): casca de seções do pacote operacional (Hero, Composição, Estágio, DNA, Ritmo, Recentes,
`CaseSection`, `ExploreCta`). `emendas_substitutivos` aparece como um dos 10 grupos funcionais (cor `--group-3`, "Modificar textos").
A única relação editorial é `CaseSection`, fixa na MPV 1343/2026 (`MPV_CASE`, id 2610975), que mostra todos os objetos
relacionados (DOC, DTQ, RPD…), não só emendas.

`/legislativo/proposicoes/explorar` (`?grupo=emendas_substitutivos` já funciona): cartão "acessório" quando há
`principalProposalId`, com "Sobre {pai}" + ementa do pai + "Ver matéria principal →". `principal_id` já participa da query
(join `parent`/`proposal_parent_context`) mas **não há filtro por matéria principal nem ordenação por nº de emendas**; o cartão
mostrava "Sobre" sem rótulo e link para página inexistente quando o pai estava ausente. A rota `/proposicoes/explorar` é só um redirect.

### Redundâncias encontradas

1. `Context` × nós "Alvo"/"Matéria relacionada" em `procedural_effect`/`document_flow`: mesma informação (rótulo do pai). Mantido o
   nó de fluxo (é uma visualização diferente: instrumento → alvo → decisão) e **o cartão `Context` continua sendo o único lugar
   com ementa, temas, cadeia e link do pai**.
2. `ActivityAround` (grupo "Emendas e substitutivos") × nova seção de emendas: para a Câmara a seção dedicada substitui o grupo;
   `ActivityAround` mantém Documentos e Normas e só mostra emendas quando não há `amendmentGraph` (Senado/legado).
3. Banner de "matéria histórica" no cabeçalho × seção "Matéria histórica": mantida só a seção.

### Decisão de UX

- **Um único cartão de pai: "Contexto relacionado".** Ganhou: verbo por sigla (todas as 11), cadeia pai imediato → raiz
  (`ESB 1/2026 → SBT 1 → PL 303/2026`), ementa do pai, "Matéria raiz" quando difere, **temas da matéria principal/raiz**
  (rotulados como contexto; temas próprios da emenda continuam não existindo), link só quando a página existe, e aviso quando a
  cadeia não chega à raiz. Não foi criado "Matéria principal", "Proposição pai" ou outro cartão.
- **Uma seção de filhos: "Emendas e substitutivos ligados a esta matéria"** (`components/proposition-amendments.tsx`), posicionada
  logo após o bloco "história" e antes de "Atividade em torno desta matéria". Vale para qualquer matéria que tenha filhos
  (principais, mas também um SBT que recebe ESB). Reaproveita: classes do grupo `emendas_substitutivos` (`groupMeta`, `--group-3`),
  chips de filtro e paginação por `Link` do `/explorar` (`?emendas=SIGLA&pagina_emendas=N#emendas`), `formatDate`/`nf`/`typeName`.
- **Hierarquia preservada:** filhos diretos ficam no primeiro nível; ESB/SBR/SBE-A aparecem aninhados num `<details>` sob o
  substitutivo/emenda que alteram (`PL → SBT → ESB`), nunca promovidos ao PL. Evidência de apensação aparece só quando provada.
- **Matéria histórica:** página navegável com seção "Matéria histórica" (identificação, ementa, situação, temas; sem tramitação),
  fora do universo 2026 (não entra em contagens, listagens nem agregados).

### Alterações feitas

| Camada | Arquivo | Mudança |
|---|---|---|
| Banco | `civica_poc.proposals_principal_idx (source, batch_id, principal_id, functional_group)` | índice pai → filhos |
| Banco | `civica_poc.proposal_support`, `proposal_support_themes`, `principal_resolution_queue` | matérias históricas de suporte, temas, fila deduplicada |
| db | `packages/db/src/postgres-proposition-graph.ts` (novo) | DDL idempotente, `loadRelationGraph`, `loadAmendmentGraph`, `loadSupportDetail`, `withRelationGraph`, `dedupeAuthors` |
| db | `postgres-propositions.ts` | listagem usa `proposal_support` como fallback do rótulo/ementa do pai |
| web | `lib/data-postgres.ts` `propositionDetail(source,id,{type,page})` | compõe o detalhe base com o grafo; mantém `item.amendments` (agora Câmara via `principal_id`) |
| web | `components/proposition-story.tsx` | `Context` consolidado; `AmendmentsSection`; seção histórica; `ActivityAround` sem duplicar emendas |
| web | `components/proposition-amendments.tsx` (novo) | seção de emendas |
| web | `app/legislativo/proposicoes/[source]/[id]/page.tsx` | lê `?emendas`/`?pagina_emendas`, nomes de tipo, oculta "situação observada" em matéria histórica |
| web | `lib/proposicoes/taxonomy.ts` | nomes seguros de SBT-A, EMC-A, SBE-A, SBR, ESB, EMA, EMS (vindos do despacho oficial) |
| coletor | `principal-proposal-parser.ts` (extraído), `postgres-principal-resolver.ts` (novo), `postgres-collector.ts`, `index.ts` | resolvedor PostgreSQL e comando `collect-camara-principals` |
| scripts | `apply-proposition-graph-schema.ts`, `measure-proposition-graph.ts`, `verify-proposition-graph.ts` | schema, métricas, casos obrigatórios |
| testes | `tests/unit/proposition-graph.test.ts` | autores, schema, parser do pai histórico |

Estrutura resultante da página de uma matéria com filhos (descrição textual):

```
Cabeçalho (casa · tipo, ementa, código, situação observada, fonte oficial)
Banner de papel ("Esta matéria possui tramitação própria…")
[Contexto relacionado]          só se a matéria tem pai; cadeia + pai + raiz + temas do pai
Tramitação desta matéria        (matéria histórica: "Matéria histórica")
Emendas e substitutivos ligados a esta matéria
   chips por sigla · lista paginada (25) · ESB/SBR/SBE-A aninhados sob o substitutivo
Atividade em torno desta matéria (documentos e normas; emendas só no legado/Senado)
Decisão · Autoria (autores deduplicados) · O que este objeto produziu
```

## Resolução automática de pais históricos

`apps/collector/src/postgres-principal-resolver.ts`, comando `npm run collector -- collect-camara-principals [--scope amendments|all]
[--max-depth N] [--concurrency N] [--limit N]`. Também roda ao fim de `collect-activity --source camara` (melhor esforço: falha
não invalida a publicação dos filhos).

- fila `principal_resolution_queue` com PK `(source, parent_id)`: o mesmo pai usado por 200 filhos é buscado uma vez; reexecução é
  idempotente (segunda execução: 0 requisições);
- estados `pending/resolved/failed/not_found`, até 5 tentativas, 2 passadas por execução; `OfficialHttp` já faz 3 tentativas com
  backoff; falha de um pai não bloqueia os demais;
- pai resolvido grava `proposal_support` (ID, tipo, número, **ano real**, data, ementa, situação, `principal_id`, proveniência
  `raw_id`/URL) e temas oficiais; o `principal_id` do próprio pai entra na fila com `depth+1` até raiz ou o teto de profundidade (hoje 10, ver Ajustes finais); `visited`
  em memória + PK + `depth` protegem contra ciclos (0 detectados);
- `catalogRole = 'relationship_support'` (valor já previsto em `@senadotracker/domain`); nenhuma linha vai para o lote ativo 2026.

Execuções reais (API oficial da Câmara): escopo `amendments` 1.768 pais / 3.536 requisições; escopo `all` +4.401 pais / 8.802
requisições; 0 falhas, 0 não encontrados, 0 retentativas. Total: **6.169 matérias de suporte** (5.230 do grupo "principais"),
12.338 requisições, profundidades 1–5 (5.772 / 224 / 108 / 48 / 17) com limite 5; 7 pais ficaram `pending` em profundidade 6, resolvidos depois ao subir o limite para 10 (ver Ajustes finais).

Caso obrigatório: **PEC 221/2019 (id 2233802)** resolvida (ano 2019, "Aguardando Apreciação pelo Senado Federal", temas Direito
Constitucional e Trabalho e Emprego); `/legislativo/proposicoes/camara/2233802` responde 200 e mostra 5 emendas (EMC 2, SBT 1,
SBT-A 1, EMA 1).

## Métricas antes/depois

| Métrica | Antes | Depois |
|---|---|---|
| Emendas/substitutivos | 5.169 | 5.169 |
| Com pai imediato | 5.169 | 5.169 |
| Pai no catálogo ativo | 1.472 | 1.472 |
| Pai em matéria de suporte | 0 | 3.697 |
| Pai não resolvido | 3.697 (1.764 pais) | **0** |
| Chegam a matéria raiz (catálogo + suporte) | 1.331 (a investigação anterior contava 1.404; ver Auditoria final, item 1) | **4.889 (94,6%)** |
| Profundidade 1 / 2 / 3+ | 5.018 / 144 / 7 | 5.018 / 144 / 7 |
| Raiz alcançada em prof. 1 / 2 / 3+ | 1.321 / 10 / 0 | 4.744 / 138 / 7 |
| Ciclos | 0 | 0 |
| Páginas históricas que passaram a existir | 0 | 6.169 |
| Matérias com seção de emendas | 307 | **2.071** |
| Faixas de filhos: 1 / 2–10 / 11–50 / 51–100 / 100+ | 188 / 108 / 5 / 3 / 3 | 1.113 / 935 / 14 / 4 / 5 |
| Maior nº de emendas de uma matéria | 427 (MPV 1343/2026) | 427 |

Cadeias que continuam sem raiz oficial (280): terminam em substitutivo/emenda antigo cuja API de detalhe devolve
`uriPropPrincipal: null` (SBT-A 247, EMC-A 21, SBT 8, SBE-A 3, EMR 1). Verificado na API (`/proposicoes/2141092`): sem principal
também em `/relacionadas`. Não há como provar a raiz; a UI mostra "A cadeia oficial até a matéria raiz não pôde ser completada".

## Performance (EXPLAIN ANALYZE, consulta pai → filhos com autores)

Antes: sem índice em `principal_id`; o plano usava `proposals_filters_idx` (varredura reversa + filtro). Depois: `proposals_principal_idx`.
Tempos de 4 execuções quentes (5 execuções, primeira fria descartada), banco local, sem concorrência.

| Filhos | Antes (ms / buffers) | Depois (ms / buffers) |
|---|---|---|
| 1 (PLP 14/2026) | 4,5–7,1 / 2.472 | 0,8–1,9 / 8 |
| 10 (PL 302/2026) | 6,2–10,2 / 2.508 | 1,2–2,0 / 51 |
| 78 (PL 278/2026) | 8,0–15,3 / 2.804 | 3,3–4,3 / 395 |
| 112 (MPV 1357/2026) | 11,2–12,9 / 2.937 | 3,0–4,0 / 565 |
| 427 (MPV 1343/2026) | 21,3–31,6 / 4.182 | 8,2–10,2 / 2.056 |

O custo deixou de depender do tamanho da tabela. A página usa `LIMIT 25`, então a MPV 1343 também lê só uma página por vez.
Páginas em dev (Next, `force-dynamic`): 0,3–1,0 s no servidor; `?emendas=EMC&pagina_emendas=18` retorna os 2 últimos de 427.

## Autores

`dedupeAuthors` agrupa por nome normalizado (sem acento/caixa) dentro da mesma proposição, preferindo o registro com partido/UF
(ex.: EMC 110/2026, Luis Carlos Heinze, aparecia 3 vezes). Coautores com nomes distintos são preservados. Aplica-se à lista de
emendas e ao bloco "Autoria". A tabela `proposal_authors` não foi alterada.

## Fase 5: /proposicoes (recomendação editorial)

Dados disponíveis hoje: 5.169 emendas/substitutivos em 2026; 2.071 matérias receberam ao menos uma; média 2,5, mediana 1;
PL: 1.795 matérias / 3.394 emendas (média 1,9); **MPV: 14 matérias / 1.191 emendas (23% do total, média 85, máx. 427)**;
substitutivos (SBT/SBT-A) como pai de outras emendas: 165 matérias.

Recomendação: **não adicionar cards ao `/proposicoes`.** O que cabe na visão geral é uma única ideia editorial, a concentração
(MPVs recebem quase um quarto das emendas com 14 matérias), e a página já tem o lugar certo para isso: `CaseSection`, que hoje usa
a MPV 1343 de forma fixa e mistura todos os objetos relacionados. Sugestão futura (não implementada): reescrevê-la para derivar a
matéria mais emendada do dado em vez de `MPV_CASE`, e acrescentar uma frase de composição ("N matérias receberam emendas, mediana 1").
Ranking de matérias, distribuição por sigla, cadeias profundas e "maior disputa textual" pertencem ao `/explorar`
(`?grupo=emendas_substitutivos`), onde já há filtro e paginação. Isso exigiria: filtro `?materia=ID` (trivial com o novo índice) e
ordenação por nº de filhos (agregado, precisa de materialização se for padrão). Não implementado nesta etapa.

## Limitações restantes

- 280 cadeias terminam em substitutivo/emenda antigo sem principal oficial (ver acima). Os 7 pais além da profundidade 5 foram resolvidos com o limite 10.
- Matérias históricas não têm tramitação, autores nem votações, só identificação, ementa, situação e temas.
- Apensação: `confirmada` depende de a matéria citada existir na base; a maioria dos casos aparece como `nao_comprovada`.
- Matérias de suporte não aparecem no `/explorar` nem em agregados (de propósito); só são alcançáveis por link.
- Senado: continua sem emendas no lote ativo e sem `principal_id`; o caminho legado por átomos permanece.
- Rótulos de SBT/EMC se repetem por órgão (vários "SBT 1"); a lista mostra o ID para distinguir; o órgão numerador não está em
  `civica_poc.proposals` (`payload` nulo).
- `npm test`: 212 testes, 9 falhas em suítes que não toquei (eleitoral, migrações SQLite, comparação de custos, CLI institucional,
  mercado de fornecedores); os 28 testes de proposições/resolvedor/grafo passam. Não comparei com um baseline limpo.
- Execução da carga ampla fez ~12 mil requisições à API pública; reexecuções só buscam pais novos.

## Auditoria final de consistência

Medições de 2026-10-05, somente leitura (`scripts/audit-support-contamination.ts`, `scripts/audit-pec221.ts`,
`scripts/measure-proposition-graph.ts`; as consultas de reconciliação rodaram sobre as mesmas tabelas).

### 1. Os dois baselines (1.404 × 1.331)

Mesma definição de "raiz" (nó do grupo `proposicoes_legislativas_principais`), recalculada:

| | Emendas |
|---|---|
| Cadeia inteira dentro do catálogo ativo (`proposals`) chega à raiz | **1.331** |
| + pai imediato ausente do catálogo, mas com `parent_type` PL/PLP em `proposal_parent_context` (contexto legado) | **+73** |
| Baseline da investigação anterior (conta o tipo do contexto como raiz, sem o nó) | **1.404** |

Os 73 vêm de 73 pais distintos (PL 72, PLP 1), todos a profundidade 1; filhos: EMC 30, EMC-A 12, SBT-A 12, EMP 11, EMR 5, SBT 2,
ESB 1. A investigação anterior aceitava o tipo gravado no contexto; o relatório pós-implementação usa só nós que existem
(catálogo ou suporte). Hoje os 73 pais estão em `proposal_support`, são do grupo "principais" e entram nos 4.889. Não há divergência de dados, só de definição.

### 2. Reconciliação 5.169 = 4.889 + 280 (categorias mutuamente exclusivas)

| Categoria (fim da cadeia oficial) | Emendas |
|---|---|
| Raiz alcançada em 1 salto | 4.744 |
| Raiz alcançada em 2 saltos | 138 |
| Raiz alcançada em 3+ saltos | 7 |
| **Subtotal chegam à raiz** | **4.889** |
| Termina em SBT-A sem `uriPropPrincipal` na API | 247 |
| Termina em EMC-A sem `uriPropPrincipal` na API | 21 |
| Termina em SBT sem `uriPropPrincipal` na API | 8 |
| Termina em SBE-A sem `uriPropPrincipal` na API | 3 |
| Termina em EMR sem `uriPropPrincipal` na API | 1 |
| **Subtotal não chegam à raiz** | **280** |
| Cortadas por limite de profundidade / pai não resolvido / ciclo | 0 / 0 / 0 |
| **Total** | **5.169** |

**Os 7 `pending` NÃO estão contidos nos 280.** Nenhum dos 7 aparece em cadeia de emenda alguma (0 de 7 em qualquer cadeia;
0 como pai imediato de emenda). Eles pertencem a cadeias de apensação de PL/PRL (item 7). Os 280 vêm todos de uma causa só (item 6).

### 3. Por que 1.764 pais de emendas viraram 6.169 matérias de suporte

`proposal_support` guarda todo pai ausente do catálogo, de qualquer filho, não só de emendas. O escopo `amendments` resolveu 1.764
pais diretos (+4 recursivos); o escopo `all` acrescentou os pais dos demais grupos.

| Origem | Matérias |
|---|---|
| Diretas (profundidade 1) | 5.772 |
| ↳ pais de ao menos uma emenda/substitutivo | 1.764 |
| ↳ pais só de filhos de outros grupos | 4.008 |
| Recursivas (pai do pai, profundidade 2–5: 224 / 108 / 48 / 17) | 397 |
| **Total** | **6.169** |

Diretas, por grupo funcional do filho que apontou para elas (não exclusivo; um pai pode ter filhos de vários grupos):
pareceres 4.056, emendas 1.764, ofícios/documentos 1.090, instrumentos de votação 1.065, atos especiais 711, requerimentos 633,
matérias principais 472, mensagens 46, recursos 13, indicações 5. Só um grupo: 3.225 (pareceres 1.592, ofícios 571, principais 398,
requerimentos 332, emendas 183, instrumentos 136, outros 13); mais de um grupo: 2.547.
Recursivas, por grupo do filho de origem: principais 309, requerimentos 77, emendas 4, pareceres 4, instrumentos 3
(nenhuma recursiva é pai direto de emenda).

Pais usados por vários filhos (buscados uma vez): 3.986 das 5.772 diretas têm ≥2 filhos no catálogo (1: 1.786; 2–5: 3.201; 6–20: 695;
21–100: 85; 100+: 5; máximo 248). 21.092 filhos do catálogo apontam para matérias de suporte.

Por sigla (maiores): PL 4.163, PDL 844, TVR 686, PLP 116, PEC 44, REQ 41, MPV 28, MSC 24, PLN 20, SBT-A 120, EMC-A 13, e mais 15 siglas
com 1 a 14 cada (26 siglas no total). Por grupo da própria matéria: principais 5.230, atos especiais 708, emendas 149,
requerimentos 46, mensagens 24, recursos 7, indicações 5.
Por ano da matéria: 2025 = 2.897; 2024 = 999; 2023 = 648; 2019 = 296; 2021 = 293; 2022 = 225; 2020 = 140; 2015 = 97; 2017 = 77;
2016 = 56; 2018 = 54; anos de 1995 a 2014 somam 243; **sem ano (`ano=0` na API): 144** (SBT-A 120, EMC-A 13, SBT 7, SBE-A 2,
EMR 1, EMC 1), todos apresentados antes de 2026; **nenhuma tem ano 2026**.
O alto volume vem do próprio escopo: 21 mil filhos do catálogo (pareceres, destaques, requerimentos) apontam para matérias
anteriores, e cada uma é uma matéria distinta.

### 4. Auditoria de contaminação

Prova estrutural: só três pontos de código leem `civica_poc.proposal_support`: o grafo (`postgres-proposition-graph.ts`), o rótulo do
pai na listagem (`postgres-propositions.ts`, `LEFT JOIN` pela PK `(source, external_id)`, que não multiplica linhas) e o resolvedor.
Nenhum código de `apps/web/lib` (KPIs, composição, ritmo, DNA, buscas, facetas) a referencia; todos leem `civica_poc.proposals`
com join em `active_publications`. A PK impede duplicidade (0 chaves duplicadas) e **0 ids de `proposal_support` existem no catálogo**.

Prova empírica: KPIs das funções da própria UI × SQL só do catálogo ativo (independente de `proposal_support`):

| KPI | App (UI) | SQL só catálogo | Referência pré-existente |
|---|---|---|---|
| Total de proposições (ambas as Casas) | 84.623 | 84.623 | 44.356 + 40.267 (`proposition_batches.proposal_count`, anterior ao suporte) |
| Câmara | 44.356 | 44.356 | 44.356 |
| Proposições de 2026 (`year=2026`) | 24.340 | 24.340 | |
| Distribuição por grupo funcional | igual | igual | |
| Listagem sem filtro (total) | 84.623 | | |
| Câmara, ano 2019 | **0** | | PEC 221/2019 não vira "proposição de 2019" na lista |
| Tipo PEC, Câmara | 6 | 6 | `proposal_support` tem 44 PEC, nenhuma entra |
| Tema "Direito Constitucional", Câmara | 15 | 15 | temas do suporte (3.750+) estão em tabela própria |
| Autorias vinculadas a matérias de suporte | 0 | | `proposal_authors` não tem linha de suporte |
| Vínculos de autoria de proposições de 2026 | 35.363 | | só catálogo |
| Linhas de `proposal_themes` para ids de suporte | 0 | | |

`/legislativo/proposicoes` usa `propositionOperationalBundle(2026)`: 24.340 em 2026, `years = [2026]` (o suporte não cria ano). Ritmo, DNA
e rankings partem de `proposal_authors`/catálogo; como não há autores de suporte, produção parlamentar não muda.
Rankings do projeto (votos, despesas) não leem proposições. Busca "PEC 221/2019" na Câmara retorna 87 itens do catálogo
(proposições que citam a PEC na ementa); a página 2233802 só é alcançável por link/id.

Matéria de suporte: tem página navegável, serve de pai/contexto e recebe filhos. Não vira proposição de 2026, não entra em totais,
anos, siglas, grupos, temas, autoria nem busca.

Ressalva de definição: 12 matérias de suporte têm `presented_at` em 2026, mas identidade (ano do número) anterior: PL 6674/2025,
PLP 73/2025, PEC 22/2025, PL 896/2023, entre outras. A Câmara as classifica por ano do número (lista anual), não pela data
da última apresentação; por isso não estão no lote 2026. Os KPIs da UI usam `year`, então a regra é consistente. Não é contaminação.

### 5. Ponte entre universos: PEC 221/2019

- `2233802`: 1 linha em `proposal_support`, 0 em `proposals`; o detalhe do catálogo devolve `null`; a página vem do suporte.
- Filhos em `proposals` apontando para ela: **176** (correção: o relatório anterior dizia 175): requerimentos 142, instrumentos de votação 24,
  emendas/substitutivos 5, pareceres 4, atos especiais 1.
- A seção de emendas devolve exatamente os 5 ids do SQL (2624861, 2624863, 2627575, 2628466, 2628653), por sigla EMC 2, EMA 1, SBT 1,
  SBT-A 1; ano 2019, `catalogRole = relationship_support`, temas Direito Constitucional e Trabalho e Emprego.
- Sentido inverso: EMA 1 (2628653) mostra pai "PEC 221/2019" (suporte, `hasPage = true`) com os mesmos temas.

### 6. As 280 emendas sem raiz

Todas terminam em 143 matérias de suporte distintas cujo detalhe oficial (`uriPropPrincipal`) é `null`. Lido do JSON bruto salvo
de cada uma: 143 de 143 com `uriPropPrincipal` nulo, 0 com `uriPropAnterior`/`uriPropPosterior`.

| Tipo do fim da cadeia | Matérias | Emendas | Motivo |
|---|---|---|---|
| SBT-A | 120 | 247 | API retorna `uriPropPrincipal = null` |
| EMC-A | 13 | 21 | idem |
| SBT | 7 | 8 | idem |
| SBE-A | 2 | 3 | idem |
| EMR | 1 | 1 | idem |
| Limite de profundidade | 0 | 0 | |
| Informação ausente / pai não resolvido | 0 | 0 | |
| Outro motivo | 0 | 0 | |

### 7. Os 7 pais pendentes (profundidade 6)

Todos são cadeias de apensação de PL/PRL. Filho no catálogo → pais resolvidos (prof. 1–5) → pendente (prof. 6):

1. PL 1031/2026 → PL 2087/2020 → PL 3290/2015 → PL 3151/2015 → PL 6772/2013 → PL 2137/2011 → **2163151**
2. PRL 1 (2624881) → PL 4649/2019 → PL 6485/2016 → PL 4504/2016 → PL 2622/2015 → PL 2549/2011 → **422067**
3. PL 2779/2026 → PL 4119/2023 → PL 3923/2020 → PL 1101/2019 → PL 6211/2016 → PL 5510/2013 → **2299910**
4. PL 1435/2026 → PL 815/2023 → PL 4593/2020 → PL 4198/2020 → PL 3981/2020 → PL 4167/2015 → **2057079**
5. PL 2777/2026 → PL 4672/2024 → PL 1363/2023 → PL 2543/2022 → PL 5664/2019 → PL 2172/2019 → **2195292**
6. PL 2681/2026 → PL 828/2025 → PL 2321/2023 → PL 10857/2018 → PL 2690/2015 → PL 143/2007 → **105934**
7. PL 497/2026 → PL 4213/2023 → PL 7352/2014 → PL 613/2011 → PL 3286/2008 → PL 2881/2008 → **365794**

Consulta pontual e sem gravação à API oficial dos 7 pendentes: 4 são raízes (PL 9162/2017, PL 4253/2019, PL 1721/2019, PL 291/2003,
`uriPropPrincipal = null`), então o corte perde só o último nó; 3 continuam por relação oficial válida (PL 4564/2008 → 302376,
PL 3789/2015 → 955602, PL 1941/2007 → 359374). Nenhuma dessas cadeias envolve emendas. O limite 5 corta, portanto, relações oficiais
válidas em 3 cadeias de 6.169 e não afeta nenhuma das 5.169 emendas. Cadeias de apensação a 6 saltos são raras, mas existem;
o limite não foi alterado nesta auditoria (foi elevado a 10 nos Ajustes finais).

### 8. Falhas de teste

As 9 falhas são preexistentes. Rodei a mesma lista de `npm test` em um worktree limpo do commit `fa19f83` (sem nenhuma alteração
minha nem do trabalho em andamento) e os 9 nomes de teste falham igualmente: lote eleitoral, migrações, comparação de custo, hub
unificado, mix de categorias, filtro por Casa, CLI institucional, itens de pauta, explorador de fornecedores. Baseline: 208 testes,
198 passam, 9 falham. Atual: 212 testes, 202 passam, 9 falham (+4 testes novos do grafo, todos passam). Causa vista em um deles:
`table supplier_aggregate_revisions has 10 columns but 4 values were supplied`; nenhum toca proposições.

### Gate da auditoria de consistência (antes dos ajustes finais)

**PROPOSITION_GRAPH = PASS_WITH_CAVEATS**

- Passa: reconciliação fecha em 5.169 com categorias exclusivas; diferença 1.404/1.331 explicada por definição (73); 7 pendentes
  fora dos 280; 6.169 explicados (5.772 diretas + 397 recursivas); KPIs do catálogo idênticos ao SQL independente; nada do suporte
  em totais, anos, siglas, grupos, temas, autoria, listagem ou busca; ponte suporte → filhos validada na PEC 221/2019; 9 falhas
  preexistentes comprovadas.
- Ressalvas: 280 emendas (5,4%) sem raiz oficial provável (a API não informa); 3 cadeias de apensação cortadas pelo limite 5 (fora
  das emendas); apensação quase sempre `nao_comprovada`; 12 matérias de suporte com data de apresentação em 2026 e identidade
  anterior; páginas verificadas por HTML renderizado, sem screenshots; a contagem de filhos da PEC 221/2019 era 176, não 175.

## Ajustes finais

### A. Limite de profundidade: 5 → 10

Mudança: `DEFAULT_MAX_DEPTH = MAX_DEPTH_CAP = 10` em `postgres-principal-resolver.ts` (o teto continua existindo, não há modo
ilimitado), padrão do CLI `collect-camara-principals --max-depth` em 10 e `MAX_ANCESTRY_DEPTH` da caminhada de ancestrais da UI de 6 para 10.
Ciclos já eram barrados por PK da fila + `visited` + teto, e a idempotência vale para qualquer profundidade.

| Medida | Antes (limite 5) | Depois (limite 10) |
|---|---|---|
| Pais `pending` | 7 (todos em profundidade 6) | **0** |
| Matérias de suporte | 6.169 | 6.178 (+9) |
| Fila por profundidade (resolvidos) | 5.772 / 224 / 108 / 48 / 17 / 0 / 0 | 5.772 / 224 / 108 / 48 / 17 / **7 / 2** |
| Profundidade máxima real na fila | 5 (6 pendente) | **7** |
| Maior nº de saltos a partir de um filho do catálogo | 7 (cadeia aberta) | **8** (fechada) |
| Cadeias abertas a partir de filhos do catálogo | 8 | **0** |
| Ciclos no grafo de suporte (6.178 nós) | 0 | 0 |
| Requisições adicionais | | **18** (9 pais × detalhe + temas), 0 falhas |
| Tempo da execução | | 3,5 s |

Os 9 pais novos são os 7 pendentes mais 2 de profundidade 7 (das 3 cadeias com relação oficial adiante, 2 exigiram um nível novo e
a outra já apontava para uma matéria conhecida). A profundidade real máxima é 8 saltos a partir de um filho do catálogo, abaixo do teto 10. Métricas das emendas inalteradas
(4.889 chegam à raiz, 280 sem raiz oficial, 0 ciclos). Impacto de desempenho: nenhum no uso normal; a execução é incremental
(só busca pais novos) e a caminhada de ancestrais da página para no primeiro nó do grupo "principais", então cadeias de apensação
de PL não são percorridas inteiras (emendas têm até 3 níveis).

Teste `tests/unit/principal-depth.test.ts` (PostgreSQL local, transação revertida, cliente HTTP falso, sem rede, nada persiste):
- cadeia oficial de 7 níveis SBT → SBR → SBT-A → EMC-A → SBE-A → ESB → PL;
- com `maxDepth = 5` resolve 5 níveis e deixa o 6º `pending` (o limite existe e é respeitado);
- com o padrão (10) resolve os 7 até a raiz oficial (`uriPropPrincipal` nulo), preserva o ano real e busca cada pai uma vez;
- `loadRelationGraph` atravessa os 7 níveis (`reachesRoot`, sem truncar; o limite anterior de 6 truncaria);
- ciclo A → B → A: cada pai é buscado uma vez, sem laço, e o ciclo é detectado.

### B. Semântica do ano

Regra de dados atual (não alterada): os recortes anuais usam `year`, o **ano do número** da proposição. A Câmara informa `ano = 0` para
tipos numerados por órgão (pareceres, destaques, substitutivos, várias emendas), e essas proposições ficam fora de qualquer recorte
`year = 2026`, mesmo apresentadas em 2026. As 12 matérias de suporte com `presentedAt` em 2026 e ano do número anterior (item 4 da
auditoria) são uma instância pequena do mesmo fenômeno; elas nem entram no catálogo (a lista anual é por ano do número).

Câmara, catálogo ativo, `year = 2026` × apresentadas em 2026 (data, fuso de São Paulo):

| Grupo funcional | Por `year` (UI) | Por data de apresentação |
|---|---|---|
| Matérias principais | 6.178 | 6.175 |
| Requerimentos | 9.286 | 9.284 |
| Pareceres e relatórios | 40 | 10.758 |
| Instrumentos de votação (destaques, RPD) | 21 | 6.821 |
| Emendas e substitutivos | 1.458 | 4.791 |
| Atos e documentos especiais | 650 | 1.673 |
| Ofícios, mensagens, indicações, recursos | iguais | iguais |
| **Total Câmara** | **22.102** | **43.971** |

Diferença: 22.254 proposições da Câmara com `ano = 0` (PRL 6.872, RPD 6.519, PAR 2.949, SBT 1.543, RDF 715, SBT-A 636, PARF 542,
EMR 454, EMP 423, EMC-A 313, PRLP 283, DTQ 245…), todas apresentadas em 2026. Senado: matérias principais 531 por `year` × 852 por
data (323 de ano de número anterior, apresentadas em 2026).

Onde a UI afirmava "apresentadas em 2026" com filtro `year = 2026` (ajustado, sem mudar a regra):

| Local | Antes | Depois |
|---|---|---|
| `stage-section.tsx` (título do rio de tramitação) | "Matérias principais apresentadas em {ano}" | "Matérias principais com ano {ano}" |
| `stage-river.tsx` (rótulo acessível) | "…matérias principais apresentadas em {ano}" | "…com ano {ano}" |
| `data-postgres.ts` (nota da etapa "Apresentação") | "Matérias principais apresentadas em {ano}." | "…com ano {ano} (ano do número da proposição)." |
| `rhythm-section.tsx` (modo "Novas proposições") | "Proposições por mês de apresentação, {ano}" | "Proposições com ano {ano}, por mês de apresentação" |
| `hero.tsx` (total por Casa) | "N proposições em {ano}" | "N proposições com ano {ano}" |
| `composition-section.tsx` | já dizia "com ano {ano}" | + nota: o recorte usa o ano do número; pareceres, destaques e várias emendas da Câmara ficam fora, mesmo apresentados no ano |
| `/explorar` (filtro avançado) | "Ano" | "Ano do número" |

Blocos que **não** usam `year`: os cartões do `/explorar` ("Apresentada em" mostra a data) e a página de detalhe. Correção (investigação
YEAR_SEMANTICS): uma versão anterior deste texto dizia que "Recentes" usa a data de apresentação sem filtro de ano. Está errado: todo o
pacote operacional de `/proposicoes` (composição, ritmo, calendário, recentes, DNA) parte de `WHERE p.year = $1`, e os eventos só contam se
a matéria tem `year = $1`; "Recentes" também exclui os itens `ano = 0`. Ver `proposition-year-semantics.md`.

Decisão de produto em aberto (não aplicada automaticamente): contar tipos com `ano = 0` pelo ano da data de apresentação mudaria o total
da Câmara de 22.102 para 43.971 e a composição por função de forma relevante (pareceres 40 → 10.758). Recomendação: tratar como
decisão editorial própria, com cobertura declarada, e não como correção silenciosa.

Script: `scripts/audit-year-semantics.ts` (somente leitura).

### Gate final

**PROPOSITION_GRAPH = PASS_WITH_CAVEATS**

- Passa: limite 10 fecha as 8 cadeias abertas (0 pendentes, 0 ciclos, 18 requisições, profundidade real máxima 7 na fila e 8 saltos), sem
  efeito nas 5.169 emendas; teste de cadeia de 7 níveis, limite e ciclo passa e não deixa dados; textos de ano alinhados ao filtro
  `year`; 213 testes, 203 passam, as mesmas 9 falhas preexistentes; typecheck limpo.
- Ressalvas: 280 emendas (5,4%) sem raiz oficial provável (API devolve `uriPropPrincipal` nulo); apensação quase sempre `nao_comprovada`;
  recortes anuais da Câmara excluem 22.254 proposições com `ano = 0` (decisão de produto pendente, apenas documentada e rotulada);
  páginas verificadas por HTML renderizado, sem screenshots.
