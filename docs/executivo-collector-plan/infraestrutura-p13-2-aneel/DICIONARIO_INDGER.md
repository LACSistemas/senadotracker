# Dicionário INDGER usado

O dicionário oficial descreve dados comerciais mensais, informados pelas distribuidoras e segregados por município. `CodMunicipioIBGE` é código IBGE; `DatReferenciaInformada` é o mês civil de referência.

| indicador | interpretação preservada |
|---|---|
| `QtdUCAtiva` | unidades consumidoras com contrato vigente, inclusive contrato com fornecimento suspenso |
| `QtdUCAtivaFat` | unidades ativas com fatura regular emitida no mês |
| `QtdFatura` | faturas de cobrança regular |
| `QtdFaturaSemLeitura` | faturas regulares calculadas sem leitura/estimativa |
| `QtdUCSuspInadimplemento` | unidades suspensas por inadimplemento no mês; eventos, não estoque de famílias sem energia |
| `QtdSolicRessarcimentoDano` | solicitações de ressarcimento por dano elétrico |
| `VlrPagoRessarcDano` | valor total pago a consumidores por dano elétrico, em BRL |

Ausência source-native permanece `NULL` com flag 512. Zero observado permanece zero. O indicador não é taxa de eletrificação nem população atendida.
