# P12.8 — Validação nos territórios pedidos pela missão

Verificação em duas camadas: (1) HTTP real contra o servidor de desenvolvimento (`curl`, sem navegador), para confirmar alcançabilidade e ausência de marcador de erro; (2) navegador real via Playwright (`tests/e2e/wellbeing-p128.spec.ts`), para conteúdo, interação, foco de teclado e ausência de erro de console. Todos os `entity_id` abaixo foram confirmados contra `civica_exec.exec_entity` antes do teste — nenhum foi assumido.

**Nota de correção**: a verificação inicial (antes desta auditoria final) usava `entity_id=5102504` para "Boa Esperança do Norte, MT" — esse id é na verdade **Cáceres, MT**. O erro foi detectado ao inspecionar visualmente o screenshot de "estado de ausência" (o título da página dizia "Cáceres", não "Boa Esperança do Norte") e corrigido consultando `exec_entity` diretamente: o id correto é **5101837**. O spec de teste e o screenshot foram corrigidos e re-executados antes de qualquer PASS ser declarado. Isso é citado aqui deliberadamente — a missão pede para nunca declarar algo correto sem inspeção real, e foi exatamente essa inspeção visual que pegou o erro.

## Resultado por território

| Território | kind | entity_id | HTTP | Verificação |
|---|---|---|---|---|
| Vitória, ES | município | 3205309 | 200 | Playwright: retrato, 6 capítulos, gráfico Caged, disclosure por indicador, sem NaN/undefined/Infinity, saldo com sinal explícito (+322) |
| Vila Velha, ES | município | 3205200 | 200 | curl: título correto, sem marcador de erro |
| Alto Rio Novo, ES | município | 3200359 | 200 | Playwright: sem crash, sem "0 vínculos/CRAS/CREAS", sem erro de console |
| Boa Esperança do Norte, MT | município | 5101837 | 200 | Playwright: capítulos sem dado aparecem como bloco `Pending` tracejado com motivo explícito ("Censo 2022 não revelou...", "Censo SUAS 2024 não registrou...", "MUNIC 2024 não tem resposta válida..."); saldo do Caged genuinamente zero (0) aparece distinto dos capítulos ausentes — nunca confundidos |
| São Paulo (município) | município | 3550308 | 200 | Playwright: `<title>` e `<h2>` diferentes da página da UF São Paulo |
| Brasília, DF | município | 5300108 | 200 | Playwright: `<title>` diferente da página da UF Distrito Federal |
| Espírito Santo | UF | 32 | 200 | Playwright: Gini 0,505 (próprio) e 0,542 (Brasil) visíveis só nesta página, nunca na de município; sem overflow em 320/390/1360px |
| São Paulo | UF | — | 200 | Playwright: confirmado distinto do município (ver acima) |
| Distrito Federal | UF | 53 | 200 | Playwright: confirmado distinto do município de Brasília (ver acima) |

8 dos 8 territórios pedidos pela missão, mais Distrito Federal (par da dupla Brasília), todos passando.

## Distinção município × UF — a checagem explícita da missão

A missão pediu para confirmar que o sistema distingue município São Paulo de UF São Paulo. Verificado em navegador real (não só por `curl`):

- `/municipios/3550308/bem-estar` → `<h2>`: "Como se vive em São Paulo?"
- `/estados/SP/bem-estar` → `<h2>`: "Como se vive no estado de São Paulo?"

Essa distinção dependeu de uma correção de aplicação durante esta fase: a heading original tinha os dois ramos do ternário (`scope.kind === 'uf' ? ... : ...`) idênticos por engano, então município e UF mostravam o mesmo texto. Corrigido em `wellbeing-page.tsx` para usar `no estado de ${where}` no ramo de UF, mesma convenção já usada em `lib/wellbeing/narrative.ts`. Reproduzido também para Brasília × Distrito Federal.

## Ausência honesta — a segunda checagem explícita da missão

Boa Esperança do Norte (MT) e Alto Rio Novo (ES) foram escolhidos por serem municípios pequenos/mais novos, com maior chance de lacunas reais de publicação. Em ambos:

- Nenhum capítulo sem dado mostra um valor zero ou um gráfico vazio silencioso — mostra o bloco `Pending` com `emptyReason` específico daquele capítulo.
- Onde existe um zero genuíno (ex.: saldo do Novo Caged = 0 em Boa Esperança do Norte, agosto/2026), o valor aparece normalmente, com o mesmo texto que apareceria para qualquer outro valor — a distinção entre "a fonte não publicou" e "o valor publicado é zero" está no CAMPO (`chapter.available`/`emptyReason`), não inferida pela UI a partir do número.
