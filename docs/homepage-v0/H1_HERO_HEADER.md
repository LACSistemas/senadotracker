# H1 — Hero e cabeçalho

## Entregue

- Título exato do mandato: **"Entenda o poder. Descubra o país."** (`apps/web/app/page.tsx`, `<h1>`).
- Busca universal no hero: `<GlobalSearch variant="hero">`, federada (pessoa/partido/estado/município/tribunal — ver H0 §2). Mesma busca acessível pelo cabeçalho global em toda rota.
- Mapa nacional contextual com legenda: `paintStateMap` reaproveitado, colorido por **IDHM 2010** (único ano recente real desta base — não existe 2023, ver H0 §3) com legenda de faixas na `<figcaption>` e `title`/`aria-label` por estado.
- 4 indicadores contextuais (não 5): **Habitantes** (214.211.951 — soma real das 27 UFs, não "203,1 milhões" do mock), **Municípios** (5.571, com nota "5.570 + Fernando de Noronha"), **Deputados federais** (513, exato), **Tribunais** (total real do catálogo CNJ, consultado em runtime via `loadJudiciaryTribunalDirectory`, não hardcoded). O IDH-M não é um 5º KPI isolado — está expresso de forma mais informativa no próprio mapa colorido, com decisão documentada em H0 §3; a despesa da União (R$5,7tri do mock) foi descartada por não ser verificável nesta base (H0 §5).
- Faixa compacta dos três poderes: chips "Municípios/Estados/Parlamentares/Tribunais" dentro do hero + uma segunda faixa de 3 cartões-link (Legislativo/Executivo/Judiciário) imediatamente abaixo do hero, cada um levando à rota real do poder.

## Verificado

- Todo número do KPI strip e do mapa vem de uma consulta real em `Promise.all` no topo de `HomePage` (nenhum literal copiado do mock) — confirmado lendo `apps/web/app/page.tsx:24-34`.
- Rotas de destino de cada chip/cartão (`/municipios`, `/estados`, `/legislativo`, `/judiciario/tribunais`, `/legislativo`, `/executivo`, `/judiciario`) retornam HTTP 200 (checado via curl ao servidor real).

## Gate H1 — PASS
