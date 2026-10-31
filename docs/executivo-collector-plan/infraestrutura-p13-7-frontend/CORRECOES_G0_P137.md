# P13.7 — Correções do Gate Zero

Todas as investigações abaixo foram feitas com consultas somente-leitura ao `projetoeleitor_db` (`POSTGRES_WRITES_ALLOWED=NO` respeitado em toda a fase). Nenhuma migration, collector ou escrita foi executada.

## G0.1 — CSV de cobertura corrigido

`docs/executivo-collector-plan/infraestrutura-p13-6-serving/MATRIZ_FONTES_COBERTURA_PERIODOS.csv` tinha 9 colunas no cabeçalho e 8 campos por linha: o número de indicadores havia sido escrito dentro do campo `DATASET_OR_DOMAIN` (ex.: `"domain5 / 16 effective definitions"`), empurrando todos os campos seguintes uma posição à esquerda.

Correção: `DATASET_OR_DOMAIN` passou a conter só `domainN`; `INDICATOR_COUNT` foi isolado em sua própria coluna. Nenhum valor foi inventado — todos os números já estavam no arquivo, só mal posicionados.

Verificação: soma de `INDICATOR_COUNT` = 91 (domínio 5) + 7 (domínio 6) + 10 (domínio 13) = **108**, idêntico ao total auditado em `P136_RESULTS.json`.

## G0.2 — Divergência MMGD 5.567 × 5.548 — causa raiz encontrada

A documentação do P13.6 nunca mencionava o número 5.567 nem explicava a divergência citada no brief desta fase. Investigação direta:

- `civica_exec.exec_energy_mmgd_municipality` (fonte bruta, competência 202610): **5.567** municípios distintos.
- `civica_exec.exec_ind_value` para os 4 indicadores `ENERGY-MMGD-*`: **5.548** municípios com valor publicado.
- Os **19 municípios da diferença têm dado bruto real e não-nulo na fonte** (ex.: Assú/RN — 2.780 empreendimentos, 23.866,62 kW instalados) e **zero linhas** em `exec_ind_value` para qualquer um dos 4 indicadores MMGD.
- Confirmado que os 19 códigos existem normalmente em `exec_entity` (kind=4) — não é problema de catálogo territorial.

**Conclusão**: não é ausência legítima (território sem MMGD) — é uma lacuna de publicação no pipeline que gerou `exec_ind_value` a partir da fonte MMGD. A causa exata do pipeline não foi investigada (fora do escopo desta fase, que não pode escrever no banco). Lista completa dos 19 municípios (ibge7): 1400605, 1502954, 1506500, 1706001, 1720499, 2400208, 2405306, 2606903, 2608503, 2800100, 2922250, 2928505, 3102506, 3105509, 3159407, 3165206, 3167301, 5107800, 5203500.

**Tratamento no frontend**: apresentar "5.548 de um universo de 5.567 municípios no cadastro-fonte MMGD", com nota de lacuna de publicação conhecida. Nunca mostrar 5.567 como se todos tivessem indicador; nunca mascarar com valor hardcoded; nunca tentar corrigir via escrita no banco nesta fase.

## G0.3 — Município novo pós-Censo 2022 — identificado

`exec_entity` (kind=4) tem 5.571 linhas; o Censo 2022 (família ENTORNO_IBGE) cobre 5.570. O município sem nenhuma observação em qualquer indicador `INF-ENTORNO-*` é:

- **ibge7 5101837 — Boa Esperança do Norte (MT)**

**Tratamento no frontend**: para este município, todos os indicadores de origem Censo 2022 (ENTORNO_IBGE, FAVELAS, INTERNET_DOMICILIAR) devem mostrar estado de indisponibilidade histórica explícito ("este município não existia na data de referência do Censo 2022"), nunca zero sintético.

## G0.4 — Contrato temporal "coded" — generalizado, não é só PEMOB

A competência `202612` do PEMOB vira `period_start=2026-12-31` no serviço — e é rotulada na própria matriz de cobertura como "competence code audited; not presented as universal December result". Não é uma data de pesquisa real: é uma competência técnica codificada pelo pipeline.

O mesmo padrão ("período coded", não uma data de coleta real) se repete em **SNISB, ANM, ATLAS_AGUAS, MMGD, ANP e LOGISTICA** — a maioria das famílias de domínio 13 e parte do domínio 5. `infrastructure-read.ts` não distingue hoje entre competência técnica, edição, ano de referência, data de coleta e data de publicação — expõe só `period`/`referenceYear` derivados de `period_start`.

**Tratamento no frontend**: helper genérico de rotulagem temporal (não um caso especial só de PEMOB) que rotula essas famílias como "competência técnica" em vez de "período de referência encerrado", evitando frases como "Dezembro de 2026" para uma competência que ainda não ocorreu.

## G0.5 — Atlas Águas — códigos especiais confirmados

Tabela fonte `civica_exec.exec_dam_atlas_municipality`: 5.572 códigos "ibge7"-like distintos. Dois — **4300001 ("Lagoa Mirim")** e **4300002 ("Lagoa dos Patos")** — não existem em `exec_entity kind=4`, ou seja, já não são tratados como municípios comuns no catálogo territorial (5.572 − 2 = 5.570 municípios reais).

Hoje, `exec_ind_value` só tem indicadores `INF-ATLAS-*` publicados no nível **BRASIL** (entity_id=76) — nenhum no nível municipal ainda. O risco de "mostrar 5.572 municípios no mapa" é hipotético nesta fase (não há indicador municipal de Atlas Águas servido). Regra de guarda documentada para quando/se isso mudar: qualquer consulta futura a `exec_dam_atlas_municipality` deve excluir `ibge7 IN (4300001,4300002)` ou fazer JOIN com `exec_entity kind=4`.

## G0.6 — Catálogo e ownership

Sem alterações. 108 indicadores permanecem no recorte auditado (domínios 5/6/13); nenhuma definição foi movida, inventada ou recontada como se cada registro de projeto/instalação fosse um indicador.

## G0.7 — Smoke tests e menor adaptação na camada de leitura

Smoke tests reais executados em `scripts/exec/p137_smoke.ts` contra `projetoeleitor_db`: Brasil, Espírito Santo (UF), Vitória, São Paulo, município pequeno (Atílio Vivácqua/ES), município sem instalação de um tipo (SNISB em Vitória → `[]`, ausência real, não erro), obra multimunicipal (project_id 1963, 790 municípios), UF com cobertura (Espírito Santo). Todos OK, sem erros de contrato.

Duas correções mínimas aplicadas em `packages/db/src/exec/infrastructure-read.ts` (sem migration, sem alterar fatos):

1. **Encoding corrigido**: 3 strings pt-BR estavam com mojibake (UTF-8 relido como Latin-1) nas notas de comparação (`getInfrastructureIndicatorDetail`), na nota de alocação de obras (`getInfrastructureWorksOverview`) e na nota de cobertura (`getInfrastructureOverview`). Eram apenas strings quebradas, não dados.
2. **Filtros de obras implementados** em `getInfrastructureWorksList` (antes `category`/`agency` existiam no tipo mas eram no-op silencioso em SQL): `category` (→ `species_code`, catálogo `exec_work_c_text kind=3`: Construção/Reforma/Ampliação/Fabricação/Recuperação/Máquinas e Equipamentos), `agency` (→ `exec_work_c_org.name`, ILIKE), `hasPhysicalMeasurement`, `hasContracts`, `hasPayment` (via `EXISTS`), `territorialScope` (`SINGLE`/`MULTI`, já computável via `territory_count`), `periodFrom`/`periodTo` (sobre `d_start_prev`/`d_end_prev`, que cobrem 154.999/155.037 projetos — rotulado como "período previsto", nunca confundido com datas efetivas, que só existem para ~1.200-1.700 projetos). `getInfrastructureWorkDetail` também passou a trazer `situation_label`, `category_label`, `nature_label`, `agency_name`, `system_label` e as datas previstas/efetivas, necessários para o cabeçalho de detalhe de obra (seção 15 do brief) — sem esses rótulos o backend só expunha códigos numéricos.

Nenhum outro arquivo em `packages/db` foi alterado. Typecheck de `packages/db` limpo após as mudanças.
