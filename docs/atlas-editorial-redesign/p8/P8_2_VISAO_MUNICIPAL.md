# P8.2 — Visão geral municipal (piloto estrutural)

Implementado junto com P8.1 (a fundação e o piloto nasceram na mesma mudança — ver `P8_1_DIRECAO_DE_ARTE.md`
para o detalhe de cada decisão). Este documento registra o resultado em `/municipios/3301009` (Campos dos
Goytacazes/RJ, indicado pelo mandato) e o que ainda falta validar antes de considerar a fase fechada.

## Inventário antes/depois

| | Antes (P0-P7) | Depois (P8.2) |
|---|---|---|
| Hero | Banner verde sólido, 0 `<svg>`/`<img>` real (P8.0) | Mapa da UF com o município em destaque, integrado à composição |
| Localização | Card "Onde fica" separado, abaixo do hero, com `dl` de 4 metadados | Absorvida pelo hero (mapa) + 1 frase editorial na descrição |
| Descoberta | Título + parágrafo, mesmo peso visual do resto | Cartão protagonista dentro do hero: número grande + comparação validada |
| Largura | 1200px fixo em qualquer tela (P8.0) | 1360px (`.shell-territory`) |
| 5 dimensões | 4 arquivos quase idênticos, grade 2×2 de caixas aninhadas (69-70%, Educação/Segurança) | 4 composições distintas (ver P8.1 §5) |
| IDHM | `MultiLineChart` com scrollbar horizontal forçada (3 pontos) | Visualização própria de 2 traços/3 marcos, sem scrollbar |
| Representação | "Quem representa {município}" com hemiciclo completo sempre aberto | "Representação estadual e federal ligada a {UF}", hemiciclo atrás de `<details>` |

Nenhum dado, filtro, link ou capítulo foi removido — confirmado por comparação direta dos campos exibidos
(população, leitos, cobertura de saúde, PIB, IDHM e componentes, contagem legislativa) entre antes e depois.

## Evidência

- `artifacts/p8-1-direcao-arte/municipio-campos-w1440-{viewport,full}.png`,
  `municipio-campos-w390-{viewport,full}.png` — revisados diretamente (não só autorrelato): hero com mapa
  real e descoberta visível na primeira tela; 0px overflow; nenhuma quebra de layout nos 2 pares de teasers
  e nas seções de governo/IDHM/representação.
- Typecheck + build isolado + 52/53 e2e (ver P8.1) cobrem esta rota entre outras.
- 1 bug real introduzido e corrigido no próprio ciclo: `KpiRow` (novo, `editorial-kpi.tsx`) tinha um `div`
  `shrink-0` sem `flex-wrap` que, com um `DeltaChip` de texto longo, estourava a largura da `<li>` sem
  nenhum ancestral para conter — 22px de overflow em 390px. Corrigido (`min-w-0 flex-wrap` no lugar de
  `shrink-0`), confirmado 0px depois.

## O que NÃO foi validado nesta fase (pendência explícita, não escondida)

- **Só 1 município testado com screenshot real** (Campos dos Goytacazes). O mandato pede também Macaé
  (dados completos, usado nas fases temáticas) e "outro com dados incompletos" — nenhum dos dois foi
  capturado aqui. Próximo passo antes de fechar o gate.
- **Só 2 larguras testadas** (1440/390) — faltam 1280/768/320 do conjunto padrão de 5 que P0-P7 usaram.
- **e2e cobre as rotas existentes, não um teste novo específico do hero/descoberta-no-hero** — nenhum teste
  afirma hoje "a descoberta aparece dentro do hero quando elegível" como contrato; é comportamento real
  (confirmado por screenshot), mas não travado por teste.
- **axe-core não executado** (ver P8.1) — o `role="img"`/`aria-label` do novo mapa do hero e o `<details>`
  do hemiciclo nunca foram auditados por ferramenta, só por leitura de código.
- Município sem UF (`m.uf` nulo) não foi testado explicitamente — `TerritoryHero` recebe `geometry={null}`
  nesse caso (código já trata isso, não renderiza o mapa), mas não há screenshot confirmando o resultado.

## Status do Gate P8.2

**`READY_FOR_VISUAL_REVIEW` com verificação parcial.** A transformação estrutural pedida pelo mandato está
implementada e comprovada com evidência real no piloto principal (Campos dos Goytacazes, 2 larguras) — não
é mais "reorganizar os mesmos cards": hero, descoberta, largura, aninhamento e representação mudaram de
composição, não só de espaçamento/cor. A extensão da verificação (Macaé, 3º município, larguras
intermediárias, e2e novo, axe-core) é o trabalho que falta antes de um `PASS` sem ressalva — não bloqueia
a revisão visual do usuário sobre a direção em si, que é a decisão que importa validar primeiro (mandato
§11.8: a aprovação de G1 é do usuário, não desta fase).
