# Senado: mandatos, exercício e filiação

Validado em 08/09/2026. Escopo: T011. Usar em conjunto com [cadastro](senado-cadastro.md) e [contrato de identidade](../methodology/identity.md).

## Rotas testadas

| URL HTTPS, método GET | Resultado | Evidência |
| --- | --- | --- |
| `https://legis.senado.leg.br/dadosabertos/senador/5672/mandatos.json` | 200, JSON, serviço 5 | [Mandatos](../../tests/fixtures/sources/senado-mandatos.json) |
| `https://legis.senado.leg.br/dadosabertos/senador/5936/mandatos.json` | 200, JSON, serviço 5 | [Suplência](../../tests/fixtures/sources/senado-suplente-mandatos.json) |
| `https://legis.senado.leg.br/dadosabertos/senador/5672/filiacoes.json` | 200, JSON, serviço 5 | [Filiações](../../tests/fixtures/sources/senado-filiacoes.json) |

Proveniências de mesmo nome, com sufixo `.provenance.json`, registram instante UTC, bytes e hash integral. O [OpenAPI oficial](https://legis.senado.leg.br/dadosabertos/v3/api-docs) documenta `codigo` obrigatório e `v` opcional, padrão 5 para mandatos/filiações. Não há parâmetro de paginação nessas rotas. JSON observado em UTF-8; XML/CSV anunciados, não testados.

## Mandato não é exercício

Raiz `MandatoParlamentar.Parlamentar`: identidade em `Codigo` e `Nome`; coleção `Mandatos.Mandato`. Cada mandato contém `CodigoMandato`, `UfParlamentar`, `DescricaoParticipacao`, legislaturas e `Exercicios.Exercicio`.

`PrimeiraLegislaturaDoMandato` e `SegundaLegislaturaDoMandato` trazem `NumeroLegislatura`, `DataInicio` e `DataFim`. São períodos institucionais; não provam que a pessoa exerceu o cargo todos os dias desse intervalo.

Cada exercício tem `CodigoExercicio` e `DataInicio`. `DataFim`, `SiglaCausaAfastamento` e `DescricaoCausaAfastamento` podem estar ausentes. No [recorte de cadastro](../../tests/fixtures/sources/senado-lista.json), parlamentar 6336 possui exercícios encerrados, como 3083 (`2025-02-01` a `2025-02-03`, causa `AFO`), e outro sem fim informado. A ordem da lista não é necessariamente crescente; preservar a ordem original e ordenar explicitamente para consultas.

Suplência é uma relação: para parlamentar 5936, mandato 545, condição `1º Suplente`, `Titular.CodigoParlamentar=751` e início de exercício `2020-11-03`. Não atribuir a ele o início institucional `2019-02-01`. `Suplentes.Suplente` pode enumerar outras pessoas sem evidenciar exercício por elas.

Chaves candidatas conservadoras: `(senado, CodigoParlamentar, CodigoMandato)` para a participação individual no mandato e `(senado, CodigoParlamentar, CodigoExercicio)` para o exercício. Não presumir que o identificador do mandato seja exclusivo de uma pessoa ou já represente sozinho uma cadeira compartilhada; confirmar essa relação com amostras adicionais antes de normalizar cadeiras.

## Filiações

Raiz `FiliacaoParlamentar.Parlamentar`, identidade em `Codigo`, coleção `Filiacoes.Filiacao`. Cada entrada traz `Partido.CodigoPartido`, `SiglaPartido`, `NomePartido`, `DataFiliacao` e, quando disponível, `DataDesfiliacao`.

Para 5672, a amostra mostra UNIÃO de `2022-02-24` até `2025-11-10`, seguida de REPUBLICANOS a partir de `2025-11-12`, sem fim informado. Não preencher o dia intermediário por inferência. Há registros anteriores ao mandato no Senado: não presumir que a coleção esteja limitada aos dias de exercício.

`Mandato.Partidos.Partido` também informa filiações, mas usa `Sigla`/`Nome` em vez de `SiglaPartido`/`NomePartido`. O adaptador deve mapear cada rota explicitamente. Para a linha do tempo partidária, priorizar o serviço de filiações; divergência com a identificação atual será registrada para revisão.

## Limites temporais e operacionais

Datas são civis `YYYY-MM-DD`, sem hora/fuso. Preservar os limites oficiais; a inclusividade de `DataFim` para indicadores diários precisa de validação própria antes de T080. Ausência de fim significa “fim não informado”, não prova ilimitada de exercício ou filiação atual.

As amostras cobrem poucos parlamentares, não toda a história. Licenças têm serviço adicional indicado pelo detalhe (`/senador/{codigo}/licencas`); sua semântica não foi validada aqui e permanece necessária para indicadores de presença. Sem autenticação nas chamadas testadas; limites, licença de redistribuição e SLA não confirmados. Coleta diária de cadastro e reconciliação semanal do histórico são decisões propostas, não frequência garantida pelo Senado.
