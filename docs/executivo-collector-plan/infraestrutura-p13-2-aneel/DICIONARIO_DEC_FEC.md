# Dicionário DEC/FEC

O dicionário ANEEL define DEC como duração equivalente de interrupção por unidade consumidora (horas) e FEC como frequência equivalente de interrupção por unidade consumidora. O arquivo contém `IdeConjUndConsumidoras`, `SigAgente`, `AnoIndice`, `NumPeriodoIndice` e `VlrIndiceEnviado`; o período pode ser mensal, trimestral ou anual conforme a linha.

O grão nativo é **conjunto de unidades consumidoras × distribuidora × indicador × período**. Os dados auditados têm 5.137.778 linhas, 23 siglas de indicador, 3.980 conjuntos, 105 agentes e períodos 2020-1 a 2026-8. Não há código municipal no arquivo de continuidade.

`DEC`/`FEC` não foram inseridos em `exec_ind_value`: sem pesos, exposição ou regra oficial de alocação, qualquer soma ou rateio municipal criaria um número sem semântica.
