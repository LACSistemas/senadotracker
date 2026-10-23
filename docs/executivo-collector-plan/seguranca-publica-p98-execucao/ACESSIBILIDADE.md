# Acessibilidade (P9.8)

Medido com `scripts/security/a11y-check.mjs` (Chrome real, build de produção; saída em `acessibilidade_resultados.json`), páginas de Vitória, ES e Serra, em 1440 e 390 px.

| Verificação | Resultado |
|---|---|
| Contraste WCAG (texto) | 0 falhas em 627–1.111 textos por página |
| Pulos de nível de título | 0 |
| SVG sem rótulo | 0 |
| Foco visível nas abas | 40/40 |
| `prefers-reduced-motion` | emulado; sem animações obrigatórias |
| Alvos < 24 px | 8–9 por página |
| Controles "sem nome" | 1 (1440) / 6 (390) — ver ressalva |

## Implementações
- Gráficos: tooltip por ponteiro **e teclado**, região `aria-live`, `<details>` "Ver os valores do gráfico" (tabela alternativa), rótulos de série, estados de ponto não dependem só de cor (círculo vazado, ×, faixa).
- Variação sempre neutra (sem verde/vermelho como juízo); setas acompanham texto.
- Seletor de crimes: lista com `aria-pressed` no desktop e `<select>` nativo no mobile; busca do explorador com rótulo `sr-only`.
- Navegação de capítulos com `aria-current`; alvos de toque de `summary` e links do capítulo ≥ 24 px.

## Ressalvas
- Os 8–9 alvos < 24 px são do cabeçalho/rodapé/links inline **globais do site** (já existentes); não foram alterados por estar fora do escopo.
- "Sem nome": falso positivo da heurística para input de busca (tem label `sr-only`) e itens do menu mobile do cabeçalho global.
- Não houve teste com leitor de tela real nem auditoria axe completa; a verificação é por script próprio.
