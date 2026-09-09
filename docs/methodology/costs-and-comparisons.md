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

No primeiro recorte, a comparação publicável usa CEAPS/CEAP líquida, pois já possui cobertura conciliada. Rubricas ampliadas e estrutura de gabinete aparecem como indisponíveis até seus adaptadores oficiais produzirem lotes completos.
