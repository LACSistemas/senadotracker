# H3 — Três poderes, três perspectivas

Três módulos editoriais distintos, cada um com protagonista visual próprio e CTA para a seção completa do poder.

## Legislativo
"Quem representa você. E o que faz com esse mandato." Protagonista: `ConcentrationCurve` com a composição partidária real da Câmara (top-5 partidos + "Demais partidos"), lida de `houseListing('camara', {pageSize:1})` (reaproveita o campo `composition` já calculado por essa função, sem nova consulta pesada). Mostra o total real de deputados em exercício. CTA "Explorar o Legislativo" → `/legislativo`.

Nota de execução: a primeira versão usava `PartyHemicycle` (hemiciclo completo), mas esse componente é dimensionado para página inteira e deixava o cartão do Legislativo muito mais alto que os de Executivo/Judiciário — decisão de não alterar um componente compartilhado por uma necessidade só desta página; trocado por `ConcentrationCurve`, que já existe no design system para esse uso compacto.

## Executivo
"O Brasil que você vive, visto pelos dados." Protagonista: 2 KPIs reais — leitos por mil habitantes (CNES, calculado a partir de `loadNationalHealthSummary()`) e Ideb anos iniciais Brasil na edição mais recente real. CTA "Explorar o Executivo" → `/executivo`.

## Judiciário
"O que chega à Justiça. O que é resolvido." Protagonista: 2 KPIs reais — processos baixados no ano mais recente e magistrados atuantes, ambos de `loadJudiciaryOverview(2025)` (mesma função de `/judiciario`). Deliberadamente sem gráfico aqui, para não duplicar a série de H2 nem fabricar uma segunda leitura de congestionamento (que não agrega nacionalmente, ver nota em `/judiciario`).

## Verificado
- Os 3 cartões têm a mesma estrutura visual (`bg-card`, mesmo padding, mesmo CTA outline) — paridade visual confirmada por captura (`artifacts/h0-homepage-v0/h1-top2200-v2.png`).
- Nenhuma das 3 visualizações repete exatamente a de H2 (ver nota em H2).

## Gate H3 — PASS
