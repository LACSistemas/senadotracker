# P13.7 — Contrato do módulo de Obras Públicas

## Armadilha crítica: unidades mistas (centavos × reais)

Nos agregados de obras (`exec_work_territory_rollup`, usados por `getInfrastructureWorksOverview` e `getInfrastructureWorksList`):

- `allocated_planned`, `allocated_contracted`, `allocated_committed` (e, na lista de obras, `allocated_planned_amount`/`allocated_contract_amount_global`/`allocated_committed_cents`) são somas de colunas `bigint` do Obrasgov (`planned_amount`, `amount_global`, `value_cents`) — **centavos**.
- `allocated_liquidated`, `allocated_paid` (e `allocated_paid` na lista) são somas de colunas `numeric` (`liquidation`, `paid` em `exec_work_c_commitment`) — **já em reais**, com centavos como fração decimal.

Confirmado empiricamente: um projeto de UBS com `planned_amount=201282500` (centavos) = R$ 2.012.825,00 — valor plausível; se tratado como reais diretos, daria R$ 201 milhões para um posto de saúde, implausível.

`lib/infrastructure/format.ts` exporta `centsToReais(v)` com comentário explícito sobre quais campos dividir por 100 e quais não. Usado em `load.ts` (overview) e `works.ts` (lista e detalhe). Verificado com um caso real de ponta a ponta (obra #89442): R$ 700,0 mi previsto / R$ 9,1 bi contratado / R$ 3,1 bi empenhado / R$ 53,7 mi liquidado / R$ 1,8 bi pago — todos conferidos manualmente e depois via Playwright.

## Filtros reais implementados (G0.7 — menor adaptação possível na camada de leitura)

| Filtro | Coluna/mecanismo | Antes da P13.7 |
|---|---|---|
| `status` | `p.situation_code` | já existia |
| `category` | `p.species_code` (`exec_work_c_text kind=3`: Construção/Reforma/Ampliação/Fabricação/Recuperação/Máquinas e Equipamentos) | existia no tipo, não filtrava (no-op) |
| `agency` | `exec_work_c_org.name ILIKE` | existia no tipo, não filtrava (no-op) |
| `hasPhysicalMeasurement` | `EXISTS` em `exec_work_c_physical` | novo |
| `hasContracts` | `EXISTS` em `exec_work_c_contract` | novo |
| `hasPayment` | `EXISTS` em `exec_work_c_commitment WHERE paid>0` | novo |
| `territorialScope` (`SINGLE`/`MULTI`) | `s.territory_count` (já computado na CTE de escopo) | novo |
| `periodFrom`/`periodTo` | `d_start_prev`/`d_end_prev` (cobre 154.999/155.037 projetos — rotulado "período previsto", nunca confundido com `d_start_eff`/`d_end_eff`, que só existem para ~1.200–1.700 projetos) | novo |

Todos verificados com consulta real (ver `scripts/exec/p137_smoke.ts`) antes de expor na UI.

## Multimunicipalidade

`allocation_class` (`SINGLE_MUNICIPALITY_PROJECT_VALUE` vs `MULTI_TERRITORY_PROJECT_TOTAL_UNALLOCATED`) decide a exibição: projetos multimunicipais mostram "não ratado" na coluna de valor da lista, nunca um número — e o detalhe lista todos os municípios vinculados com nota explícita de que o valor total não foi dividido entre eles. Testado com a obra #1963 (790 municípios, DNIT/MG).

## Rótulos enriquecidos sem migration

`getInfrastructureWorkDetail` e `getInfrastructureWorksList` passaram a trazer `situation_label`, `category_label`, `nature_label`, `agency_name`, `system_label` via `LEFT JOIN` com `exec_work_c_text`/`exec_work_c_org` — antes só havia códigos numéricos crus, inutilizáveis para exibição direta sem essa tradução.

## Limitações conhecidas, não corrigidas nesta fase

- `getInfrastructureWorkDetail` não pagina a tabela de contratos (só os empenhos são paginados via `getInfrastructureWorkFinancialEvidence`). Caso real testado teve 142 contratos — renderiza inteiro, funciona, mas é uma tabela longa. Pendência para iteração futura se aparecer um caso com centenas de contratos.
- Filtro de período usa só `d_start_prev`/`d_end_prev` (previsto). Não há filtro por data efetiva (`d_start_eff`/`d_end_eff`) nem por data de cadastro — dados existem (`cadastro_year`) mas não foram expostos como filtro para não multiplicar a superfície sem necessidade clara no brief.
- PNCP: `pncpLinks` hoje é `'NOT_REPORTED'` para praticamente todo projeto (0 vínculos verificados na base inteira, conforme P13.6). A UI mostra a frase recomendada pelo brief ("Não há correspondência confirmada com contratos do PNCP para esta obra"), nunca uma seção vazia com título chamativo.
