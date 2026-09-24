# Custos ampliados, gabinetes e comparações

## Composição

Cada observação guarda Casa, pessoa ou gabinete, competência, rubrica, valor em centavos, natureza (`expense`, `budget`, `occupancy` ou `headcount`), origem e disponibilidade. Somente `expense` atribuída diretamente e sem sobreposição entra na composição. CEAPS/CEAP continua identificada separadamente. “Total” é proibido enquanto alguma rubrica prevista estiver indisponível; a interface usa “custos identificados no recorte”.

## Vocabulário financeiro de gabinete

| Termo | Natureza | Pode ser somado diretamente? |
| --- | --- | --- |
| Limite/verba disponível | orçamento/teto | não; não é gasto |
| Verba de gabinete gasta | despesa identificada pela Câmara | somente dentro da própria série e competência |
| Remuneração bruta | parcela da folha | somente após deduplicar pessoa, competência e tipo de folha |
| Auxílio, diária e indenização | rubricas próprias | não presumir inclusão ou exclusão da remuneração bruta; usar regra da fonte |
| Encargo patronal, 13º e férias | custo adicional | só atribuir quando houver valor oficial por gabinete |
| CEAP/CEAPS | cota parlamentar indenizatória | manter separada da folha/verba |
| Subsídio parlamentar | remuneração do parlamentar | manter separado da equipe |
| Quantidade de funcionários | `headcount` | nunca converter em dinheiro |

O percentual de utilização é `gasto / limite` apenas quando ambos pertencem ao mesmo deputado, mês e contrato da fonte. Limite proporcional não é substituído pelo teto corrente. Comparações entre Senado e Câmara só são publicadas se rubrica, população e competência forem equivalentes; caso contrário, cada Casa mantém sua métrica própria.

Gabinete separa escritório, pessoa, vínculo de trabalho e lotação. Uma fotografia atual não cria histórico retroativo. Endereço, contagem ou custo só aparecem com fonte e data de observação.

## Comparações

- Comparar apenas a mesma Casa, métrica, ano e meses cobertos.
- Considerar registros nos períodos de exercício; suplência e afastamento alteram elegibilidade.
- Partido e UF são os válidos no período da observação, quando disponíveis.
- Ausência ou lote parcial não vira zero e exclui o registro de médias e ranking.
- Média é aritmética sobre pessoas compatíveis; empate ordena por nome e identificador oficial.
- Rankings são por métrica explícita e não formam nota de mérito.

## Régua, cor semântica e piso de amostra

A régua ao lado de um número o situa no universo que o produziu: percentil na distribuição ou múltiplo da mediana. Ela e a cor semântica seguem três regras.

- **Mesma proveniência.** Valor e distribuição vêm do mesmo lote, recorte de período e universo elegível. Um valor de competência única é comparado com a distribuição da mesma competência, nunca com a soma anual da Casa.
- **Direção declarada por métrica.** Custos e quantidade de vínculos são `higher-is-worse`; presença, participação, autoria e relatoria são `higher-is-better`. A direção fica na definição da métrica, não em quem exibe o número, e decide qual cauda acende.
- **Piso de amostra.** A distribuição existe com qualquer n e sempre publica o seu, mas o piso governa tom e frase: **10 observações** para distribuição de Casa e **3** para mediana por unidade federativa, porque o Senado tem três cadeiras por UF. Abaixo do piso, e em cobertura `unavailable`, `stale` ou `not_applicable`, o número fica neutro e sem régua.

## Comparabilidade no tempo

As regras acima são transversais — mesma Casa, mesma métrica, mesmo ano. Quando a comparação atravessa anos, o dinheiro deixa de ser uma unidade única: reais de 2018 e de 2022 não medem o mesmo poder de compra.

- **Valores nominais são o padrão** e continuam publicados, porque são o que a fonte declarou.
- **A correção é oferecida, não imposta**, e sempre diz o índice, os dois meses de referência e a fonte. Os meses vêm do próprio dado (a data da eleição registrada na candidatura), não de constante no código.
- **Sem índice publicado para as duas pontas, não há correção.** A opção fica desabilitada com a razão; um valor estimado seria indistinguível de um medido, e séries não são completadas com o valor corrente.
- **Corrigir por um fator único não reordena ranking.** `(1+r)/k − 1` é monótono em `r`: muda o sinal e a magnitude, não a posição. Quem cresceu menos que o índice passa a aparecer com perda real, e a interface afirma isso em vez de deixar o leitor procurar uma reordenação que não existe.

## Concordância de voto

A concordância entre dois parlamentares é a fração das votações nominais de plenário em que ambos registraram a mesma posição.

- **O denominador é a interseção**: só deliberações em que os dois votaram. Nunca o universo de votações elegíveis.
- **Só votos que revelam posição entram**: sim, não e abstenção, mais obstrução na Câmara, onde é posição declarada. Ausência, licença, missão e não registro ficam fora — dois ausentes não concordam, apenas faltaram. `Secreto` e `votou` também ficam fora: registram a ação, não a direção.
- **O universo é o mesmo das demais métricas da página**: plenário, votação nominal, até o corte do período. Votos de comissão não entram, porque quem não é da mesma comissão nunca se cruzaria.

O eixo das votações usa a mesma definição de voto e a legislatura como universo. É o primeiro componente das divergências observadas, **não uma escala ideológica**: não tem direção intrínseca, os extremos são descritos pelos partidos que os ocupam, e só as distâncias relativas significam algo. Quando o eixo explica pouco da variância, a cobertura registra que a Casa não se reduz bem a uma dimensão.

Cinza significa ausência de universo compatível, nunca valor baixo — no mapa ele usa um matiz fora da rampa sequencial para não ser lido como o tom mais claro. A cor sempre acompanha seta e rótulo, e jamais é o único portador da informação.

No primeiro recorte, a comparação publicável usa CEAPS/CEAP líquida, pois já possui cobertura conciliada. Rubricas ampliadas e estrutura de gabinete aparecem como indisponíveis até seus adaptadores oficiais produzirem lotes completos.
