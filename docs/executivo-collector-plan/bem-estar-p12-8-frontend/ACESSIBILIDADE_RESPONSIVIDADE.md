# P12.8 — Acessibilidade e responsividade

Nenhum auditor automatizado de WCAG (ex.: axe-core) está instalado neste repositório ou nesta sessão — confirmado por busca no `node_modules` e no `package.json` antes de escrever este documento, para não fingir uma cobertura que não existe. A verificação abaixo é a verificação direcionada possível sem instalar uma dependência nova nesta fase (instalar uma ferramenta nova não é uma mudança neutra; fora do escopo de uma fase só de leitura). Gates marcados `PASS_WITH_CAVEATS` refletem essa limitação, não uma lacuna escondida.

## Responsividade — larguras testadas

| Largura | Página(s) | Resultado |
|---|---|---|
| 320px | Vitória (município), Espírito Santo (UF) | sem rolagem horizontal (`scrollWidth − clientWidth ≤ 0`), sem erro de console |
| 390px | Vitória, Espírito Santo | idem |
| 768px | Vitória | idem |
| 1360px | Vitória, Espírito Santo | layout de referência, usado nos screenshots "desktop" |
| 1920px | Vitória | idem |

**Um bug real de overflow foi encontrado e corrigido nesta fase**, não só testado: em 320px, `StatGrid` (`components/wellbeing/wellbeing-ui.tsx`) força `grid-cols-2` mesmo na largura mais estreita; um valor longo sem ponto de quebra (ex.: "1.127.414") em fonte `text-3xl` dentro de uma coluna de ~140px empurrava o grid (e a página inteira) 20px além da viewport. Corrigido movendo a unidade para uma linha própria e adicionando `break-all` ao valor — mesmo padrão defensivo já usado em `security-ui.tsx`. Após a correção, overflow é 0 em todas as larguras testadas, em todas as páginas testadas.

**Achado não corrigido, fora do escopo desta fase**: `components/education/education-ui.tsx` tem o mesmo padrão de `StatGrid` (valor + unidade no mesmo `<dd>`, sem ponto de quebra) e está provavelmente exposto ao mesmo risco em 320px. Não foi alterado porque a missão veda redesenhar outra área temática sem necessidade direta desta fase — fica registrado aqui para decisão própria, fora de P12.8.

## Teclado e foco visível

Testado na página de Vitória (1360px): `Tab` até o primeiro link de `ChapterNav` confirma foco (`:focus` ativo) com `outline`/`box-shadow` computado diferente de `none 0px none` — ou seja, existe indicação visual de foco, não só a mudança de `document.activeElement`. Mesma checagem no `<summary>` do primeiro bloco de divulgação ("Fonte e limites —"): recebe foco e mostra indicação visual.

## Sinalização que não depende só de cor

- Badges Sim/Não/Sem resposta válida do capítulo "Cotidiano digital" carregam o texto por extenso ("Sim", "Não", "Sem resposta válida"), não só a cor de fundo — confirmado via `innerText` do elemento, não via classe CSS.
- Saldo do Novo Caged mostra o sinal explícito (`+322`, por exemplo, ou um valor negativo com `-` literal) no texto, nunca só uma cor para indicar positivo/negativo.
- A legenda (`WellbeingLegend`) descreve em texto o que cada cor/traço de gráfico significa (linha verde = território, azul = estado, cinza tracejada = Brasil, linha interrompida = ausência), antes de qualquer gráfico aparecer na página.
- Blocos de ausência (`Pending`) usam borda tracejada **e** texto explicativo, não só uma cor de fundo diferente.

## Movimento reduzido

`prefers-reduced-motion: reduce` emulado em um navegador real (não simulado por CSS media query só na leitura do código): a página de Vitória renderiza da mesma forma, sem erro de console. Os gráficos (`TrendChart`) não dependem de animação de entrada para serem legíveis — não há conteúdo que só aparece após uma transição.

## O que não foi verificado (honestamente marcado, não escondido)

- **Contraste de cor numérico (WCAG AA, razão ≥ 4,5:1 para texto normal)**: não medido com uma ferramenta automatizada nesta sessão. A paleta reaproveitada (`#115B45` sobre branco/`#e8f3ee`, `#14304f` para texto de destaque) é a mesma já usada e aceita em Segurança (P9.8) e Educação (P11); não foi criada nenhuma combinação de cor nova nesta fase que justificasse uma nova verificação de contraste isolada.
- **Leitor de tela real (NVDA/VoiceOver)**: não testado ponta a ponta nesta sessão; a estrutura semântica (`<nav aria-label>`, `<details>/<summary>` nativos, `<dl>/<dt>/<dd>` para estatísticas, `scope="col"/"row"` nas tabelas) segue o HTML semântico correto, que é a base de que leitores de tela dependem, mas isso não substitui um teste real com o software.

Gate de acessibilidade desta fase: **PASS_WITH_CAVEATS** — os itens verificáveis sem ferramenta automatizada (foco, sinalização não-só-cor, movimento reduzido, overflow) passam, incluindo um bug real corrigido; os itens que exigiriam uma ferramenta não instalada nesta sessão (contraste numérico, leitor de tela) ficam marcados como não avaliados, não como aprovados por suposição.
