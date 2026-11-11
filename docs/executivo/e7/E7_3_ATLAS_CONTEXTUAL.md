# E7.3 — Continuidade da exploração territorial

## O que foi preservado sem alteração
O hero cartográfico fundido da E6 (mapa único analítico, seletor de indicador, painel de contexto, tabela de 27 estados, URLs com `?indicador=`/`?uf=`, back/forward) **não foi reconstruído** — o mandato explicitamente veda isso. Confirmado intacto pelos 44/44 testes e2e, incluindo os 3 específicos do explorador por indicador.

## O que foi estendido: seleção de UF reflete na seção de Saúde
Das 5 áreas, só Saúde tem contrato real por UF carregado nesta fase (`getHealthBedsByUf`, novo em E7.1) — por isso só ela reflete a UF selecionada no mapa, conforme o mandato permite explicitamente ("não significa obrigar todos os módulos a possuir dados para a mesma UF... quando não existir [cobertura], não simular a informação"). Ao selecionar um estado no atlas (`?uf=MG`), o painel de Saúde:
- destaca o ponto da UF na distribuição (maior, com anel, cor sólida em vez de translúcida);
- mostra texto real: "MG: 2,36 leitos/mil hab. — dentro da distribuição nacional acima, sem implicar melhor ou pior atendimento" — nunca uma nota de ranking ("MG está acima da média" nunca aparece).

As demais 4 áreas (Educação/Segurança/Bem-estar/Infraestrutura) mostram dado nacional independente da UF selecionada — não é uma omissão, é a ausência honesta de um contrato por UF que esta fase não construiu (evoluir isso exigiria novas consultas por UF para Ideb/tráfico/bem-estar/SINISA, fora do escopo autorizado de "frontend + adaptadores de leitura não persistentes" sem inflar o número de queries por carregamento de página).

## Achado real corrigido: overflow horizontal introduzido nesta fase (não pré-existente)
Verificação real por medição (`document.documentElement.scrollWidth`, não inspeção visual) encontrou **356px de overflow em 320px**, 301px em 375px, 286px em 390px, 246px em 430px — um bug real introduzido pela própria E7, não presente na E6 (que reportava 0px nessas larguras). Causa raiz: o `<div className="mt-8 grid gap-6 lg:grid-cols-12">` da seção "cinco áreas" tem a classe `grid` (sem prefixo responsivo) ativa em **todas** as larguras — só o número de colunas é condicional a `lg:`. Abaixo de `lg`, cada filho do grid tem `min-width: auto` por padrão (comportamento do CSS Grid, igual ao Flexbox), permitindo que o conteúdo de largura intrínseca mínima do gráfico (`min-w-[620px]` do `AreaTrend`/`BarChart`, dentro de um `overflow-x-auto` que só funciona se o item do grid puder encolher) inflasse a trilha inteira do grid. Corrigido com `min-w-0` nos 5 filhos diretos do grid. Confirmado por remedição: 0px de overflow em 320/375/390/430/768/1280/1440/1920px (o único overflow remanescente é os 11px pré-existentes em 1024px, documentado desde a E6/H5, do cabeçalho global — não tocado nesta fase).

## Verificação
`tests/e2e/executivo-portal.spec.ts` "390px: sem overflow horizontal no portal nacional" — passa. Medição numérica adicional nas 9 larguras do mandato (§25) confirma o mesmo resultado fora do teste automatizado.
