# Freshness e LKG

`getInfrastructureFreshness` retorna período indicador mais recente, famílias, `lastKnownGood`, `stale`, `cacheRevision` e `cacheKey`. A chave inclui território e revisões do snapshot de indicadores e da revisão ativa de Obrasgov. Falha futura não apaga a publicação válida; consumidores devem reter o último estado bom e sinalizar stale.
