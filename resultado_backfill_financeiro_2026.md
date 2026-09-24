# Resultado do backfill financeiro institucional — 2026

Data da execução: 24/09/2026. O fluxo implementado parte do exercício financeiro e preserva a distinção entre pagamento, empenho, liquidação, cobrança e contrato.

## Resultado observado

| Casa | Fornecedores com pagamento datado | Pagamentos | Valor efetivamente pago |
| --- | ---: | ---: | ---: |
| Câmara | 36 | 175 | R$ 56.645.112,73 |
| Senado | 0 no backfill publicado | 0 | R$ 0,00 |
| Total | 36 | 175 | R$ 56.645.112,73 |

O valor da Câmara inclui movimentos de pagamentos e estornos com sinal. A execução já existente antes do backfill somava R$ 46.541.266,31 e 32 fornecedores; após a leitura anual, 36 fornecedores e 175 movimentos ficaram no universo financeiro datado de 2026.

O Senado não foi publicado como zero factual. O endpoint financeiro por favorecido ficou indisponível durante a execução (as 100 primeiras tentativas terminaram sem resposta HTTP), portanto o lote permaneceu sem registros normalizados de 2026. O parser foi validado com uma página oficial de NE que contém pagamento em 22/01/2026; quando a fonte voltar, `--resume`/`--force` permite repetir sem duplicação.

## Anos relacionados aos pagamentos da Câmara

### Ano da NE

| Ano da NE | Movimentos de pagamento |
| ---: | ---: |
| 2024 | 5 |
| 2025 | 27 |
| 2026 | 143 |

### Ano do contrato

| Ano do contrato | Movimentos de pagamento |
| ---: | ---: |
| 2024 | 13 |
| 2025 | 46 |
| 2026 | 116 |

Há 32 movimentos de pagamento identificados como restos a pagar na fonte da Câmara. O ano do pagamento foi sempre derivado de `occurred_at`/`movement_year`; não foi inferido do contrato ou da NE.

## Matriz de reconciliação

| Casa | Contratos conhecidos | NEs ligadas | NEs com execução | Pagamentos datados de 2026 | Fornecedores publicados |
| --- | ---: | ---: | ---: | ---: | ---: |
| Câmara | 2.181 | 119 | 67 | 175 movimentos | 36 |
| Senado | 2.626 | 32 | 32 | 0 publicados (fonte indisponível) | 0 no lote anual |

Na Câmara, o fluxo também preserva compromissos de 2024 e 2025 que continuam gerando pagamentos em 2026. No Senado, os números de contratos/NEs são o inventário anterior; não foram promovidos a pagamento anual.

## Universo sem decomposição temporal

Agregados históricos de contratos, cobranças e valores sem data oficial continuam fora do KPI anual. Eles permanecem auditáveis como universo B e não são convertidos em pagamento apenas por compartilharem contrato ou empenho. O lote anual publica somente movimentos com data e exercício verificáveis.

## Implementação e retomada

Comandos:

```powershell
npm run collector -- collect-chamber-financial-year --year 2026 --resume
npm run collector -- collect-senate-financial-year --year 2026 --resume
npm run collector -- rebuild-supplier-aggregates
```

Os comandos aceitam `--dry-run`, `--force`, `--limit` e `--ids`. Cada resposta é gravada em raw antes da normalização, com hash e checkpoint. As chaves de NE e movimento são idempotentes; não há delete silencioso. A arquitetura está pronta para outros exercícios, mas a execução histórica completa não foi iniciada.

## Limitações e próximos passos

1. Reexecutar o Senado quando `www6g.senado.leg.br` estiver acessível e publicar apenas pagamentos datados.
2. Resolver contratos antigos para NEs anuais quando existir vínculo oficial, mantendo `contract_year` separado de `commitment_year`.
3. Medir a reconciliação de cada Casa contra o total oficial do exercício antes de ampliar para todos os anos.

