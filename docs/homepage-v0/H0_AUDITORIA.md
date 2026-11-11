# H0 — Auditoria da homepage e dos dados

Auditoria read-only. Reaproveita extensivamente achados já verificados nas fases anteriores desta sessão (`docs/executivo/E0_AUDITORIA_E_FONTES.md`, `docs/judiciario-redesign/J0_AUDITORIA_E_CONTRATOS.md`) — não repete verificação do que já está provado.

## 1. Estado real da homepage atual

`apps/web/app/page.tsx` é de uma fase anterior do produto: hero `InstitutionHero` genérico ("Quem representa você?"), busca de parlamentares, destaques legislativos reais, dois "InstitutionPortal" (Legislativo pronto; **Judiciário marcado como "em breve", com o texto "Ainda não há dados judiciais publicados neste produto" — hoje FALSO**, já que P14.x está completo e verificado) e nenhuma menção ao Executivo. Confirma exatamente o diagnóstico do mandato.

## 2. Busca: o que existe de verdade

`apps/web/lib/search.ts` (`searchAll`, usado por `GlobalSearch` via `/api/busca`) cobre **só 2 tipos**: `pessoa` (`civica_people_poc.profiles`, 594 registros = 513 deputados federais + 81 senadores) e `partido`. **Não busca município, estado nem tribunal.** Não existe deputado estadual nesta tabela (os hosts de assembleias em `PORTRAIT_ALLOWED_HOSTS` são do retrato de governador/prefeito via TSE, não de parlamentar estadual).

**Decisão:** estender `searchAll` para federar também estado (via `loadStates()`, já carregado em memória) e município (via `findMunicipalities`, já existe) e tribunal (via `loadJudiciaryTribunalDirectory({search})`, já existe) — 3 consultas leves a mais no mesmo padrão `Promise.all` já usado, sem nova infraestrutura de índice. `SearchHit.kind` ganha 3 valores novos (`estado`, `municipio`, `tribunal`).

## 3. Números do hero do mock — auditados

| Número do mock | Real? | Valor real verificado | Já provado em |
|---|---|---|---|
| IDH-M 2023, 0,761 | **Não** — não existe 2023 nesta base | **0,727 (2010)**, único ano recente disponível | `E0_AUDITORIA_E_FONTES.md` §3 |
| 203,1 milhões habitantes (2026) | Próximo, não exato | **214.211.951** (soma real das 27 UFs) | idem |
| 513 deputados federais | **Sim, exato** | 513 | `civica_people_poc.profiles` |
| 91 tribunais | Próximo, não exato | **93 instituições** (27 TJ + 6 TRF + 25 Trabalho + 28 Eleitoral + 3 Militar + 2 Superior + STF + CNJ) | `J0_AUDITORIA_E_CONTRATOS.md` §6 |
| R$ 5,7 tri despesa da União (2025) | **Não verificável** | não existe no projeto uma tabela de despesa da União por categoria/natureza — só recortes por domínio (segurança, educação) | ver §5 abaixo |

## 4. "+1,8 mil parlamentares" da faixa de abrangência

Não é real. O total de parlamentares federais é **594** (513+81); não há parlamentares estaduais nesta base. Vou usar o número real, com rótulo preciso ("594 parlamentares federais" ou separado por casa), nunca "+1,8 mil".

## 5. Donut de gastos públicos — não construível

Investigado: `financas-read.ts` tem `getSecurityFinanceUnion`/`getSecurityFinanceOrgans`, mas **só para o recorte de segurança** (MJSP) — não existe uma leitura de "despesa da União por natureza" (Previdência, Pessoal, Juros, Investimentos) de propósito geral. Reproduzir o donut do mock exigiria inventar uma categorização que a base não sustenta — exatamente o que o mandato veda em §6.3 e §12.

**Decisão:** substituir por uma história real e honesta de "gastos que já conseguimos verificar", comparando números reais de domínios diferentes (custo médio mensal por deputado, despesa nacional com magistrados do STF — R$34,5bi, já publicada em `/judiciario`) — sem fingir que é o orçamento total da União.

## 6. Histórias de dados — viabilidade real

| História | Visualização do mock | Dado real disponível | Decisão |
|---|---|---|---|
| Educação | Mapa de Ideb por estado, 2023 | `getIdebTerritory({ufCode, stage:1})` já funciona por UF — testado ao vivo (ES 2025 = 6,6) | Mapa real, edição **2025** (mais recente), não 2023 |
| Justiça | Série de entradas × baixas, 2019-2024 | `loadJudiciaryNationalSeries(['JN_CASES_NEW_G1','JN_CASES_NEW_G2','JN_DISPOSED'])` já existe e já é usada em `/judiciario` | Reaproveitar sem nenhuma mudança, série real 2009-2025 (eu uso o range completo, não recorto para bater com o mock) |
| Gastos públicos | Donut de categorias da União | Não existe (ver §5) | Substituída por comparação real entre domínios |

## 7. Componentes reutilizáveis confirmados

- `InstitutionHero` com `imageUrl` — mesma técnica das 3 fases anteriores desta sessão.
- `paintStateMap`/`mapMarkup`/`sequentialRamp` — mapa nacional, já usado em `/estados` e `/executivo`.
- `PartyHemicycle` (`components/party-hemicycle.tsx`) — hemiciclo real já pronto para o módulo do Legislativo.
- `MultiLineChart`/`RankedBars` (`components/charts.tsx`) — séries e rankings, já usados no Judiciário.
- `GlobalSearch` — será estendida, não recriada.
- Atalhos territoriais (`MunicipalFinder`, `isUf`) e o resolvedor `/executivo/buscar` — mesmo padrão para a seção território desta página.

## 8. Rotas de destino confirmadas (nenhum CTA vai para rota inexistente)

`/legislativo`, `/executivo`, `/judiciario`, `/estados`, `/municipios`, `/judiciario/comparar` (comparar territórios — na verdade comparador do Judiciário; **não existe um "comparar territórios" genérico de Executivo/saúde/educação** — o CTA "Comparar territórios" do mock será direcionado para o recurso real mais próximo ou reformulado), `/metodologia`.

## Gate H0

Todo número do hero e das 3 histórias tem fonte real verificada ou foi substituído por uma alternativa real documentada. A busca federada é viável sem nova infraestrutura. **Pronto para iniciar H1.**
