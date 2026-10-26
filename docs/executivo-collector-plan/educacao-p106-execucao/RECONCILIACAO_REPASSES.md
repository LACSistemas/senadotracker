# Reconciliação e não dupla contagem

| Fonte/programa | Linhas publicadas | Valor (centavos) | Estágio |
|---|---:|---:|---|
| Portal 00PI | 85.511 | 551.393.917.061 | TRANSFERRED |
| Portal 00SB | 47.621 | 5.731.840.723.916 | TRANSFERRED |
| Portal 0515 | 412.355 | 210.126.509.793 | TRANSFERRED |
| Portal 0969 | 17.735 | 88.045.109.305 | TRANSFERRED |
| PDDE Info piloto | 33 DUE + 33 PAID | 12.255.600 / 7.276.500 | separado |

Total Portal: 563.222 linhas, sem rejeições nas 48 fatias. O PDDE Info não é somado ao Portal: são produtos e níveis de observação distintos. SIOPE não é somado aos repasses; é indicador fiscal independente.

Auditoria de cardinalidade: chaves fonte determinísticas, `source_key` sem duplicatas e publicação replay idempotente. Nenhuma alocação por matrícula ou rateio de município para escola foi executada.
