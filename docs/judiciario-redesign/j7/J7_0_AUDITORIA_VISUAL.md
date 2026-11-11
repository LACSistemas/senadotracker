# J7.0 — Auditoria visual do Judiciário (antes de mudar código)

Capturas em `artifacts/j7-judiciario/before/` (1440 primeira viewport e página inteira, 390 primeira viewport e página inteira). Inspeção direta das imagens, confirmando o diagnóstico do mandato:

1. **Hero**: banner escuro com manchete + uma ilustração decorativa de colunas (`/judiciario-nacional.svg`) — não é dado, é decoração. Nenhuma visualização real na primeira tela.
2. **4 KPIs** (casos novos/baixados/pendentes/magistrados) em cartões brancos separados, logo abaixo do hero, mesma hierarquia visual entre si.
3. **"A Justiça em movimento"**: já tinha um `MultiLineChart` real (2009-2025, 3 séries) — esta seção já estava relativamente madura, diferente do que o resumo do mandato descreve ("gráfico histórico com pouco protagonismo"); confirmado por inspeção que o gráfico já é grande e a seção já usa um grid assimétrico (`minmax(0,1fr)_320px`). O ponto fraco real era a aside "Como a Justiça se organiza?": uma lista plana de 6 links com hints de contagem **hardcoded** (não lidos do banco).
4. **"Congestionamento e tempo"**: confirmado **puramente textual** — dois parágrafos e um link, nenhum elemento gráfico. Falha mais clara do que o mandato descreve.
5. **"Temas que mobilizam o sistema"**: confirmado 6 cartões com estrutura idêntica (título, descrição, contagem de indicadores, seta) — nenhuma diferenciação, nenhum tema em destaque, nenhum dado real visível além da contagem.
6. **Mobile**: hero vira texto + ilustração decorativa + CTAs, depois 4 KPIs empilhados, depois o gráfico — exatamente a sequência "Hero → 4 cards → gráfico pequeno" que o mandato pede para eliminar.

## Decisões concretas para J7

1. Hero reconstruído como composição única (texto + gráfico real de casos novos×baixados, 6 anos mais recentes, + 4 indicadores integrados no mesmo painel) — mesma gramática estrutural validada em H7, mas com identidade própria: paleta de linha (verde-claro "casos novos" / âmbar "baixados"), não mapa.
2. "A Justiça em movimento" mantido majoritariamente — já atendia ao critério de protagonismo; só a aside de ramos foi reconstruída.
3. Ramos: lista plana → barras reais, usando a contagem de instituições já carregada em `judOverview.data.branches` (não mais hints hardcoded).
4. Congestionamento: construída uma visualização real de **distribuição** entre os 91 tribunais (não uma falsa média nacional) — nova função de leitura `getJudiciaryIndicatorDistribution`, só leitura, documentada em `J7_2_TEMPO_E_INSTITUICOES.md`.
5. Temas: 6 cards uniformes → 1 tema em destaque (critério explicado, não "o de maior número") + 5 temas em lista compacta.

Nenhuma mudança na "Congestionamento" do ponto de vista estatístico: a regra de nunca somar taxas continua — o que mudou é a FORMA de mostrar a variação real (distribuição, não texto).
