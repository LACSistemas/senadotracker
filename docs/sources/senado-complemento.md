# Senado — fontes complementares

Verificado em 08/09/2026 no OpenAPI e em respostas oficiais. A rota individual atualizada do senador 5672 retornou 59 votações de 2026. Elas coincidiram com as 59 votações do arquivo anual em identificador, data e voto individual, sem divergências.

`/votacaoComissao/parlamentar/5672.json` retornou 225 votações. `CodigoVotacao` identifica a votação; `CodigoColegiado` identifica a comissão; cada `Voto` preserva `CodigoParlamentar`, `QualidadeVoto` e indicador de voto do presidente. Após restringir aos IDs publicados e remover 39 repetições exatas de `(votação, parlamentar)`, o lote guarda 3.059 votos em comissão. Esse universo não é somado ao Plenário.

A matéria 155842 foi consultada em detalhe e pelas rotas de autoria, relatorias, emendas, movimentações e situação atual. Os estados e coleções integrais ficam no objeto bruto; cada rota tem um registro complementar próprio. A rota de lideranças do senador também foi armazenada. Os serviços antigos anunciam depreciação e rotas sucessoras, que deverão ser adotadas antes de ampliar a amostra.
