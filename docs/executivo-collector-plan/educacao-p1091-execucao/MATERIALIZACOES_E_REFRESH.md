# Materializações e refresh

Migration 21 cria `exec_edu_overview_rollup` e `exec_edu_series_rollup`. O refresh `refreshEducationCompactServing` usa advisory lock, tabelas temporárias, replace transacional e `exec_edu_analytics_meta` com fingerprint de origem.

Resultado: 5.599 overviews e 106.331 pontos de série; tamanho físico combinado medido no ensaio isolado 69.640.192 bytes e no oficial aproximadamente 38 MB após o refresh/índices.

O refresh é idempotente e preserva os fatos. Falha antes do `COMMIT` não substitui o estado anterior. Para produção, a próxima execução deve manter last-known-good explícito no control plane e registrar `dataThrough` por fonte. Retificações atuais exigem refresh do ano afetado; não há ainda delta refresh por município.
