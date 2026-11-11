# E6.5 — Mobile

## Antes
Hero (texto + mapa contextual pequeno, num card próprio) → 4 KPIs em grade → rolagem longa até uma SEGUNDA seção com um SEGUNDO mapa, seletor e painel. Dois momentos cartográficos desconectados, o segundo deles abaixo da dobra em qualquer tela pequena.

## Depois
A fusão do hero (E6.1/E6.2) resolve isso estruturalmente: no mobile, a composição única colapsa para coluna simples, mas o mapa — já analítico, já com indicador selecionável — aparece logo após a busca e os atalhos, ainda dentro da primeira rolagem de tela. Confirmado por captura (`e6-after-390-first.png`).

Diferente da homepage (3 histórias de peso comparável, resolvido com carrossel) e diferente do Judiciário (2 blocos de peso bem distinto, resolvido com empilhamento simples), o Executivo tem uma única peça central (o mapa) seguida de seções já estruturalmente variadas (faixa federativa conectada, 5 temas empilhados, gráfico de obras) — não precisou de carrossel: a variação de altura e tipo de conteúdo entre as seções já quebra o padrão "sequência de cards iguais" que o mandato rejeita.

## Achado real corrigido (visível só em captura real)
O input de busca territorial, com `background-color` transparente, ficava progressivamente pior em telas pequenas (texto do placeholder praticamente ilegível contra o hero escuro, nenhuma borda para indicar os limites do campo). Corrigido junto com a correção de E6.1 (`bg-white`) — mesma causa, mesmo fix, confirmado em ambas as larguras.

## Verificação
0px de overflow em 320/375/390/430/768px. 0 erros de console novos. 0 ocorrência de `NaN`/`undefined`/`Infinity`/`[object Object]`. O gráfico de obras por situação (6 barras reais) e a faixa "Quem cuida de quê" permanecem legíveis e sem quebra de layout em 320px.
