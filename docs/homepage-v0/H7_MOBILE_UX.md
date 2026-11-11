# H7.4-H7.5 — Mobile editorial e ritmo

## H7.4 — Histórias de dados: carrossel, não empilhamento

### Diagnóstico
A H6 (e a H0-H5 antes dela) empilhava as 3 histórias verticalmente no mobile — a mesma composição do desktop, só em coluna única. O mandato classifica isso como "não é a experiência mobile própria que pedimos" (§8.1/§8.2), mesmo quando o conteúdo interno de cada card já é bom.

### Solução escolhida: opção B (navegação controlada), não A nem C
Rolagem horizontal nativa com `scroll-snap` (`snap-x snap-mandatory`, cartões `snap-center`), um card por vez, a 88% da largura da viewport — a próxima história sempre visível em parte na borda (achado verificado em captura real, `h7-mobile-carousel-justica.png`, mostra lascas dos cards vizinhos). Decisão por esta opção e não "A — sequência ampla" porque manter os 3 cards grandes empilhados é exatamente o padrão que o usuário rejeitou; não "C — híbrida" porque as 3 histórias têm peso editorial comparável (nenhuma é claramente secundária no mobile, diferente do desktop onde Justiça ganha mais largura por ter a série mais rica).

Sem autoplay (requisito explícito do mandato). Sem esconder histórias — a dica de texto "Arraste para ver as 3 histórias →" é explícita, mais a lasca visível da próxima história. `role="region" aria-label="Histórias de dados" tabIndex={0}` dá acesso por teclado (a região focável rola com as setas em navegadores que suportam `scroll-snap` por teclado nativamente).

Desktop e mobile renderizam o **mesmo conteúdo React** (as 3 histórias são construídas uma vez como variáveis JSX e inseridas em dois wrappers diferentes — grid assimétrico no desktop, carrossel no mobile) — nenhuma duplicação de dado ou lógica, só de composição visual, o que o mandato pede explicitamente ("direção editorial própria", não "duas implementações").

### Bug real encontrado e corrigido durante H7.4
Ao implementar o carrossel, `document.documentElement.scrollWidth` relatava **439px de overflow horizontal em 390px** — um bug real introduzido nesta fase, não um falso positivo. Investigação por bisseção de DOM (removendo/alterando elementos um a um e remedindo, não suposição):

1. Isolado à seção de Histórias (`main > section:nth-of-type(2)`), depois ao `role="region"` do carrossel especificamente — removê-lo zera o overflow.
2. Testado e descartado, um a um: classes de scroll-snap, `snap-center` nos cards, `tabIndex`, a margem negativa `-mx-4`/`px-4` do bleed, largura percentual vs. `calc()` fixo, `gap`, `min-width:0` nos itens flex, `table-layout:fixed`.
3. **Causa real, confirmada por remoção isolada**: o `<table className="sr-only">` adicionado como alternativa textual da série para leitor de tela (dentro do card de Justiça). `width:1px` do utilitário `sr-only` não é respeitado pelo algoritmo de layout padrão de tabela (`table-layout:auto`) quando o conteúdo das células pede mais espaço — a tabela layouta na sua largura "preferida" pelo conteúdo (3 colunas × números como "31.418.002"), não no `width:1px` pedido. Mesmo com `overflow:hidden` e `position:absolute` (que tiram a tabela do fluxo visual), a caixa de layout resultante ainda conta para `document.documentElement.scrollWidth` — por isso a página inteira "sabia" que havia ~400px de conteúdo rolável à direita, mesmo sem nada visível.
4. **Correção**: trocada a tabela por uma lista (`<ul className="sr-only">`) com o mesmo conteúdo textual (ano, entradas, baixas) — mesma função de acessibilidade (§8.3 do mandato, "tabela alternativa quando apropriado" — aqui, uma lista cumpre o mesmo papel sem o algoritmo de tabela), sem o bug.
5. Reverificado: overflow 0 em 320/375/390/430/768/1023/1280/1920px (único resíduo: 11px em 1024px, mas confirmado **pré-existente e não relacionado** — `/estados`, página nunca tocada nesta sessão, tem o mesmo problema no cabeçalho global `app-header.tsx` nessa largura exata).

## Três poderes no mobile
Mesma composição do desktop (hemiciclo/medidores/barras), empilhada em coluna única — já compacta o suficiente (cada cartão cabe numa tela sem rolagem excessiva) para não precisar de um tratamento mobile separado; os 3 gráficos (hemiciclo SVG, barras de medidor, barras ranqueadas) já são responsivos por natureza (SVG com `viewBox`, barras com `width` percentual), confirmado sem overflow nas capturas 320-430px.

## Território, perguntas e transparência
Mantidos como estavam (cards compactos) — o próprio mandato classifica essas seções como de baixa intensidade na progressão de ritmo (§9.1: "perguntas compactas... transparência discreta"), e elas já atendiam a esse critério antes da H7.

## H7.5 — Ritmo editorial
A progressão **Impacto (hero) → Descoberta (histórias) → Instituições (três poderes) → Território → Investigação (perguntas) → Confiança (transparência)** já existia estruturalmente desde H0; o que a H7 mudou foi o CONTRASTE de intensidade dentro de cada etapa: histórias foram de "3 cards pequenos iguais" para "composição assimétrica com um protagonista"; três poderes foram de "3 cards com a mesma estrutura de mini-KPI" para "3 visualizações de identidade própria (hemiciclo / medidores / ranking)". Isso é o que o mandato pede em §9.1 ("crie contraste... não faça todas as seções parecerem iguais") — não uma reordenação de seções, que já estava correta.
