# J7.4 — Mobile

## Antes
Hero (texto + ilustração decorativa) → 4 KPIs empilhados → gráfico da "Justiça em movimento" — exatamente a sequência "hero → cards → gráfico pequeno" que o mandato pede para eliminar. Confirmado por captura (`j7-before-390-first.png`).

## Depois
A reconstrução do hero (J7.1) já resolve o problema estruturalmente: no mobile, a mesma composição única colapsa para coluna simples, mas a ORDEM muda para: manchete → contexto → CTAs → atalhos → **gráfico real (casos novos×baixados) → 4 indicadores integrados no mesmo painel** → faixa de despesa. Confirmado por captura (`j7-after-390-first.png`): o gráfico real já aparece na primeira viewport, não depois de 4 cards.

A "Justiça em movimento" (gráfico principal, 2009-2025) e a nova distribuição de congestionamento (J7.2) usam `<svg viewBox>`/componentes já responsivos — `MultiLineChart` já tinha tratamento mobile antes desta fase (não alterado); a tira de distribuição de congestionamento é 100% fluida (`left: ${value*100}%`), testada sem overflow em 320-430px.

Os temas (J7.3) empilham verticalmente no mobile (`grid lg:grid-cols-[1.3fr_1fr]` colapsa para 1 coluna abaixo de `lg`) — o card de destaque vem primeiro, os 5 outros em lista compacta logo abaixo, sem precisar de carrossel (diferente da homepage: aqui são só 2 blocos, não 3 cards do mesmo peso, então o empilhamento simples já é suficiente e não repete o padrão "sequência de cards iguais" que o mandato rejeita — os dois blocos têm pesos visuais claramente diferentes).

## Verificação
0px de overflow horizontal em 320/375/390/430/768px (script real contra o servidor de dev). 0 erros de console novos. 0 ocorrência de `NaN`/`undefined`/`Infinity`/`[object Object]` no texto renderizado.
