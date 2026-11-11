# H7.6 — Auditoria final

## Comparação obrigatória antes/depois (mandato §15)

| Dimensão | H6 | H7 | Evidência |
|---|---|---|---|
| Hero | Composição única (texto+mapa+indicadores integrados), já resolvida | Mesma composição — avaliada contra os critérios do mandato e aprovada sem mudança estrutural; só o artefato de captura do header sticky foi investigado (confirmado não-bug) | `h7-final-1440-first.png`, `h7-final-1920-first.png`, `h7-sticky-scrolled-viewport.png` |
| Educação | Mapa de nível único (Ideb 2025), pergunta de distribuição | Mapa de **variação** Ideb 2023→2025, paleta divergente, pergunta de evolução respondida com dado real (26 estados melhoraram, 0 pioraram) | `h7-final-1440-full.png` (seção Histórias) |
| Justiça | Mini-gráfico de barras, 80px, sem eixo | Gráfico de linhas real, 220px, eixo Y (0 e máximo), eixo X (anos extremos), tabela oculta para leitor de tela | `h7-mobile-carousel-justica.png`, `h7-final-1440-full.png` |
| Gastos | Número único gigante (R$34,5bi) sem visualização | Barras horizontais das 3 maiores categorias reais (Servidores/Magistrados/Benefícios), validadas contra o total publicado | `h7-final-1440-full.png` |
| Legislativo | `ConcentrationCurve` (barra compacta) | Hemiciclo real compacto (mesma geometria de `/legislativo`), legenda dos 4 maiores partidos | `h7-final-1440-full.png`, `h7-final-390-full.png` |
| Executivo | Mapa de população (3º mapa do Brasil na página) | Composição de 3 medidores (saúde/educação/infraestrutura), nenhum mapa | `h7-final-1440-full.png` |
| Judiciário | 2 barras verticais "balanço do ano" (entradas×baixas, mesmo par de cores da história de Justiça) | Ranking por ramo da Justiça (estrutura, não movimento no tempo) | `h7-final-1440-full.png` |
| Mobile (histórias) | Empilhamento vertical das 3 histórias | Carrossel horizontal com `scroll-snap`, uma história por vez, próxima sempre visível em parte | `h7-mobile-carousel-justica.png`, `h7-final-390-full.png` |

Nenhuma dessas linhas é "melhorou bastante" sem evidência — cada uma aponta para uma captura real e, onde aplicável, para o valor numérico real que mudou (26/0, R$157,8bi/R$164,6bi, 31,4mi/7,3mi/5,4mi/0,53mi).

## Responsividade e console
Larguras testadas: 320/375/390/430/640/768/1023/1024/1280/1920px. Overflow horizontal: **0 em todas, exceto duas exceções documentadas**:
- 1024px: 11px, no cabeçalho global (`app-header.tsx`), **confirmado pré-existente** — reproduzido de forma idêntica em `/estados`, página não tocada nesta sessão, nesta mesma largura exata. Fora do escopo deste mandato (frontend-only de homepage); não corrigido.
- 640px exato: 10px, colisão de borda entre o breakpoint Tailwind `sm:` (`min-width:640px`, inclusive) e a media query do `page-shell` (`max-width:640px`, também inclusive) — um pixel de largura de viewport em que as duas regras CSS se aplicam simultaneamente. Irrelevante na prática (nenhum dispositivo real renderiza exatamente 640,0px sem chrome do navegador alterando o valor); não corrigido por custo-benefício.

0 erros de console novos (excluindo o aviso pré-existente `<svg height="auto">`, presente em todo o produto, confirmado não introduzido aqui).

## Bug real encontrado e corrigido
Documentado em detalhe em `H7_MOBILE_UX.md` §"Bug real encontrado": tabela `sr-only` causando 439px de overflow fantasma no carrossel mobile, root-caused por bisseção de DOM (não suposição), corrigida substituindo por uma lista.

## Acessibilidade (axe-core real)
| | H6 | H7 |
|---|---|---|
| `label-content-name-mismatch` | 81 nós | **54 nós** |
| `nested-interactive` | 3 nós | **2 nós** |

Ambas as categorias já existiam antes de H6 (mesma causa raiz: o componente de mapa compartilhado `brazil-map-markup.ts`/`state-map-paint.ts`, replicado também em `/estados` e `/executivo`) — **não são violações novas**. A contagem **caiu** em H7 porque a página passou a usar o mapa 2 vezes (hero + história de Educação) em vez de 3 (H6 também usava um mapa no cartão Executivo, removido nesta fase) — de volta exatamente ao número de nós do baseline original H0-H5 (54/2). Não corrigidas (mesma razão de todas as fases anteriores: defeito do componente compartilhado, fora do escopo deste mandato de composição).

## Regressão e2e
Suíte completa (25 testes, `cadastro.spec.ts` + `ux-busca.spec.ts`) reexecutada após a reconstrução. **5 falhas, nenhuma nova**:
- 3 pré-existentes e não relacionadas, já isoladas e documentadas em `H5_QA_E_ACESSIBILIDADE.md` (reformas já mescladas antes desta sessão: heading renomeado em `/legislativo`; heading de histórico movido entre abas na carreira política; rota `/parlamentares/senado/999999` sem mais devolver 404).
- 2 flakiness de paralelismo de workers (`ux-busca.spec.ts:96` e `:123`), já confirmadas passando isoladamente nas fases H6.
- Os 3 testes que tocam diretamente a home/busca continuam verdes.

Classificação explícita pedida pelo mandato §12.1: nenhuma das 5 é regressão nova; todas já existiam e foram causa-raiz antes de H7.

## Typecheck
Isolado (`NEXT_DIST_DIR`), limpo, 0 erros — reexecutado 3 vezes ao longo da fase (após a reconstrução de storytelling/três-poderes, após a correção do carrossel, e verificação final).

## Performance
Não foi medido LCP/CLS/INP de campo nesta fase — este ambiente de desenvolvimento isolado não expõe Real User Monitoring, e não executamos Lighthouse/laboratório nesta rodada (status `NOT_EVALUATED` no gate G9, mesma situação herdada de H6). O peso adicionado é pequeno e determinístico: 3 SVGs a mais (hemiciclo, linha de Justiça, mesma assinatura leve de `paintStateMap` já usada antes) e 1 consulta nova (`getInfrastructureEditorialKpis`, Brasil-level, já indexada); nenhuma biblioteca de gráficos nova foi adicionada.

## Segurança arquitetural
Mudança exclusiva de apresentação em `apps/web/app/page.tsx`. A única leitura nova é `getInfrastructureEditorialKpis` (já existente em `@senadotracker/db`, nenhuma função/tabela criada). Nenhuma migração, alteração de schema, backfill, reinício de coletor ou comando destrutivo de Git em toda a fase.

## Status dos gates

| Gate | Status | Nota |
|---|---|---|
| G1 — Impacto visual | PASS_WITH_CAVEATS | Mudança estrutural real na primeira tela de histórias/três-poderes; avaliação final de "singularidade" cabe ao usuário |
| G2 — Data storytelling | PASS | As 3 histórias têm evidência visual própria, interpretação e investigação — nenhuma é só KPI |
| G3 — Diferenciação institucional | PASS | Hemiciclo / medidores / ranking — 3 formas visuais realmente distintas, confirmado em captura |
| G4 — Ritmo editorial | PASS | Composição assimétrica nas histórias, carrossel no mobile, contraste de densidade entre seções |
| G5 — Mobile | PASS | Carrossel com scroll-snap, sem autoplay, sem esconder histórias; bug real de overflow encontrado e corrigido |
| G6 — Precisão estatística | PASS | Nenhum dado inventado; decomposição de despesa rotulada corretamente como parcial (~96%, não 100%); nenhuma fórmula de variação de acervo fabricada |
| G7 — Funcionalidade | PASS | Busca, mapas, gráficos, links e navegação verificados funcionando |
| G8 — Acessibilidade | PASS_WITH_CAVEATS | 2 categorias pré-existentes no componente de mapa compartilhado, contagem de nós reduzida nesta fase, não corrigidas (fora de escopo) |
| G9 — Performance | NOT_EVALUATED | Sem métricas de campo disponíveis neste ambiente; peso adicionado é pequeno e qualitativamente avaliado |
| G10 — Segurança arquitetural | PASS | Nenhuma alteração em banco, coletores ou pipelines |

## Status final: READY_FOR_USER_VISUAL_APPROVAL

Conforme o mandato, G1 não é autoaprovado — a avaliação visual definitiva é do usuário.
