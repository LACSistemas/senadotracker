# Ingestão institucional

A biblioteca comum dos coletores institucionais separa transporte, evidência raw, normalização e publicação. `InstitutionalHttp` aceita apenas hosts oficiais, aplica timeout, limite de bytes, intervalo por requisição, retry exponencial e `Retry-After`. Respostas vazias, HTML no lugar de JSON e payloads incompatíveis falham antes da publicação.

Os parsers comuns preservam moeda como inteiro escalado, datas inválidas como ausência, movimentos de anulação/estorno com sinal negativo, identificadores como texto e chaves compostas sem concatenação ambígua. Cada resposta completa é gravada em `raw_objects` antes das entidades normalizadas. Checkpoints e métricas registram retomada, contagens, órfãos, conflitos, requests, retries, bytes e cobertura temporal.

## CLI

Os comandos institucionais aceitam `--year`, `--from`, `--to`, `--resume`, `--dry-run`, `--force`, `--limit` e `--concurrency`. A coleta base da Câmara está conectada por:

```powershell
npm run collector -- collect-chamber-procurement --year 2026 --dry-run --limit 10
npm run collector -- collect-chamber-procurement --year 2026 --resume
```

`--dry-run` valida e mantém o checkpoint pendente; ele nunca conta como publicação concluída. `--resume` pula somente escopos publicados com sucesso. `--force` refaz a leitura e executa upsert pelas chaves oficiais.

## Câmara 2026

Publicação validada em 23/09/2026: 123 licitações, 120 pedidos, 824 linhas de itens, 343 propostas e 50 contratos. Os cinco arquivos permanecem como conjuntos independentes e ativos. `source_file_year` é metadado; ano do fato vem da linha. Valores estimados, propostos, adjudicados, originais e totais publicados ficam em campos distintos. Nenhum deles é promovido a pagamento.

## Backfill histórico da Câmara

O intervalo 2001–2026 foi executado em 130 escopos com checkpoint (26 anos × cinco conjuntos). O acervo normalizado resultante contém 4.802 licitações, 4.887 pedidos, 21.215 itens, 33.958 propostas, 13.583 resultados/adjudicações e 2.181 contratos. Contratos repetidos nos arquivos anuais foram consolidados por `(anoContrato, numContrato, tipoContrato)`: há zero chaves duplicadas e zero violações de FK.

Alguns arquivos antigos contêm contratos, itens ou propostas cuja licitação não aparece no catálogo anual correspondente. Nesses casos o registro raw é publicado, a ausência é contabilizada e a FK fica nula; o coletor não fabrica a relação. Divergências do mesmo registro entre snapshots incrementam `value_conflicts` e permanecem auditáveis por lote.

## Enriquecimento contratual e financeiro

Os comandos abaixo resolvem detalhes somente para contratos selecionados ou pendentes. A fila é incremental: um detalhe já coletado só volta a ser buscado quando o registro-base muda ou com `--force`.

```powershell
npm run collector -- collect-chamber-contract-details --ids 2024:98:Contrato
npm run collector -- collect-chamber-financial-execution --force
npm run collector -- collect-senate-contract-details --ids 5774
npm run collector -- collect-senate-financial-execution --ids 5774
```

Na Câmara, a execução parte exclusivamente das NEs que a página do contrato vincula explicitamente. No Senado, a API de pagamentos é comparada ao portal: resposta vazia recebe estado próprio e aciona fallback oficial. `PagamentoDto.valor_cobrado` e os valores do portal são cobranças; pago só nasce da coluna oficial de execução SIAFI da mesma NE.

As fixtures completas e suas limitações estão em [institutional-procurement-fixtures.md](../reconciliation/institutional-procurement-fixtures.md).

## Cobertura-base do Senado

A publicação integral validada em 24/09/2026 usa o CSV oficial de empresas, evitando a paginação instável do endpoint JSON: 2.929 empresas, 555 contratos no recorte 2026, 2.758 licitações no catálogo, 348 notas de empenho com força de contrato e 50 atas de registro de preços. O PCA oficial acrescentou 766 itens de 2023–2026 e o retrato de penalidades de 2026 acrescentou 11 sanções vigentes/publicadas. PCA permanece planejamento e sanção permanece fato cadastral; nenhum dos dois alimenta valor contratado ou pago.

O detalhe de contratos consulta itens, aditivos, garantias, cobranças, documentos fiscais e empenhos vinculados. Endpoints auxiliares `404` ficam como `unavailable`, listas vazias como `api_empty` e divergência com o portal como `empty_but_portal_has_data`. O objeto `PagamentoDto` é persistido como cobrança/faturamento; `valor_cobrado` jamais cria movimento financeiro. Atas preservam itens e acionamentos em entidades próprias. A reexecução atualiza pelas chaves oficiais e não duplica filhos.

## PNCP

`collect-pncp-enrichment --from AAAA-MM-DD --to AAAA-MM-DD` consulta contratos por atualização, separadamente para os CNPJs institucionais da Câmara e do Senado. O vínculo local exige uma combinação única de Casa, ano, número exato do contrato e CNPJ/CPF válido do fornecedor. Âncora, primeiro candidato ou semelhança nominal não são usados. O payload PNCP conserva `valorInicial`, `valorGlobal`, `valorAcumulado` e demais campos com sua semântica contratual; nenhum deles prova liquidação ou pagamento.

O PNCP é não bloqueante. Na amostra real de 20 a 24/09/2026 executada em 24/09/2026, `/api/consulta/v1/contratos/atualizacao` respondeu `422` para as duas Casas. Os checkpoints ficaram `pending`, os lotes principais das Casas permaneceram publicados e nenhum conjunto vazio foi inferido. O job pode ser reexecutado quando a API se recuperar.

## Reconcilia??o documental SIAFI do Senado

Linhas anuais s?o consolidadas pelo n?mero completo da NE antes do v?nculo. O coletor abre a NE e cada documento relacionado, valida a liga??o reversa e compara a soma l?quida por fase ao total oficial. S? substitui um agregado por movimentos datados quando a rela??o ? inequ?voca e a soma fecha exatamente; diverg?ncias incrementam `value_conflicts` e permanecem no raw. Agregados n?o recebem data, exerc?cio do movimento ou flag de restos a pagar inventados.

## Backfill financeiro por exercicio

O fluxo anual parte da evidencia financeira do exercicio e somente depois tenta
resolver favorecido, nota de empenho e contrato. Assim, uma execucao de 2026
continua publicada quando o contrato ou a NE nasceu em outro ano.

```powershell
npm run collector -- collect-chamber-financial-year --year 2026 --resume
npm run collector -- collect-senate-financial-year --year 2026 --resume
npm run collector -- rebuild-supplier-aggregates
```

Os dois comandos aceitam `--dry-run`, `--force`, `--limit` e `--ids`. Cada
execucao grava raw antes da normalizacao, hash do payload, checkpoint por Casa
e exercicio e metricas de requests, bytes, erros, registros descobertos e
registros publicados. Repeticoes usam chaves oficiais e upsert idempotente;
`--resume` somente pula um escopo com checkpoint `complete`.

`occurred_at` e `movement_year` vem da linha de pagamento. `commitment_year`
vem do ano da NE; `restos_a_pagar` so e marcado quando a fonte explicita isso.
Estorno e anulacao mantem sinal negativo. Contrato, empenho, liquidacao,
cobranca e pagamento continuam fases distintas. O resultado de 2026 pode ser
reexecutado para outros anos sem alterar a semantica, mas o historico completo
deve ser planejado por volume antes de ser executado.
