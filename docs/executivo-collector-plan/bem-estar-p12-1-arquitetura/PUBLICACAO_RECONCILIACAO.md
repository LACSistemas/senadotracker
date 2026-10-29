# Publicação, reconciliação e last-known-good

## Pipeline futuro

1. Capturar arquivo/endpoint oficial em `D:\Civica\raw` e calcular SHA-256 antes e depois da leitura.
2. Criar `exec_ingestion_run` com fonte, edição, competência, parser e `rows_in`.
3. Validar cabeçalho, encoding, chaves, tipos, códigos IBGE/SIAFI, duplicidade e privacidade.
4. Agregar por indicador/território/período preservando numerador/denominador quando existem.
5. Reconciliar linhas source→stage→fato e Brasil/UF/município somente quando aditivo.
6. Publicar uma fatia `(dataset, UF, competência)` dentro da transação existente.
7. Atualizar `exec_ind_latest`/story apenas depois da publicação ativa.

## Gates por run

`SOURCE_HASH_PRESENT`, `LAYOUT_STABLE`, `KEY_UNIQUE`, `TERRITORY_RESOLVED`, `NO_PII`, `MEASURE_UNIT_VALID`, `DENOMINATOR_VALID`, `COVERAGE_EXPLAINED`, `AMOUNT_OR_COUNT_PARITY`, `IDEMPOTENT_REPLAY`, `PUBLICATION_ATOMIC`.

Falha em qualquer gate impede ativação da nova revisão; a revisão anterior continua servindo.

## Reconciliação

- `source_rows = parsed_rows + rejected_rows`;
- `parsed_rows = canonical_rows + unresolved_rows`;
- totais de classes só reconciliam se classes forem exaustivas;
- Caged: admissões, desligamentos e saldo são conferidos separadamente;
- Bolsa Família/BPC: valor pago não é valor concedido;
- mediana, Gini, percentuais e taxas não têm soma esperada;
- ausência territorial precisa de lista de códigos, não apenas um percentual.

## Replay e retificação

Replay do mesmo SHA/parser não gera nova revisão ativa. SHA diferente, mesmo período, gera revisão candidata com `previous_run_id`; a promoção exige reconciliação e mantém o last-known-good. Arquivo que muda durante a leitura é descartado e rebaixado para nova captura.

## Cenários de falha

| Falha | Ação |
|---|---|
| recurso indisponível | manter revisão ativa e registrar blocker |
| schema drift | não publicar; guardar amostra em staging |
| cobertura menor | publicar apenas se o contrato permitir `PARTIAL` e listar ausências |
| código territorial ambíguo | `AMBIGUOUS`; não fuzzy-match |
| retificação retroativa | nova revisão do período, sem apagar anterior |
| PII inesperada | quarentena no D:, não persistir |

