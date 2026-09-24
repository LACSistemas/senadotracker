# Reconciliação das fixtures de contratações institucionais

## Câmara — Contrato 98/2024

Reconciliação executada sobre as fontes oficiais da Câmara em 24/09/2026.

| Fato | Valor persistido | Semântica |
| --- | ---: | --- |
| Licitação | Concorrência 2/2023 | processo e disputa de origem |
| Proposta/adjudicação do item | R$ 49.085.672,00 | resultado do item; não é pagamento |
| Contrato original | R$ 49.085.672,00 | valor celebrado originalmente |
| Contrato atual publicado | R$ 56.677.970,58 | estado contratual após alterações; não é pagamento |
| Aditivos | 6 | instrumentos preservados individualmente |
| Empenhos explicitamente vinculados | 3 | 2024NE000930, 2025NE000973 e 2026NE000679 |
| Movimentos financeiros | 74 | liquidações e pagamentos com sinal, sem inferência por CNPJ |

Para 2024NE000930, a fonte publicou R$ 22.192.131,21 liquidados e R$ 20.326.290,63 pagos. Para 2025NE000973, publicou R$ 15.609.665,70 liquidados e R$ 14.506.731,80 pagos. A NE de 2026 ainda não tinha movimentos na página consultada. As grandezas permanecem em tabelas/campos diferentes e não são somadas como se fossem equivalentes.

## Senado — Contrato 103/2021, GESCON 5774

Reconciliação executada sobre API administrativa, portal contratual e execução SIAFI publicada pelo Senado em 24/09/2026.

| Fato | Cobertura persistida | Semântica |
| --- | ---: | --- |
| Licitação | Pregão 88/2021 | vínculo pelo número/ano oficial |
| Fornecedor | CNPJ 06.984.836/0001-54 | identidade global por documento forte |
| Itens | 7 | itens contratuais publicados pela API |
| Valor global exibido | R$ 830.702,28 | valor contratual publicado; não é pago |
| Aditivos/apostila/recebimento | 5 | `valor` mantido sem interpretar acréscimo/supressão |
| Cobranças | 101 | `valor_cobrado`; não prova pagamento |
| Documentos fiscais identificados | 100 | documento fiscal; não prova pagamento |
| Empenhos explicitamente vinculados | 32 | extraídos da página do próprio contrato |
| Execução reconciliada | 32/32 NEs | match exato por número/ano na página SIAFI do favorecido |

O endpoint `/contratos/5774/pagamentos` respondeu `[]`, enquanto o portal publicou 101 cobranças. O lote registra `empty_but_portal_has_data` e conserva ambos os raws. O total cobrado observado foi R$ 4.838.403,49. A execução oficial agregada das 32 NEs publicou R$ 4.805.753,49 empenhados, liquidados e pagos. A coincidência entre os três agregados não transforma cobranças em pagamentos: cada valor conserva sua fonte e natureza.

A página financeira por NE informa que seus agregados incluem o exercício de emissão e restos a pagar posteriores, sem separar o ano de cada movimento. O collector registra essa limitação no payload e não inventa datas de movimento. O detalhamento documental do SIAFI ainda é necessário para decompor exercício e estornos individualmente.

## Integridade

- Upserts usam chaves naturais da fonte e permanecem idempotentes.
- Nenhum pagamento é inferido de contrato, aditivo, cobrança, nota fiscal ou CNPJ.
- `PRAGMA foreign_key_check` retornou zero violações depois das duas fixtures.
- Fontes agregadas duplicadas não são somadas: quando a execução SIAFI é publicada, o agregado preliminar do portal deixa de ser um movimento financeiro ativo e permanece no raw auditável.

## Auditoria documental da execu??o do Senado ? 24/09/2026

A auditoria abriu as 32 p?ginas de NE e 86 documentos financeiros relacionados da fixture 5774. A liga??o reversa do documento ? NE foi exigida antes de qualquer granulariza??o. Sete NEs apresentaram documentos relacionados cuja soma n?o reconciliava com o total oficial da pr?pria NE; esses documentos ficaram como evid?ncia raw e n?o viraram movimentos som?veis.

O lote final conserva 32 totais de empenho, 32 de liquida??o e 32 de pagamento, todos reconciliados em R$ 4.805.753,49. Como o agregado n?o prova qual parcela ? resto a pagar, `restos_a_pagar` n?o ? afirmado; a limita??o fica em `movement_kind` e no payload. O run `1df15024-102d-427c-adc2-00d149803b7b` realizou 123 requests, persistiu 96 fatos financeiros e registrou sete conflitos de granularidade. A decomposi??o por data e exerc?cio s? ? publicada quando os documentos relacionados reconciliam exatamente com o total agregado.
