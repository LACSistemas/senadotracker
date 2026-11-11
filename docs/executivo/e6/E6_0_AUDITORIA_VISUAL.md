# E6.0 — Auditoria visual do Executivo (antes de mudar código)

Inspeção do código e capturas reais antes de qualquer mudança, confirmando o diagnóstico do mandato:

1. **2 mapas do Brasil na mesma página**: o hero tinha um mapa puramente contextual (cor neutra única, sem indicador, sem legenda — `heroMap`), e logo abaixo, numa seção separada ("Explore o Brasil por indicador"), um SEGUNDO mapa, este sim analítico (colorido por indicador, com legenda). Repetição cartográfica confirmada exatamente como o mandato descreve — "mapa e informações nacionais visualmente fragmentados".
2. **Hero → KPIs em cartões separados**: mesmo padrão já corrigido na homepage (H6) e no Judiciário (J7) ainda presente aqui — 4 `KpiCard` numa grade própria, desconectados do mapa.
3. **"Quem cuida de quê no Brasil?"**: 3 cartões uniformes (ícone, título, parágrafo) — confirmado, "parece uma lista de três cartões" como o mandato aponta.
4. **"As cinco áreas da gestão pública"**: 5 `ThemeCard` com estrutura idêntica (ícone → título → número → unidade → nota → link) — confirmado.
5. **"Recursos e execução por área"**: confirmado puramente textual — 2 parágrafos e 2 links, nenhuma visualização, apesar de existirem dados reais de obras (Obrasgov) prontos para uso (`getInfrastructureWorksOverview`/`getInfrastructureWorksBySituation`, já no pacote `@senadotracker/db`, nunca chamados nesta página).
6. **Achado extra, fora do diagnóstico do mandato mas real**: o link `/obras` (usado em 2 lugares: a pergunta investigativa de infraestrutura e a lista de "Recursos") é uma **rota inexistente** — só existe `/obras/[projectId]` (detalhe), nunca um índice nacional. Confirmado 404. Mesmo achado já registrado durante o trabalho da homepage (H4), nunca corrigido até agora porque estava fora daquele escopo.
7. **Achado extra, campo invisível**: o input de busca territorial do hero (`#exec-q`) tinha `background-color: rgba(0,0,0,0)` (transparente) computado — texto escuro sobre o hero escuro, efetivamente ilegível. Pré-existente (mesmas classes já estavam assim antes de qualquer mudança desta fase), só veio à tona ao reconstruir o hero e conferir a captura real.

## Decisões concretas para E6
1. Fundir hero + "explorar por indicador" numa única composição cartográfica investigativa — resolve E6.1+E6.2+E6.3 simultaneamente (mandato enfatiza que esta fusão é "o maior diferencial que precisamos introduzir no Executivo").
2. "Quem cuida de quê": de 3 cartões soltos para uma faixa conectada (mesmo conteúdo textual, nova composição).
3. "As cinco áreas": Saúde ganha um 2º dado real (hospitais, não só leitos) para começar a diferenciação sem reescrever as 5 visualizações do zero.
4. "Recursos": de texto puro para um gráfico real de obras por situação (6 categorias reais do Obrasgov, mutuamente exclusivas).
5. Corrigir os 2 links `/obras` quebrados e o input invisível — achados reais, não deixados para depois.
