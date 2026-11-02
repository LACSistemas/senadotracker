# P8.5 — Integração e polimento do Atlas Vivo

Mandato §7/P8.5: "preserve a funcionalidade já comprovada. Não introduza mudanças desnecessárias na camada
geográfica." P8.0 já havia confirmado o Atlas Vivo como a rota com menor aninhamento de card (30%, contra
68-70% das visões gerais) e o único lugar com mapa de tela cheia — por isso esta fase não reconstruiu a
fundação (zoom/pan/seleção/URL compartilhável, todos de P3/P6.2, intocados), só corrigiu um problema real e
concreto encontrado durante a revisão visual de P8.1.

## O achado

Revisando os screenshots de P8.1 pessoalmente, notei que mesmo no Atlas Vivo — a página que o mandato cita
como "a mais forte" — o mapa não aparecia na primeira tela a 1440px: a busca de município vivia num card
cheio acima do mapa, empurrando a cartografia para baixo da dobra. Isso contradiz diretamente dois pedidos
do mandato (§7): "maior protagonismo da cartografia" e "busca mais integrada ao mapa".

## A mudança

`AtlasVivo` (`components/territory/atlas-vivo.tsx`) ganhou uma prop aditiva `searchSlot?: ReactNode`,
renderizada dentro da aside do mapa (ao lado do canvas, no estado "nada selecionado" — antes um texto
genérico de "Pré-visualização"). A página (`estados/[uf]/atlas/page.tsx`) monta o mesmo `MunicipalFinder`
de sempre (`<form method="get">`, funciona sem JS) e passa como `searchSlot` em vez de renderizá-lo num
card cheio acima do mapa. Na visão de tabela (sem aside), o card de busca continua existindo como antes —
não há onde integrá-lo.

Resultado: o mapa agora é o primeiro elemento visual real da seção em qualquer largura ≥1024px — confirmado
por screenshot (`artifacts/p8-5-atlas-vivo/atlas-rj-w1440-viewport.png`: a parte superior do SVG já aparece
sem rolar).

## O que foi avaliado e deliberadamente não mudado

- **Legenda**: já fica imediatamente abaixo do mapa (figcaption), já é "integrada" na prática — não
  precisava de reposicionamento.
- **Botão de recuperação/enquadramento padrão**: já existe (`Centralizar`, `reset()`) — satisfaz o pedido
  do mandato sem mudança.
- **Orientação em zoom elevado** (ex. mini-mapa de localização dentro do estado): avaliado, não
  implementado — seria uma peça nova de UI num componente que o mandato pede para não reconstruir sem
  necessidade real comprovada; o `aria-label` do palco já diz "mapa dos municípios" e o breadcrumb/hero da
  página já identificam o território. Registrado como possível melhoria futura, não um gap escondido.
- **Seleção de polígonos muito pequenos/irregulares**: é uma dificuldade real (município pequeno = área de
  clique pequena no SVG) que o mandato nomeia explicitamente. Não resolvida nesta fase — exigiria uma
  técnica de hit-area maior que o path visível (ex. hit-area invisível separada por polígono), que é um
  risco de regressão geográfica maior do que o tempo desta fase comportava com segurança. Mitigado (não
  resolvido) pelo fato de que a busca — agora mais visível, ao lado do mapa — continua sendo um caminho
  completo e independente para chegar a qualquer município, inclusive os pequenos.

## Verificação

- Typecheck limpo, build isolado, servidor isolado (porta 3173), porta 3000 do usuário intacta.
- Screenshots reais 1440/390px, mapa + tabela, com e sem seleção ativa — 0px overflow, 0 erros de console
  em todas as combinações.
- Teste de interação real (Playwright direto, não suíte do repositório — não existe spec e2e dedicado ao
  Atlas Vivo, mesma lacuna que P3/P6/P7 já tinham): busca por "Niterói" retorna resultado real na aside;
  selecionar um município atualiza a aside e centraliza o mapa; o botão "Fechar pré-visualização" devolve a
  busca ao lugar; zoom e reset por teclado (`+`, `0`) continuam funcionando sem erro de console.
- Nenhuma mudança na camada geográfica (`UfGeometry`, cálculo de zoom/pan/clamp, construção da URL
  compartilhável) — só na composição da aside.

## Status do Gate P8.5

**`PASS_WITH_CAVEATS`.** O achado mais concreto e verificável (mapa fora da primeira tela mesmo na melhor
página do produto) foi corrigido com uma mudança mínima e de baixo risco, preservando 100% da fundação
geográfica. 2 pedidos explícitos do mandato (orientação em zoom alto, seleção de polígonos pequenos) foram
avaliados e deliberadamente não resolvidos, por risco/benefício desfavorável dentro do tempo desta fase —
registrados, não escondidos.
