# E6.1 — Hero cartográfico editorial

## A fusão
Antes: `InstitutionHero` (texto) + `<figure>` com mapa contextual neutro, lado a lado com 4 `KpiCard`; **abaixo**, uma seção inteira própria ("Explore o Brasil por indicador") com um SEGUNDO mapa (analítico), seletor de indicador, painel de contexto e tabela.

Depois: uma única superfície escura (mesma gramática estrutural de H7/J7, identidade própria do Executivo — mapa, não gráfico de linha nem hemiciclo):
- **Zona esquerda**: eyebrow, manchete (mantida exata: "O Brasil que as políticas públicas revelam."), descrição, busca territorial, **seletor de indicador** (antes só existia na seção separada), atalhos para os 5 temas.
- **Zona direita**: o mapa — já colorido pelo indicador selecionado desde o primeiro carregamento —, legenda real, painel de contexto (estado selecionado ou referência Brasil) e os 3 indicadores estruturais (habitantes/municípios/UFs) integrados no mesmo painel.
- Tabela "ver todos os estados" preservada como `<details>` anexado à base do hero (mesmo padrão de rodapé-do-hero de H7/J7).

Não existem mais 2 mapas — existe 1, que É a investigação, não uma prévia dela.

## Indicador do mapa é a mesma descoberta territorial
O formulário `<select>` (População residente / IDHM) continua GET server-side (`/executivo?indicador=X`), sem JavaScript novo — mesmo padrão que já existia, só puxado para dentro do hero. Selecionar um estado no mapa ainda leva a `?uf=X`, preenchendo o painel de contexto com o valor exato e referência Brasil, exatamente como antes — nenhuma funcionalidade perdida, só reposicionada.

## Achados reais corrigidos nesta fase
- **Input de busca invisível**: `#exec-q` tinha `background-color: transparent` computado, texto escuro sobre o hero escuro (confirmado via `getComputedStyle`, `rgba(0,0,0,0)`). Mesmas classes já existiam antes desta fase — não foi introduzido por E6, mas corrigido agora (`bg-white` adicionado) porque é um bug de usabilidade real que toca exatamente a peça que esta fase reconstruiu.
- Verificado por captura antes/depois (`e6-after-1440-first.png`): o campo de busca agora é um pill branco legível.

## Verificação
0px de overflow em 320-1920px exceto os 11px pré-existentes do cabeçalho global em 1024px (mesmo achado documentado em `/estados`, na homepage e em `/judiciario`). 0 erros de console novos.
