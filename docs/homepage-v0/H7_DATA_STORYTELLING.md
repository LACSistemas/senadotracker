# H7.0-H7.1 — Auditoria e reconstrução do data storytelling

## H7.0 — Auditoria real (antes de mudar código)

Capturas em `artifacts/h7-homepage-v0/` (prefixo `h7-check-*` para o estado herdado de H6, `h7-final-*` para o resultado). Inspeção direta das imagens, não suposição.

Decisões concretas, não recomendações genéricas:

1. **Educação**: o H6 mostrava um mapa de Ideb de uma única edição (2025) sob a pergunta "varia bastante entre os estados?" — pergunta de distribuição, dado correto para isso. O mandato H7 pede explicitamente uma pergunta sobre **evolução**; um mapa de ano único não demonstra evolução. **Decisão**: trocar para mapa de variação (Δ) entre as duas edições mais recentes do Ideb (2023→2025), já que a Nota Informativa do Ideb 2025 do INEP trata essas edições como comparáveis às anteriores — não é preciso reformular a pergunta para "distribuição", dá para responder honestamente "como mudou" com um mapa de delta.
2. **Justiça**: mini-gráfico de barras de 80px de altura, sem eixo numérico, sem protagonismo. **Decisão**: gráfico de linhas real em SVG, dimensionado para o card (560×220 de viewBox), com eixo Y (0 e o valor máximo), eixo X (primeiro/último ano), pontos com `<title>` por ano, e uma tabela oculta para leitor de tela — mesma série de dados (CNJ, soma nacional 2016-2025), sem inventar nada novo.
3. **Gastos públicos**: H6 mostrava só um número grande (R$34,5bi, despesa com magistrados) e um headcount — nenhuma visualização, nenhuma composição. Investigado: `JN_EXPENSE_MAGISTRATES` + `JN_EXPENSE_SERVERS` + `JN_EXPENSE_BENEFITS` somam R$157,8bi dos R$164,6bi de `JN_EXPENSE_TOTAL` publicado (~96%, não 100% — o Judiciário não detalha as rubricas restantes nesta base). **Decisão**: gráfico de barras horizontal com as 3 categorias reais, rotulado explicitamente como "as 3 maiores categorias", nunca como "composição total" — a nota sob o gráfico declara o percentual real coberto, para não parecer uma repartição de 100% que não é.
4. **Rodapé da seção**: título "Investigações baseadas em dados oficiais, com contexto e caminhos para você se aprofundar" trocado para explicitar os 4 níveis de leitura exigidos pelo mandato (pergunta → evidência → interpretação → investigação).

## H7.1 — O que foi construído

### Educação — "Como o aprendizado mudou entre 2023 e 2025?"
Mapa de variação do Ideb (anos iniciais) por UF, paleta divergente reaproveitando tokens já validados do design system (`--map-rose-2/4` para queda, `--map-blue-2/4` para alta, `#e9e7e0` neutro para estável) — não uma paleta nova. Dado real, consultado ao vivo para as 27 UFs (mesma função `getIdebTerritory`, sem nova consulta de schema): **26 estados melhoraram, 0 pioraram** entre as duas edições. Fonte: INEP, edição 2025.

### Justiça — "O que acontece quando entrada e baixa de processos seguem ritmos diferentes?"
Gráfico de linhas real (SVG customizado, não `MultiLineChart` — aquele tem min-width de 620px com rolagem interna, inviável num card; nem a mini-barra da H6, insuficiente como protagonista). Eixo Y com o valor máximo e zero: eixo X com os anos extremos. Interpretação explícita evita a armadilha que o mandato aponta: "baixas acompanham entradas de perto, mas não as compensam totalmente — o acervo pendente é o estoque publicado pelo CNJ, nunca a diferença entre as duas séries" — nenhuma fórmula de variação de acervo inventada a partir de entradas−baixas.

### Gastos públicos — "O que compõe a despesa do Judiciário?"
Barras horizontais reais: Servidores R$107,8bi, Magistrados R$34,5bi, Benefícios R$15,5bi — validadas contra `JN_EXPENSE_TOTAL` (R$164,6bi), com nota explícita de que as 3 juntas não fecham 100% do total.

### Composição desktop
Grid assimétrico de 12 colunas (Educação 4 / Justiça 5 / Gastos 3) — a história com a série mais rica (Justiça) ganha mais espaço, em vez dos 3 cards sempre do mesmo tamanho da H6.

## Verificação
Nenhum indicador novo foi inventado; todo número dos 3 cards vem de uma consulta real já carregada no `Promise.all` do topo da página (Ideb por UF em 2 edições, métricas de despesa do `judOverview`, mesma série nacional de entradas/baixas). Nenhuma chamada nova ao banco além da leitura por-UF de Ideb que já existia na H6 (agora buscando 2 edições por UF em vez de 1, mesma função, mesmo custo por chamada).
