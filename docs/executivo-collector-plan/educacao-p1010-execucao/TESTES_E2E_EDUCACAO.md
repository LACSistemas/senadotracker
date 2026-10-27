# Testes de navegador e regressão

## Smoke de rotas

| Rota/recorte | Desktop | Mobile | Resultado |
|---|---:|---:|---|
| ES | 1440 | 390 | 200 / PASS |
| SP | 1440 | — | 200 / PASS |
| Vitória | 1440 | 390 | 200 / PASS |
| Serra | 1440 | — | 200 / PASS |
| São Paulo capital | 1440 | — | 200 / PASS |
| município pequeno | 1440 | 390 | 200 / PASS |
| UF parcial/AC | — | 390 | 200 / PASS |

`scrollWidth == viewport` foi confirmado em 1440, 1360, 1280, 390, 375 e 320 px para a rota estadual principal. A rota existente `/estados/ES/seguranca` continuou respondendo 200 e sem overflow a 390 px.

Os controles de rede, etapa e edição temporal alteram os recortes já carregados; o comparador alterna UF/Brasil e a lista de escolas possui paginação local limitada à primeira carga. No município, o Capítulo 3 valida a série município/UF/Brasil e o tooltip/foco com os três valores por edição.

## Automação

O smoke foi executado com Playwright contra o servidor local, gerando 10 screenshots reais. Não é uma suíte E2E de CI; build, typecheck e testes direcionados foram executados separadamente.

## Testes direcionados

`tests/unit/educacao-p1010.test.ts` e `tests/unit/educacao-p1091-1.test.ts`: 6 testes, 6 pass, 0 falhas, 0 skips.

