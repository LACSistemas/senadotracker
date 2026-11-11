# Contratos de dados e cobertura — P14.8

## Integração

O frontend consome exclusivamente `@senadotracker/db` (pacote compartilhado), nunca PostgreSQL direto do navegador, nunca CKAN STJ, nunca DataJud. Duas camadas de leitura web (`apps/web/lib/judiciary.ts`, `judiciary-themes.ts`) só adicionam cache de 5 minutos (`memo`, mesmo padrão de `territory-executive.ts`) sobre o serving já existente — zero lógica de negócio nova, exceto a função listada abaixo.

## Única adição ao serving

`getJudiciaryNationalSeries(pool, indicatorIds)` em `packages/db/src/postgres-judiciary-serving.ts`: série nacional multi-ano para indicadores `SUM`. Mesmas tabelas (`jud_jn_indicator`, `jud_jn_observation`), agrupadas por ano em vez de filtradas por ano único — nenhuma tabela nova, nenhum coletor novo. Filtra pelas revisões **ativas** de `JN_STATISTICS` e `JN_THEMATIC` (corrigido durante a implementação — ver `RELATORIO_EXECUCAO_P148.md`).

## `semanticTheme`, nunca o prefixo do ID

Confirmado na prática, não por leitura de documentação: `P146_TAX_EXECUTION_ALL_DISPOSED` tem prefixo "TAX_EXECUTION" no ID, mas sua classificação real (`provenance->>'semanticTheme'`, resolvida por `postgres-judiciary-themes.ts`) é `CRIMINAL_EXECUTION` — e é exatamente assim que ele aparece nesta implementação (no tema "Execução penal", nunca em "Execução fiscal"). Nenhuma página deste frontend faz `indicator_id.split('_')` ou qualquer inferência de tema pelo ID: toda classificação vem de `getJudiciaryThemeOverview`/`getJudiciaryThemeIndicators`/`getJudiciaryThemeByTribunal`, que já resolvem pela revisão corrigida de P14.7-R (`p147r-theme-metadata-20261105-v2`).

## Gate de cobertura temática

A regra do mandato foi seguida à risca: nenhuma página deste frontend apresenta uma "cobertura nacional" calculada sobre o universo potencial de posições. Cada métrica mostra `observations` (quantas linhas existem) e `available_values` (quantas têm valor) lado a lado, nunca um percentual derivado sem contexto. Exemplo real, execução fiscal: "91 observações · 84 com valor". O leitor vê o denominador declarado, não uma porcentagem que pareça medir o universo nacional inteiro.

### Violência doméstica (caso prioritário do mandato)

994.852 processos baixados em 2025 é a soma nacional real (SUM, indicador elegível). A série "Evolução histórica" mostra 2009–2015 como **Indisponível** (não zero, não omitido) — a variável só passou a ser coletada/publicada a partir de 2016. Confirmado na captura real: a tabela de dados do gráfico lista "2009 → Indisponível" explicitamente, nunca "0".

## Ausência nunca vira zero

Em todo o frontend, um valor ausente usa `'—'` ou `JudiciaryAvailabilityNote`, nunca `0`. Exemplos reais capturados:
- STJ, perfil institucional: TJES tem 0 unidades catalogadas → mostra `'—'` com a nota "sem unidades catalogadas", não "0 unidades".
- Tema "Execução fiscal", indicador "Índice de atendimento à demanda" (taxa, `NONE_RATE_OFFICIAL`): mostra `'—'` com "não agregável nacionalmente", nunca uma média inventada.
- Precedente STJ sem tese fixada (`STJ:PRECEDENT:1601`, real): mostra "A tese ainda não foi fixada ou não foi publicada pela fonte — não é um resumo gerado, é a ausência real do campo."

## Agregação e comparabilidade

Só indicadores com `aggregation_allowed='SUM'` são somados nacionalmente (confirmado: `JN_CASES_NEW_G1/G2`, `JN_DISPOSED`, `JN_CASES_PENDING` são `SUM`; `JN_CONGESTION_RATE`/`JN_CLEARANCE_INDEX` são `NONE_RATE_OFFICIAL`, nunca somados). O comparador usa `comparison_eligible` do próprio indicador (confirmado: `JN_CONGESTION_RATE` tem `comparison_eligible=true` mesmo não sendo somável — por isso o panorama linka para o comparador em vez de inventar uma média nacional, e o comparador consegue mostrar o valor real de cada tribunal lado a lado).

## Finanças — estágios nunca se somam

`getJudiciaryFinancialProfile` já separa `facts` (despesas JN por estágio orçamentário) de `payroll` (folha agregada). O Capítulo E do perfil mostra despesa JN elegível (`JN_EXPENSE_TOTAL`/`JN_EXPENSE_SERVERS`/`JN_EXPENSE_BENEFITS`) e, só no perfil do STJ, uma nota separada sobre a folha mensal agregada adicional — nunca misturados, nunca a folha STJ aparecendo em outro tribunal (a própria consulta já filtra por `tribunal_id`, então isso é estrutural, não uma checagem de UI).

## Territorialidade

`getJudiciaryTerritorialInstitutions` (disponível no serving, usado indiretamente via os `physical_uf`/`physical_municipality_source_code` dos registros de unidade) nunca atribui estatística a um município sem relação comprovada — o mandato de "não inventar jurisdição municipal" foi herdado sem necessidade de reforço na UI, porque o próprio contrato já devolve `UNVERIFIED_RELATION` quando não há evidência.
