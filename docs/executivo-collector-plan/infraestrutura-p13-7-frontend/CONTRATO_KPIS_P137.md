# P13.7 — Contrato dos KPIs do hero

## Problema que isso resolve

`getInfrastructureEditorialKpis` (backend, P13.6) não prioriza variedade de dimensão — pega os 8 primeiros indicadores por `indicator_id` crescente que tenham valor não-nulo. Isso poderia devolver, por exemplo, 8 variações do Censo Entorno (todas FACES/DOMICÍLIOS/MORADORES de temas parecidos) em vez de uma amostra plural. O brief (seção 8) exige "priorizar variedade de dimensões, para não exibir seis percentuais muito semelhantes do Censo Entorno".

## Solução: prioridade de família, não de ID fixo

`HERO_KPI_PRIORITY` em `lib/infrastructure/catalog.ts` — lista ordenada de até 8 `{code, label}`, um por dimensão:

1. `IAG0001` — Abastecimento de água (SINISA)
2. `IES0001` — Esgotamento sanitário (SINISA)
3. `INF-ENTORNO-HOUSEHOLD-PAVEMENT` — Pavimentação no entorno (Censo 2022)
4. `INF-ENTORNO-HOUSEHOLD-LIGHTING` — Iluminação pública no entorno (Censo 2022)
5. `INF-INTERNET-DOMICILIOS` — Internet domiciliar (Censo 2022)
6. `ENERGY-MMGD-INSTALLED-KW` — Potência de geração distribuída (ANEEL)
7. `IND-MOB-PEMOB-SERVICOS-MUNICIPAIS` — Transporte sob gestão municipal (PEMOB)
8. `INF-DAMS-SNISB-TOTAL` — Barragens cadastradas (SNISB)

`loadInfrastructurePage` percorre essa lista e inclui só os que o território realmente tem valor publicado — nunca força 8 quando há menos. Se sobrar espaço (menos de 8 KPIs e há obras registradas), um 9º "pseudo-KPI" sintético de contagem é adicionado ("Obras públicas registradas", vindo de `getInfrastructureWorksOverview`, não de um indicador do catálogo) — não um indicador do catálogo de 108, por isso tratado à parte.

Isso **é** uma lista de prioridade por dimensão, não "os 8 IDs fixos" no sentido proibido pelo brief: a presença de cada um depende de disponibilidade real; a ordem é o que é fixo, garantindo variedade quando os dados existem.

## O que cada KPI carrega

`HeroKpi`: `code`, `label` (leigo, não o título técnico do catálogo), `value` (já formatado pela unidade real — ver `format.ts`), `unit`, `note` (competência técnica ou restrição de comparação, quando aplicável), `sourceFamily`, `year`, `compare?` (comparação UF/Brasil, só preenchida para até 3 KPIs elegíveis em município — ver `CONTRATO_COMPARACOES_P137.md`).

## Por que não os oito IDs do Censo Entorno direto

O brief cita "Pavimentação no entorno" e "Iluminação pública no entorno" como candidatos explícitos (seção 8) — só esses dois do Censo Entorno entraram na lista de prioridade, não os 8 restantes, justamente para evitar a repetição que o próprio brief probe.
