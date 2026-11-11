# J5 — Integração, mobile, acessibilidade e refinamento

## Responsividade

Testado com medição real de overflow horizontal (`document.documentElement.scrollWidth - clientWidth`), nas 4 rotas reconstruídas mais o perfil do STF, em **320px, 390px, 768px, 1280px e 1440px**: **overflow 0 em todas as combinações** (20/20). Um overflow real de 286px foi encontrado e corrigido durante o próprio J2 (grid sem `min-w-0` — ver `J2_PERFIL_TRIBUNAL.md`), não nesta fase — J5 confirma que não sobrou nenhum caso parecido nas outras 3 páginas nem nas larguras intermediárias que J1–J4 não tinham testado ainda.

## Acessibilidade (axe-core real, não suposição)

Rodado com o axe-core já instalado no ambiente de ferramentas do projeto (`D:\Civica\tools\a11y`, mesmo usado no programa editorial P8.7), tags `wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa/best-practice`, em 1280px e 390px:

| Rota | Violações | Passes | A revisar manualmente |
|---|---|---|---|
| `/judiciario` | 0 | 46 | 2 |
| `/judiciario/temas` | 0 | 43 | 1 |
| `/judiciario/tribunais` | 0 | 50/47 | 2 |
| `/judiciario/tribunais/JUD:TRIBUNAL:TJES` | 0 | 47 | 2 |

**Zero violações automáticas em qualquer das 4 páginas, nas duas larguras.** Os itens "a revisar" (`incomplete`, 1–2 por página) são achados que o axe-core não consegue julgar sozinho (tipicamente contraste em estados hover/dinâmicos) — não são falhas confirmadas; ficam registrados para uma eventual auditoria manual futura, não bloqueiam este gate.

Resultado bruto em `artifacts/j0-judiciario-redesign/axe-j1-j4.json`.

## Refinamento

Um problema visual real foi corrigido nesta fase: no perfil de tribunal, a faixa "Em destaque" usava `grid sm:grid-cols-3` fixo — quando só 1 dos 3 cards tinha dado (caso do STF, só "Estrutura e pessoas"), o card ficava esticado numa coluna estreita com duas colunas vazias ao lado (registrado como pendência em `J2_PERFIL_TRIBUNAL.md`). Trocado por `flex flex-wrap` com `min-w-[220px]` e `sm:max-w-xs` por card — agora 1, 2 ou 3 cards sempre ficam com tamanho natural, nunca esticados nem com espaço vazio ao lado.

## Verificação

- Typecheck limpo após o ajuste de layout.
- Suíte e2e completa do Judiciário: **52/52 passando**.
