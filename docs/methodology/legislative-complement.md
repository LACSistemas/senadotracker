# Complemento legislativo F2

O complemento não substitui os lotes canônicos de cadastro, proposições e votos. Cada registro informa `kind`, chave externa, pessoa, matéria, deliberação, órgão, instante, valor literal, URL oficial e objeto bruto. A chave do lote impede que a mesma ocorrência seja contada duas vezes.

| Casa | Fonte | Fato canônico | Uso complementar | Cobertura atual |
| --- | --- | --- | --- | --- |
| Senado | `ListaVotacoes2026.json` | votação plenária e votos | comparar com rota individual | ano de 2026 |
| Senado | `/senador/5672/votacoes` | voto de um senador | reconciliação, sem nova contagem | amostra 5672 |
| Senado | `/votacaoComissao/parlamentar/5672` | votação em comissão | universo separado de Plenário | 225 votações retornadas |
| Senado | `/materia/*/155842` | detalhes da matéria | autoria, relatoria, emenda, movimentação e situação | uma matéria rastreável |
| Senado | `/senador/5672/{cargos,comissoes,liderancas}` | funções | confirmar dimensões separadas | amostra 5672 |
| Câmara | arquivos anuais | votação, proposição, autoria e órgão | fonte canônica de volume | 2026/L57 |
| Câmara | `/votacoes/2611313-31/orientacoes` | orientação de liderança | fato separado do voto individual | uma votação, 15 linhas |
| Câmara | `/proposicoes/2611313/{temas,tramitacoes}` | tema e andamento | histórico apensado à proposição | um projeto, 1 tema/32 tramitações |
| Câmara | `/orgaos/4/membros` | composição atual | reconciliar função e intervalo | 15 membros |

Orientação de bancada não é voto. Voto de comissão não entra em presença ou participação de Plenário. A tramitação mais recente não apaga as anteriores. Uma amostra comprova o contrato e a execução, mas sua contagem não representa cobertura completa da Casa.
