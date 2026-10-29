# Contratos sociais P12.3

- Fato escalar: `(indicator_id, entity_id, period_start)`; `NULL` quando a fase/universo oficial não existir.
- Família ≠ pessoa ≠ parcela ≠ benefício. Nunca inferir famílias contando parcelas.
- Bolsa Família: separar quantidade de famílias oficialmente informada e valor de parcelas pagas.
- BPC: separar benefícios/pagamentos conforme o estágio explicitado pela fonte.
- CadÚnico: registrar a situação publicada (ativo, atualizado, elegível etc.) como parte da definição; taxa só com numerador e denominador do mesmo universo.
- Unidade monetária: BRL decimal; sem floats no staging ou nos fatos.
- Município: resolver por código SIAFI→IBGE oficial; nome isolado não é chave.
- Snapshot: competência, `source_updated_at`, hash do recurso e revisão imutável; falha não substitui last-known-good.
- PII: CPF, NIS, nome, benefício e representante não entram em raw/staging/DB/logs desta fase. A fonte pode ser inspecionada apenas no dicionário.

Nenhuma publicação P12.3 foi ativada porque os pré-requisitos de fonte segura não passaram.
