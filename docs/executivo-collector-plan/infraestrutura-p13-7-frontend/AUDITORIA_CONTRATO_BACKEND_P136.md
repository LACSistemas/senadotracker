# P13.7 — Auditoria do contrato de backend (P13.6)

Leitura completa de `packages/db/src/exec/infrastructure-read.ts` (exportado via `index.ts`) e dos documentos de `docs/executivo-collector-plan/infraestrutura-p13-6-serving/`. Base factual para toda a implementação de frontend — nenhum parâmetro ou campo abaixo foi inventado.

## Tipos base

```ts
type InfrastructureLevel = 'BRASIL' | 'UF' | 'MUNICIPIO';
interface InfrastructureTerritory { level: InfrastructureLevel; ufCode?: number; ibge7?: string | number }
type Availability = 'AVAILABLE' | 'PARTIAL_COVERAGE' | 'NOT_REPORTED' | 'NOT_COLLECTED' | 'SOURCE_BLOCKED' | 'NOT_APPLICABLE' | 'NOT_PUBLISHED' | 'OUTSIDE_REFERENCE_GEOGRAPHY' | 'UNDER_REVIEW' | 'STALE' | 'UNVERIFIED_RELATION';
```

Na prática, `valueStatus()` só emite `AVAILABLE` / `NOT_REPORTED` / `SOURCE_BLOCKED` hoje — os outros 8 estados são contrato, não observados em runtime pelos indicadores. `getInfrastructureWorkDetail().availability` usa a string `'NOT_EVALUATED'` para `completion`/`operation`, que **não pertence** ao enum `Availability` — tratar no frontend como um tipo próprio (`Availability | 'NOT_EVALUATED'`), sem alterar o backend.

## Funções exportadas

| Função | Territórios/filtros | Observação |
|---|---|---|
| `getInfrastructureIndicators(q,t,{code?,family?,from?,to?,limit?})` | BRASIL/UF/MUNICIPIO; `limit` 1–500 (default 200) | Só o período mais recente por indicador |
| `getInfrastructureIndicatorDetail(q,t,idOuCode)` | — | Série completa + comparação UF/Brasil quando aplicável |
| `getInfrastructureCoverage(q,t?,family?)` | — | Lê `exec_infra_coverage_snapshot`; disponibilidade por território calculada em JS |
| `getInfrastructureFamilies(q,t?)` | — | Agrega cobertura por `source_family` |
| `getInfrastructureEditorialKpis(q,t)` | máx. 8 | **Não prioriza variedade de dimensão** — pega os 8 primeiros por `indicator_id` com valor. Resolver no frontend (`lib/infrastructure/catalog.ts`) |
| `getInfrastructureWorksOverview(q,t)` | — | `exec_work_territory_rollup`; `allocated_*` nulo quando multimunicipal (nunca rateado) |
| `getInfrastructureWorksList(q,t,{page?,pageSize?,status?,category?,agency?,hasPhysicalMeasurement?,hasContracts?,hasPayment?,territorialScope?,periodFrom?,periodTo?})` | pageSize 1–100 (default 25) | `category`/`agency`/`has*`/`territorialScope`/`period*` implementados nesta fase (G0.7) — ver `CORRECOES_G0_P137.md` |
| `getInfrastructureWorkDetail(q,projectId)` | — | Enriquecido nesta fase com `situation_label`,`category_label`,`nature_label`,`agency_name`,`system_label`,datas previstas/efetivas |
| `getInfrastructureWorkFinancialEvidence(q,projectId,page,pageSize)` | pageSize 1–500 | `stages` = soma total sobre todos os empenhos, não só a página |
| `getInfrastructureFacilities(q,t,facilityType?,page,pageSize)` | pageSize 1–500 | |
| `getInfrastructureLogistics(q,t)` | — | Facilities sem paginação própria (só 1ª página, até 100) |
| `getInfrastructureEnergy(q,t,{code?})` | — | Família derivada do prefixo de `code` |
| `getInfrastructureUrbanConditions(q,t)` | — | Fixo `family:'ENTORNO_IBGE'` |
| `getInfrastructureHousing(q,t)` | — | Fixo `family:'FAVELAS'` — **não** inclui FJP nem Internet domiciliar |
| `getInfrastructureWaterSecurity(q,t)` | — | Fixo `family:'SNISB'` (barragens, não água/saneamento geral) |
| `getInfrastructureFreshness(q,t?)` | — | `lastKnownGood`/`stale` **hardcoded** (`true`/`false`) — não reflete staleness real |
| `getInfrastructureIndicatorComparison(q,t,idOuCode)` | — | Atalho sobre `getInfrastructureIndicatorDetail` |
| `getInfrastructureOverview(q,t)` | — | **Ponto de entrada da página de overview** — agrega tudo num `Promise.all` |

Sem atalho nomeado para SINISA (água/saneamento) nem PEMOB/MUNIC_TRANSPORTE (mobilidade) — usar `getInfrastructureIndicators(q,t,{family:'SINISA'|'PEMOB'|'MUNIC_TRANSPORTE'})`.

## Schema de obras (Obrasgov)

`exec_work_c_project` (situation_code/nature_code/species_code → `exec_work_c_text` por `kind`: 1=situação, 2=natureza, 3=espécie/categoria; `org_id` → `exec_work_c_org.name`; `d_start_prev`/`d_end_prev` cobrem 154.999–155.000 de 155.037 projetos — período confiável; `d_start_eff`/`d_end_eff` só ~1.200–1.700 projetos — não usar como filtro primário), `exec_work_c_location` (multi-linha = multimunicipal), `exec_work_c_contract`, `exec_work_c_commitment` (value_cents/liquidation/paid — nunca somados entre si), `exec_work_c_physical` (percentual, nunca ⇒ entregue), `exec_work_c_history`, `exec_work_verified_links_v` (PNCP — hoje 0 vínculos), `exec_work_project_overview_v` (agregados pré-computados: location/contract/commitment/physical/history counts).

## Benchmarks reais (P13.6, nível de serviço — não é página renderizada)

Overview município: p50 ~5-7ms (outlier p95 169ms em 1 caso isolado, Vitória — investigar antes de usar como SLA). Overview UF/Brasil: <5ms. Detalhe de obra: até 13ms. Listagem nacional de obras: p50 107ms/p95 148ms (2 queries). P13.7 deve medir TTFB/LCP reais de página, não reusar isso como proxy de performance de frontend.

## Lacunas resolvidas nesta fase (G0)

Ver `CORRECOES_G0_P137.md` para a causa raiz investigada de MMGD (5.567×5.548, 19 municípios com defeito de serving), Atlas Águas (códigos 4300001/4300002), município novo pós-Censo (5101837, Boa Esperança do Norte/MT) e o conserto de encoding em `infrastructure-read.ts`.
