# H7.2-H7.3 — Direção de arte: três poderes e hero

## H7.2 — Diferenciação visual dos três poderes

### Diagnóstico (H6)
Legislativo usava `ConcentrationCurve` (barra empilhada compacta) em vez do hemiciclo — identidade parlamentar perdida, apontado explicitamente pelo mandato §2.4/§6.1. Executivo usava um mapa coroplético de população — 3º mapa do Brasil na mesma página (hero + Educação + Executivo), repetição apontada em §2.3/§6.2. Judiciário usava 2 barras verticais de "balanço do ano" — visualmente quase idêntico ao par de cores entradas/baixas já usado na história de Justiça, pouca diferenciação real.

### Legislativo — hemiciclo real, compacto
Reconstruído com a mesma geometria usada em `/legislativo` (`layoutHemicycle` de `lib/hemicycle.ts`, a função pura que calcula a posição de cada cadeira — não um componente novo, não dado fictício). Não é o componente `PartyHemicycle` inteiro (que tem legenda completa, 3 chips e um parágrafo — dimensionado para página inteira, não para um cartão de 1/3 da largura); é uma versão compacta: o SVG do hemiciclo + total de deputados + os 4 maiores partidos como chips de legenda + "+N partidos". Cores reais via `partyColor()`, a mesma paleta usada em todo o produto.

### Executivo — composição de 3 indicadores de serviço, sem mapa
Em vez de um mapa, 3 "medidores" horizontais independentes, cada um com sua própria régua: Saúde (leitos SUS/mil hab., CNES), Educação (Ideb anos iniciais, INEP) e Infraestrutura (% de domicílios com via pavimentada no entorno, Censo 2022/IBGE — indicador novo nesta página, obtido de `getInfrastructureEditorialKpis`, já existente no pacote `@senadotracker/db`, nenhuma consulta nova criada). Nota explícita sob os medidores: "as três não são comparáveis entre si" — cada barra usa sua própria escala (0–4, 0–10, 0–100%), e isso é dito ao usuário, não escondido.

### Judiciário — composição por ramo da Justiça
Barras ranqueadas de processos baixados por ramo (Estadual 31,4mi, Federal 7,3mi, Trabalho 5,4mi, Eleitoral 0,53mi — CNJ, 2025), vindas de `judOverview.data.branches`, já carregado pela mesma chamada que alimenta o resto da página (nenhuma consulta nova). É uma leitura de **estrutura** (quem processa mais, agora), não de **movimento no tempo** — a mesma distinção que o mandato pede em §6.3, e deliberadamente diferente do gráfico de linhas da história de Justiça.

### Linguagem visual
Os 3 cartões mantêm o mesmo verde institucional (`bg-card`, mesmos tokens) — o mandato permite paletas diferentes por poder (§6.4) mas também diz explicitamente que "a diferenciação principal deve vir da visualização e composição, não apenas da cor"; como os 3 já ficaram visualmente muito distintos pela mudança de conteúdo (hemiciclo vs. medidores vs. barras ranqueadas), não introduzimos uma paleta nova por poder — risco de regredir a "identidade visual consistente" que o próprio mandato pede em outro ponto, por um ganho marginal.

## H7.3 — Hero: avaliado, não reconstruído

O mandato é explícito: "a H6 melhorou o hero... faça ajustes somente quando representarem ganho real" e pede para não repetir "mais uma rodada de mudanças cosméticas". Reinspecionamos o hero (capturas `h7-final-1440-first.png`, `h7-final-1920-first.png`, `h7-final-390-first.png`) contra os critérios do mandato:

- Mapa e texto numa única superfície: já resolvido na H6, confirmado ainda válido.
- Legenda, unidade e competência do mapa visíveis: sim (legenda de faixas + "IDHM 2010 · PNUD/IPEA/FJP").
- Busca com hierarquia clara, atalhos discretos: sim.
- Primeira viewport mobile sem excesso de KPIs antes da exploração: sim — eyebrow, manchete, subtítulo, busca, atalhos, depois o mapa; os 4 indicadores vêm só depois do mapa, nunca antes dele.

**Nenhuma mudança estrutural foi feita no hero nesta fase** — não havia ganho real demonstrável a justificar mexer numa peça que já atende aos critérios do próprio mandato, e o diagnóstico vinculante do H7 (§2) trata o hero como "melhorou, precisa de refinamento", não como um problema central (ao contrário de storytelling e três poderes, tratados como prioridade 1).

### Investigação do "header branco no meio da captura" (H7 §2.1/§7.4)
Confirmado como **artefato de captura**, não bug real:
- `document.querySelectorAll('header').length` → **1** (um único `<header>` no DOM, não há duplicação).
- Screenshot da viewport real após `scrollTo(0, 1800)` (não `fullPage`) mostra o header `sticky` corretamente fixo no topo, sem nenhuma segunda cópia branca no meio do conteúdo (`h7-sticky-scrolled-viewport.png`).
- Causa real: `fullPage: true` do Playwright tira a captura em segmentos do tamanho da viewport e rola a página entre eles; um elemento `position: sticky; top: 0` (o header, em `app-header.tsx`) é recapturado no topo de cada segmento, produzindo a ilusão de repetição na imagem final montada — comportamento documentado do Chromium/Playwright com elementos sticky, não do produto.

**Nenhuma mudança foi feita no comportamento sticky do header**, conforme instrução explícita do mandato de só corrigir o que for confirmado como bug real.
