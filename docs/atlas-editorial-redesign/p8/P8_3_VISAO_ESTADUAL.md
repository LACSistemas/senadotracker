# P8.3 — Visão geral estadual (piloto estrutural)

Implementado junto com P8.1/P8.2 (mesma mudança). Resultado em `/estados/RJ`. ES e RR (pedidos pelo
mandato como contraste) ainda não foram testados — ver pendências abaixo.

## Inventário antes/depois

| | Antes (P0-P7) | Depois (P8.3) |
|---|---|---|
| Hero | Banner verde sólido, idêntico ao de município (mesma composição, números diferentes) | Mapa da UF inteira como silhueta, protagonista da abertura |
| Largura | 1200px fixo (P8.0) | 1360px — o explorador de mapa completo (métrica/busca/ranking) ganha ~160px a mais sem nenhuma mudança de composição interna |
| Ritmo | Idêntico ao município: hero → mapa → teasers → governo/IDHM → legislativo | Hero distinto (silhueta inteira, não destaque de 1 ponto) — primeiro passo de diferenciação entre os 2 níveis territoriais; o corpo da página (explorador, teasers, governo) continua com a mesma estrutura de seções que o município, decisão deliberada desta fase (ver pendências) |
| IDHM / Representação / 4 teasers | Mesmos componentes do município (`*Summary`, `IdhmSummary`, `TerritoryLegislativeSummary`) | Mesmas correções de P8.1 (sem scrollbar no IDHM, sem aninhamento nos teasers) — a visão estadual nunca passa `municipioName`, então a representação continua com o hemiciclo sempre aberto e o título "Quem representa {estado}", exatamente como antes (nenhuma mudança aqui é esperada nem desejável no nível estadual) |

## O que esta fase deliberadamente NÃO fez

- **Não criou descoberta estadual.** P8.0/P8.1 confirmaram que `selectDiscoveries` não tem hoje nenhum
  sinal de comparabilidade no nível UF (o contrato existente compara município contra UF/Brasil, não UF
  contra Brasil/regiões). Investigar se compensa estender esse contrato fica para uma iteração futura —
  não implementado "para não inventar" uma comparação sem contrato de elegibilidade real (mandato §8.5).
- **Não reconstruiu a composição do explorador de mapa completo** (métrica/busca/ranking de municípios) —
  só se beneficiou da largura maior. O mandato pede "o mapa deve protagonizar a abertura" (cumprido pelo
  hero) e "integrar melhor a entrada para o Atlas Vivo" (já existia um link "Abrir Atlas Vivo →", mantido,
  não redesenhado). Uma reformulação mais profunda do explorador (ex. mapa realmente full-bleed, legenda
  reorganizada) é candidata a P8.5 (Atlas Vivo e exploração cartográfica), não desta fase.
- **Não diferenciou a estrutura de seções entre estado e município além do hero** — o mandato pede (§4.2)
  "não repetir simplesmente a mesma estrutura municipal com números estaduais" e sugere favorecer
  distribuições/contrastes entre municípios. Isso não foi feito nesta passada: as seções de teasers,
  governo/IDHM e representação seguem a mesma ordem e composição do município. Registrado como a maior
  lacuna real desta fase frente ao mandato — não escondida.

## Evidência

- `artifacts/p8-1-direcao-arte/estado-rj-w1440-{viewport,full}.png`, `estado-rj-w390-{viewport,full}.png`
  — revisados diretamente: mapa real na abertura, explorador completo com mais espaço, hemiciclo completo
  no fim da página (não colapsado, correto para o nível estadual), 0px overflow nas 2 larguras.
- Mesma base de verificação de P8.1 (typecheck, build isolado, 52/53 e2e, incluindo os testes de
  `p14-territorio-executivo.spec.ts` que cobrem `/estados/ES` e `/estados/SP`).

## O que falta antes de fechar o gate

- ES e RR (pedidos explicitamente pelo mandato como contraste de porte/região) — zero screenshot captado.
- Larguras 1280/768/320 não testadas nesta rota (só 1440/390).
- axe-core não executado (mesma pendência de P8.1/P8.2).
- A lacuna de composição (seção acima) é trabalho de design pendente, não só de verificação — maior item
  em aberto desta fase.

## Status do Gate P8.3

**`PARTIAL`.** O hero (o problema mais citado pelo mandato para a visão estadual, §2.2/§4.2/G1.2) está
resolvido e verificado em 1 estado. A diferenciação estrutural mais profunda entre os 2 níveis territoriais
— que o próprio mandato pede explicitamente e distingue de P8.2 — não foi abordada nesta passada. Não é um
`PASS_WITH_CAVEATS`: é um resultado real mas deliberadamente incompleto, correto nomear como tal.
