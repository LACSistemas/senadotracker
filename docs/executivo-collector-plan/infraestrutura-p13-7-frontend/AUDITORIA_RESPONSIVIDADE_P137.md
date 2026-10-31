# P13.7 — Auditoria de responsividade

Verificação real via Playwright/Chromium (não é inspeção de código apenas) — ver `TESTES_E2E_P137.md` para a suíte completa.

## Larguras testadas e resultado

| Largura | Caso | Overflow horizontal | Erro de console |
|---|---|---|---|
| 320px | Vitória (município) | 0 | 0 |
| 360px | Vitória (município) | 0 | 0 |
| 390px | Vitória (município) | 0 | 0 |
| 390px | Espírito Santo (UF) | 0 | 0 |
| 390px | Lista de obras, filtrada | 0 | — |
| 768px | Vitória (município) | 0 | 0 |
| 1360px | Vitória (município) | 0 | 0 |
| 1360px | Espírito Santo (UF) | 0 | 0 |
| 1440px | Vitória (município) | 0 | 0 |
| 1920px | Vitória (município) | 0 | 0 |

`overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth`, medido no navegador real — zero em todas as larguras testadas, incluindo as quatro exigidas pelo brief (1360–1440, 768, 390, 360) mais três adicionais de estresse (320, 1920).

## Padrões usados para garantir isso

- Tabelas (lista de obras, contratos, empenhos, explorador) envolvidas em `overflow-x-auto` com `min-w-[*]`, nunca estourando a largura da página — a rolagem fica contida na tabela, não na página.
- Grids de KPI (`StatGrid`) usam `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, mesmo padrão já usado e testado em Segurança/Bem-estar/Educação.
- Formulário de filtro de obras usa `grid sm:grid-cols-2 lg:grid-cols-4`, campos empilham em mobile.
- Alternador de unidade do Censo Entorno (`EntornoUnitSwitcher`) usa `flex-wrap` nos botões.

## O que não foi verificado

- Inspeção visual manual em dispositivo físico (só emulação de viewport no Chromium).
- Orientação landscape em mobile.
- Zoom de página (200%) — não testado nesta fase.
