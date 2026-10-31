# P13.7 — Auditoria de acessibilidade

Sem `axe-core` no projeto (nenhum domínio anterior usa) — verificação estrutural manual + Playwright, mesmo padrão de `wellbeing-p128.spec.ts`/`seguranca-p98.spec.ts`.

## Verificado com teste real (Playwright)

- **Foco visível por teclado**: `ChapterNav` (link ativo do primeiro item) tem `outline`/`box-shadow` computado diferente de `none 0px none` — confirmado via `getComputedStyle`, não suposição.
- **`prefers-reduced-motion: reduce`**: página renderiza sem erro de console com a preferência ativada.
- **Navegação sem depender de mouse**: formulário de filtros de obras usa `<select>`/`<input type="date">`/`<input type="checkbox">`/`<button type="submit">` nativos — recebem foco e são operáveis por teclado por padrão do navegador (comportamento nativo, não precisa de JS customizado).

## Verificado por revisão estrutural do código

- **HTML semântico**: `<nav aria-label="...">`, `<table>` com `<thead>`/`<th scope="col">`, `<details>/<summary>` para disclosures e para o explorador (progressive disclosure nativo, sem JS de abrir/fechar customizado), `<dl>/<dt>/<dd>` para KPIs.
- **Texto alternativo em gráfico**: `TerritoryCompareRow` (comparador) tem `role="img"` com `aria-label` descrevendo os três pontos por extenso — a leitura não depende só da posição visual dos pontos no eixo.
- **Cor não é o único sinal**: barras (`BarList`) mostram o valor numérico ao lado, nunca só a barra preenchida; estados "não aplicável"/ausência aparecem como texto, não como cor isolada.
- **Unidades legíveis**: todo valor formatado (`formatIndicatorValue`) carrega a unidade (%, kW/MW/GW, R$, etc.) ao lado do número, nunca um número solto.
- **Mensagens de ausência compreensíveis**: cada capítulo sem dado usa `<Pending>` com frase explicando o motivo e a garantia explícita "Nenhum valor é estimado nem preenchido com zero" — não um "—" genérico sem explicação.
- **Tabelas**: cabeçalhos (`<th scope="col">`) em todas as tabelas (lista de obras, contratos, empenhos, explorador, cobertura por família).

## O que não foi testado nesta fase (limitação honesta)

- Leitor de tela real (NVDA/JAWS/VoiceOver) não foi executado.
- Contraste de cor não foi medido com ferramenta dedicada (ex.: axe, Lighthouse) — os tokens de cor reusados (`#115b45`, `#14304f`, `#e8f3ee`) são os mesmos já em produção em Segurança/Bem-estar/Educação, não houve introdução de combinação nova.
- Navegação completa só-teclado ponta a ponta (abrir filtro → selecionar → submeter → navegar para resultado → abrir obra → voltar) não foi percorrida manualmente, só os pontos críticos (`ChapterNav`, disclosure) citados acima.
