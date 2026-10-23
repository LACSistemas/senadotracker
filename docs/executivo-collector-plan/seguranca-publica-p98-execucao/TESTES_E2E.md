# Testes (P9.8)

## Resultado final
| Suíte | Arquivo | Resultado |
|---|---|---|
| Unitário | `tests/unit/security-p98.test.ts` | 14/14 |
| Integração (cluster isolado, porta 55438) | `tests/integration/security-bench-p98.test.ts` | 3/3 |
| Integração com dados reais | `tests/integration/security-page-real-p98.test.ts` | 4/4 |
| E2E Playwright (Chrome, build de produção isolado) | `tests/e2e/seguranca-p98.spec.ts` | 13/13 (rodada final, após o último build) |
| `npm test` completo | — | 493 testes: 463 pass, 0 fail, 30 skipped |
| `tsc` (web e `tsconfig.tests.json`) | — | limpos |
| Regressão de dados | `scripts/exec/fingerprints-all.ts` | fingerprints P9.7-final × P9.8-final **idênticos** |

## O que o E2E cobre
Vitória (herói, seletor de crime, quantidade × taxa, janela, comparação, CSV, estágios financeiros, Detran), Alto Rio Novo (sem comparação de taxa, "Não tem" guarda), Salvador (sem "Roubos" no herói; dado só-estadual), página de estado, vitrine nas visões gerais, APIs (benchmark válido; parâmetros inválidos recusados), mobile 390 (sem rolagem horizontal, `<select>` nativo, KPI nos primeiros 1.400 px).

## Unitário/integração
Sem causalidade no texto; zero × ausente × suprimido; faixas de porte; recusa de taxa em 2022–2023 e < 20 mil hab.; benchmark com cobertura < 80% e supressão; casts numéricos (`value out of range` pegos aqui); SSR do gráfico.

## Como rodar
`E2E_BASE_URL=http://127.0.0.1:3102 npx playwright test tests/e2e/seguranca-p98.spec.ts` (servidor de produção isolado). Sem `E2E_BASE_URL`, o `playwright.config.ts` sobe o servidor padrão.

## Ressalvas
- Testes antigos exigiram `lc_messages=C` no cluster de teste (mensagens do Postgres em inglês); não é regressão.
- Sem testes de regressão visual por pixel; as capturas são inspecionadas manualmente.
