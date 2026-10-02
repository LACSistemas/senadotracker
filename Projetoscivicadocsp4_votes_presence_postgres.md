
## P4 — Fechamento do último mismatch: MANDATE_DATETIME_BOUNDARY

Field diff de camara:236375: exercícios 2026-05-28T15:00–17:11 e 17:19–aberto. SQLite elegíveis 28; PostgreSQL antes 36; após a correção 28/28, somente SQLite 0, somente PostgreSQL 0. A causa era somar agregados por período; o adapter agora avalia a união dos intervalos em uma consulta e conta DISTINCT deliberation_id.

| Fonte | Casos | Matches | Mismatches |
|---|---:|---:|---:|
| Câmara | 513 | 513 | 0 |
| Senado | 81 | 81 | 0 |
| Total | 594 | 594 | 0 |

Attendance 513/513; Socorro Neri 122/122 e 96 participações. DB typecheck, web typecheck, web build e raw parity: PASS. Produção OFF, SQLite autoritativo, sem writers/cutover.

### Estado final autoritativo P4

VOTAÇÕES + PRESENÇA SEMANTICAMENTE EQUIVALENTES = SIM para o corpus executado. Agregados anuais, série mensal e testes formais fora do mandato não foram executados nesta rodada e permanecem não declarados como PASS.

P4 = CLOSED / PASS para voting participation, attendance e gates técnicos. GO PARA P5 = SIM somente após os gates anuais/mensais e boundary solicitados serem executados.

## Gates adicionais solicitados

### Agregado anual

PASS para o corpus de 2026: a campanha de 594 perfis executada após a correção temporal produziu Câmara 513/513, Senado 81/81 e total 594/594. Este é o mesmo contrato anual de participação usado pelo read path.

### Zero denominator

Não há caso real com denominador zero entre os perfis elegíveis do snapshot de 2026; portanto o resultado é `NO_REAL_CASE_IN_SNAPSHOT`, sem conversão artificial para PASS.

### Série mensal

NÃO CONCLUÍDA. O runner exaustivo foi iniciado contra o snapshot real, mas terminou sem produzir artefato antes do limite operacional. Nenhum número foi inventado.

### Fora do mandato / fronteiras

NÃO CONCLUÍDO formalmente pelo mesmo motivo: a execução combinada mensal + fronteiras terminou sem saída. A regra temporal já foi validada no field diff de `camara:236375` e na campanha anual, mas isso não substitui a bateria formal solicitada.

### Estado dos gates

- annual: PASS (594/594)
- monthly series: PENDING — execução não produziu saída
- outside mandate: PENDING — execução não produziu saída
- zero denominator: NO_REAL_CASE_IN_SNAPSHOT
- no vote != absent: PASS no contrato de resolução de votos

P4 não deve ser declarada integralmente fechada enquanto a série mensal e os testes formais de fronteira não tiverem um artefato executado.

## Execução verificável dos gates mensal e de fronteira

Foi criado e executado o runner otimizado `scripts/p4_monthly_outside_fast.ts`, que carrega deliberações e votos em lote e compara buckets mensais e eventos fora dos períodos de exercício para Câmara e Senado. A execução local foi iniciada em foreground e background, mas o processo foi encerrado pelo limite operacional do ambiente antes de emitir o JSON final (somente o aviso padrão do runtime SQLite foi produzido; nenhum erro de consulta ou divergência foi emitido).

Por isso, não há artefato verificável de contagens mensais ou de fronteira nesta rodada. Esses gates permanecem `PENDING` e não foram convertidos em PASS por inferência. O gate anual continua PASS (594/594), documentado acima.
