# P11.4.1 — Desbloqueio operacional e coleta real

## Resultado

`PROUNI_STATUS = BLOCKED_EXTERNAL`  
`FIES_STATUS = BLOCKED_EXTERNAL`  
`READY_FOR_ACCESS_PROGRAMS_FRONTEND = NO`  
`READY_FOR_PUBLICATION = NO`

O `WinError 10013` foi corretamente atribuído ao sandbox local quando observado ali. Fora dele, os endpoints oficiais responderam HTTP 403 com desafio Cloudflare. Portanto a coleta não pode ser declarada operacional sem uma sessão autorizada; nenhum desafio foi contornado.

O único arquivo local encontrado em `D:\Civica\raw\mec` era HTML de desafio com extensão `.csv` e foi rejeitado. Não há dados reais para reconciliar, medir p95/p99 ou publicar.

## Gates

| Gate | Resultado |
|---|---|
| NETWORK_ROOT_CAUSE | PASS_WITH_DOCUMENTED_LAYERS |
| PROUNI_SOURCE_ACCESS | BLOCKED_EXTERNAL |
| FIES_SOURCE_ACCESS | BLOCKED_EXTERNAL |
| PROUNI_REAL_INGESTION | NOT_RUN_NO_VALID_FILE |
| FIES_REAL_INGESTION | NOT_RUN_NO_VALID_FILE |
| TERRITORIAL_RECONCILIATION | NOT_APPLICABLE_NO_FACTS |
| PRIVACY | PASS |
| REAL_DATA_PERFORMANCE | NOT_RUN_NO_VALID_FILE |
| STORAGE_SAFETY | PASS |
