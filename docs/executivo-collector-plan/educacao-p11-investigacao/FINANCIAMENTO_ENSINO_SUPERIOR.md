# Financiamento do ensino superior

## Federal

Portal da Transparência oferece downloads e API com periodicidades distintas. Tesouro publica lista de órgãos SIAFI com código, nome e CNPJ; ela é a primeira ponte determinística para universidades federais. A despesa deve ser mantida por órgão/UG, exercício, ação, natureza e estágio, sem somar dotações, empenho, liquidação e pagamento.

## Estadual/municipal

Siconfi/SIOPE já são reusados pelo P10 para educação, mas função 12 e MDE não equivalem automaticamente ao orçamento de uma universidade. Portais estaduais têm cobertura e layouts próprios. Publicar SOURCE_LIMITATION quando não houver universo completo.

## Privadas

Não há orçamento público total comparável. A camada pública pode mostrar bolsas ProUni/FIES, vagas, matrículas, qualidade e contratos PNCP publicados; não extrapolar isso para custo ou receita da instituição.

## Contratos

Reutilizar o coletor PNCP do P10. A ligação é por CNPJ do órgão/fornecedor e contrato publicado. Campus, fundação de apoio e mantenedora podem ter CNPJs diferentes; exigem crosswalk explícito.

## Gasto por aluno

Só calcular quando numerador e denominador tiverem mesma instituição, ano, local e definição. despesa paga / matrícula não deve misturar órgão central com polos EaD nem usar matrícula como pessoa única.

