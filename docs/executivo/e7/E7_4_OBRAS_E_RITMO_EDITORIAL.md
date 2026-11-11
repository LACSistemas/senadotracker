# E7.4 — Obras e ritmo editorial

## Obras públicas: maior destaque à visualização (mandato §14.2)
O gráfico de 6 situações da E6 foi preservado integralmente — mesmos dados, mesmas cores, mesma régua de não-soma dos estágios financeiros. O que mudou: um dado derivado real (não uma nova consulta) passou a abrir a seção como número protagonista — **28,9% das 154.449 obras registradas no Obrasgov estão concluídas** (`concludedCount / situationTotal`, calculado a partir das mesmas 6 linhas já buscadas por `getInfrastructureWorksBySituation`) — antes a seção abria direto num parágrafo de texto. Nenhum dado novo, nenhuma soma de estágios financeiros distintos (continua vedado).

## Ritmo editorial da página inteira (mandato §15)
A progressão continua: Descobrir o território (hero) → Entender responsabilidades (federativo) → Explorar condições de vida (cinco áreas) → Investigar entregas (obras) → Verificar fontes — já era essa ordem na E6 e permanece. O que mudou de fato o ritmo visual foi o conteúdo das seções do meio: antes, 3 blocos de altura e peso visual semelhantes (3 cards, 5 cards, texto+gráfico); agora, cada seção tem uma composição de altura e tipo diferentes (pílulas+faixa federativa; grade assimétrica com 5 linguagens visuais distintas; número+barras+sidebar de perguntas) — a variação de altura e tipo de conteúdo entre seções é o que quebra o padrão "sequência de blocos iguais" que o mandato rejeita, sem precisar de carrossel (mesmo raciocínio já usado em E6.5 para o mobile).

## O que não foi tocado
A base de dados da seção de obras (`getInfrastructureWorksOverview`, `getInfrastructureWorksBySituation`) não foi alterada; os 2 links de "Obras por estado e município" e "Finanças... por estado" continuam apontando para `/estados`, mesmas rotas já corrigidas e testadas na E6.
