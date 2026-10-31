# P13.7 — Testes E2E

Suíte: `tests/e2e/infraestrutura-p137.spec.ts` (Playwright, Chromium real, headless). Espelha o padrão já estabelecido por `tests/e2e/wellbeing-p128.spec.ts` e `tests/e2e/seguranca-p98.spec.ts`.

Execução real contra o build de produção isolado:
```
NEXT_DIST_DIR=.next-infra137 npx next build && NEXT_DIST_DIR=.next-infra137 npx next start -p 3103
E2E_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/e2e/infraestrutura-p137.spec.ts
```

**Resultado: 30/30 testes passando** (primeira rodada teve 1 falha por seletor ambíguo no próprio teste — corrigido, não era defeito da aplicação).

## Cobertura

| Grupo | O que testa |
|---|---|
| Vitória desktop (1360×900) | Heading do panorama, nav de capítulos, ausência de `NaN`/`undefined`/`Infinity`/`[object Object]`, os 6 capítulos temáticos visíveis, disclosure de indicador abre e mostra Fonte/Período/Cobertura, link para lista de obras |
| Explorador | Abre o `<details>`, busca por "água", exporta CSV real (evento de download do navegador verificado) |
| Screenshots Vitória | Panorama, Ruas e Entorno, Energia, Obras — capturas reais |
| Teclado | Foco visível em `ChapterNav` (outline/box-shadow computado, não `none`) |
| Movimento reduzido | `prefers-reduced-motion: reduce` não quebra a renderização |
| Estado (ES) | Heading correto, **confirma ausência do bloco de comparação** (regra: só município compara), sem overflow horizontal, screenshot |
| ES mobile 390px | Sem overflow horizontal, screenshot |
| Larguras de estresse | 320/360/390/768/1360/1440/1920px — zero overflow horizontal e zero erro de console em todas |
| Obras — lista | Filtro de situação muda a URL e o resultado; filtro multimunicipal mostra "não ratado" (nunca valor fictício); paginação preserva filtros na URL |
| Obras — detalhe | Obra rica (142 contratos, 527 empenhos): 5 estágios visíveis, valores batem com o cálculo manual (R$ 700,0 mi / R$ 9,1 bi), empenhos paginados; obra multimunicipal: lista municípios e nota de não-rateio; obra recém-cadastrada: nunca mostra "R$ 0" para etapa ausente, mostra a frase "Não há informação publicada para esta etapa."; obra inexistente: 404 real, não 500 |
| Município × UF | São Paulo município tem título diferente de São Paulo UF (confirma que não há confusão de escopo) |
| Territórios pequenos/pós-Censo | Boa Esperança do Norte (MT, G0.3): não falha, mostra ausência honesta em vários capítulos, nenhum zero sintético; Atílio Vivácqua (ES): sem erro |
| Regressão | `/municipios/.../saude`, `/educacao`, `/seguranca`, `/bem-estar`, `/estados/ES/representacao`, `/estados/ES` continuam 200 sem erro de console |

## O que esta suíte NÃO cobre (limitação honesta)

- Lighthouse/Core Web Vitals reais (LCP/INP/CLS medidos por ferramenta dedicada) — não há Lighthouse configurado no projeto; os números de performance desta fase vêm de `BENCHMARKS_FRONTEND_P137.json` (medição direta do loader) e do tempo de execução dos próprios testes Playwright (proxy, não substituto).
- Teste de leitor de tela real (NVDA/JAWS/VoiceOver) — fora do escopo de Playwright; a verificação de acessibilidade desta fase é estrutural (ver `AUDITORIA_ACESSIBILIDADE_P137.md`).
- Interação de teclado completa em todos os controles (só `ChapterNav` e `summary` de disclosure foram testados explicitamente; os demais controles — formulário de filtro, paginação, explorador — usam elementos nativos (`<select>`, `<input>`, `<button>`, `<a>`) que recebem foco e funcionam por teclado por padrão do navegador, mas não foram testados um a um).
