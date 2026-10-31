# P13.7 — Hierarquia editorial (camadas progressivas)

## Camada 1 — Compreensão imediata

Seção "panorama" da página de overview: título contextual ("O que existe e está registrado em Vitória?"), lede com contagem real de indicadores e obras, até 8 KPIs priorizados por variedade de dimensão (água, ruas, habitação, energia, mobilidade/segurança-hídrica, obras), um gráfico de obras por situação oficial (nunca uma nota única), comparação com UF/Brasil quando elegível (só município).

## Camada 2 — Exploração por tema

7 capítulos, nesta ordem: Água e saneamento → Ruas e ambiente urbano → Habitação → Energia e conectividade → Mobilidade e logística → Segurança hídrica e barragens → Obras públicas. Cada um com `ChapterShell` (pergunta → resposta → contexto → conteúdo → fontes e limites → convite) e `ChapterNav` sticky para pular entre eles.

A ordem segue o brief (seção 6) com um ajuste: Segurança hídrica (SNISB/SIGBM/Atlas Águas) vem **antes** de Obras públicas, porque Obras é tratado como prioridade de produto (seção 14 do brief) e funciona melhor como fecho do panorama temático, com link direto para a camada 3 (lista completa).

## Camada 3 — Análise aprofundada

- **Explorador de indicadores** (`IndicatorExplorer`): catálogo completo dos indicadores publicados para aquele território específico (não os 108 nacionais inteiros — ver nota em `CONTRATO_KPIS_P137.md` sobre essa escolha de escopo), com busca, filtro por família e exportação CSV.
- **Lista de obras** (`/infraestrutura/obras`): os projetos completos do território, com os 10 filtros reais implementados (situação, categoria, órgão, abrangência, período previsto, com/sem medição física, com/sem contrato, com/sem pagamento), paginação no servidor.
- **Detalhe de obra** (`/obras/[id]`): histórico completo de uma obra — financeiro por estágio, físico, contratos, empenhos paginados, evidências externas.
- **Disclosure por indicador** (`IndicatorDetails`, dentro de cada capítulo): fonte, período, universo, cobertura, revisão, metodologia — sem nenhuma consulta nova, dado que o capítulo já buscou.

## Camada 4 — Evidências

- Seção "Fontes desta página" ao final do overview: lista de fontes realmente usadas (só as que têm capítulo disponível) + nota de isenção ("não cria uma nota única... ausência de valor significa que a fonte não publicou, nunca zero").
- `<details>` de "Cobertura nacional por família de fonte" dentro da seção de fontes: contagem de indicadores/observações/período mais recente por família, rotulado explicitamente como alcance **nacional** da fonte (não deste território), para não confundir "76 mil observações no Brasil" com "76 mil observações aqui".
- `CORRECOES_G0_P137.md`, `AUDITORIA_CONTRATO_BACKEND_P136.md` e os demais documentos desta pasta são a camada de evidência do próprio processo de construção da fase — registram o que foi investigado, decidido e por quê.

## Regra de não vazamento entre camadas

Nenhum dado da camada 3/4 aparece na camada 1 sem resumo — o hero nunca mostra uma tabela, nunca mostra um código de indicador cru, nunca expõe os 108 registros de uma vez. Inversamente, nenhuma informação da camada 1 some ao aprofundar: os mesmos indicadores do hero reaparecem com detalhe completo no capítulo correspondente e no explorador.
